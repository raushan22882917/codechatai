import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Create root element
const root = createRoot(document.getElementById('root')!);

// Render the App component
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
