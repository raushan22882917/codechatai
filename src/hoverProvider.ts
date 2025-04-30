import * as vscode from 'vscode';
import { LineAnalysisResult } from './lineAnalyzer';
import { analyzeCodeLine } from './lineAnalyzer';

/**
 * Provides hover information for code issues
 */
export class GenTestXHoverProvider implements vscode.HoverProvider {
  private analysisResults: Map<string, LineAnalysisResult[]>;
  private apiKey: string | undefined;
  
  constructor(analysisResults: Map<string, LineAnalysisResult[]>) {
    this.analysisResults = analysisResults;
    
    // Get the API key
    const config = vscode.workspace.getConfiguration('gentestx');
    this.apiKey = config.get<string>('groqApiKey');
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gentestx.groqApiKey')) {
        const config = vscode.workspace.getConfiguration('gentestx');
        this.apiKey = config.get<string>('groqApiKey');
      }
    });
  }
  
  /**
   * Provides hover information for a given position
   * @param document The document
   * @param position The position
   * @returns A hover or null
   */
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | null> {
    // Get the line number
    const lineNumber = position.line;
    
    // Check if we already have analysis results for this line
    const results = this.analysisResults.get(document.uri.toString());
    let result = results?.find(r => r.lineNumber === lineNumber);
    
    // If no results, analyze the line on-demand
    if (!result && this.apiKey) {
      try {
        result = await analyzeCodeLine(document, lineNumber, this.apiKey);
      } catch (error) {
        console.error('Error analyzing line for hover:', error);
      }
    }
    
    if (!result || !result.fixes || result.fixes.length === 0) {
      return null;
    }
    
    // Create the hover content
    const fix = result.fixes[0];
    const severity = result.severity.charAt(0).toUpperCase() + result.severity.slice(1);
    
    // Create markdown content with buttons
    const markdownContent = new vscode.MarkdownString();
    markdownContent.isTrusted = true;
    markdownContent.supportHtml = true;
    
    markdownContent.appendMarkdown(`### ${severity}: ${result.message}\n\n`);
    markdownContent.appendMarkdown(`**Original Code:**\n\`\`\`${document.languageId}\n${document.lineAt(lineNumber).text}\n\`\`\`\n\n`);
    markdownContent.appendMarkdown(`**Suggested Fix:**\n\`\`\`${document.languageId}\n${fix.edits[0].newText}\n\`\`\`\n\n`);
    
    // Add accept/reject buttons using command URIs
    markdownContent.appendMarkdown(
      `[Accept Fix](command:gentestx.acceptFix?${encodeURIComponent(JSON.stringify([document.uri.toString(), lineNumber, fix.edits[0].newText]))}) &nbsp; ` +
      `[Reject](command:gentestx.rejectFix)`
    );
    
    return new vscode.Hover(markdownContent);
  }
}
