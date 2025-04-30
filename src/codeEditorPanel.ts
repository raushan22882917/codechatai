import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Creates and shows a new webview panel for the GenTestX code editor interface.
 * This panel shows generated code and allows creating a new file.
 */
export function createCodeEditorPanel(
  context: vscode.ExtensionContext,
  code: string,
  language: string,
  suggestedFileName: string
): vscode.WebviewPanel {
  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    'genTestXCodeEditor',
    `GenTestX: ${suggestedFileName}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'dist'))
      ],
      retainContextWhenHidden: true
    }
  );

  // Set the HTML content
  panel.webview.html = getWebviewContent(panel.webview, context, code, language, suggestedFileName);

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(async (message: any) => {
    if (message.type === 'create-file') {
      try {
        // Create a new file with the generated code
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
          return;
        }

        // Allow the user to modify the file name if needed
        const fileName = await vscode.window.showInputBox({
          prompt: 'Enter file name',
          value: message.fileName,
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return 'File name cannot be empty';
            }
            return null; // Input is valid
          }
        });

        if (!fileName) {
          return; // User cancelled
        }

        // Create the file path
        const filePath = path.join(workspaceFolders[0].uri.fsPath, fileName);
        const fileUri = vscode.Uri.file(filePath);

        // Check if the file already exists
        try {
          await vscode.workspace.fs.stat(fileUri);
          // If we get here, the file exists
          const overwrite = await vscode.window.showWarningMessage(
            `File '${fileName}' already exists. Do you want to overwrite it?`,
            'Yes', 'No'
          );
          if (overwrite !== 'Yes') {
            return;
          }
        } catch (error) {
          // File doesn't exist, which is what we want
        }

        // Write the code to the file
        await vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(message.code, 'utf8')
        );

        // Open the file in the editor
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);

        // Show success message
        vscode.window.showInformationMessage(`File '${fileName}' created successfully!`);

        // Close the panel
        panel.dispose();
      } catch (error) {
        vscode.window.showErrorMessage(`Error creating file: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (message.type === 'edit-code') {
      // Update the code in the panel
      panel.webview.html = getWebviewContent(panel.webview, context, message.code, language, suggestedFileName);
    }
  });

  return panel;
}

/**
 * Gets the HTML content for the code editor webview
 */
function getWebviewContent(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  code: string,
  language: string,
  fileName: string
): string {
  // Get the local path to main.js
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js'))
  );

  // Escape the code for HTML
  const escapedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GenTestX Code Editor</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
        padding: 0;
        margin: 0;
      }
      .container {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        background-color: var(--vscode-editor-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .title {
        font-size: 14px;
        font-weight: bold;
      }
      .buttons {
        display: flex;
        gap: 8px;
      }
      .button {
        padding: 6px 12px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 2px;
        cursor: pointer;
      }
      .button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      .editor {
        flex: 1;
        overflow: auto;
        padding: 16px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: var(--vscode-editor-font-size);
        line-height: 1.5;
      }
      textarea {
        width: 100%;
        height: 100%;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        border: none;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: var(--vscode-editor-font-size);
        line-height: 1.5;
        resize: none;
        padding: 8px;
        box-sizing: border-box;
      }
      textarea:focus {
        outline: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="title">Generated Code: ${fileName}</div>
        <div class="buttons">
          <button class="button" id="createFileBtn">Create File</button>
        </div>
      </div>
      <div class="editor">
        <textarea id="codeEditor">${escapedCode}</textarea>
      </div>
    </div>
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        const createFileBtn = document.getElementById('createFileBtn');
        const codeEditor = document.getElementById('codeEditor');
        
        // Store the initial state
        vscode.setState({ 
          code: ${JSON.stringify(code)},
          fileName: ${JSON.stringify(fileName)},
          language: ${JSON.stringify(language)}
        });
        
        // Handle create file button click
        createFileBtn.addEventListener('click', () => {
          vscode.postMessage({
            type: 'create-file',
            code: codeEditor.value,
            fileName: ${JSON.stringify(fileName)},
            language: ${JSON.stringify(language)}
          });
        });
        
        // Handle code changes
        codeEditor.addEventListener('input', () => {
          vscode.setState({ 
            code: codeEditor.value,
            fileName: ${JSON.stringify(fileName)},
            language: ${JSON.stringify(language)}
          });
          
          vscode.postMessage({
            type: 'edit-code',
            code: codeEditor.value
          });
        });
        
        // Restore state if available
        const state = vscode.getState();
        if (state) {
          codeEditor.value = state.code;
        }
      }());
    </script>
  </body>
  </html>`;
}
