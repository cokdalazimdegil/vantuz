const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

module.exports = {
    /**
     * Analyzes the store name and creates a BRAND.md file.
     * @param {string} storeName - The name of the store (e.g., "TechMaster")
     * @param {Object} config - The Conf instance
     */
    async analyzeAndSave(storeName, config) {
        const spinner = ora('Yapay Zeka marka kimliğini analiz ediyor...').start();

        try {
            // Dynamic import because ai-provider is ESM
            const { default: ai } = await import('./ai-provider.js');

            // Get API configuration
            // index.js uses 'vantuz' key for plugin config, but product-manager uses 'ai'.
            // We'll inspect both or default to what's available.
            const aiConfig = config.get('ai') || {};
            const vantuzConfig = config.get('vantuz') || {};

            // Prepare environment variables for the provider
            // The AI provider expects env vars like GEMINI_API_KEY
            const env = {};
            if (aiConfig.apiKey) {
                // Guess the key name based on provider or default to OPENAI
                const provider = aiConfig.provider || 'openai';
                env[`${provider.toUpperCase()}_API_KEY`] = aiConfig.apiKey;
            } else if (process.env.OPENAI_API_KEY) {
                env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
            }

            // If no key found, we can't analyze
            if (Object.keys(env).length === 0 && !process.env.GEMINI_API_KEY) {
                spinner.warn(chalk.yellow('AI API Anahtarı bulunamadı. Marka analizi atlanıyor.'));
                return;
            }

            const prompt = `
            Analyze the store name: "${storeName}".
            Based on this name, infer:
            1. The likely Industry (Electronic, Fashion, Home, etc.)
            2. Target Audience (Young, Professional, Budget, Luxury)
            3. Brand Voice (Professional, Friendly, Tech-savvy, Traditional)
            
            Then, generate the content for a "BRAND.md" file.
            The content should look like this:
            
            # Brand Identity: ${storeName}
            
            ## Industry
            [Industry]
            
            ## Target Audience
            [Audience]
            
            ## Brand Voice
            [Voice Description]
            
            ## Communication Guidelines
            - Rule 1
            - Rule 2
            
            Return ONLY the markdown content.
            `;

            const aiOptions = {
                aiProvider: aiConfig.provider || 'openai',
                systemContext: 'You are a Brand Strategist.'
            };

            const response = await ai.chat(prompt, aiOptions, env);

            // Clean response (remove markdown code blocks if any)
            const cleanContent = response.replace(/^```markdown/, '').replace(/^```/, '').trim();

            // Setup workspace
            const workspaceDir = path.join(process.cwd(), 'workspace');
            if (!fs.existsSync(workspaceDir)) {
                fs.mkdirSync(workspaceDir, { recursive: true });
            }

            const brandPath = path.join(workspaceDir, 'BRAND.md');
            fs.writeFileSync(brandPath, cleanContent, 'utf-8');

            spinner.succeed(chalk.green('Marka kimliği oluşturuldu: workspace/BRAND.md'));

            // Show a preview
            console.log(chalk.gray('----------------------------------------'));
            console.log(cleanContent.split('\n').slice(0, 10).join('\n') + '\n...');
            console.log(chalk.gray('----------------------------------------'));

        } catch (error) {
            spinner.fail('Marka analizi başarısız.');
            console.error(chalk.red(error.message));
        }
    }
};
