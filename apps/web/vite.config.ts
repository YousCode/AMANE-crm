/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base « /app/ » : le build statique est servi par l'API Express sous /app.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  base: mode === 'production' ? '/app/' : '/',
  server: { port: 5173, strictPort: true, host: true },
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    // react-dom hissé à la racine (19.3.1, appli mobile) vs react local : tout passer par le résolveur Vite (dedupe) pour n'avoir qu'une copie.
    deps: { optimizer: { web: { enabled: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@testing-library/react', '@testing-library/dom', 'react-router-dom', 'zustand', 'zustand/react/shallow'] } } },
  },
}));
