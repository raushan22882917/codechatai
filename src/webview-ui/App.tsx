import React, { useState, useEffect, useRef } from 'react';
import AnalysisOutput from './components/ChatOutput';
import SettingsForm, { SettingsData } from './components/SettingsForm';
import TabInterface from './components/TabInterface';
import ModernChatInput from './components/ModernChatInput';
import FixSuggestion from './components/FixSuggestion';
import RevertButton from './components/RevertButton';
import CodeEditor from './components/CodeEditor';
import { theme } from './theme';
import { vscode } from './utilities/vscode';

// Interface for a test case
interface TestCase {
  id: string;
  description: string;
  functionToTest: string;
  inputs: string;
  expectedOutput: string;
  scenario: string;
  testCode: string;
  isRunning: boolean;
  runResult: string | null;
  passed?: boolean;
}

// Interface for analysis state
interface AnalysisState {
  code: string;
  language: string;
  result: string | null;
  isLoading: boolean;
  error: string | null;
  fileSuggestions: string[];
  currentFile: string | null;
  testCases: TestCase[];
  isGeneratingTests: boolean;
}

// Interface for app settings
interface AppSettings {
  groqApiKey: string;
  defaultMode: 'chat' | 'gentestx';
  defaultLanguage: string;
}

const App: React.FC = () => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');

  // State for settings
  const [settings, setSettings] = useState<AppSettings>({
    groqApiKey: '',
    defaultMode: 'chat',
    defaultLanguage: 'javascript'
  });

  // State for selected code
  const [selectedCode, setSelectedCode] = useState<{
    code: string;
    language: string;
    lineNumber: number;
  } | null>(null);

  // State for fix suggestions
  const [fixSuggestion, setFixSuggestion] = useState<{
    errorMessage: string;
    originalCode: string;
    fixedCode: string;
    lineNumber: number;
    language: string;
  } | null>(null);

  // State for revert button
  const [showRevertButton, setShowRevertButton] = useState<boolean>(false);

  // State for generated code
  const [generatedCode, setGeneratedCode] = useState<{
    code: string;
    fileName: string;
    language: string;
  } | null>(null);

  // Analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    code: '',
    language: 'javascript',
    result: null,
    isLoading: false,
    error: null,
    fileSuggestions: [],
    currentFile: null,
    testCases: [],
    isGeneratingTests: false
  });

  // State for workspace folders
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([]);

  const resultRef = useRef<HTMLDivElement>(null);

  // Scroll to result when it changes
  useEffect(() => {
    if (analysisState.result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [analysisState.result]);

  // Load settings and workspace folders from VS Code
  useEffect(() => {
    vscode.postMessage({
      type: 'get-settings'
    });

    vscode.postMessage({
      type: 'get-workspace-folders'
    });
  }, []);

  // Handle saving settings
  const handleSaveSettings = (newSettings: SettingsData) => {
    setSettings({
      groqApiKey: newSettings.groqApiKey,
      defaultMode: newSettings.defaultMode,
      defaultLanguage: newSettings.defaultLanguage
    });

    // Switch back to chat tab after saving
    setActiveTab('chat');
  };

  // Handle running all test cases
  const handleRunAllTests = () => {
    if (!analysisState.code || analysisState.testCases.length === 0) {
      return;
    }

    // Mark all tests as running
    setAnalysisState(prev => ({
      ...prev,
      testCases: prev.testCases.map(test => ({ ...test, isRunning: true, runResult: null }))
    }));

    // Send message to extension to run all tests
    vscode.postMessage({
      type: 'run-all-tests',
      testCases: analysisState.testCases,
      language: analysisState.language,
      userCode: analysisState.code
    });
  };

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'file-structure-analysis') {
        // File structure analysis result
        setAnalysisState(prev => ({
          ...prev,
          language: message.analysis.detectedLanguage || prev.language,
          currentFile: message.fileName || prev.currentFile,
          code: message.code || prev.code
        }));
      } else if (message.type === 'all-tests-results') {
        // Results from running all tests
        setAnalysisState(prev => ({
          ...prev,
          testCases: message.results.testCases,
          result: `Test Results: ${message.results.summary.passed}/${message.results.summary.total} tests passed`
        }));
      } else if (message.type === 'settings') {
        // Settings sent from the extension
        setSettings({
          groqApiKey: message.settings.groqApiKey || '',
          defaultMode: message.settings.defaultMode || 'chat',
          defaultLanguage: message.settings.defaultLanguage || 'javascript'
        });
      } else if (message.type === 'code-to-analyze') {
        // Code sent from the extension to analyze
        setAnalysisState(prev => ({
          ...prev,
          code: message.code,
          language: message.language,
          currentFile: message.fileName || null
        }));
      } else if (message.type === 'analysis-response') {
        setAnalysisState(prev => ({
          ...prev,
          result: message.data,
          isLoading: false,
          error: null
        }));
      } else if (message.type === 'analysis-error') {
        setAnalysisState(prev => ({
          ...prev,
          result: null,
          isLoading: false,
          error: message.error
        }));
      } else if (message.type === 'file-suggestions') {
        setAnalysisState(prev => ({
          ...prev,
          fileSuggestions: message.suggestions || []
        }));
      } else if (message.type === 'test-cases-generated') {
        setAnalysisState(prev => ({
          ...prev,
          testCases: message.testCases,
          isGeneratingTests: false,
          error: null
        }));
      } else if (message.type === 'test-generation-error') {
        setAnalysisState(prev => ({
          ...prev,
          isGeneratingTests: false,
          error: message.error
        }));
      } else if (message.type === 'test-run-result') {
        setAnalysisState(prev => ({
          ...prev,
          testCases: prev.testCases.map(test =>
            test.id === message.testId
              ? { ...test, isRunning: false, runResult: message.result }
              : test
          )
        }));
      } else if (message.type === 'test-run-error') {
        setAnalysisState(prev => ({
          ...prev,
          testCases: prev.testCases.map(test =>
            test.id === message.testId
              ? { ...test, isRunning: false, runResult: `Error: ${message.error}` }
              : test
          )
        }));
      } else if (message.type === 'current-file') {
        // Update the current file and language
        setAnalysisState(prev => ({
          ...prev,
          currentFile: message.fileName,
          language: message.language
        }));
      } else if (message.type === 'selected-code') {
        // Handle selected code from the editor
        // Update the input in the ModernChatInput component
        setSelectedCode({
          code: message.code,
          language: message.language,
          lineNumber: message.lineNumber
        });

        // Automatically analyze the selected code for errors
        handleAnalyzeForErrors(message.code, message.language, message.lineNumber);
      } else if (message.type === 'error-analysis-result') {
        // Handle error analysis result
        if (message.hasIssues) {
          setFixSuggestion({
            errorMessage: message.message,
            originalCode: message.originalCode,
            fixedCode: message.fixedCode,
            lineNumber: message.lineNumber,
            language: message.language
          });
        }
      } else if (message.type === 'fix-applied') {
        // Show the revert button after a fix is applied
        setShowRevertButton(true);

        // Hide the revert button after 30 seconds
        setTimeout(() => {
          setShowRevertButton(false);
        }, 30000);
      } else if (message.type === 'revert-complete') {
        // Hide the revert button after a revert is complete
        setShowRevertButton(false);
      } else if (message.type === 'workspace-folders') {
        // Update workspace folders
        setWorkspaceFolders(message.folders || []);
      } else if (message.type === 'code-generated') {
        // Handle generated code
        setGeneratedCode({
          code: message.result.code,
          fileName: message.result.fileName,
          language: analysisState.language
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle code analysis request
  const handleAnalyzeCode = (code: string, language: string = 'javascript', mode: string = 'gentestx') => {
    if (!code.trim()) return;

    // Update state
    setAnalysisState(prev => ({
      ...prev,
      code,
      language,
      result: null,
      isLoading: true,
      error: null
    }));

    // Send message to extension
    vscode.postMessage({
      type: 'analyze-code',
      code,
      language,
      mode
    });
  };

  // Handle file request for @ mentions
  const handleFileRequest = (query: string) => {
    // Send message to extension to get file suggestions
    vscode.postMessage({
      type: 'get-file-suggestions',
      query
    });
  };

  // Handle analyzing current file
  const handleAnalyzeCurrentFile = () => {
    vscode.postMessage({
      type: 'analyze-current-file'
    });
  };

  // Handle generating test cases
  const handleGenerateTestCases = () => {
    if (!analysisState.code) {
      // If no code is loaded, first get the current file
      vscode.postMessage({
        type: 'get-current-file'
      });
      return;
    }

    setAnalysisState(prev => ({
      ...prev,
      isGeneratingTests: true,
      testCases: []
    }));

    // Send message to extension to generate test cases
    vscode.postMessage({
      type: 'generate-test-cases',
      code: analysisState.code,
      language: analysisState.language
    });
  };

  // Handle generating code and creating a new file
  const handleGenerateCode = (prompt: string) => {
    if (!prompt.trim()) return;

    // Clear any previous generated code
    setGeneratedCode(null);

    // Set loading state
    setAnalysisState(prev => ({
      ...prev,
      isLoading: true,
      result: null,
      error: null
    }));

    // Call the command to generate code
    vscode.postMessage({
      type: 'generate-code',
      prompt,
      language: analysisState.language || 'javascript'
    });
  };

  // Handle running a test case
  const handleRunTest = (testId: string) => {
    // Find the test case
    const testCase = analysisState.testCases.find(test => test.id === testId);
    if (!testCase) return;

    // Mark the test as running
    setAnalysisState(prev => ({
      ...prev,
      testCases: prev.testCases.map(test =>
        test.id === testId ? { ...test, isRunning: true, runResult: null } : test
      )
    }));

    // Send message to extension to run the test
    vscode.postMessage({
      type: 'run-test',
      testId,
      testCode: testCase.testCode,
      language: analysisState.language
    });
  };

  // Handle code analysis for errors
  const handleAnalyzeForErrors = (code: string, language: string, lineNumber: number) => {
    vscode.postMessage({
      type: 'analyze-for-errors',
      code,
      language,
      lineNumber
    });
  };

  // Handle accepting a fix suggestion
  const handleAcceptFix = () => {
    if (fixSuggestion) {
      vscode.postMessage({
        type: 'apply-fix',
        fixedCode: fixSuggestion.fixedCode,
        lineNumber: fixSuggestion.lineNumber
      });

      // Clear the fix suggestion
      setFixSuggestion(null);
    }
  };

  // Handle rejecting a fix suggestion
  const handleRejectFix = () => {
    // Just clear the fix suggestion
    setFixSuggestion(null);
  };

  // Render the chat interface
  const renderChatInterface = () => (
    <>
      <div style={styles.header}>
        <h2 style={styles.title}>
          GenTestX - Test Case Generator
          {analysisState.currentFile && (
            <span style={styles.currentFile}> - {analysisState.currentFile}</span>
          )}
        </h2>
        <div style={styles.headerActions}>
          <button
            style={styles.settingsButton}
            onClick={() => setActiveTab('settings')}
            title="Settings"
          >
            ⚙️
          </button>

          <button
            style={styles.generateTestsButton}
            onClick={handleGenerateTestCases}
            disabled={analysisState.isLoading || analysisState.isGeneratingTests}
          >
            Generate Test Cases
          </button>
          {analysisState.testCases.length > 0 && (
            <button
              style={styles.runAllTestsButton}
              onClick={handleRunAllTests}
              disabled={analysisState.isLoading || analysisState.testCases.some(t => t.isRunning)}
            >
              Run All Tests
            </button>
          )}
          {analysisState.currentFile && (
            <button
              style={styles.cancelButton}
              onClick={() => {
                setAnalysisState(prev => ({
                  ...prev,
                  currentFile: null
                }));
                vscode.postMessage({
                  type: 'clear-current-file'
                });
              }}
              title="Clear current file"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={styles.mainContainer}>
        <div style={styles.resultSection}>
          {fixSuggestion && (
            <FixSuggestion
              errorMessage={fixSuggestion.errorMessage}
              originalCode={fixSuggestion.originalCode}
              fixedCode={fixSuggestion.fixedCode}
              lineNumber={fixSuggestion.lineNumber}
              language={fixSuggestion.language}
              onAccept={handleAcceptFix}
              onReject={handleRejectFix}
            />
          )}

          {analysisState.isLoading && (
            <div style={styles.loading}>
              <p>Analyzing code with Groq AI...</p>
            </div>
          )}
          {analysisState.isGeneratingTests && (
            <div style={styles.loading}>
              <p>Generating test cases...</p>
            </div>
          )}
          {analysisState.error && (
            <div style={styles.error}>
              <p>Error: {analysisState.error}</p>
            </div>
          )}

          {/* Display generated code if available */}
          {generatedCode && (
            <CodeEditor
              code={generatedCode.code}
              language={generatedCode.language}
              fileName={generatedCode.fileName}
            />
          )}

          {/* Display test cases if available */}
          {analysisState.testCases.length > 0 && (
            <div style={styles.testCasesContainer}>
              <h3 style={styles.sectionTitle}>
                Generated Test Cases
                {analysisState.testCases.some(t => t.passed !== undefined) && (
                  <span style={styles.testSummary}>
                    {analysisState.testCases.filter(t => t.passed).length}/{analysisState.testCases.length} passed
                  </span>
                )}
              </h3>
              {analysisState.testCases.map(testCase => (
                <div key={testCase.id} style={{
                  ...styles.testCase,
                  ...(testCase.passed !== undefined ?
                    (testCase.passed ? styles.testCasePassed : styles.testCaseFailed) : {})
                }}>
                  <div style={styles.testCaseHeader}>
                    <h4 style={styles.testCaseTitle}>
                      {testCase.passed !== undefined && (
                        <span style={styles.testStatusIcon}>
                          {testCase.passed ? '✅' : '❌'}
                        </span>
                      )}
                      {testCase.description}
                    </h4>
                    <button
                      style={styles.runButton}
                      onClick={() => handleRunTest(testCase.id)}
                      disabled={testCase.isRunning}
                    >
                      {testCase.isRunning ? 'Running...' : 'Run Test'}
                    </button>
                  </div>
                  <div style={styles.testCaseDetails}>
                    <div style={styles.testCaseDetail}>
                      <span style={styles.testCaseLabel}>Function: </span>
                      <span>{testCase.functionToTest}</span>
                    </div>
                    <div style={styles.testCaseDetail}>
                      <span style={styles.testCaseLabel}>Inputs: </span>
                      <span>{testCase.inputs}</span>
                    </div>
                    <div style={styles.testCaseDetail}>
                      <span style={styles.testCaseLabel}>Expected Output: </span>
                      <span>{testCase.expectedOutput}</span>
                    </div>
                    <div style={styles.testCaseDetail}>
                      <span style={styles.testCaseLabel}>Scenario: </span>
                      <span>{testCase.scenario}</span>
                    </div>
                  </div>
                  <div style={styles.testCaseCode}>
                    <pre style={styles.codeBlock}>
                      <code>{testCase.testCode}</code>
                    </pre>
                  </div>
                  {testCase.runResult && (
                    <div style={testCase.runResult.includes('Error') ? styles.testCaseError : styles.testCaseSuccess}>
                      <pre>{testCase.runResult}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Display analysis result if available */}
          {analysisState.result && (
            <div style={styles.result}>
              <AnalysisOutput
                role="assistant"
                content={analysisState.result}
              />
            </div>
          )}

          {/* Empty state */}
          {!analysisState.isLoading &&
           !analysisState.isGeneratingTests &&
           !analysisState.result &&
           !analysisState.error &&
           analysisState.testCases.length === 0 && (
            <div style={styles.emptyState}>
              <p>Type a prompt below or use the buttons above</p>
              <p>Use @ to reference files or folders</p>
              <p>Click "Generate Test Cases" to create runnable tests</p>
            </div>
          )}
          <div ref={resultRef} />
        </div>
      </div>

      <ModernChatInput
        onSendMessage={(code, mode) => {
          if (mode === 'gentestx') {
            handleAnalyzeCode(code, analysisState.language, mode);
          } else {
            // If in chat mode, treat as code generation prompt
            handleGenerateCode(code);
          }
        }}
        onFileRequest={handleFileRequest}
        isLoading={analysisState.isLoading}
        initialValue={selectedCode?.code || ""}
        suggestions={analysisState.fileSuggestions}
        currentFile={analysisState.currentFile}
        selectedCode={selectedCode}
        workspaceFolders={workspaceFolders}
        onClearSelectedCode={() => setSelectedCode(null)}
        onClearCurrentFile={() => {
          setAnalysisState(prev => ({
            ...prev,
            currentFile: null
          }));

          // Notify the extension that the current file has been cleared
          vscode.postMessage({
            type: 'clear-current-file'
          });
        }}
        onRunAllTests={handleRunAllTests}
        hasTestCases={analysisState.testCases.length > 0}
        isRunningTests={analysisState.testCases.some(t => t.isRunning)}
      />

      {/* Revert button */}
      <RevertButton visible={showRevertButton} />
    </>
  );

  // Render the settings interface
  const renderSettingsInterface = () => (
    <div style={styles.settingsContainer}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          GenTestX - Settings
        </h2>
        <div style={styles.headerActions}>
          <button
            style={styles.backButton}
            onClick={() => setActiveTab('chat')}
          >
            Back to Chat
          </button>
        </div>
      </div>

      <div style={styles.settingsContent}>
        <SettingsForm
          onSave={handleSaveSettings}
          initialSettings={{
            groqApiKey: settings.groqApiKey,
            defaultMode: settings.defaultMode,
            defaultLanguage: settings.defaultLanguage
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      {activeTab === 'chat' ? renderChatInterface() : renderSettingsInterface()}
    </div>
  );
};

// Inline styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: theme.backgroundPrimary,
    color: theme.textPrimary,
  },
  header: {
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.darkNavy,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'normal' as const,
    display: 'flex',
    alignItems: 'center',
    color: theme.white,
  },
  currentFile: {
    fontSize: '14px',
    fontWeight: 'normal' as const,
    color: theme.textSecondary,
    marginLeft: '8px',
    textOverflow: 'ellipsis' as const,
    overflow: 'hidden' as const,
    whiteSpace: 'nowrap' as const,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  settingsButton: {
    padding: '6px 10px',
    backgroundColor: theme.buttonSecondary,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.buttonSecondaryHover,
    },
  },
  backButton: {
    padding: '8px 12px',
    backgroundColor: theme.buttonSecondary,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.buttonSecondaryHover,
    },
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    backgroundColor: theme.backgroundPrimary,
  },
  inputSection: {
    padding: '16px',
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.backgroundSecondary,
  },
  resultSection: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto' as const,
    backgroundColor: theme.backgroundPrimary,
    scrollBehavior: 'smooth' as const,
    maxHeight: 'calc(100vh - 180px)',
  },
  settingsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  settingsContent: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto' as const,
    backgroundColor: theme.backgroundPrimary,
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 'normal' as const,
    color: theme.white,
  },
  languageSelector: {
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  select: {
    marginLeft: '8px',
    marginRight: '16px',
    padding: '4px 8px',
    backgroundColor: theme.dropdownBackground,
    color: theme.textPrimary,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
  },
  analyzeButton: {
    marginTop: '8px',
    padding: '8px 16px',
    backgroundColor: theme.buttonPrimary,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
    boxShadow: theme.shadowLight,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.buttonPrimaryHover,
    },
  },
  analyzeCurrentButton: {
    padding: '8px 16px',
    backgroundColor: theme.buttonPrimary,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '8px',
    boxShadow: theme.shadowLight,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.buttonPrimaryHover,
    },
  },
  generateCodeButton: {
    padding: '8px 16px',
    backgroundColor: theme.accent,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: theme.shadowLight,
    transition: 'background-color 0.2s ease',
    marginRight: '8px',
    '&:hover': {
      backgroundColor: theme.accentHover,
    },
  },
  generateTestsButton: {
    padding: '8px 16px',
    backgroundColor: theme.buttonPrimary,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: theme.shadowLight,
    transition: 'background-color 0.2s ease',
    marginRight: '8px',
    '&:hover': {
      backgroundColor: theme.buttonPrimaryHover,
    },
  },
  runAllTestsButton: {
    padding: '8px 16px',
    backgroundColor: theme.accent,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: theme.shadowLight,
    transition: 'background-color 0.2s ease',
    marginRight: '8px',
    '&:hover': {
      backgroundColor: theme.accentHover,
    },
  },
  cancelButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: theme.error,
      color: theme.white,
    },
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    color: theme.textSecondary,
    textAlign: 'center' as const,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '8px',
    padding: '20px',
    margin: '20px 0',
  },
  loading: {
    padding: '12px 16px',
    fontStyle: 'italic',
    color: theme.textSecondary,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '4px',
    margin: '10px 0',
  },
  error: {
    padding: '12px 16px',
    color: theme.error,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderRadius: '4px',
    border: `1px solid ${theme.error}`,
    margin: '10px 0',
  },
  result: {
    padding: '16px',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    marginBottom: '60px', // Add space for the fixed input at bottom
    boxShadow: theme.shadowLight,
  },
  testCasesContainer: {
    marginBottom: '20px',
  },
  testCase: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: 'var(--vscode-editor-background)',
    borderRadius: '4px',
    border: '1px solid var(--vscode-panel-border)',
  },
  testCaseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  testCaseTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  runButton: {
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  testCaseDetails: {
    marginBottom: '8px',
    fontSize: '13px',
  },
  testCaseDetail: {
    marginBottom: '4px',
  },
  testCaseLabel: {
    fontWeight: 'bold' as const,
    color: 'var(--vscode-editor-foreground)',
  },
  testCaseCode: {
    marginBottom: '8px',
  },
  codeBlock: {
    margin: 0,
    padding: '8px',
    backgroundColor: 'var(--vscode-textCodeBlock-background)',
    borderRadius: '4px',
    overflow: 'auto' as const,
    fontSize: '12px',
    fontFamily: 'monospace',
    maxHeight: '200px',
  },
  testCaseSuccess: {
    padding: '8px',
    backgroundColor: 'var(--vscode-testing-iconPassed)',
    color: 'var(--vscode-editor-background)',
    borderRadius: '4px',
    fontSize: '12px',
  },
  testCaseError: {
    padding: '8px',
    backgroundColor: 'var(--vscode-testing-iconFailed)',
    color: 'var(--vscode-editor-background)',
    borderRadius: '4px',
    fontSize: '12px',
  },
  testCasePassed: {
    borderLeft: '4px solid var(--vscode-testing-iconPassed)',
  },
  testCaseFailed: {
    borderLeft: '4px solid var(--vscode-testing-iconFailed)',
  },
  testStatusIcon: {
    marginRight: '8px',
  },
  testSummary: {
    fontSize: '14px',
    fontWeight: 'normal' as const,
    marginLeft: '12px',
    color: theme.textSecondary,
  },
};

export default App;
