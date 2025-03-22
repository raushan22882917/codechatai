import * as vscode from 'vscode';
import { TestCase } from '../services/testGenerator';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'testcrafter.testView';
    private _view?: vscode.WebviewView;
    private _tests: TestCase[] = [];
    private _autoDetectEnabled: boolean = false;
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _currentFile?: string;
    private _debounceTimer?: NodeJS.Timeout;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _testGenerator: any,
        private readonly _testRunner: any
    ) {
        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this._updateCurrentFile();
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'generateTests': {
                    await this._generateTests();
                    break;
                }
                case 'runTests': {
                    await this._runTests();
                    break;
                }
                case 'acceptTest': {
                    const testId = data.testId;
                    const test = this._tests.find(t => t.id === testId);
                    if (test) {
                        test.status = 'accepted';
                        this._view?.webview.postMessage({
                            type: 'testsUpdated',
                            tests: this._tests
                        });
                    }
                    break;
                }
                case 'rejectTest': {
                    const testId = data.testId;
                    const test = this._tests.find(t => t.id === testId);
                    if (test) {
                        test.status = 'rejected';
                        this._view?.webview.postMessage({
                            type: 'testsUpdated',
                            tests: this._tests
                        });
                    }
                    break;
                }
                case 'toggleAutoDetect': {
                    this._handleAutoDetectToggle(data.enabled);
                    break;
                }
            }
        });

        // Initialize with welcome message
        this._updateStatus('Welcome to Test Crafter! Enable auto-detect or click "Generate Tests" to get started.');
    }

    private async _generateTests() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        try {
            this._updateStatus('Generating tests...', true);

            const tests = await this._testGenerator.generateTests(
                editor.document.getText(),
                editor.document.languageId
            );
            this._tests = tests;

            this._view?.webview.postMessage({
                type: 'testsUpdated',
                tests: tests
            });

            this._updateStatus('Tests generated successfully', false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this._updateStatus(`Error: ${errorMessage}`, false);
            vscode.window.showErrorMessage(`Failed to generate tests: ${errorMessage}`);
        }
    }

    private async _runTests() {
        try {
            this._updateStatus('Running tests...', true);

            await this._testRunner.runTests(this._tests);

            this._updateStatus('Tests completed', false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this._updateStatus(`Error: ${errorMessage}`, false);
            vscode.window.showErrorMessage(`Failed to run tests: ${errorMessage}`);
        }
    }

    private _handleAutoDetectToggle(enabled: boolean) {
        this._autoDetectEnabled = enabled;

        if (enabled) {
            // Set up file watcher if not already set
            if (!this._fileWatcher) {
                this._fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
                this._fileWatcher.onDidChange(uri => {
                    if (uri.fsPath === this._currentFile) {
                        // Debounce the test generation to prevent rapid updates
                        if (this._debounceTimer) {
                            clearTimeout(this._debounceTimer);
                        }
                        this._debounceTimer = setTimeout(() => {
                            this._generateTests();
                        }, 1000); // Wait 1 second after last change
                    }
                });
            }
            
            // Generate tests for current file
            if (this._currentFile && vscode.window.activeTextEditor) {
                this._generateTests();
            }

            this._updateStatus('Auto-detect enabled. Tests will be generated automatically.');
        } else {
            // Dispose file watcher
            if (this._fileWatcher) {
                this._fileWatcher.dispose();
                this._fileWatcher = undefined;
            }
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
                this._debounceTimer = undefined;
            }
            this._updateStatus('Auto-detect disabled. Click Generate Tests to manually create tests.');
        }
    }

    private _updateCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._currentFile = undefined;
            this._updateStatus('No file selected');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        if (this._currentFile !== filePath) {
            this._currentFile = filePath;
            this._updateStatus(`Current file: ${filePath}`);
            
            if (this._autoDetectEnabled) {
                this._generateTests();
            }
        }
    }

    private _updateStatus(message: string, loading: boolean = false) {
        this._view?.webview.postMessage({
            type: 'updateStatus',
            message,
            loading
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'style.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Test Cases</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
