"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProvider = void 0;
const vscode = require("vscode");
class ChatProvider {
    constructor(context, groqService) {
        this.context = context;
        this.groqService = groqService;
        this.messages = [];
    }
    show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('testcrafterChat', 'TestCrafter Chat', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        this.panel.webview.html = this.getWebviewContent();
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.handleUserMessage(message.text);
                    break;
            }
        }, undefined, this.context.subscriptions);
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);
    }
    async handleUserMessage(text) {
        if (!this.panel)
            return;
        // Add user message to history
        this.messages.push({ role: 'user', content: text });
        try {
            // Get AI response
            const response = await this.groqService.getChatResponse(this.messages);
            this.messages.push({ role: 'assistant', content: response });
            // Update chat UI
            this.panel.webview.postMessage({
                command: 'addMessage',
                message: response,
                isUser: false
            });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to get response from AI');
        }
    }
    getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TestCrafter Chat</title>
            <style>
                body {
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                }
                #chat-container {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 120px);
                }
                #messages {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 10px;
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                }
                .message {
                    margin: 5px 0;
                    padding: 8px;
                    border-radius: 5px;
                }
                .user-message {
                    background-color: var(--vscode-editor-background);
                    margin-left: 20%;
                }
                .ai-message {
                    background-color: var(--vscode-input-background);
                    margin-right: 20%;
                }
                #input-container {
                    display: flex;
                    gap: 10px;
                }
                #message-input {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                button {
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="messages"></div>
                <div id="input-container">
                    <input type="text" id="message-input" placeholder="Type your message...">
                    <button id="send-button">Send</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const messagesContainer = document.getElementById('messages');
                const messageInput = document.getElementById('message-input');
                const sendButton = document.getElementById('send-button');

                function addMessage(text, isUser) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = \`message \${isUser ? 'user-message' : 'ai-message'}\`;
                    messageDiv.textContent = text;
                    messagesContainer.appendChild(messageDiv);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (!text) return;

                    addMessage(text, true);
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: text
                    });

                    messageInput.value = '';
                }

                sendButton.addEventListener('click', sendMessage);
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') sendMessage();
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'addMessage':
                            addMessage(message.message, message.isUser);
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
exports.ChatProvider = ChatProvider;
//# sourceMappingURL=chatProvider.js.map