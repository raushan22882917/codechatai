import React from 'react';
import { theme } from '../theme';
import { vscode } from '../utilities/vscode';

interface FixSuggestionProps {
  errorMessage: string;
  originalCode: string;
  fixedCode: string;
  lineNumber: number;
  language: string;
  onAccept: () => void;
  onReject: () => void;
}

const FixSuggestion: React.FC<FixSuggestionProps> = ({
  errorMessage,
  originalCode,
  fixedCode,
  lineNumber,
  language,
  onAccept,
  onReject
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Error Detected</h3>
        <span style={styles.lineInfo}>Line {lineNumber + 1}</span>
      </div>
      
      <div style={styles.errorMessage}>
        {errorMessage}
      </div>
      
      <div style={styles.codeComparison}>
        <div style={styles.codeSection}>
          <div style={styles.codeHeader}>Original Code:</div>
          <pre style={styles.codeBlock}>
            <code>{originalCode}</code>
          </pre>
        </div>
        
        <div style={styles.codeSection}>
          <div style={styles.codeHeader}>Suggested Fix:</div>
          <pre style={styles.codeBlock}>
            <code>{fixedCode}</code>
          </pre>
        </div>
      </div>
      
      <div style={styles.actions}>
        <button 
          style={styles.acceptButton}
          onClick={onAccept}
          title="Accept this fix"
        >
          Accept Fix
        </button>
        <button 
          style={styles.rejectButton}
          onClick={onReject}
          title="Reject this fix"
        >
          Reject
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    padding: '16px',
    marginBottom: '16px',
    boxShadow: theme.shadowLight,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: `1px solid ${theme.borderLight}`,
    paddingBottom: '8px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: theme.error,
  },
  lineInfo: {
    fontSize: '12px',
    color: theme.textSecondary,
    backgroundColor: theme.lightNavy,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  errorMessage: {
    marginBottom: '16px',
    color: theme.textPrimary,
    fontSize: '14px',
    lineHeight: '1.5',
  },
  codeComparison: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '16px',
  },
  codeSection: {
    flex: 1,
  },
  codeHeader: {
    fontSize: '12px',
    color: theme.textSecondary,
    marginBottom: '4px',
  },
  codeBlock: {
    margin: 0,
    padding: '12px',
    backgroundColor: theme.backgroundCode,
    borderRadius: '6px',
    overflow: 'auto' as const,
    fontSize: '13px',
    fontFamily: 'monospace',
    maxHeight: '150px',
    border: `1px solid ${theme.borderLight}`,
    color: theme.textPrimary,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  acceptButton: {
    padding: '8px 16px',
    backgroundColor: theme.success,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: '#218838',
    },
  },
  rejectButton: {
    padding: '8px 16px',
    backgroundColor: theme.error,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: '#c82333',
    },
  },
};

export default FixSuggestion;
