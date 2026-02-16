// core/vision-service.js
// Decoupled Vision AI Service
// Extracted from plugins/vantuz/tools/vision.js for API/Gateway access.
// Can be called from CLI, API endpoint, or Warehouse Node.

import axios from 'axios';
import fs from 'fs';
import { log } from './ai-provider.js';

/**
 * Analyze a product image and return structured data.
 * Accepts: file path, URL, or raw Base64 string.
 *
 * @param {string} imageInput - File path, URL, or base64 data URI.
 * @param {object} aiConfig - { apiKey, baseUrl?, model? }
 * @returns {object} { detected, confidence, attributes, suggestedPrice, seo_keywords }
 */
export async function analyzeProductImage(imageInput, aiConfig) {
    if (!aiConfig?.apiKey) {
        throw new Error('AI API anahtarı gerekli (aiConfig.apiKey)');
    }

    // Normalize image to base64 data URI
    let imageData = imageInput;

    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        log('INFO', 'Vision: Downloading image from URL...');
        const response = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 15000 });
        imageData = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
    } else if (imageInput.startsWith('data:')) {
        // Already a data URI
        imageData = imageInput;
    } else if (fs.existsSync(imageInput)) {
        log('INFO', 'Vision: Reading local file...');
        const buffer = fs.readFileSync(imageInput);
        imageData = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } else {
        // Assume raw base64 string
        imageData = `data:image/jpeg;base64,${imageInput}`;
    }

    const model = aiConfig.model || 'gpt-4o';
    const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';

    log('INFO', `Vision: Analyzing with ${model}...`);

    const response = await axios.post(`${baseUrl}/chat/completions`, {
        model,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Bu ürün fotoğrafını analiz et. JSON formatında yanıt ver:
{
  "detected": "Ürün tipi",
  "confidence": 0.95,
  "attributes": {
    "color": "Renk",
    "material": "Malzeme",
    "style": "Stil",
    "pattern": "Desen",
    "condition": "Durum (yeni/kullanılmış/hasarlı)"
  },
  "suggestedPrice": { "min": 100, "max": 200, "optimal": 149 },
  "seo_keywords": ["anahtar1", "anahtar2"],
  "defects": "Görünür hasar/kusur varsa açıkla, yoksa null"
}`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: imageData }
                    }
                ]
            }
        ],
        max_tokens: 1000
    }, {
        headers: {
            'Authorization': `Bearer ${aiConfig.apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        log('INFO', 'Vision: Analysis complete', { detected: result.detected });
        return result;
    }

    throw new Error('AI Vision yanıtı parse edilemedi');
}

/**
 * Quick damage check for returns.
 * @param {string} imageInput - Image path/URL/base64.
 * @param {object} aiConfig - AI config.
 * @returns {object} { isDamaged, severity, description }
 */
export async function checkReturnDamage(imageInput, aiConfig) {
    const analysis = await analyzeProductImage(imageInput, aiConfig);
    return {
        isDamaged: !!analysis.defects,
        severity: analysis.defects ? 'check_required' : 'ok',
        condition: analysis.attributes?.condition || 'unknown',
        description: analysis.defects || 'Görünür hasar tespit edilmedi.',
        fullAnalysis: analysis
    };
}
