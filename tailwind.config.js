/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/webview/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'vscode-bg': 'var(--vscode-editor-background)',
        'vscode-fg': 'var(--vscode-foreground)',
        'vscode-button': 'var(--vscode-button-background)',
        'vscode-button-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-button-fg': 'var(--vscode-button-foreground)',
        'vscode-input-bg': 'var(--vscode-input-background)',
        'vscode-input-fg': 'var(--vscode-input-foreground)',
        'vscode-border': 'var(--vscode-panel-border)',
        'vscode-focus': 'var(--vscode-focusBorder)',
      },
    },
  },
  plugins: [],
};
