import * as vscode from 'vscode';
import { analyzeFile, analyzeCodeLine, createDiagnostics, LineAnalysisResult } from './lineAnalyzer';

/**
 * Manages diagnostics for code analysis
 */
export class GenTestXDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private analysisResults: Map<string, LineAnalysisResult[]> = new Map();
  private analysisTimer: NodeJS.Timeout | null;

  constructor(context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gentestx');
    context.subscriptions.push(this.diagnosticCollection);

    // Register event handlers
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(this.refreshDiagnostics, this),
      vscode.workspace.onDidCloseTextDocument(doc => this.diagnosticCollection.delete(doc.uri), this),
      vscode.workspace.onDidChangeTextDocument(this.handleDocumentChange, this)
    );

    // Initialize diagnostics for all open text documents
    vscode.workspace.textDocuments.forEach(this.refreshDiagnostics, this);

    // Set up a timer for delayed analysis
    this.analysisTimer = null;
  }

  /**
   * Refreshes diagnostics for a document
   * @param document The document to refresh diagnostics for
   */
  private refreshDiagnostics(document: vscode.TextDocument): void {
    // Support all languages
    const supportedLanguages = [
      'javascript', 'typescript', 'python', 'java', 'csharp',
      'cpp', 'go', 'rust', 'php', 'ruby', 'html', 'css', 'scss',
      'less', 'json', 'yaml', 'markdown', 'powershell', 'shellscript',
      'sql', 'swift', 'objective-c', 'dart', 'kotlin', 'c', 'xml',
      'perl', 'lua', 'r', 'groovy', 'fsharp', 'vb', 'clojure', 'coffeescript'
    ];

    if (!supportedLanguages.includes(document.languageId)) {
      return;
    }

    // Get the results for this document
    const results = this.analysisResults.get(document.uri.toString());
    if (results) {
      const diagnostics = createDiagnostics(results, document);
      this.diagnosticCollection.set(document.uri, diagnostics);
    } else {
      this.diagnosticCollection.delete(document.uri);
    }
  }

  /**
   * Analyzes a document and updates diagnostics
   * @param document The document to analyze
   * @param apiKey The Groq API key
   */
  public async analyzeDocument(document: vscode.TextDocument, apiKey: string): Promise<void> {
    try {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing ${document.fileName}...`,
        cancellable: true
      }, async (progress, token) => {
        // Clear existing diagnostics
        this.diagnosticCollection.delete(document.uri);

        // Analyze the file
        const results = await analyzeFile(document, apiKey);

        // Store the results
        this.analysisResults.set(document.uri.toString(), results);

        // Update diagnostics
        this.refreshDiagnostics(document);

        // Show summary
        if (results.length > 0) {
          const errorCount = results.filter(r => r.severity === 'error').length;
          const warningCount = results.filter(r => r.severity === 'warning').length;
          const infoCount = results.filter(r => r.severity === 'info').length;

          vscode.window.showInformationMessage(
            `Analysis complete: ${errorCount} errors, ${warningCount} warnings, ${infoCount} suggestions`
          );
        } else {
          vscode.window.showInformationMessage('No issues found in the file.');
        }

        return results;
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error analyzing document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets the analysis results for a document
   * @param documentUri The document URI
   * @returns The analysis results
   */
  public getAnalysisResults(documentUri: string): LineAnalysisResult[] | undefined {
    return this.analysisResults.get(documentUri);
  }

  /**
   * Handles document changes and triggers analysis after a delay
   * @param event The document change event
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    // Refresh diagnostics immediately
    this.refreshDiagnostics(event.document);

    // Cancel any pending analysis
    if (this.analysisTimer) {
      clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }

    // Schedule a new analysis after a delay (1 second)
    this.analysisTimer = setTimeout(async () => {
      try {
        // Get the configuration
        const config = vscode.workspace.getConfiguration('gentestx');
        const apiKey = config.get<string>('groqApiKey');
        const autoAnalysis = config.get<boolean>('autoAnalysis', true);

        // Skip analysis if auto-analysis is disabled or no API key
        if (!apiKey || !autoAnalysis) {
          return;
        }

        // Analyze the changed lines
        const changedLines = event.contentChanges.map(change => {
          const startLine = event.document.positionAt(change.rangeOffset).line;
          const endLine = event.document.positionAt(change.rangeOffset + change.rangeLength).line;
          return { startLine, endLine };
        });

        // Analyze each changed line
        for (const { startLine, endLine } of changedLines) {
          for (let i = startLine; i <= endLine; i++) {
            const result = await analyzeCodeLine(event.document, i, apiKey);

            if (result) {
              // Get existing results
              const results = this.analysisResults.get(event.document.uri.toString()) || [];

              // Remove any existing result for this line
              const filteredResults = results.filter(r => r.lineNumber !== i);

              // Add the new result
              filteredResults.push(result);

              // Update the results
              this.analysisResults.set(event.document.uri.toString(), filteredResults);

              // Refresh diagnostics
              this.refreshDiagnostics(event.document);
            }
          }
        }
      } catch (error) {
        console.error('Error analyzing document changes:', error);
      }
    }, 1000);
  }

  public clearDiagnostics(): void {
    this.diagnosticCollection.clear();
    this.analysisResults.clear();
  }
}
