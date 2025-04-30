import * as vscode from 'vscode';
import { LineAnalysisResult } from './lineAnalyzer';

/**
 * Provides code lenses for code issues
 */
export class GenTestXCodeLensProvider implements vscode.CodeLensProvider {
  private analysisResults: Map<string, LineAnalysisResult[]>;
  
  constructor(analysisResults: Map<string, LineAnalysisResult[]>) {
    this.analysisResults = analysisResults;
  }
  
  /**
   * Provides code lenses for a given document
   * @param document The document
   * @returns An array of code lenses
   */
  public provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    
    // Get analysis results for this document
    const results = this.analysisResults.get(document.uri.toString());
    if (!results || results.length === 0) {
      return [];
    }
    
    // Create code lenses for each result
    for (const result of results) {
      if (!result.fixes || result.fixes.length === 0) {
        continue;
      }
      
      // Create a range for the code lens
      const line = document.lineAt(result.lineNumber);
      const range = new vscode.Range(
        new vscode.Position(result.lineNumber, 0),
        new vscode.Position(result.lineNumber, line.text.length)
      );
      
      // Create a code lens for the fix
      const fix = result.fixes[0];
      const severity = result.severity.charAt(0).toUpperCase() + result.severity.slice(1);
      const title = `${severity}: ${result.message}`;
      
      // Create a code lens with a command to show the fix
      const codeLens = new vscode.CodeLens(range, {
        title: title,
        command: 'gentestx.showFixSuggestion',
        arguments: [document.uri.toString(), result.lineNumber, fix.edits[0].newText]
      });
      
      codeLenses.push(codeLens);
      
      // Add accept/reject code lenses
      const acceptCodeLens = new vscode.CodeLens(range, {
        title: 'Accept Fix',
        command: 'gentestx.acceptFix',
        arguments: [document.uri.toString(), result.lineNumber, fix.edits[0].newText]
      });
      
      const rejectCodeLens = new vscode.CodeLens(range, {
        title: 'Reject',
        command: 'gentestx.rejectFix',
        arguments: []
      });
      
      codeLenses.push(acceptCodeLens);
      codeLenses.push(rejectCodeLens);
    }
    
    return codeLenses;
  }
}
