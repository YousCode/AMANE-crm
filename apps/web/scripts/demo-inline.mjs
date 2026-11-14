/* Réunit dist-demo/demo.html, son script et sa feuille de style en un seul fichier autonome : dist-demo/amane-demo.html.
   `--fragment` : sans <html>/<head>/<body> (pour un hébergeur qui fournit lui-même le squelette de page). */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo');
const html = readFileSync(join(dist, 'demo.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')); const css = assets.filter((f) => f.endsWith('.css'));
if (js.length !== 1 || css.length > 1) throw new Error(`un seul script et une seule feuille de style attendus (${js.length} js, ${css.length} css)`);
const script = readFileSync(join(dist, 'assets', js[0]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const style = css.length ? readFileSync(join(dist, 'assets', css[0]), 'utf8').replace(/<\/style/gi, '<\\/style') : '';
const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [''])[0];
const title = (html.match(/<title>[^<]*<\/title>/) || ['<title>Démo CRM Amane</title>'])[0];
const corps = `${fonts}\n<style>html,body,#root{height:100%}${style}</style>\n<div id="root"></div>\n<script type="module">${script}</script>\n`;
const fragment = process.argv.includes('--fragment');
const out = fragment ? `${title}\n${corps}` : `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="robots" content="noindex,nofollow">\n${title}\n</head>\n<body>\n${corps}</body>\n</html>\n`;
const file = join(dist, fragment ? 'amane-demo.fragment.html' : 'amane-demo.html');
writeFileSync(file, out);
console.log(`${file} — ${(out.length / 1024).toFixed(0)} Ko`);
