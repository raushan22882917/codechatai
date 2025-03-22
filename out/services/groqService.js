"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqService = void 0;
const vscode = require("vscode");
const axios_1 = require("axios");
const dotenv = require("dotenv");
const path = require("path");
class GroqService {
    constructor() {
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.model = 'llama-3.3-70b-versatile';
        // Load environment variables from .env file
        const envPath = path.join(__dirname, '..', '..', '.env');
        dotenv.config({ path: envPath });
    }
    getApiKey() {
        // First try to get from VS Code settings
        const config = vscode.workspace.getConfiguration('verichat');
        let apiKey = config.get('groqApiKey');
        // If not in settings, try environment variable
        if (!apiKey) {
            apiKey = process.env.GROQ_API_KEY;
        }
        if (!apiKey) {
            throw new Error('Groq API key not found. Please set it in VS Code settings or .env file');
        }
        return apiKey;
    }
    async makeRequest(messages) {
        try {
            const response = await axios_1.default.post(this.apiUrl, {
                model: this.model,
                messages
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getApiKey()}`
                }
            });
            if (response.data.error) {
                throw new Error(`Groq API error: ${response.data.error.message}`);
            }
            return response.data.choices[0].message.content;
        }
        catch (error) {
            console.error('Groq API error:', error);
            if (error.response?.data?.error) {
                throw new Error(`Groq API error: ${error.response.data.error.message}`);
            }
            throw new Error('Failed to communicate with Groq API: ' + error.message);
        }
    }
    async generateTestCases(code, language) {
        const prompt = `Generate comprehensive test cases for the following ${language} code. Include edge cases and error scenarios. Format the output as follows:

### Test Case 1: [Brief description]
[Test code]

### Test Case 2: [Brief description]
[Test code]

And so on. Focus on:
1. Happy path scenarios
2. Edge cases
3. Error conditions
4. Boundary values
5. Integration points

Code to test:
\`\`\`${language}
${code}
\`\`\``;
        return this.makeRequest([
            { role: 'system', content: 'You are a test generation expert. Generate practical, comprehensive test cases that cover all important scenarios.' },
            { role: 'user', content: prompt }
        ]);
    }
    async getCodeSuggestions(code, position) {
        const prompt = `Analyze this code and provide intelligent code suggestions at position ${position.line}:${position.character}. Consider the context and best practices.

Code:
\`\`\`
${code}
\`\`\``;
        const response = await this.makeRequest([
            { role: 'system', content: 'You are an expert code assistant. Provide practical, context-aware code suggestions.' },
            { role: 'user', content: prompt }
        ]);
        try {
            // Parse the response into structured suggestions
            const suggestions = response.split('\n')
                .filter((line) => line.trim())
                .map((line) => {
                const [text, ...detailParts] = line.split(' - ');
                return {
                    text: text.trim(),
                    detail: detailParts.join(' - ').trim()
                };
            });
            return suggestions;
        }
        catch (error) {
            console.error('Error parsing suggestions:', error);
            return [];
        }
    }
    async getChatResponse(messages) {
        return this.makeRequest(messages);
    }
    async getDebugSuggestions(code, error) {
        const prompt = `Debug this code and provide suggestions for fixing the error:

Error:
${error}

Code:
\`\`\`
${code}
\`\`\`

Please provide:
1. Analysis of the error
2. Potential fixes
3. Best practices to prevent similar issues`;
        return this.makeRequest([
            { role: 'system', content: 'You are an expert debugger. Analyze code issues and provide clear, actionable solutions.' },
            { role: 'user', content: prompt }
        ]);
    }
}
exports.GroqService = GroqService;
//# sourceMappingURL=groqService.js.map