import { GroqService } from './groqService';

export interface TestCase {
    id: string;
    title: string;
    category: string;
    code: string;
    input: string;
    expectedOutput: string;
    status: 'pending' | 'passed' | 'failed' | 'accepted' | 'rejected';
    error?: string;
}

export class TestGenerator {
    private groqService: GroqService;
    private categories = [
        'Basic Test Cases',
        'Edge Case Test Cases',
        'Boundary Value Test Cases',
        'Negative Test Cases',
        'Large Input Test Cases',
        'Special Character Test Cases',
        'Null/Empty Input Test Cases',
        'Duplicate Input Test Cases',
        'Performance & Stress Test Cases',
        'Security Test Cases',
        'Dependency-Based Test Cases',
        'Randomized Test Cases',
        'Multi-Threading Test Cases',
        'Compatibility Test Cases',
        'UI/UX Test Cases',
        'API Test Cases',
        'Database Test Cases',
        'Regression Test Cases',
        'Integration Test Cases',
        'Unit Test Cases',
        'System Test Cases',
        'End-to-End (E2E) Test Cases',
        'Acceptance Test Cases',
        'Localization & Internationalization Test Cases',
        'Usability Test Cases'
    ];

    constructor() {
        this.groqService = new GroqService();
    }

    async generateTests(code: string, language: string): Promise<TestCase[]> {
        try {
            // Generate test cases for each category
            const testPromises = this.categories.map(async (category) => {
                const prompt = this.generatePrompt(code, language, category);
                const response = await this.groqService.generateCompletion(prompt);
                return this.parseResponse(response, category);
            });

            const testCases = await Promise.all(testPromises);
            return testCases.flat();
        } catch (err) {
            const error = err as Error;
            throw new Error(`Failed to generate tests: ${error.message}`);
        }
    }

    private generatePrompt(code: string, language: string, category: string): string {
        return `
Generate test cases for the following ${language} code, focusing on ${category}:

${code}

Please provide test cases in the following format:
{
    "title": "Brief description of the test case",
    "input": "Test input values",
    "expectedOutput": "Expected output or behavior",
    "code": "Complete test code that can be executed"
}

Generate up to 3 test cases for this category.`;
    }

    private parseResponse(response: string, category: string): TestCase[] {
        try {
            // Extract JSON objects from the response
            const jsonMatches = response.match(/\{[^{}]*\}/g) || [];
            
            return jsonMatches.map((jsonStr, index) => {
                const testData = JSON.parse(jsonStr);
                return {
                    id: `${category}-${index}`,
                    title: testData.title,
                    category,
                    code: testData.code,
                    input: testData.input,
                    expectedOutput: testData.expectedOutput,
                    status: 'pending'
                };
            });
        } catch (err) {
            const error = err as Error;
            console.error(`Failed to parse test cases for ${category}:`, error);
            return [];
        }
    }
}
