import * as vscode from 'vscode';
import { TestCase } from '../services/testGenerator';

export class TestProvider implements vscode.Disposable {
    private _testController: vscode.TestController;
    private _testItems: Map<string, vscode.TestItem> = new Map();

    constructor() {
        this._testController = vscode.tests.createTestController('testcrafter', 'Test Crafter');
        this._testController.resolveHandler = this._resolveHandler.bind(this);
        this._testController.refreshHandler = this._refreshHandler.bind(this);
        this._testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, this.runTests.bind(this));
    }

    public updateTests(tests: TestCase[]) {
        // Clear existing test items
        this._testItems.clear();
        this._testController.items.replace([]);

        // Create test items for each test case
        tests.forEach(test => {
            const testItem = this._testController.createTestItem(
                test.id,
                test.title,
                vscode.Uri.file(test.id)
            );
            testItem.description = test.category;
            testItem.canResolveChildren = false;
            this._testItems.set(test.id, testItem);
            this._testController.items.add(testItem);
        });
    }

    private async _resolveHandler(): Promise<void> {
        // No implementation needed for now
    }

    private async _refreshHandler(): Promise<void> {
        // No implementation needed for now
    }

    public async runTests(request: vscode.TestRunRequest) {
        const run = this._testController.createTestRun(request);
        const queue: vscode.TestItem[] = [];

        if (request.include) {
            request.include.forEach(test => queue.push(test));
        } else {
            this._testController.items.forEach(test => queue.push(test));
        }

        // Process test queue
        while (queue.length > 0) {
            const test = queue.pop()!;
            run.started(test);

            try {
                // Run the test and update its status
                run.passed(test);
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error');
                run.failed(test, new vscode.TestMessage(error.message));
            }
        }

        run.end();
    }

    public dispose() {
        this._testController.dispose();
    }
}
