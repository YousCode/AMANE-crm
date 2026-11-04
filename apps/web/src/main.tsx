import './styles/base.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/* Faux serveur (msw) en développement et pour Playwright, sauf si VITE_API_URL pointe un vrai serveur ou VITE_MOCK=0. */
async function start() {
  const wantMock = import.meta.env.VITE_MOCK === '1' || (!import.meta.env.VITE_API_URL && import.meta.env.DEV && import.meta.env.VITE_MOCK !== '0');
  if (wantMock) { const { startMocks } = await import('./mocks/browser'); await startMocks(); }
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
start();
