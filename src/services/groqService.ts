import * as vscode from 'vscode';

export class GroqService {
    private apiKey: string;
    private baseUrl = 'https://api.groq.com/v1/completions';

    constructor() {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY environment variable is not set');
        }
        this.apiKey = apiKey;
    }

    async generateCompletion(prompt: string): Promise<string> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'mixtral-8x7b-32768',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a test case generator assistant. Generate test cases in JSON format based on the provided code and requirements.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 4000,
                    top_p: 1,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (err) {
            const error = err as Error;
            throw new Error(`Failed to generate test case: ${error.message}`);
        }
    }

    async generateTestCases(code: string, language: string): Promise<string> {
        const prompt = `Generate test cases for the following ${language} code:\n\n${code}`;
        return this.generateCompletion(prompt);
    }

    async getCodeSuggestions(code: string, position: vscode.Position): Promise<Array<{ text: string, detail: string }>> {
        const prompt = `Analyze this code and provide intelligent code suggestions at position ${position.line}:${position.character}. Consider the context and best practices.

Code:
\`\`\`
${code}
\`\`\``;

        const response = await this.generateCompletion(prompt);

        try {
            // Parse the response into structured suggestions
            const suggestions = response.split('\n')
                .filter((line: string) => line.trim())
                .map((line: string) => {
                    const [text, ...detailParts] = line.split(' - ');
                    return {
                        text: text.trim(),
                        detail: detailParts.join(' - ').trim()
                    };
                });

            return suggestions;
        } catch (error) {
            console.error('Error parsing suggestions:', error);
            return [];
        }
    }

    async getChatResponse(messages: { role: string, content: string }[]): Promise<string> {
        const prompt = messages.map(message => `${message.role}: ${message.content}`).join('\n');
        return this.generateCompletion(prompt);
    }

    async getDebugSuggestions(code: string, error: string): Promise<string> {
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

        return this.generateCompletion(prompt);
    }
}
