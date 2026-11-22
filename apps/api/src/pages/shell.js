// Coquille HTML des pages publiques (devis partagé, espace client, portail prestataire, inscription) : charte Amane stricte.
// Ivoire #FAF8F4, noir #111, champagne #B8955C ; Bodoni Moda + Jost (Google Fonts) ; le A à serrure ; slogan en pied.
import { tokens, isRtl, t } from '@amane/shared';

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const C = tokens.colors.light;
const D = tokens.colors.dark;

export function logo(size = 26) {
  return `<svg viewBox="${tokens.logoViewBox}" width="${size}" height="${Math.round(size * 1120 / 940)}" aria-hidden="true"><path fill="currentColor" d="${tokens.logoPath}"/></svg>`;
}

export const slogan = () => `<p class="slogan">Arrive as a <em>Guest</em>. Leave with a <em>Story</em>.</p>`;

export function shell({ lang = 'EN', title, body, description = '', scripts = '', css = '' }) {
  const L = String(lang || 'EN').toUpperCase();
  const rtl = isRtl(L);
  return `<!doctype html>
<html lang="${L.toLowerCase()}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${C.bg}">
<title>${esc(title)} — Amane</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tokens.logoViewBox}"><path fill="${C.fg}" d="${tokens.logoPath}"/></svg>`)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${tokens.googleFonts}">
<style>
:root{--bg:${C.bg};--bg2:${C.bg2};--panel:${C.panel};--panel2:${C.panel2};--line:${C.line};--line2:${C.line2};--fg:${C.fg};--fg2:${C.fg2};--fg3:${C.fg3};--accent:${C.accent};--accent-ink:${C.accentInk};--champagne:${C.champagne};--stone:${C.stone};--ok:${C.ok};--warn:${C.warn};--bad:${C.bad};--radius:${tokens.radius}px;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:${D.bg};--bg2:${D.bg2};--panel:${D.panel};--panel2:${D.panel2};--line:${D.line};--line2:${D.line2};--fg:${D.fg};--fg2:${D.fg2};--fg3:${D.fg3};--accent:${D.accent};--accent-ink:${D.accentInk};--champagne:${D.champagne};--stone:${D.stone};--ok:${D.ok};--warn:${D.warn};--bad:${D.bad};color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:${tokens.fonts.ui};font-weight:300;font-size:16px;line-height:1.55;min-height:100dvh;display:flex;flex-direction:column}
${rtl ? `body{font-family:${tokens.fonts.arabic},${tokens.fonts.ui}}` : ''}
a{color:inherit}
.wrap{width:100%;max-width:760px;margin:0 auto;padding:0 16px}
header.top{padding:22px 0 14px;border-bottom:1px solid var(--line2)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--fg)}
.brand .word{font-family:${tokens.fonts.ui};font-weight:500;font-size:12px;letter-spacing:.34em;text-transform:uppercase}
.label{font-family:${tokens.fonts.ui};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--fg3);font-weight:400}
h1,h2,h3,.display{font-family:${tokens.fonts.display};font-weight:400;letter-spacing:-.01em;margin:0}
h1{font-size:clamp(30px,6vw,42px);line-height:1.1;margin:8px 0 6px}
h1 em,h2 em,.slogan em{font-style:italic;color:var(--champagne)}
h2{font-size:22px;margin:0 0 10px}
.muted{color:var(--fg3);font-size:14px}
main{flex:1;padding:26px 0 40px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin:16px 0}
.num{font-family:${tokens.fonts.mono};font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{padding:10px 6px;border-bottom:1px solid var(--line2);text-align:${rtl ? 'right' : 'left'};vertical-align:top;font-size:15px}
th{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg3);font-weight:400}
td.n,th.n{text-align:${rtl ? 'left' : 'right'};white-space:nowrap}
.tot{margin-${rtl ? 'right' : 'left'}:auto;width:min(380px,100%)}
.tot td{border:0;padding:5px 6px}
.tot tr.g td{border-top:1px solid var(--fg);font-size:18px;padding-top:10px;font-family:${tokens.fonts.display}}
.btns{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0 6px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 22px;border-radius:999px;border:1px solid var(--fg);background:var(--fg);color:var(--bg);font-family:${tokens.fonts.ui};font-weight:500;font-size:15px;letter-spacing:.02em;text-decoration:none;cursor:pointer;flex:1 1 220px}
.btn.ghost{background:transparent;color:var(--fg)}
.btn[disabled]{opacity:.5;cursor:default}
.chip{display:inline-block;padding:4px 12px;border:1px solid var(--champagne);color:var(--champagne);border-radius:999px;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
.ok{color:var(--ok)}.warn{color:var(--warn)}
.day{margin-top:22px;font-family:${tokens.fonts.display};font-size:19px;border-bottom:1px solid var(--line2);padding-bottom:6px}
.st{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)}
.st b{font-weight:400;color:var(--champagne);font-family:${tokens.fonts.mono}}
.person{display:flex;align-items:center;gap:16px}
.person img,.person .ph{width:64px;height:64px;border-radius:50%;object-fit:cover;background:var(--stone);display:flex;align-items:center;justify-content:center;font-family:${tokens.fonts.display};font-size:26px;color:var(--fg2)}
.links a{display:block;padding:12px 0;border-bottom:1px solid var(--line2);text-decoration:none}
.links a:last-child{border-bottom:0}
footer{border-top:1px solid var(--line2);padding:26px 0 34px;color:var(--fg3);font-size:13px}
.slogan{font-family:${tokens.fonts.display};font-size:17px;color:var(--fg);margin:0 0 8px;direction:ltr;text-align:${rtl ? 'right' : 'left'}}
.ph-legal{color:var(--fg3)}
@media print{body{background:#fff;color:#111}.btns,footer .slogan{display:none}}
${css}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="/">${logo(26)}<span class="word">Amane</span></a><span class="label">Paris</span></div></header>
<main><div class="wrap">${body}</div></main>
<footer><div class="wrap">${slogan()}<div>Amane · Paris · <span class="ph-legal">${esc(process.env.LEGAL_LINE || '')}</span></div></div></footer>
${scripts}
</body>
</html>`;
}

export const tt = (L, k, v) => esc(t(L, k, v));
