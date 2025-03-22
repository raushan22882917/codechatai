"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCaseGenerator = void 0;
class TestCaseGenerator {
    constructor(groqService) {
        this.groqService = groqService;
        this.testCases = [];
    }
    async generateTests(code, language) {
        try {
            const testCasesStr = await this.groqService.generateTestCases(code, language);
            this.testCases = this.parseTestCases(testCasesStr);
            return this.testCases;
        }
        catch (error) {
            console.error('Error generating tests:', error);
            throw error;
        }
    }
    async getTests() {
        return this.testCases;
    }
    parseTestCases(testCasesStr) {
        // Parse the AI-generated test cases into structured format
        const testCases = [];
        const testBlocks = testCasesStr.split('###');
        testBlocks.forEach((block, index) => {
            if (!block.trim())
                return;
            const lines = block.trim().split('\n');
            const name = lines[0].trim();
            const code = lines.slice(1).join('\n').trim();
            testCases.push({
                id: `test-${index + 1}`,
                name,
                code,
                status: 'pending'
            });
        });
        return testCases;
    }
}
exports.TestCaseGenerator = TestCaseGenerator;
//# sourceMappingURL=testGenerator.js.map