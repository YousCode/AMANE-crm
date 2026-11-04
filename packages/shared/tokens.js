// Identité visuelle d'Amane : ivoire, noir, champagne. Aucune autre couleur hors ok/warn/bad/info pour les statuts.
export const tokens = Object.freeze({
  colors: Object.freeze({
    light: Object.freeze({
      bg: '#FAF8F4', bg2: '#F3EFE8', panel: '#FFFFFF', panel2: 'rgba(17,17,17,.035)', line: 'rgba(17,17,17,.16)', line2: 'rgba(17,17,17,.08)',
      fg: '#111111', fg2: '#4A443E', fg3: '#6E675F', accent: '#8A6A3B', accentInk: '#FFFFFF', champagne: '#B8955C', stone: '#EDE7DD',
      ok: '#3E7A4E', warn: '#8A5A12', bad: '#A3293F', info: '#3D5F87', scrim: 'rgba(17,17,17,.38)',
    }),
    dark: Object.freeze({
      bg: '#111111', bg2: '#0B0B0B', panel: 'rgba(250,248,244,.045)', panel2: 'rgba(250,248,244,.06)', line: 'rgba(250,248,244,.16)', line2: 'rgba(250,248,244,.09)',
      fg: '#F4F1EC', fg2: '#CFC8BE', fg3: '#A39B90', accent: '#C9A56A', accentInk: '#111111', champagne: '#C9A56A', stone: '#1C1B19',
      ok: '#9FBF9A', warn: '#E2BC72', bad: '#F09AA6', info: '#B4C6DE', scrim: 'rgba(0,0,0,.6)',
    }),
  }),
  fonts: Object.freeze({
    display: "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif",
    ui: "'Jost', 'Futura', 'Helvetica Neue', Arial, sans-serif",
    mono: "'IBM Plex Mono', 'SF Mono', Menlo, Consolas, monospace",
    arabic: "'Noto Naskh Arabic', 'Tahoma', 'Geeza Pro', serif",
    weights: Object.freeze({ light: 300, regular: 400, medium: 500 }),
  }),
  radius: 12,
  rail: 84,
  tracking: Object.freeze({ label: '.18em', labelSize: 11, transform: 'uppercase' }),
  space: Object.freeze([0, 4, 8, 12, 16, 24, 32, 48, 64]),
  touch: 44,
  breakpoints: Object.freeze({ mobile: 760, tablet: 1020 }),
  googleFonts: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,400;0,500;1,400;1,500&family=Jost:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap',
  logoPath: 'M452 -6 L560 -6 L831.93 912 Q856.67 982 930.67 982 L930.67 1000 L653.17 1000 L653.17 982 Q715.17 982 698.38 912 Z M452 -6 L486 40 L217.73 922 Q201.48 982 261.48 982 L261.48 1000 L97.19 1000 L97.19 982 Q165.19 982 184.49 922 Z M301.5 632.5 L627.38 632.5 L627.38 647.5 L301.5 647.5 Z M406.44 636 A58 58 0 1 1 522.44 636 A58 58 0 1 1 406.44 636 Z M442.44 676 L486.44 676 L510.44 832 Q512.44 842 502.44 842 L426.44 842 Q416.44 842 418.44 832 Z',
  logoViewBox: '40 -60 940 1120',
  slogan: 'Arrive as a Guest. Leave with a Story.',
});

const kebab = (k) => k.replace(/([A-Z])/g, '-$1').toLowerCase();

/** Déclarations CSS « --bg:#FAF8F4;--fg:#111111;… » pour un thème ('light' | 'dark'), plus polices, rayon et rail. */
export function cssVars(theme = 'light') {
  const c = tokens.colors[theme === 'dark' ? 'dark' : 'light'];
  const out = Object.entries(c).map(([k, v]) => `--${kebab(k)}:${v}`);
  out.push(`--font-display:${tokens.fonts.display}`, `--font-ui:${tokens.fonts.ui}`, `--font-mono:${tokens.fonts.mono}`, `--font-arabic:${tokens.fonts.arabic}`);
  out.push(`--radius:${tokens.radius}px`, `--rail:${tokens.rail}px`, `--tracking:${tokens.tracking.label}`, `--touch:${tokens.touch}px`);
  return out.join(';') + ';';
}

/** Feuille complète : :root clair, sombre selon le système (sauf data-theme="light") et data-theme="dark" forcé. */
export function cssTheme() {
  return `:root{${cssVars('light')}color-scheme:light}\n@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${cssVars('dark')}color-scheme:dark}}\n:root[data-theme="dark"]{${cssVars('dark')}color-scheme:dark}`;
}

/** Le A à serrure en SVG inline (couleur = currentColor). */
export function logoSvg({ size = 28, title = 'Amane' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tokens.logoViewBox}" width="${size}" height="${Math.round(size * 1120 / 940)}" role="img" aria-label="${title}"><path fill="currentColor" d="${tokens.logoPath}"/></svg>`;
}
