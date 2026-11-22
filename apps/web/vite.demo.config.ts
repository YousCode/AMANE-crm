/* Démo autonome : `npm run build:demo` → dist-demo/demo.html puis scripts/demo-inline.mjs → dist-demo/amane-demo.html (un seul fichier).
   L'application réelle n'est pas concernée (vite.config.ts). */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shim = fileURLToPath(new URL('./src/demo/router-shim.tsx', import.meta.url));
const routerEnMemoire = (): Plugin => ({
  name: 'amane-demo-router', enforce: 'pre',
  resolveId(source, importer) { return source === 'react-router-dom' && importer && !importer.includes('router-shim') ? shim : null; },
});

export default defineConfig({
  plugins: [routerEnMemoire(), react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  base: './',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('https://demo.amane.example') },
  build: { outDir: 'dist-demo', sourcemap: false, target: 'es2020', cssCodeSplit: false, assetsInlineLimit: 100000000, rollupOptions: { input: 'demo.html', output: { inlineDynamicImports: true } } },
});
