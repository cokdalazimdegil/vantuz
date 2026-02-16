const axios = require('axios');

module.exports = {
    async analyze(data, config) {
        if (!config.ai || !config.ai.apiKey) {
            throw new Error('AI yapılandırması eksik. Ayarlardan API anahtarınızı girin.');
        }

        const prompt = `
Sen OmniMarket AI'ın uzman e-ticaret analistisin.
Aşağıdaki e-ticaret verilerini analiz et ve mağaza sahibine 3 adet kritik, eyleme dönüştürülebilir öneri sun.
Yanıtın kısa, net ve profesyonel olsun. Türkçe yanıt ver.

Veriler:
${JSON.stringify(data, null, 2)}
        `;

        try {
            const baseURL = config.ai.baseUrl || 'https://api.openai.com/v1';
            const model = config.ai.model || 'gpt-4-turbo';
            
            // Generic OpenAI Compatible Endpoint Support (Works with DeepSeek, OpenAI, LocalAI)
            const response = await axios.post(`${baseURL}/chat/completions`, {
                model: model,
                messages: [
                    { role: 'system', content: 'Sen uzman bir e-ticaret danışmanısın.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${config.ai.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;

        } catch (error) {
            if (error.response) {
                throw new Error(`AI API Hatası: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
};
