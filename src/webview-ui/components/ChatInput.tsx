import React, { useState, useEffect, KeyboardEvent, useRef } from 'react';

type InputMode = 'chat' | 'gentestx';

interface CodeInputProps {
  onSendMessage: (code: string, mode: string) => void;
  onFileRequest?: (query: string) => void;
  isLoading: boolean;
  initialValue?: string;
  placeholder?: string;
  suggestions?: string[];
  fixedAtBottom?: boolean;
}

const CodeInput: React.FC<CodeInputProps> = ({
  onSendMessage,
  onFileRequest,
  isLoading,
  initialValue = '',
  placeholder = 'Enter code to analyze or use @ to reference files...',
  suggestions = [],
  fixedAtBottom = false
}) => {
  const [input, setInput] = useState<string>(initialValue);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [atQuery, setAtQuery] = useState<string>('');
  const [inputMode, setInputMode] = useState<InputMode>('chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update input when initialValue changes
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
    }
  }, [initialValue]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input, inputMode);
      // Clear input after sending if fixed at bottom
      if (fixedAtBottom) {
        setInput('');
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (unless Shift is pressed)
    if (e.key === 'Enter' && !e.shiftKey && fixedAtBottom) {
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

  // Get placeholder text based on input mode
  const getPlaceholder = () => {
    if (inputMode === 'chat') {
      return 'Type a message...';
    } else {
      return 'Type a prompt (e.g., "Analyze this code" or "@filename to reference a file")...';
    }
  };

  return (
    <div style={fixedAtBottom ? styles.fixedContainer : styles.container}>
      {showSuggestions && suggestions.length > 0 && (
        <div style={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              style={styles.suggestion}
              onClick={() => insertSuggestion(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
      <div style={styles.inputWrapper}>
        <div style={styles.modeSelector}>
          <select
            value={inputMode}
            onChange={(e) => setInputMode(e.target.value as InputMode)}
            style={styles.modeSelect}
          >
            <option value="chat">Chat</option>
            <option value="gentestx">GenTestx AI</option>
          </select>
        </div>
        <textarea
          ref={textareaRef}
          style={fixedAtBottom ? styles.fixedTextarea : styles.textarea}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={isLoading}
          rows={fixedAtBottom ? 3 : 10}
          spellCheck={false}
        />
        <button
          style={styles.sendButton}
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--vscode-editor-background)',
    position: 'relative' as const,
  },
  fixedContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--vscode-editor-background)',
    position: 'sticky' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '8px',
    borderTop: '1px solid var(--vscode-panel-border)',
    zIndex: 10,
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'flex-end',
    width: '100%',
  },
  modeSelector: {
    display: 'flex',
    alignItems: 'center',
    marginRight: '8px',
  },
  modeSelect: {
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-dropdown-background)',
    color: 'var(--vscode-dropdown-foreground)',
    border: '1px solid var(--vscode-dropdown-border)',
    borderRadius: '4px',
    fontSize: '14px',
    height: '34px',
  },
  textarea: {
    resize: 'vertical' as const,
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '1.5',
    minHeight: '150px',
    width: '100%',
  },
  fixedTextarea: {
    resize: 'none' as const,
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '1.5',
    minHeight: '60px',
    width: '100%',
  },
  sendButton: {
    marginLeft: '8px',
    padding: '6px 12px',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    height: '34px',
    minWidth: '60px',
  },
  suggestionsContainer: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '0',
    width: '100%',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    backgroundColor: 'var(--vscode-dropdown-background)',
    border: '1px solid var(--vscode-dropdown-border)',
    borderRadius: '4px',
    zIndex: 100,
  },
  suggestion: {
    padding: '8px 12px',
    cursor: 'pointer',
    color: 'var(--vscode-dropdown-foreground)',
    ':hover': {
      backgroundColor: 'var(--vscode-list-hoverBackground)',
    },
  },
};

export default CodeInput;
