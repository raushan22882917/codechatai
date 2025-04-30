import * as vscode from 'vscode';
import axios from 'axios';

/**
 * Interface for a code analysis result
 */
export interface LineAnalysisResult {
  lineNumber: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  fixes?: CodeFix[];
}

/**
 * Interface for a code fix suggestion
 */
export interface CodeFix {
  title: string;
  edits: vscode.TextEdit[];
}

/**
 * Analyzes a specific line of code for bugs and errors
 * @param document The document to analyze
 * @param lineNumber The line number to analyze (0-based)
 * @param apiKey The Groq API key
 * @returns A promise that resolves to an analysis result
 */
export async function analyzeCodeLine(
  document: vscode.TextDocument,
  lineNumber: number,
  apiKey: string
): Promise<LineAnalysisResult | null> {
  try {
    // Get the line text
    const line = document.lineAt(lineNumber);
    const lineText = line.text;

    if (!lineText.trim()) {
      return null; // Skip empty lines
    }

    // Get context (a few lines before and after)
    const startLine = Math.max(0, lineNumber - 3);
    const endLine = Math.min(document.lineCount - 1, lineNumber + 3);

    let contextCode = '';
    for (let i = startLine; i <= endLine; i++) {
      const contextLine = document.lineAt(i).text;
      if (i === lineNumber) {
        contextCode += `> ${contextLine}\n`; // Mark the target line
      } else {
        contextCode += `  ${contextLine}\n`;
      }
    }

    // Get the language ID
    const language = document.languageId;

    // Create the prompt for the AI
    const prompt = `
    Analyze this line of ${language} code for bugs, errors, or potential improvements:

    ${contextCode}

    Focus on the line marked with ">". Identify any:
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
            content: `You are a code analysis expert that specializes in finding bugs and suggesting fixes. Respond only with JSON.
            When generating text, output all characters exactly as they are written, without applying any formatting, parsing, or interpretation.
            Treat characters like **, *, _, #, [, ], (, ), {, }, <, >, ~, \`, \\, %, $, @, ^, &, |, :, ;, ', " and any similar symbols as plain, literal text.
            Do NOT apply Markdown, HTML, LaTeX, or any other syntax formatting rules to them.
            Preserve all special characters exactly as provided, even if they normally trigger styling or linking behavior.
            Never attempt to bold, italicize, create lists, links, code blocks, headings, emojis, or perform escape sequences automatically.`
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
      return null;
    }

    try {
      const result = JSON.parse(jsonMatch[0]);

      if (!result.hasIssues) {
        return null; // No issues found
      }

      // Create a code fix if available
      const fixes: CodeFix[] = [];
      if (result.fix && result.fix.suggestion) {
        const range = new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber, line.text.length)
        );

        fixes.push({
          title: result.fix.explanation || 'Fix issue',
          edits: [vscode.TextEdit.replace(range, result.fix.suggestion)]
        });
      }

      return {
        lineNumber,
        message: result.message,
        severity: result.severity || 'info',
        fixes
      };
    } catch (parseError) {
      console.error('Error parsing analysis result:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error analyzing code line:', error);
    return null;
  }
}

/**
 * Analyzes an entire file for bugs and errors
 * @param document The document to analyze
 * @param apiKey The Groq API key
 * @returns A promise that resolves to an array of analysis results
 */
export async function analyzeFile(
  document: vscode.TextDocument,
  apiKey: string
): Promise<LineAnalysisResult[]> {
  const results: LineAnalysisResult[] = [];

  // Analyze each line
  for (let i = 0; i < document.lineCount; i++) {
    const result = await analyzeCodeLine(document, i, apiKey);
    if (result) {
      results.push(result);
    }

    // Show progress notification every 10 lines
    if (i % 10 === 0) {
      vscode.window.setStatusBarMessage(`Analyzing line ${i + 1}/${document.lineCount}...`);
    }
  }

  vscode.window.setStatusBarMessage('Code analysis complete', 3000);
  return results;
}

/**
 * Creates diagnostics from analysis results
 * @param results The analysis results
 * @param document The document
 * @returns An array of diagnostics
 */
export function createDiagnostics(
  results: LineAnalysisResult[],
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  return results.map(result => {
    const line = document.lineAt(result.lineNumber);
    const range = new vscode.Range(
      new vscode.Position(result.lineNumber, 0),
      new vscode.Position(result.lineNumber, line.text.length)
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      result.message,
      getSeverity(result.severity)
    );

    // Add metadata for code fixes
    diagnostic.source = 'GenTestX';
    diagnostic.code = {
      value: 'gentestx.fix',
      target: vscode.Uri.parse(`command:gentestx.fixCode?${encodeURIComponent(JSON.stringify([document.uri.toString(), result.lineNumber]))}`)
    };

    return diagnostic;
  });
}

/**
 * Converts a severity string to a vscode.DiagnosticSeverity
 * @param severity The severity string
 * @returns The corresponding vscode.DiagnosticSeverity
 */
function getSeverity(severity: string): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}
