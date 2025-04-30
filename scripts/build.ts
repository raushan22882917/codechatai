import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';

const watch = process.argv.includes('--watch');

// Ensure the dist directory exists
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy HTML file
const htmlSource = path.join(__dirname, '..', 'src', 'webview-ui', 'index.html');
const htmlDest = path.join(distDir, 'index.html');

try {
  if (fs.existsSync(htmlSource)) {
    fs.copyFileSync(htmlSource, htmlDest);
    console.log('HTML file copied successfully');
  } else {
    // Create a default HTML file if source doesn't exist
    const defaultHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GenTestX</title>
</head>
<body>
  <div id="root">Loading GenTestX...</div>
  <script type="module" src="webview.js"></script>
</body>
</html>`;
    fs.writeFileSync(htmlDest, defaultHtml);
    console.log('Default HTML file created');
  }
} catch (error) {
  console.error('Error handling HTML file:', error);
}

// Build configuration
const buildOptions = {
  extension: {
    entryPoints: [path.join(__dirname, '..', 'src', 'extension.ts')],
    bundle: true,
    outfile: path.join(distDir, 'extension.js'),
    external: ['vscode'],
    format: 'cjs' as esbuild.Format,
    platform: 'node' as esbuild.Platform,
    sourcemap: true,
    minify: true,
    treeShaking: true,
  },
  webview: {
    entryPoints: [path.join(__dirname, '..', 'src', 'webview-ui', 'main.tsx')],
    bundle: true,
    outfile: path.join(distDir, 'webview.js'),
    format: 'esm' as esbuild.Format,
    platform: 'browser' as esbuild.Platform,
    sourcemap: true,
    minify: true,
    treeShaking: true,
  }
};

// Build function
async function buildAll() {
  try {
    await esbuild.build(buildOptions.extension);
    console.log('Extension build complete');

    await esbuild.build(buildOptions.webview);
    console.log('Webview build complete');

    console.log('All builds completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Watch function
async function watchAll() {
  const extensionCtx = await esbuild.context(buildOptions.extension);
  const webviewCtx = await esbuild.context(buildOptions.webview);

  await extensionCtx.watch();
  console.log('Watching extension for changes...');

  await webviewCtx.watch();
  console.log('Watching webview for changes...');

  console.log('Watch mode active');
}

// Run build or watch
if (watch) {
  watchAll();
} else {
  buildAll();
}
