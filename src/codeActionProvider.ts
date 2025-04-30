import * as vscode from 'vscode';
import { LineAnalysisResult } from './lineAnalyzer';

/**
 * Provides code actions for GenTestX diagnostics
 */
export class GenTestXCodeActionProvider implements vscode.CodeActionProvider {
  private analysisResults: Map<string, LineAnalysisResult[]>;
  
  constructor(analysisResults: Map<string, LineAnalysisResult[]>) {
    this.analysisResults = analysisResults;
  }
  
  /**
   * Provides code actions for a given document and range
   * @param document The document
   * @param range The range
   * @param context The context
   * @returns An array of code actions
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    // Filter diagnostics to only include GenTestX diagnostics
    const relevantDiagnostics = context.diagnostics.filter(
      diagnostic => diagnostic.source === 'GenTestX'
    );
    
    if (relevantDiagnostics.length === 0) {
      return [];
    }
    
    const actions: vscode.CodeAction[] = [];
    
    // Get analysis results for this document
    const results = this.analysisResults.get(document.uri.toString());
    if (!results) {
      return [];
    }
    
    // Create code actions for each diagnostic
    for (const diagnostic of relevantDiagnostics) {
      // Find the corresponding analysis result
      const lineNumber = diagnostic.range.start.line;
      const result = results.find(r => r.lineNumber === lineNumber);
      
      if (result && result.fixes && result.fixes.length > 0) {
        // Create a code action for each fix
        for (const fix of result.fixes) {
          const action = new vscode.CodeAction(
            fix.title,
            vscode.CodeActionKind.QuickFix
          );
          
          action.diagnostics = [diagnostic];
          action.edit = new vscode.WorkspaceEdit();
          
          // Add the edits to the workspace edit
          for (const edit of fix.edits) {
            action.edit.replace(document.uri, edit.range, edit.newText);
          }
          
          actions.push(action);
        }
      }
    }
    
    return actions;
  }
}
