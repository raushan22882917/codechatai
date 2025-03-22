import * as vscode from 'vscode';
import { TestGenerator } from '../services/testGenerator';

interface AIResponse {
    text: string;
    codeBlocks?: Array<{
        code: string;
        language: string;
    }>;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'testcrafter.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _testGenerator: TestGenerator
    ) {}

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
                case 'sendMessage': {
                    await this._handleUserMessage(data.message);
                    break;
                }
                case 'acceptCode': {
                    await this._handleAcceptCode(data.code);
                    break;
                }
                case 'rejectCode': {
                    await this._handleRejectCode(data.code);
                    break;
                }
            }
        });
    }

    private async _handleUserMessage(message: string) {
        try {
            // Get current editor content for context
            const editor = vscode.window.activeTextEditor;
            const fileContent = editor?.document.getText() || '';
            const fileName = editor?.document.fileName || '';
            const language = editor?.document.languageId || '';

            // Send typing indicator
            this._view?.webview.postMessage({
                type: 'setTyping',
                value: true
            });

            // Process the message and generate response
            const response = await this._generateResponse(message, fileContent, fileName, language);

            // Send response back to webview
            this._view?.webview.postMessage({
                type: 'receiveMessage',
                message: {
                    type: 'assistant',
                    content: response.text,
                    timestamp: new Date().toLocaleTimeString(),
                    codeBlocks: response.codeBlocks
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to process message: ${errorMessage}`);
        } finally {
            // Stop typing indicator
            this._view?.webview.postMessage({
                type: 'setTyping',
                value: false
            });
        }
    }

    private async _generateResponse(
        userMessage: string,
        fileContent: string,
        fileName: string,
        language: string
    ): Promise<AIResponse> {
        // Check if the message is requesting test generation
        if (userMessage.toLowerCase().includes('generate test') || 
            userMessage.toLowerCase().includes('create test')) {
            try {
                const tests = await this._testGenerator.generateTests(fileContent, language);
                return {
                    text: 'I\'ve generated some test cases for your code:',
                    codeBlocks: tests.map(test => ({
                        code: test.code,
                        language: language
                    }))
                };
            } catch (error) {
                throw new Error('Failed to generate tests: ' + error);
            }
        }

        // Check if the message is asking for code analysis
        if (userMessage.toLowerCase().includes('analyze') || 
            userMessage.toLowerCase().includes('review')) {
            return {
                text: `Here's my analysis of ${fileName}:\n\n` +
                      'The code appears to be well-structured. Here are some suggestions:',
                codeBlocks: [{
                    code: '// Consider adding error handling\ntry {\n    // Your code\n} catch (error) {\n    // Handle error\n}',
                    language: language
                }]
            };
        }

        // Default response for other types of messages
        return {
            text: 'I can help you with code analysis and test generation. ' +
                  'Try asking me to "analyze this code" or "generate tests".',
            codeBlocks: []
        };
    }

    private async _handleAcceptCode(code: string) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await editor.edit(editBuilder => {
                    // Insert the code at the current cursor position
                    const position = editor.selection.active;
                    editBuilder.insert(position, code);
                });
                vscode.window.showInformationMessage('Code inserted successfully');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to insert code: ${errorMessage}`);
        }
    }

    private async _handleRejectCode(code: string) {
        // Log rejected code for future improvements
        console.log('Code suggestion rejected:', code);
        vscode.window.showInformationMessage('Code suggestion rejected');
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
                <title>AI Chat</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
