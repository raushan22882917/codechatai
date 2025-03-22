import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../out/webview',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/index.tsx',
      formats: ['cjs'],
      fileName: () => 'webview.js'
    },
    rollupOptions: {
      external: ['vscode'],
      output: {
        globals: {
          vscode: 'vscode'
        }
      }
    }
  }
});
