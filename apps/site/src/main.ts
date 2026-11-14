import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource-variable/jost/index.css';
import './style.css';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from './config';
import { applyLang, detectLang, type Lang } from './i18n';
import { lazySequence } from './lazy';
import { initForm } from './form';
import { mountStatic, renderDynamic, initReveal, initProgress, initSeuil, initHeure, initRituel, initManifesto, initServices, initFleet, initFrises } from './sections';

gsap.registerPlugin(ScrollTrigger);
const html = document.documentElement;
html.classList.add('js');
// Posé ici plutôt que dans le HTML : la page reste entière quand un hébergeur fournit lui-même la balise <body>.
document.body.classList.add('loading');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 899px)').matches;
if (reduced) html.classList.add('still');
const one = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const all = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

// ─── Langue et contenu ──────────────────────────────────────────────────
let lang: Lang = detectLang();
async function arabicFonts() {
  await Promise.all([import('@fontsource/amiri/400.css'), import('@fontsource/amiri/400-italic.css'), import('@fontsource/ibm-plex-sans-arabic/300.css'), import('@fontsource/ibm-plex-sans-arabic/400.css')]);
}
mountStatic();
applyLang(lang);
renderDynamic(lang);
if (lang === 'ar') void arabicFonts();
one('#yr').textContent = String(new Date().getFullYear());
one<HTMLAnchorElement>('#partnerLink').href = CONFIG.api + '/prestataires';
const form = initForm(() => lang);
form.update();

// ─── Films pilotés par le défilement ────────────────────────────────────
const loaderBar = one('#loaderBar');
const porte = lazySequence({
  canvas: one<HTMLCanvasElement>('#porte'), name: 'porte', mobile,
  // Sur un écran étroit, on garde la porte dans le cadre : elle est à gauche au début, au centre à la fin.
  focus: (p) => (mobile ? [0.34 + p * 0.16, 0.5] : [0.5, 0.5]),
  onProgress: (n, total) => { loaderBar.style.transform = `scaleX(${Math.min(1, n / Math.min(total, 12)).toFixed(3)})`; },
}, one('#top'));
// Les films plus bas dans la page ne chargent qu'à l'approche de leur section, et se libèrent quand on s'en éloigne.
const rivoli = lazySequence({ canvas: one<HTMLCanvasElement>('#rivoli'), name: 'rivoli', mobile, focus: [0.42, 0.5] }, one('#heure'));
const cles = lazySequence({ canvas: one<HTMLCanvasElement>('#cles'), name: 'cles', mobile, focus: [0.42, 0.5] }, one('#rituel'));

// ─── Défilement doux ────────────────────────────────────────────────────
const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, touchMultiplier: 1.15 });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const nav = one('#nav');
const onScroll = () => nav.classList.toggle('solid', window.scrollY > window.innerHeight * 0.6);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href')!;
  const target = id.length > 1 ? document.querySelector<HTMLElement>(id) : null;
  if (!target) return;
  e.preventDefault();
  if (a.dataset.ask) form.pick(a.dataset.ask);
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else target.scrollIntoView();
});

// ─── Parties de la page ─────────────────────────────────────────────────
const watchReveal = initReveal();
initProgress();
const bindServices = initServices({ mobile, animate: !reduced });
let bindFleet: () => void = () => undefined;
if (reduced) {
  // Sans animation : chaque film reste sur une image choisie, tout le texte est là.
  porte.set(0.5); rivoli.set(0.5); cles.set(0.6);
  all('#manifesto .w').forEach((w) => w.classList.add('lit'));
} else {
  initSeuil(porte);
  initManifesto();
  initHeure(rivoli);
  initRituel(cles);
  bindFleet = initFleet();
  initFrises();
}
ScrollTrigger.sort();
ScrollTrigger.refresh();

// ─── Changement de langue ───────────────────────────────────────────────
all<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
  const next = b.dataset.lang as Lang;
  if (next === lang) return;
  lang = next;
  if (lang === 'ar') await arabicFonts();
  applyLang(lang);
  renderDynamic(lang);
  one('.seuil-title').classList.add('in');
  if (reduced) all('#manifesto .w').forEach((w) => w.classList.add('lit'));
  watchReveal();
  bindServices();
  bindFleet();
  form.update();
  ScrollTrigger.refresh();
}));

// ─── Fin du chargement : dès que la première image du film d'ouverture est là ─
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
Promise.race([Promise.all([porte.ready, document.fonts?.ready ?? Promise.resolve(), wait(reduced ? 0 : 900)]), wait(4500)]).then(() => {
  loaderBar.style.transform = 'scaleX(1)';
  document.body.classList.remove('loading');
  window.setTimeout(() => one('.seuil-title').classList.add('in'), reduced ? 0 : 350);
  ScrollTrigger.refresh();
});
