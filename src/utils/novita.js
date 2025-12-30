const OpenAI = require('openai');

class NovitaService {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.NOVITA_API_KEY,
            baseURL: 'https://api.novita.ai/openai', // Updated to exact provided Base URL
        });
    }

    /**
     * Chat completion using Novita AI (via OpenAI SDK)
     */
    async chatCompletion(messages, options = {}) {
        if (!process.env.NOVITA_API_KEY) {
            throw new Error('NOVITA_API_KEY is not configured');
        }

        try {
            const response = await this.client.chat.completions.create({
                model: 'meta-llama/llama-3.3-70b-instruct', // Updated to Llama 3.3
                messages: messages,
                max_tokens: options.max_tokens || 1000,
                temperature: options.temperature || 0.7,
                stream: false,
            });

            return response;
        } catch (error) {
            console.error('Novita AI SDK Error:', error);
            throw new Error('Failed to communicate with Novita AI');
        }
    }

    /**
     * Analyze rental agreement text
     */
    async analyzeAgreement(text) {
        const messages = [
            {
                role: 'system',
                content: `You are a legal assistant specializing in rental property agreements. 
                Analyze the following rental agreement text. 
                Identify key obligations for the tenant, forbidden activities, and potential "red flags" or unfair terms.
                Summarize the key points in bullet points.
                Output format: Markdown.`
            },
            {
                role: 'user',
                content: text
            }
        ];

        return this.chatCompletion(messages);
    }

    /**
     * Q&A about rental agreement
     */
    async askQuestion(text, question) {
        const messages = [
            {
                role: 'system',
                content: `You are a helpful assistant. Answer the user's question based strictly on the provided Rental Agreement text. If the answer is not in the text, say so.`
            },
            {
                role: 'user',
                content: `Rental Agreement Context:\n${text}\n\nQuestion: ${question}`
            }
        ];

        return this.chatCompletion(messages);
    }
}

module.exports = new NovitaService();
