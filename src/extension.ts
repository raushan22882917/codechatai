import * as vscode from 'vscode';
import { WebviewProvider } from './webview/WebviewProvider';
import { ChatViewProvider } from './webview/ChatViewProvider';
import { TestProvider } from './providers/testProvider';
import { TestGenerator } from './services/testGenerator';
import * as dotenv from 'dotenv';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // Load environment variables
    const envPath = path.join(context.extensionPath, '.env');
    dotenv.config({ path: envPath });

    // Initialize services
    const testGenerator = new TestGenerator();
    const testProvider = new TestProvider();

    // Initialize webview providers
    const webviewProvider = new WebviewProvider(
        context.extensionUri,
        testGenerator,
        testProvider
    );

    const chatViewProvider = new ChatViewProvider(
        context.extensionUri,
        testGenerator
    );

    // Register webview providers
    const testViewRegistration = vscode.window.registerWebviewViewProvider(
        'codetestai.mainView',
        webviewProvider
    );

    const chatViewRegistration = vscode.window.registerWebviewViewProvider(
        'codetestai.chatView',
        chatViewProvider
    );

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = "$(beaker) CodeTest AI";
    statusBarItem.tooltip = "Show CodeTest AI";
    statusBarItem.command = 'codetestai.showChat';
    statusBarItem.show();

    // Register commands
    const generateTestsCommand = vscode.commands.registerCommand(
        'codetestai.generateTests',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found. Please open a file to generate tests.');
                return;
            }

            try {
                const tests = await testGenerator.generateTests(
                    editor.document.getText(),
                    editor.document.languageId
                );
                testProvider.updateTests(tests);
                vscode.window.showInformationMessage('Tests generated successfully');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to generate tests: ${errorMessage}`);
            }
        }
    );

    const runTestsCommand = vscode.commands.registerCommand(
        'codetestai.runTests',
        async () => {
            try {
                await testProvider.runTests(new vscode.TestRunRequest());
                vscode.window.showInformationMessage('Tests completed');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to run tests: ${errorMessage}`);
            }
        }
    );

    const acceptSuggestionCommand = vscode.commands.registerCommand(
        'codetestai.acceptSuggestion',
        () => {
            vscode.commands.executeCommand('workbench.action.acceptSelectedSuggestion');
        }
    );

    const rejectSuggestionCommand = vscode.commands.registerCommand(
        'codetestai.rejectSuggestion',
        () => {
            vscode.commands.executeCommand('workbench.action.rejectSelectedSuggestion');
        }
    );

    const showChatCommand = vscode.commands.registerCommand(
        'codetestai.showChat',
        () => {
            vscode.commands.executeCommand('workbench.view.extension.codetestai-sidebar');
        }
    );

    const debugTestCommand = vscode.commands.registerCommand(
        'codetestai.debugTest',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            try {
                // Start debugging session
                await vscode.debug.startDebugging(undefined, {
                    type: 'node',
                    request: 'launch',
                    name: 'Debug Test',
                    program: '${file}',
                    stopOnEntry: true
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to start debugging: ${errorMessage}`);
            }
        }
    );

    // Push subscriptions
    context.subscriptions.push(
        testViewRegistration,
        chatViewRegistration,
        generateTestsCommand,
        runTestsCommand,
        acceptSuggestionCommand,
        rejectSuggestionCommand,
        showChatCommand,
        debugTestCommand,
        statusBarItem,
        testProvider,
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codetestai')) {
                testProvider.updateTests([]);
            }
        })
    );
}

export function deactivate() {}
