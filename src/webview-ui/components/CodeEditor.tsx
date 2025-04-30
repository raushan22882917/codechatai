import React, { useRef } from 'react';
import { theme } from '../theme';
import { vscode } from '../utilities/vscode';

interface CodeEditorProps {
  code: string;
  language: string;
  fileName: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, language, fileName }) => {
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    if (codeRef.current) {
      // Create a temporary textarea to copy the text
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      // Show a temporary "Copied!" message
      const copyBtn = document.getElementById('copy-btn');
      if (copyBtn) {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Copied!';
        setTimeout(() => {
          copyBtn.innerText = originalText;
        }, 2000);
      }
    }
  };

  const handleCreate = () => {
    // Send message to extension to create a file
    vscode.postMessage({
      type: 'create-file',
      code,
      fileName,
      language
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Generated Code: {fileName}</div>
        <div style={styles.buttons}>
          <button
            id="copy-btn"
            style={styles.button}
            onClick={handleCopy}
            title="Copy code to clipboard"
          >
            Copy
          </button>
          <button
            style={styles.button}
            onClick={handleCreate}
            title="Create a new file with this code"
          >
            Create
          </button>
        </div>
      </div>
      <div style={styles.editorContainer}>
        <pre
          ref={codeRef}
          style={styles.codeBlock}
          className={`language-${language}`}
        >
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    marginBottom: '16px',
    overflow: 'hidden',
    boxShadow: theme.shadowLight,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: theme.darkNavy,
    borderBottom: `1px solid ${theme.border}`,
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: theme.white,
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    padding: '6px 12px',
    backgroundColor: theme.accent,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.accentHover,
    },
  },
  editorContainer: {
    maxHeight: '400px',
    overflow: 'auto' as const,
    backgroundColor: theme.backgroundCode,
    padding: '0',
  },
  codeBlock: {
    margin: '0',
    padding: '16px',
    backgroundColor: theme.backgroundCode,
    color: theme.white,
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '1.5',
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
  },
};

export default CodeEditor;
