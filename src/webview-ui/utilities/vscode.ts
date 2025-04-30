// Get the VS Code API
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

// Create a reference to the VS Code API
export const vscode = window.acquireVsCodeApi();
