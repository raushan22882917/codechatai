"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
class WebviewProvider {
    constructor(_extensionUri, _groqService, _testGenerator) {
        this._extensionUri = _extensionUri;
        this._groqService = _groqService;
        this._testGenerator = _testGenerator;
        this._autoDetectEnabled = false;
        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this._updateCurrentFile();
        });
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this._setWebviewMessageListener(webviewView.webview);
        this._updateCurrentFile();
        // Initialize with welcome message
        this._view.webview.postMessage({
            command: 'addMessage',
            text: 'Welcome to CodeTest AI! I can help you generate and run tests for your code. Enable auto-detect or click "Generate Tests" to get started.',
            isUser: false
        });
    }
    _getHtmlForWebview(webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'panel.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');
        // Make paths absolute for the webview
        html = html.replace(/(?<=src="|href=")([^"]*)/g, (match) => {
            return webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, match)).toString();
        });
        return html;
    }
    _updateCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._currentFile = undefined;
            this._updateFileInfo();
            return;
        }
        const filePath = editor.document.uri.fsPath;
        if (this._currentFile !== filePath) {
            this._currentFile = filePath;
            this._updateFileInfo();
            if (this._autoDetectEnabled) {
                this._generateTests();
            }
        }
    }
    _updateFileInfo() {
        if (!this._view)
            return;
        this._view.webview.postMessage({
            command: 'updateFile',
            filePath: this._currentFile || ''
        });
    }
    async _setWebviewMessageListener(webview) {
        webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._handleChatMessage(message.text);
                    break;
                case 'generateTests':
                    await this._generateTests();
                    break;
                case 'runAllTests':
                    await this._handleRunTests();
                    break;
                case 'toggleAutoDetect':
                    this._handleToggleAutoDetect(message.enabled);
                    break;
            }
        });
    }
    async _handleChatMessage(text) {
        if (!this._view)
            return;
        try {
            const response = await this._groqService.getChatResponse([
                { role: 'user', content: text }
            ]);
            this._view.webview.postMessage({
                command: 'addMessage',
                text: response,
                isUser: false
            });
        }
        catch (error) {
            this._showError('Failed to get AI response: ' + error);
        }
    }
    async _generateTests() {
        if (!this._view)
            return;
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._showError('No active editor found');
            return;
        }
        try {
            this._updateStatus('Analyzing code and generating test cases...', true);
            const document = editor.document;
            const code = document.getText();
            const tests = await this._testGenerator.generateTests(code, document.languageId);
            this._view.webview.postMessage({
                command: 'updateTests',
                tests: tests
            });
            this._updateStatus('Test cases generated successfully!');
        }
        catch (error) {
            this._showError('Failed to generate tests: ' + error);
        }
    }
    async _handleRunTests() {
        if (!this._view)
            return;
        try {
            this._updateStatus('Running all tests...', true);
            const tests = await this._testGenerator.getTests();
            // Run each test
            for (const test of tests) {
                try {
                    const document = await vscode.workspace.openTextDocument({
                        content: test.code,
                        language: 'javascript' // TODO: Make this dynamic
                    });
                    await vscode.workspace.saveAll();
                    await vscode.commands.executeCommand('workbench.action.tasks.test');
                    test.status = 'passed';
                }
                catch (error) {
                    test.status = 'failed';
                    test.error = error instanceof Error ? error.message : 'Unknown error';
                }
            }
            // Update UI with test results
            this._view.webview.postMessage({
                command: 'updateTests',
                tests: tests
            });
            this._updateStatus('All tests executed!');
        }
        catch (error) {
            this._showError('Failed to run tests: ' + error);
        }
    }
    _handleToggleAutoDetect(enabled) {
        this._autoDetectEnabled = enabled;
        if (enabled) {
            // Set up file watcher if not already set
            if (!this._fileWatcher) {
                this._fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
                this._fileWatcher.onDidChange(uri => {
                    if (uri.fsPath === this._currentFile) {
                        this._generateTests();
                    }
                });
            }
            // Generate tests for current file
            if (this._currentFile) {
                this._generateTests();
            }
            this._updateStatus('Auto-detect enabled. Tests will be generated automatically.');
        }
        else {
            // Dispose file watcher
            if (this._fileWatcher) {
                this._fileWatcher.dispose();
                this._fileWatcher = undefined;
            }
            this._updateStatus('Auto-detect disabled. Click Generate Tests to manually create tests.');
        }
    }
    _showError(message) {
        vscode.window.showErrorMessage(message);
        if (this._view) {
            this._updateStatus(`Error: ${message}`);
        }
    }
    _updateStatus(message, loading = false) {
        if (!this._view)
            return;
        this._view.webview.postMessage({
            command: 'updateStatus',
            message: message,
            loading: loading
        });
    }
    updateTests(tests) {
        if (!this._view)
            return;
        this._view.webview.postMessage({
            command: 'updateTests',
            tests: tests
        });
    }
}
exports.WebviewProvider = WebviewProvider;
WebviewProvider.viewType = 'codetestai.mainView';
//# sourceMappingURL=WebviewProvider.js.map