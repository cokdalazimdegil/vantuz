const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { table } = require('table');
const { Product, Store } = require('./database');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// AI Konfigürasyonunu yükle
const Config = require('conf');
const conf = new Config({ projectName: 'vantuz' });

module.exports = {
    async manageProducts() {
        console.log(chalk.bold('\n🛍️  VANTUZ Ürün Merkezi\n'));

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'İşlem Seçiniz:',
                choices: [
                    { name: '👁️  AI Vision: Fotoğraftan Ürün Ekle', value: 'vision_add' },
                    { name: '📋 Ürün Listesi', value: 'list' },
                    { name: '🔙 Geri Dön', value: 'back' }
                ]
            }
        ]);

        if (action === 'vision_add') await this.visionAdd();
        else if (action === 'list') await this.listProducts();
    },

    async visionAdd() {
        // AI Config Kontrolü
        const aiConfig = conf.get('ai');
        if (!aiConfig || !aiConfig.apiKey) {
            console.log(chalk.red('\n❌ AI Vision özelliği için API Anahtarı gerekli.'));
            console.log(chalk.yellow('Lütfen ana menüden "Ayarlar > AI Konfigürasyon" kısmından OpenAI API Key giriniz.\n'));
            await inquirer.prompt([{type: 'input', name: 'c', message: 'Devam...' }]);
            return;
        }

        console.log(chalk.magenta('\n👁️  AI Vision Modu Aktif'));
        
        const { imagePath } = await inquirer.prompt([
            { type: 'input', name: 'imagePath', message: 'Fotoğraf Dosya Yolu (Örn: /home/user/gomlek.jpg):' }
        ]);

        if (!fs.existsSync(imagePath)) {
            console.log(chalk.red('❌ Dosya bulunamadı!'));
            return;
        }

        const spinner = ora('Görsel taranıyor ve analiz ediliyor...').start();

        try {
            // OpenAI Vision API İsteği
            const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
            const dataUrl = `data:image/jpeg;base64,${base64Image}`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o", // Vision destekli model
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Bu ürünün bir e-ticaret sitesi için satış başlığını, SEO uyumlu açıklamasını, kategorisini (Trendyol ağacı) ve tahmini piyasa fiyatını (TRY) JSON formatında ver. Örnek: {title, description, category, price}" },
                            { type: "image_url", image_url: { url: dataUrl } }
                        ]
                    }
                ],
                max_tokens: 500
            }, {
                headers: {
                    'Authorization': `Bearer ${aiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            spinner.succeed('Analiz Tamamlandı!');
            
            // Yanıtı temizle ve parse et (JSON bloğunu ayıkla)
            let content = response.data.choices[0].message.content;
            content = content.replace(/```json/g, '').replace(/```/g, ''); // Markdown temizliği
            const analysis = JSON.parse(content);

            console.log(chalk.cyan('\n🔍 AI Tespiti:'));
            console.log(`📌 Başlık: ${analysis.title}`);
            console.log(`📄 Açıklama: ${analysis.description.substring(0, 100)}...`);
            console.log(`📂 Kategori: ${analysis.category}`);
            console.log(`💰 Tahmini Fiyat: ${analysis.price} TL\n`);

            const { confirm } = await inquirer.prompt([
                { type: 'confirm', name: 'confirm', message: 'Bu bilgilerle ürün oluşturulsun mu?' }
            ]);

            if (confirm) {
                await Product.create({
                    name: analysis.title,
                    description: analysis.description,
                    images: [imagePath], // Gerçekte S3/Cloud upload gerekir
                    marketData: { trendyol: { price: analysis.price, stock: 0 } }
                });
                console.log(chalk.green('✅ Ürün veritabanına eklendi!'));
            }

        } catch (error) {
            spinner.fail('Analiz Hatası');
            console.error(chalk.red(error.message));
            if (error.response) console.error(chalk.red(JSON.stringify(error.response.data)));
        }
        
        await inquirer.prompt([{type: 'input', name: 'c', message: 'Devam...' }]);
    },

    async listProducts() {
        const products = await Product.findAll();
        if (products.length === 0) {
            console.log(chalk.yellow('Kayıtlı ürün yok.'));
            return;
        }

        const data = [['ID', 'Ürün Adı', 'Fiyat']];
        products.forEach(p => {
            const price = p.marketData?.trendyol?.price || 0;
            data.push([p.id, p.name, price + ' TL']);
        });

        console.log(table(data));
        await inquirer.prompt([{type: 'input', name: 'c', message: 'Devam...' }]);
    }
};
