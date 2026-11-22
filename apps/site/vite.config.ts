import { defineConfig } from 'vite';

// Site statique : `dist/` se dépose chez n'importe quel hébergeur, ou est servi par l'API à la racine.
export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: true, host: true },
  build: { outDir: 'dist', target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 900 },
});
