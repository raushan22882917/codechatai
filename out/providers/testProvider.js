"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestProvider = void 0;
const vscode = require("vscode");
class TestProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.testCases = [];
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        return this.testCases.map(test => new TestCaseNode(test));
    }
    updateTests(tests) {
        this.testCases = tests;
        this._onDidChangeTreeData.fire();
    }
    async runAllTests() {
        for (const test of this.testCases) {
            try {
                const document = await vscode.workspace.openTextDocument({
                    content: test.code,
                    language: 'javascript'
                });
                await vscode.workspace.saveAll();
                const result = await vscode.commands.executeCommand('workbench.action.tasks.test');
                test.status = 'passed';
            }
            catch (error) {
                test.status = 'failed';
                test.error = error instanceof Error ? error.message : 'Unknown error';
            }
        }
        this._onDidChangeTreeData.fire();
    }
}
exports.TestProvider = TestProvider;
class TestCaseNode extends vscode.TreeItem {
    constructor(test) {
        super(test.name, vscode.TreeItemCollapsibleState.None);
        this.test = test;
        this.tooltip = test.code;
        this.description = test.status;
        switch (test.status) {
            case 'passed':
                this.iconPath = new vscode.ThemeIcon('pass');
                break;
            case 'failed':
                this.iconPath = new vscode.ThemeIcon('error');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('testing-unset-icon');
        }
        this.command = {
            command: 'testcrafter.viewTest',
            title: 'View Test',
            arguments: [test]
        };
    }
}
//# sourceMappingURL=testProvider.js.map