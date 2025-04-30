import React from 'react';

interface AnalysisOutputProps {
  role: 'user' | 'assistant';
  content: string;
}

// Function to render text exactly as written, without any formatting
const formatPlainText = (text: string): JSX.Element => {
  // Simply render the text as-is, preserving all characters and line breaks
  return (
    <div style={styles.paragraph}>
      <pre style={styles.plainTextPre}>
        {text}
      </pre>
    </div>
  );
};

const AnalysisOutput: React.FC<AnalysisOutputProps> = ({ role, content }) => {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {formatPlainText(content)}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
  },
  content: {
    fontSize: '14px',
    lineHeight: 1.5,
  },
  paragraph: {
    marginBottom: '16px',
  },
  plainTextPre: {
    margin: 0,
    padding: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '14px',
    lineHeight: 1.5,
    overflow: 'visible',
    backgroundColor: 'transparent',
    color: 'var(--vscode-editor-foreground)',
  },
};

export default AnalysisOutput;
