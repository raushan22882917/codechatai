import * as vscode from 'vscode';
import { LineAnalysisResult } from './lineAnalyzer';

/**
 * Provides decorations for code issues
 */
export class GenTestXDecorationProvider {
  private analysisResults: Map<string, LineAnalysisResult[]>;
  private decorationType: vscode.TextEditorDecorationType;
  
  constructor(analysisResults: Map<string, LineAnalysisResult[]>) {
    this.analysisResults = analysisResults;
    
    // Create a decoration type for issues
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
      border: '1px solid rgba(255, 0, 0, 0.3)',
      borderRadius: '3px',
      after: {
        margin: '0 0 0 1em',
        contentIconPath: new vscode.ThemeIcon('lightbulb')
      }
    });
    
    // Update decorations when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.updateDecorations(editor);
      }
    });
    
    // Update decorations when the analysis results change
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        this.updateDecorations(editor);
      }
    });
    
    // Initial update
    if (vscode.window.activeTextEditor) {
      this.updateDecorations(vscode.window.activeTextEditor);
    }
  }
  
  /**
   * Updates decorations for a given editor
   * @param editor The editor
   */
  public updateDecorations(editor: vscode.TextEditor): void {
    const document = editor.document;
    const results = this.analysisResults.get(document.uri.toString());
    
    if (!results || results.length === 0) {
      // Clear decorations if no results
      editor.setDecorations(this.decorationType, []);
      return;
    }
    
    // Create decorations for each result
    const decorations: vscode.DecorationOptions[] = [];
    
    for (const result of results) {
      if (!result.fixes || result.fixes.length === 0) {
        continue;
      }
      
      // Create a range for the decoration
      const line = document.lineAt(result.lineNumber);
      const range = new vscode.Range(
        new vscode.Position(result.lineNumber, 0),
        new vscode.Position(result.lineNumber, line.text.length)
      );
      
      // Create a decoration
      const severity = result.severity.charAt(0).toUpperCase() + result.severity.slice(1);
      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.appendMarkdown(`**${severity}:** ${result.message}\n\n`);
      hoverMessage.appendMarkdown(`**Suggested Fix:**\n\`\`\`${document.languageId}\n${result.fixes[0].edits[0].newText}\n\`\`\`\n\n`);
      hoverMessage.appendMarkdown(`Click the lightbulb icon to see options.`);
      
      decorations.push({
        range,
        hoverMessage
      });
    }
    
    // Set decorations
    editor.setDecorations(this.decorationType, decorations);
  }
  
  /**
   * Disposes of the decoration type
   */
  public dispose(): void {
    this.decorationType.dispose();
  }
}
