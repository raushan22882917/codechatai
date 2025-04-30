import * as vscode from 'vscode';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { createAnalysisPanel } from './panel';
import { createCodeEditorPanel } from './codeEditorPanel';
import { analyzeCodeWithGroq, generateTestCases, runTestCase, analyzeFileStructure, runAllTestCases, generateCodeWithFileName } from './api';
import { GenTestXDiagnosticProvider } from './diagnosticProvider';
import { GenTestXCodeActionProvider } from './codeActionProvider';
import { GenTestXHoverProvider } from './hoverProvider';
import { GenTestXCodeLensProvider } from './codeLensProvider';
import { GenTestXDecorationProvider } from './decorationProvider';
import { analyzeCodeLine } from './lineAnalyzer';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export function activate(context: vscode.ExtensionContext) {
  console.log('GenTestX extension is now active');

  // Create diagnostic provider
  const diagnosticProvider = new GenTestXDiagnosticProvider(context);

  // Register code action provider
  const codeActionProvider = new GenTestXCodeActionProvider(
    (diagnosticProvider as any).analysisResults
  );

  // Create hover provider
  const hoverProvider = new GenTestXHoverProvider(
    (diagnosticProvider as any).analysisResults
  );

  // Create code lens provider
  const codeLensProvider = new GenTestXCodeLensProvider(
    (diagnosticProvider as any).analysisResults
  );

  // Create decoration provider
  const decorationProvider = new GenTestXDecorationProvider(
    (diagnosticProvider as any).analysisResults
  );

  // Support all languages
  const supportedLanguages = [
    'javascript', 'typescript', 'python', 'java', 'csharp',
    'cpp', 'go', 'rust', 'php', 'ruby', 'html', 'css', 'scss',
    'less', 'json', 'yaml', 'markdown', 'powershell', 'shellscript',
    'sql', 'swift', 'objective-c', 'dart', 'kotlin', 'c', 'xml',
    'perl', 'lua', 'r', 'groovy', 'fsharp', 'vb', 'clojure', 'coffeescript'
  ];

  for (const language of supportedLanguages) {
    // Register code action provider
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { language },
        codeActionProvider
      )
    );

    // Register hover provider
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { language },
        hoverProvider
      )
    );

    // Register code lens provider
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language },
        codeLensProvider
      )
    );
  }

  // Track the active editor
  let activeEditor = vscode.window.activeTextEditor;

  // Store the last edit for revert functionality
  let lastEdit: {
    document: vscode.TextDocument;
    range: vscode.Range;
    oldText: string;
    newText: string;
  } | null = null;

  // Listen for editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;

    // If we have a provider and an editor, send the current file info
    if (activeProvider && editor) {
      activeProvider.webview.postMessage({
        type: 'current-file',
        fileName: path.basename(editor.document.fileName),
        language: editor.document.languageId
      });
    }
  });

  // Listen for selection changes
  vscode.window.onDidChangeTextEditorSelection(event => {
    // Only process if we have an active provider and the selection is not empty
    if (activeProvider && !event.selections[0].isEmpty) {
      const editor = event.textEditor;
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      // Send the selected text to the webview
      activeProvider.webview.postMessage({
        type: 'selected-code',
        code: selectedText,
        language: editor.document.languageId,
        lineNumber: selection.start.line
      });
    }
  });

  // Store the active provider
  let activeProvider: vscode.WebviewView | undefined;

  // Create and register the webview panel provider
  const provider = vscode.window.registerWebviewViewProvider(
    'gentestx.analysisView',
    {
      resolveWebviewView(webviewView: vscode.WebviewView) {
        // Store the active provider
        activeProvider = webviewView;

        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'dist'))
          ]
        };

        // Send current file info if available
        if (activeEditor) {
          webviewView.webview.postMessage({
            type: 'current-file',
            fileName: path.basename(activeEditor.document.fileName),
            language: activeEditor.document.languageId
          });
        }

        // Send workspace folders
        const folders = vscode.workspace.workspaceFolders;
        const folderNames = folders ? folders.map(folder => folder.name) : [];
        webviewView.webview.postMessage({
          type: 'workspace-folders',
          folders: folderNames
        });

        // Set the HTML content
        webviewView.webview.html = getWebviewContent(webviewView.webview, context);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message: any) => {
          if (message.type === 'analyze-code') {
            try {
              const response = await analyzeCodeWithGroq(message.code, message.language, message.mode || 'gentestx');
              webviewView.webview.postMessage({
                type: 'analysis-response',
                data: response
              });
            } catch (error) {
              webviewView.webview.postMessage({
                type: 'analysis-error',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'get-file-suggestions') {
            try {
              const suggestions = await getFileSuggestions(message.query);
              webviewView.webview.postMessage({
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
                webviewView.webview.postMessage({
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
              webviewView.webview.postMessage({
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
              const response = await analyzeCodeWithGroq(code, language);
              webviewView.webview.postMessage({
                type: 'analysis-response',
                data: response
              });
            } catch (error) {
              webviewView.webview.postMessage({
                type: 'analysis-error',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'generate-test-cases') {
            try {
              // Generate test cases
              const testCases = await generateTestCases(message.code, message.language);

              // Send the test cases to the webview
              // Make sure we're sending a properly serializable object
              webviewView.webview.postMessage({
                type: 'test-cases-generated',
                testCases: JSON.parse(JSON.stringify(testCases))
              });
            } catch (error) {
              console.error('Error generating test cases:', error);
              webviewView.webview.postMessage({
                type: 'test-generation-error',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'run-test') {
            try {
              // Run the test
              const testResult = await runTestCase(message.testCode, message.language, message.userCode || '');

              // Send the result to the webview
              webviewView.webview.postMessage({
                type: 'test-run-result',
                testId: message.testId,
                result: testResult.result,
                passed: testResult.passed,
                errorType: testResult.errorType,
                suggestion: testResult.suggestion
              });
            } catch (error) {
              webviewView.webview.postMessage({
                type: 'test-run-error',
                testId: message.testId,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'get-settings') {
            try {
              // Get settings from VS Code
              const config = vscode.workspace.getConfiguration('gentestx');
              const groqApiKey = config.get<string>('groqApiKey') || '';
              const defaultMode = config.get<string>('defaultMode') || 'chat';
              const defaultLanguage = config.get<string>('defaultLanguage') || 'javascript';

              // Send settings to the webview
              webviewView.webview.postMessage({
                type: 'settings',
                settings: {
                  groqApiKey,
                  defaultMode,
                  defaultLanguage
                }
              });
            } catch (error) {
              console.error('Error getting settings:', error);
            }
          } else if (message.type === 'save-settings') {
            try {
              // Save settings to VS Code
              const config = vscode.workspace.getConfiguration('gentestx');

              // Update each setting
              if (message.settings.groqApiKey !== undefined) {
                await config.update('groqApiKey', message.settings.groqApiKey, vscode.ConfigurationTarget.Global);
              }

              if (message.settings.defaultMode !== undefined) {
                await config.update('defaultMode', message.settings.defaultMode, vscode.ConfigurationTarget.Global);
              }

              if (message.settings.defaultLanguage !== undefined) {
                await config.update('defaultLanguage', message.settings.defaultLanguage, vscode.ConfigurationTarget.Global);
              }

              // Send success message
              webviewView.webview.postMessage({
                type: 'settings-saved',
                success: true
              });
            } catch (error) {
              console.error('Error saving settings:', error);
              webviewView.webview.postMessage({
                type: 'settings-saved',
                success: false,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'test-api-key') {
            try {
              // Test the API key by making a simple request
              await testApiKey(message.apiKey);

              // Send the result to the webview
              webviewView.webview.postMessage({
                type: 'test-api-key-response',
                success: true
              });
            } catch (error) {
              console.error('Error testing API key:', error);
              webviewView.webview.postMessage({
                type: 'test-api-key-response',
                success: false,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'open-external-url') {
            // Open an external URL
            vscode.env.openExternal(vscode.Uri.parse(message.url));
          } else if (message.type === 'clear-current-file') {
            // Clear the current file reference
            // No action needed in the extension, the webview handles this
          } else if (message.type === 'analyze-for-errors') {
            try {
              // Analyze the code for errors
              const result = await analyzeCodeForErrors(
                message.code,
                message.language,
                message.lineNumber
              );

              // Send the result to the webview
              webviewView.webview.postMessage({
                type: 'error-analysis-result',
                ...result
              });
            } catch (error) {
              console.error('Error analyzing code for errors:', error);
            }
          } else if (message.type === 'apply-fix') {
            try {
              // Apply the fix to the active editor
              if (activeEditor) {
                const range = new vscode.Range(
                  new vscode.Position(message.lineNumber, 0),
                  new vscode.Position(message.lineNumber, activeEditor.document.lineAt(message.lineNumber).text.length)
                );

                // Store the old text for revert functionality
                const oldText = activeEditor.document.getText(range);

                // Apply the edit
                const edit = new vscode.WorkspaceEdit();
                edit.replace(activeEditor.document.uri, range, message.fixedCode);
                await vscode.workspace.applyEdit(edit);

                // Store the last edit
                lastEdit = {
                  document: activeEditor.document,
                  range,
                  oldText,
                  newText: message.fixedCode
                };

                // Show success message
                vscode.window.showInformationMessage('Fix applied successfully!');

                // Notify the webview that the fix was applied
                webviewView.webview.postMessage({
                  type: 'fix-applied'
                });
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Error applying fix: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else if (message.type === 'revert-last-change') {
            try {
              // Revert the last edit
              if (lastEdit) {
                // Create a new edit to revert the change
                const edit = new vscode.WorkspaceEdit();
                edit.replace(lastEdit.document.uri, lastEdit.range, lastEdit.oldText);
                await vscode.workspace.applyEdit(edit);

                // Clear the last edit
                lastEdit = null;

                // Show success message
                vscode.window.showInformationMessage('Last change reverted successfully!');

                // Notify the webview that the revert is complete
                webviewView.webview.postMessage({
                  type: 'revert-complete'
                });
              } else {
                vscode.window.showInformationMessage('No changes to revert.');
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Error reverting change: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else if (message.type === 'analyze-file-structure') {
            try {
              // Analyze the file structure
              const analysis = await analyzeFileStructure(message.code, message.language);

              // Send the analysis to the webview
              webviewView.webview.postMessage({
                type: 'file-structure-analysis',
                analysis
              });
            } catch (error) {
              console.error('Error analyzing file structure:', error);
              webviewView.webview.postMessage({
                type: 'file-structure-error',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'run-all-tests') {
            try {
              // Show progress indicator
              vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Running all test cases...',
                cancellable: false
              }, async (progress) => {
                try {
                  // Run all test cases
                  const results = await runAllTestCases(
                    message.testCases,
                    message.language,
                    message.userCode
                  );

                  // Show a summary notification
                  const { summary } = results;
                  vscode.window.showInformationMessage(
                    `Test Summary: ${summary.passed}/${summary.total} tests passed (${summary.failed} failed)`
                  );

                  // Send the results to the webview
                  webviewView.webview.postMessage({
                    type: 'all-tests-results',
                    results
                  });
                } catch (error) {
                  console.error('Error running all test cases:', error);
                  webviewView.webview.postMessage({
                    type: 'all-tests-error',
                    error: error instanceof Error ? error.message : String(error)
                  });
                }
              });
            } catch (error) {
              console.error('Error running all test cases:', error);
              webviewView.webview.postMessage({
                type: 'all-tests-error',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'get-workspace-folders') {
            try {
              // Get workspace folders
              const folders = vscode.workspace.workspaceFolders;
              const folderNames = folders ? folders.map(folder => folder.name) : [];

              // Send the workspace folders to the webview
              webviewView.webview.postMessage({
                type: 'workspace-folders',
                folders: folderNames
              });
            } catch (error) {
              console.error('Error getting workspace folders:', error);
            }
          } else if (message.type === 'generate-code') {
            try {
              // Generate code with file name
              const result = await generateCodeWithFileName(
                message.prompt,
                message.language
              );

              // Send the results to the webview
              webviewView.webview.postMessage({
                type: 'code-generated',
                result
              });
            } catch (error) {
              console.error('Error generating code:', error);
              webviewView.webview.postMessage({
                type: 'code-generation-error',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else if (message.type === 'create-file') {
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
            } catch (error) {
              vscode.window.showErrorMessage(`Error creating file: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        });
      }
    }
  );

  // Register the command to analyze code
  const analyzeCommand = vscode.commands.registerCommand('gentestx.analyzeCode', async () => {
    // Get the active text editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found. Please open a file to analyze.');
      return;
    }

    // Get the selected text or the entire document
    const selection = editor.selection;
    const code = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    if (!code) {
      vscode.window.showErrorMessage('No code found to analyze.');
      return;
    }

    // Get the language ID
    const language = editor.document.languageId;

    // Create a panel and send the code for analysis
    const panel = createAnalysisPanel(context);
    panel.webview.postMessage({
      type: 'code-to-analyze',
      code,
      language
    });
  });

  // Register the command to call the API directly
  const callApiCommand = vscode.commands.registerCommand('gentestx.callAPI', async (code: string, language: string, mode: string = 'gentestx') => {
    try {
      return await analyzeCodeWithGroq(code, language, mode);
    } catch (error) {
      vscode.window.showErrorMessage(`Error analyzing code: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Register the command to generate test cases
  const generateTestsCommand = vscode.commands.registerCommand('gentestx.generateTests', async (code: string, language: string) => {
    try {
      return await generateTestCases(code, language);
    } catch (error) {
      vscode.window.showErrorMessage(`Error generating test cases: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Register the command to run a test
  const runTestCommand = vscode.commands.registerCommand('gentestx.runTest', async (testCode: string, language: string, userCode: string = '') => {
    try {
      return await runTestCase(testCode, language, userCode);
    } catch (error) {
      vscode.window.showErrorMessage(`Error running test: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Register the command to run all test cases
  const runAllTestsCommand = vscode.commands.registerCommand('gentestx.runAllTests', async (testCases: any[], language: string, userCode: string) => {
    try {
      return await runAllTestCases(testCases, language, userCode);
    } catch (error) {
      vscode.window.showErrorMessage(`Error running all tests: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Register the command to analyze file structure
  const analyzeStructureCommand = vscode.commands.registerCommand('gentestx.analyzeFileStructure', async (code: string, language: string) => {
    try {
      return await analyzeFileStructure(code, language);
    } catch (error) {
      vscode.window.showErrorMessage(`Error analyzing file structure: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Register command to analyze current line
  const analyzeLineCommand = vscode.commands.registerCommand('gentestx.analyzeLine', async () => {
    // Get the active text editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found. Please open a file to analyze.');
      return;
    }

    try {
      // Get the API key
      const config = vscode.workspace.getConfiguration('gentestx');
      const apiKey = config.get<string>('groqApiKey');

      if (!apiKey) {
        vscode.window.showErrorMessage('Groq API key not found. Please set it in the settings.');
        return;
      }

      // Get the current line
      const lineNumber = editor.selection.active.line;

      // Show progress indicator
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing line...',
        cancellable: false
      }, async () => {
        // Analyze the line
        const result = await analyzeCodeLine(editor.document, lineNumber, apiKey);

        if (result) {
          // Show the result
          const severity = result.severity.charAt(0).toUpperCase() + result.severity.slice(1);
          const message = `${severity}: ${result.message}`;

          if (result.fixes && result.fixes.length > 0) {
            const fix = await vscode.window.showWarningMessage(
              message,
              { modal: false },
              'Fix Issue'
            );

            if (fix === 'Fix Issue') {
              // Apply the first fix
              const edit = new vscode.WorkspaceEdit();
              for (const textEdit of result.fixes[0].edits) {
                edit.replace(editor.document.uri, textEdit.range, textEdit.newText);
              }

              await vscode.workspace.applyEdit(edit);
            }
          } else {
            vscode.window.showInformationMessage(message);
          }
        } else {
          vscode.window.showInformationMessage('No issues found in this line.');
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error analyzing line: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Register command to analyze entire file
  const analyzeFileCommand = vscode.commands.registerCommand('gentestx.analyzeFile', async () => {
    // Get the active text editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found. Please open a file to analyze.');
      return;
    }

    try {
      // Get the API key
      const config = vscode.workspace.getConfiguration('gentestx');
      const apiKey = config.get<string>('groqApiKey');

      if (!apiKey) {
        vscode.window.showErrorMessage('Groq API key not found. Please set it in the settings.');
        return;
      }

      // Analyze the file
      await diagnosticProvider.analyzeDocument(editor.document, apiKey);
    } catch (error) {
      vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Register command to fix code
  const fixCodeCommand = vscode.commands.registerCommand('gentestx.fixCode', async (uri: string, lineNumber: number) => {
    try {
      // Get the document
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));

      // Get the analysis results
      const results = diagnosticProvider.getAnalysisResults(uri);
      if (!results) {
        return;
      }

      // Find the result for this line
      const result = results.find(r => r.lineNumber === lineNumber);
      if (!result || !result.fixes || result.fixes.length === 0) {
        return;
      }

      // Apply the first fix
      const edit = new vscode.WorkspaceEdit();
      for (const textEdit of result.fixes[0].edits) {
        edit.replace(document.uri, textEdit.range, textEdit.newText);
      }

      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      vscode.window.showErrorMessage(`Error fixing code: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Register command to select and analyze a file
  const selectFileCommand = vscode.commands.registerCommand('gentestx.selectFile', async () => {
    try {
      // Show file picker
      const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');

      if (files.length === 0) {
        vscode.window.showErrorMessage('No files found in the workspace.');
        return;
      }

      // Get file names for quick pick
      const fileItems = files.map(file => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
        let relativePath = file.path;

        if (workspaceFolder) {
          relativePath = file.path.replace(workspaceFolder.uri.path, '');
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
          }
        }

        return {
          label: path.basename(file.path),
          description: relativePath,
          uri: file
        };
      });

      // Show quick pick
      const selectedFile = await vscode.window.showQuickPick(fileItems, {
        placeHolder: 'Select a file to analyze'
      });

      if (!selectedFile) {
        return;
      }

      // Open the file
      const document = await vscode.workspace.openTextDocument(selectedFile.uri);
      await vscode.window.showTextDocument(document);

      // Get the code and language
      const code = document.getText();
      const language = document.languageId;
      const fileName = path.basename(document.fileName);

      // Show progress indicator
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing ${fileName}...`,
        cancellable: false
      }, async (progress) => {
        try {
          // First analyze the file structure to detect language
          progress.report({ message: 'Analyzing file structure...' });
          const structureAnalysis = await analyzeFileStructure(code, language);

          // Use the detected language or fall back to the document language
          const detectedLanguage = structureAnalysis.detectedLanguage !== 'unknown' ?
            structureAnalysis.detectedLanguage : language;

          // Send the file info and analysis to the webview
          if (activeProvider) {
            activeProvider.webview.postMessage({
              type: 'file-structure-analysis',
              analysis: structureAnalysis,
              fileName,
              code,
              language: detectedLanguage
            });

            // Generate test cases
            progress.report({ message: 'Generating test cases...' });
            const testCases = await generateTestCases(code, detectedLanguage);

            // Send the test cases to the webview
            activeProvider.webview.postMessage({
              type: 'test-cases-generated',
              testCases: JSON.parse(JSON.stringify(testCases))
            });
          }

          // Also run the standard file analysis
          vscode.commands.executeCommand('gentestx.analyzeFile');
        } catch (error) {
          console.error('Error in file analysis:', error);
          vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error selecting file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Register command to accept a fix
  const acceptFixCommand = vscode.commands.registerCommand('gentestx.acceptFix', async (uri: string, lineNumber: number, newText: string) => {
    try {
      // Get the document
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));

      // Get the editor
      const editor = await vscode.window.showTextDocument(document);

      // Create a range for the line
      const line = document.lineAt(lineNumber);
      const range = new vscode.Range(
        new vscode.Position(lineNumber, 0),
        new vscode.Position(lineNumber, line.text.length)
      );

      // Store the old text for revert functionality
      const oldText = line.text;

      // Apply the edit
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, newText);
      await vscode.workspace.applyEdit(edit);

      // Store the last edit
      lastEdit = {
        document,
        range,
        oldText,
        newText
      };

      // Show success message
      vscode.window.showInformationMessage('Fix applied successfully!');

      // Notify the webview if active
      if (activeProvider) {
        activeProvider.webview.postMessage({
          type: 'fix-applied'
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error applying fix: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Register command to reject a fix
  const rejectFixCommand = vscode.commands.registerCommand('gentestx.rejectFix', () => {
    // Just show a message
    vscode.window.showInformationMessage('Fix rejected.');
  });

  // Register command to generate code and create a new file
  const generateCodeCommand = vscode.commands.registerCommand('gentestx.generateCode', async (prompt: string, language: string = 'javascript') => {
    try {
      // Show progress indicator
      return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating code...',
        cancellable: false
      }, async (progress) => {
        // Generate code with file name
        const result = await generateCodeWithFileName(prompt, language);

        // Create a code editor panel
        const panel = createCodeEditorPanel(context, result.code, language, result.fileName);

        return result;
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error generating code: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Register command to toggle automatic code analysis
  const toggleAutoAnalysisCommand = vscode.commands.registerCommand('gentestx.toggleAutoAnalysis', async () => {
    try {
      // Get the current setting
      const config = vscode.workspace.getConfiguration('gentestx');
      const currentSetting = config.get<boolean>('autoAnalysis', true);

      // Toggle the setting
      await config.update('autoAnalysis', !currentSetting, vscode.ConfigurationTarget.Global);

      // Show a message
      vscode.window.showInformationMessage(
        `Automatic code analysis is now ${!currentSetting ? 'enabled' : 'disabled'}.`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error toggling automatic analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Register command to show fix suggestion
  const showFixSuggestionCommand = vscode.commands.registerCommand('gentestx.showFixSuggestion', async (uri: string, lineNumber: number, newText: string) => {
    try {
      // Get the document
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));

      // Get the line text
      const line = document.lineAt(lineNumber);
      const oldText = line.text;

      // Get the analysis results
      const results = diagnosticProvider.getAnalysisResults(uri);
      if (!results) {
        return;
      }

      // Find the result for this line
      const result = results.find(r => r.lineNumber === lineNumber);
      if (!result) {
        return;
      }

      // Show the fix suggestion
      const severity = result.severity.charAt(0).toUpperCase() + result.severity.slice(1);
      const message = `${severity}: ${result.message}`;

      const fix = await vscode.window.showInformationMessage(
        message,
        { modal: true, detail: `Original: ${oldText}\nSuggested: ${newText}` },
        'Accept Fix',
        'Reject'
      );

      if (fix === 'Accept Fix') {
        // Execute the accept fix command
        vscode.commands.executeCommand('gentestx.acceptFix', uri, lineNumber, newText);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error showing fix suggestion: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  context.subscriptions.push(
    provider,
    analyzeCommand,
    callApiCommand,
    generateTestsCommand,
    runTestCommand,
    runAllTestsCommand,
    analyzeStructureCommand,
    analyzeLineCommand,
    analyzeFileCommand,
    fixCodeCommand,
    selectFileCommand,
    acceptFixCommand,
    rejectFixCommand,
    showFixSuggestionCommand,
    toggleAutoAnalysisCommand,
    generateCodeCommand,
    decorationProvider
  );
}

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  // Get the local path to the webview resources
  const scriptUri = webview.asWebviewUri(
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

  return htmlContent;
}

/**
 * Gets file suggestions based on a query
 * @param query The search query
 * @returns A list of file paths that match the query
 */
async function getFileSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    // Use VS Code's built-in file search
    const files = await vscode.workspace.findFiles(
      `**/*${query}*`,
      '**/node_modules/**',
      100
    );

    // Extract file names and paths
    return files.map(file => {
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
  } catch (error) {
    console.error('Error searching for files:', error);
    return [];
  }
}

/**
 * Tests if a Groq API key is valid
 * @param apiKey The API key to test
 * @returns A promise that resolves if the key is valid, or rejects if it's invalid
 */
async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    // Make a simple request to the Groq API to check if the key is valid
    await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-70b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Hello, this is a test message to verify my API key.'
          }
        ],
        max_tokens: 10 // Keep it small for a quick test
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // If we get here, the key is valid
    return true;
  } catch (error: any) {
    // Check if the error is related to the API key
    if (error.response?.status === 401 ||
        error.response?.data?.error?.message?.includes('API key')) {
      throw new Error('Invalid API key');
    }

    // Some other error occurred
    throw error;
  }
}

/**
 * Analyzes code for errors and suggests fixes
 * @param code The code to analyze
 * @param language The programming language
 * @param lineNumber The line number (0-based)
 * @returns Analysis result
 */
async function analyzeCodeForErrors(code: string, language: string, lineNumber: number): Promise<any> {
  try {
    // Get the API key
    const config = vscode.workspace.getConfiguration('gentestx');
    const apiKey = config.get<string>('groqApiKey');

    if (!apiKey) {
      throw new Error('Groq API key not found. Please set it in the settings.');
    }

    // Create the prompt for the AI
    const prompt = `
    Analyze this line of ${language} code for bugs, errors, or potential improvements:

    ${code}

    Identify any:
    1. Syntax errors
    2. Logical bugs
    3. Performance issues
    4. Security vulnerabilities
    5. Best practice violations

    If you find any issues, suggest a specific fix. Format your response as JSON:
    {
      "hasIssues": true/false,
      "severity": "error"/"warning"/"info",
      "message": "Brief description of the issue",
      "fix": {
        "suggestion": "Suggested code to replace the line",
        "explanation": "Why this fix works"
      }
    }

    If there are no issues, return { "hasIssues": false }
    `;

    // Call the Groq API
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-70b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a code analysis expert that specializes in finding bugs and suggesting fixes. Respond only with JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Parse the response
    const content = response.data.choices[0].message.content;

    // Extract JSON from the response
    const jsonMatch = content.match(/({[\s\S]*})/);
    if (!jsonMatch) {
      console.error('Could not find JSON in response:', content);
      return { hasIssues: false };
    }

    try {
      const result = JSON.parse(jsonMatch[0]);

      if (!result.hasIssues) {
        return { hasIssues: false };
      }

      return {
        hasIssues: true,
        message: result.message,
        severity: result.severity || 'info',
        originalCode: code,
        fixedCode: result.fix?.suggestion || code,
        lineNumber,
        language
      };
    } catch (parseError) {
      console.error('Error parsing analysis result:', parseError);
      return { hasIssues: false };
    }
  } catch (error) {
    console.error('Error analyzing code for errors:', error);
    return { hasIssues: false };
  }
}

export function deactivate() {}
