import React, { useState, useEffect, KeyboardEvent, useRef } from 'react';
import { theme } from '../theme';
import { vscode } from '../utilities/vscode';

type InputMode = 'chat' | 'gentestx';

interface ModernChatInputProps {
  onSendMessage: (code: string, mode: string) => void;
  onFileRequest?: (query: string) => void;
  isLoading: boolean;
  initialValue?: string;
  placeholder?: string;
  suggestions?: string[];
  currentFile?: string | null;
  selectedCode?: {
    code: string;
    language: string;
    lineNumber: number;
  } | null;
  onClearCurrentFile?: () => void;
  onClearSelectedCode?: () => void;
  workspaceFolders?: string[];
  onRunAllTests?: () => void;
  hasTestCases?: boolean;
  isRunningTests?: boolean;
}

const ModernChatInput: React.FC<ModernChatInputProps> = ({
  onSendMessage,
  onFileRequest,
  isLoading,
  initialValue = '',
  placeholder,
  suggestions = [],
  currentFile = null,
  selectedCode = null,
  onClearCurrentFile,
  onClearSelectedCode,
  workspaceFolders = [],
  onRunAllTests,
  hasTestCases = false,
  isRunningTests = false
}) => {
  const [input, setInput] = useState<string>(initialValue);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [atQuery, setAtQuery] = useState<string>('');
  const [inputMode, setInputMode] = useState<InputMode>('chat');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [showFolderDropdown, setShowFolderDropdown] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Update input when initialValue changes
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
    }
  }, [initialValue]);

  // Update input when selectedCode changes
  useEffect(() => {
    if (selectedCode?.code) {
      setInput(selectedCode.code);
      // Set input mode to GenTestx AI for code analysis
      setInputMode('gentestx');
    }
  }, [selectedCode]);

  // Set the selected folder when workspaceFolders changes
  useEffect(() => {
    if (workspaceFolders && workspaceFolders.length > 0) {
      setSelectedFolder(workspaceFolders[0]);
    }
  }, [workspaceFolders]);

  // Handle clicks outside the folder dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input, inputMode);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (unless Shift is pressed)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Allow tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      // Insert tab at cursor position
      const newValue = input.substring(0, start) + '  ' + input.substring(end);
      setInput(newValue);

      // Move cursor after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }

    // Handle @ mentions
    if (e.key === '@') {
      setShowSuggestions(true);
      setAtQuery('');
      setCursorPosition(e.currentTarget.selectionStart + 1);
    }

    // Close suggestions on Escape
    if (e.key === 'Escape' && showSuggestions) {
      setShowSuggestions(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Check if we're in an @ mention
    if (showSuggestions) {
      const curPos = e.target.selectionStart;
      const textBeforeCursor = newValue.substring(0, curPos);
      const lastAtPos = textBeforeCursor.lastIndexOf('@');

      if (lastAtPos >= 0) {
        const query = textBeforeCursor.substring(lastAtPos + 1);
        setAtQuery(query);

        // Trigger file search if onFileRequest is provided
        if (onFileRequest && query.length > 0) {
          onFileRequest(query);
        }
      } else {
        // If no @ found before cursor, close suggestions
        setShowSuggestions(false);
      }
    }
  };

  const insertSuggestion = (suggestion: string) => {
    const beforeAt = input.substring(0, input.lastIndexOf('@', cursorPosition));
    const afterCursor = input.substring(cursorPosition);

    // Insert the suggestion
    const newValue = `${beforeAt}@${suggestion} ${afterCursor}`;
    setInput(newValue);
    setShowSuggestions(false);

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const toggleFolderDropdown = () => {
    setShowFolderDropdown(!showFolderDropdown);
  };

  const selectFolder = (folder: string) => {
    setSelectedFolder(folder);
    setShowFolderDropdown(false);
  };

  // Get placeholder text based on input mode
  const getPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    if (inputMode === 'chat') {
      return 'Describe code you want to generate...';
    } else {
      return 'Enter code to analyze or use @ to reference files...';
    }
  };

  return (
    <div style={styles.container}>
      {/* Current Project Folder Indicator */}
      {selectedFolder && (
        <div style={styles.folderIndicator}>
          <div style={styles.folderInfo} onClick={toggleFolderDropdown}>
            <span style={styles.folderIcon}>📁</span>
            <span style={styles.folderName}>{selectedFolder}</span>
            <span style={styles.dropdownArrow}>{showFolderDropdown ? '▲' : '▼'}</span>
          </div>

          {showFolderDropdown && workspaceFolders && workspaceFolders.length > 0 && (
            <div ref={folderDropdownRef} style={styles.folderDropdown}>
              {workspaceFolders.map((folder, index) => (
                <div
                  key={index}
                  style={{
                    ...styles.folderOption,
                    ...(folder === selectedFolder ? styles.selectedFolderOption : {})
                  }}
                  onClick={() => selectFolder(folder)}
                >
                  <span style={styles.folderIcon}>📁</span>
                  {folder}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current File Indicator */}
      {currentFile && (
        <div style={styles.currentFileIndicator}>
          <span style={styles.fileIcon}>📄</span>
          <span style={styles.currentFileName}>{currentFile}</span>
          <button
            style={styles.clearFileButton}
            onClick={onClearCurrentFile}
            title="Clear current file"
          >
            ×
          </button>
        </div>
      )}

      {/* Selected Code Indicator */}
      {selectedCode && (
        <div style={styles.selectedCodeIndicator}>
          <span style={styles.codeIcon}>📝</span>
          <span style={styles.selectedCodeInfo}>
            Selected code from line {selectedCode.lineNumber + 1}
          </span>
          <button
            style={styles.clearFileButton}
            onClick={onClearSelectedCode}
            title="Clear selected code"
          >
            ×
          </button>
        </div>
      )}

      {/* File Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              style={styles.suggestion}
              onClick={() => insertSuggestion(suggestion)}
            >
              <span style={styles.fileIcon}>📄</span>
              {suggestion}
            </div>
          ))}
        </div>
      )}

      {/* Input Container */}
      <div style={styles.inputContainer}>
        <div style={styles.inputWrapper}>
          {/* Mode Selector */}
          <div style={styles.modeSelector}>
            <select
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value as InputMode)}
              style={styles.modeSelect}
              title="Select mode"
            >
              <option value="chat">Agent</option>
              <option value="gentestx">GenTestx AI</option>
            </select>
            <span style={styles.autoLabel}>Auto</span>
          </div>

          {/* Text Input */}
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isLoading}
            rows={1}
            spellCheck={false}
          />

          {/* Action Buttons */}
          <div style={styles.actionButtons}>
            <button
              style={styles.actionButton}
              title="Insert file reference"
              onClick={() => {
                if (textareaRef.current) {
                  const curPos = textareaRef.current.selectionStart;
                  const newValue = input.substring(0, curPos) + '@' + input.substring(curPos);
                  setInput(newValue);
                  setShowSuggestions(true);
                  setAtQuery('');
                  setCursorPosition(curPos + 1);
                  textareaRef.current.focus();
                }
              }}
            >
              @
            </button>
            {hasTestCases && onRunAllTests && (
              <button
                style={styles.runAllTestsButton}
                onClick={onRunAllTests}
                disabled={isRunningTests}
                title="Run All Test Cases"
              >
                Run All Tests
              </button>
            )}
            <button
              style={styles.sendButton}
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              title="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'sticky' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px',
    backgroundColor: theme.darkNavy,
    borderTop: `1px solid ${theme.border}`,
    zIndex: 10,
  },
  // Folder indicator styles
  folderIndicator: {
    display: 'flex',
    flexDirection: 'column' as const,
    marginBottom: '8px',
    position: 'relative' as const,
  },
  folderInfo: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: theme.darkNavy,
    borderRadius: '4px',
    border: `1px solid ${theme.border}`,
    cursor: 'pointer',
    fontSize: '13px',
    color: theme.white,
    '&:hover': {
      backgroundColor: theme.lightNavy,
    },
  },
  folderIcon: {
    marginRight: '6px',
    fontSize: '14px',
  },
  fileIcon: {
    marginRight: '6px',
    fontSize: '14px',
  },
  codeIcon: {
    marginRight: '6px',
    fontSize: '14px',
  },
  folderName: {
    flex: 1,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    color: theme.white,
  },
  dropdownArrow: {
    marginLeft: '8px',
    fontSize: '10px',
    color: theme.textSecondary,
  },
  folderDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.backgroundSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    marginTop: '4px',
    zIndex: 100,
    maxHeight: '200px',
    overflowY: 'auto' as const,
    boxShadow: theme.shadow,
  },
  folderOption: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: theme.textPrimary,
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      backgroundColor: theme.lightNavy,
    },
  },
  selectedFolderOption: {
    backgroundColor: theme.accent + '20',
    color: theme.accent,
  },
  // Current file indicator styles
  currentFileIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    backgroundColor: theme.lightNavy,
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  selectedCodeIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    backgroundColor: theme.accent + '20', // Semi-transparent accent color
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  currentFileName: {
    color: theme.textSecondary,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  selectedCodeInfo: {
    color: theme.accent,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  clearFileButton: {
    backgroundColor: 'transparent',
    color: theme.textSecondary,
    border: 'none',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
    marginLeft: '8px',
    '&:hover': {
      backgroundColor: theme.borderLight,
      color: theme.white,
    },
  },
  // Input container styles
  inputContainer: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '8px',
    border: `2px solid ${theme.accent}`,
    overflow: 'hidden',
    boxShadow: theme.shadow,
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    padding: '12px',
    backgroundColor: theme.backgroundInput,
    borderRadius: '6px',
  },
  modeSelector: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginRight: '10px',
    position: 'relative' as const,
  },
  modeSelect: {
    padding: '6px 10px',
    backgroundColor: theme.darkNavy,
    color: theme.accent,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  },
  autoLabel: {
    fontSize: '10px',
    color: theme.textSecondary,
    marginTop: '4px',
  },
  textarea: {
    flex: 1,
    resize: 'none' as const,
    padding: '10px 12px',
    backgroundColor: 'transparent',
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: '1.5',
    minHeight: '24px',
    maxHeight: '150px',
    outline: 'none',
    overflow: 'auto' as const,
    overflowX: 'scroll' as const,
    whiteSpace: 'pre' as const,
  },
  actionButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actionButton: {
    backgroundColor: theme.darkNavy,
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    padding: 0,
    '&:hover': {
      backgroundColor: theme.lightNavy,
      color: theme.white,
    },
  },
  runAllTestsButton: {
    backgroundColor: theme.accent,
    color: theme.white,
    border: `1px solid ${theme.accent}`,
    borderRadius: '4px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    '&:hover': {
      backgroundColor: theme.accent + 'cc',
    },
    '&:disabled': {
      backgroundColor: theme.darkNavy,
      color: theme.textSecondary,
      cursor: 'not-allowed',
      border: `1px solid ${theme.border}`,
    },
  },
  sendButton: {
    backgroundColor: theme.accent,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    '&:hover': {
      backgroundColor: theme.accent + 'cc',
    },
    '&:disabled': {
      backgroundColor: theme.darkNavy,
      color: theme.textSecondary,
      cursor: 'not-allowed',
      border: `1px solid ${theme.border}`,
    },
  },
  // Suggestions styles
  suggestionsContainer: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '0',
    width: '100%',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    backgroundColor: theme.backgroundSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    zIndex: 100,
    boxShadow: theme.shadow,
  },
  suggestion: {
    padding: '8px 12px',
    cursor: 'pointer',
    color: theme.textPrimary,
    borderBottom: `1px solid ${theme.borderLight}`,
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      backgroundColor: theme.lightNavy,
    },
    '&:last-child': {
      borderBottom: 'none',
    },
  },
};

export default ModernChatInput;
