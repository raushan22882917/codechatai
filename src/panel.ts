import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Creates and shows a new webview panel for the GenTestX code analysis interface.
 * This is an alternative to the sidebar view.
 */
export function createAnalysisPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    'genTestXAnalysis',
    'GenTestX Code Analysis',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'dist'))
      ]
    }
  );

  // Get the local path to the webview resources
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js'))
  );

  // Read the HTML file from the dist directory
  const htmlPath = path.join(context.extensionPath, 'dist', 'index.html');
  let htmlContent = '';
  try {
    const fs = require('fs');
    htmlContent = fs.readFileSync(htmlPath, 'utf8');
  } catch (error) {
    console.error('Error reading HTML file:', error);
    htmlContent = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GenTestX</title>
    </head>
    <body>
      <div id="root">Loading GenTestX...</div>
      <script type="module" src="{{scriptUri}}"></script>
    </body>
    </html>`;
  }

  // Replace the script placeholder with the actual script URI
  htmlContent = htmlContent.replace('{{scriptUri}}', scriptUri.toString());

  panel.webview.html = htmlContent;

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(async (message: any) => {
    if (message.type === 'analyze-code') {
      try {
        // Call the API through the command
        vscode.commands.executeCommand('gentestx.callAPI', message.code, message.language, message.mode || 'gentestx')
          .then((response) => {
            panel.webview.postMessage({
              type: 'analysis-response',
              data: response
            });
          })
          .catch((error) => {
            panel.webview.postMessage({
              type: 'analysis-error',
              error: error instanceof Error ? error.message : String(error)
            });
          });
      } catch (error) {
        panel.webview.postMessage({
          type: 'analysis-error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else if (message.type === 'get-file-suggestions') {
      try {
        // Use the workspace API to find files
        const files = await vscode.workspace.findFiles(
          `**/*${message.query}*`,
          '**/node_modules/**',
          100
        );

        // Extract file names and paths
        const suggestions = files.map(file => {
          // Get the workspace folder
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
          if (workspaceFolder) {
            // Get the relative path from the workspace folder
            const relativePath = file.path.replace(workspaceFolder.uri.path, '');
            // Remove leading slash if present
            return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
          }
          // If no workspace folder, just return the file name
          return file.path.split('/').pop() || '';
        });

        panel.webview.postMessage({
          type: 'file-suggestions',
          suggestions
        });
      } catch (error) {
        console.error('Error getting file suggestions:', error);
      }
    } else if (message.type === 'analyze-current-file' || message.type === 'get-current-file') {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          panel.webview.postMessage({
            type: 'analysis-error',
            error: 'No active editor found. Please open a file to analyze.'
          });
          return;
        }

        const document = editor.document;
        const code = document.getText();
        const language = document.languageId;
        const fileName = document.fileName.split(/[\\/]/).pop() || '';

        // Send the code to the webview
        panel.webview.postMessage({
          type: 'code-to-analyze',
          code,
          language,
          fileName
        });

        // If this is just a get-current-file request, we're done
        if (message.type === 'get-current-file') {
          return;
        }

        // Analyze the code
        vscode.commands.executeCommand('gentestx.callAPI', code, language, 'gentestx')
          .then((response) => {
            panel.webview.postMessage({
              type: 'analysis-response',
              data: response
            });
          })
          .catch((error) => {
            panel.webview.postMessage({
              type: 'analysis-error',
              error: error instanceof Error ? error.message : String(error)
            });
          });
      } catch (error) {
        panel.webview.postMessage({
          type: 'analysis-error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else if (message.type === 'generate-test-cases') {
      try {
        // Generate test cases using the API
        vscode.commands.executeCommand('gentestx.generateTests', message.code, message.language)
          .then((testCases) => {
            panel.webview.postMessage({
              type: 'test-cases-generated',
              testCases: JSON.parse(JSON.stringify(testCases))
            });
          })
          .catch((error) => {
            panel.webview.postMessage({
              type: 'test-generation-error',
              error: error instanceof Error ? error.message : String(error)
            });
          });
      } catch (error) {
        panel.webview.postMessage({
          type: 'test-generation-error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else if (message.type === 'run-test') {
      try {
        // Run the test using the API
        vscode.commands.executeCommand('gentestx.runTest', message.testCode, message.language)
          .then((result) => {
            panel.webview.postMessage({
              type: 'test-run-result',
              testId: message.testId,
              result
            });
          })
          .catch((error) => {
            panel.webview.postMessage({
              type: 'test-run-error',
              testId: message.testId,
              error: error instanceof Error ? error.message : String(error)
            });
          });
      } catch (error) {
        panel.webview.postMessage({
          type: 'test-run-error',
          testId: message.testId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  return panel;
}
