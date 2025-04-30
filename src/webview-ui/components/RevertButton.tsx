import React from 'react';
import { theme } from '../theme';
import { vscode } from '../utilities/vscode';

interface RevertButtonProps {
  visible: boolean;
}

const RevertButton: React.FC<RevertButtonProps> = ({ visible }) => {
  if (!visible) {
    return null;
  }
  
  const handleRevert = () => {
    // Send message to extension to revert the last change
    vscode.postMessage({
      type: 'revert-last-change'
    });
  };
  
  return (
    <button
      style={styles.revertButton}
      onClick={handleRevert}
      title="Revert last change"
    >
      ↩️ Revert Last Change
    </button>
  );
};

const styles = {
  revertButton: {
    position: 'fixed' as const,
    bottom: '80px',
    right: '20px',
    padding: '8px 12px',
    backgroundColor: theme.buttonSecondary,
    color: theme.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    boxShadow: theme.shadow,
    zIndex: 100,
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    '&:hover': {
      backgroundColor: theme.buttonSecondaryHover,
    },
    '&:active': {
      transform: 'translateY(1px)',
    },
  },
};

export default RevertButton;
