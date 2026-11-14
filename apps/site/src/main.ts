import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource-variable/jost/index.css';
import './style.css';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from './config';
import { applyLang, detectLang, type Lang } from './i18n';
import { createScene, type Pose } from './three/scene';
import { initForm } from './form';
import { mountLogos, renderDynamic, initReveal, initVideos, initFilm, initManifesto, initDoors, initTilt, initMessage, initMarquee, initCursor } from './sections';

gsap.registerPlugin(ScrollTrigger);
const html = document.documentElement;
html.classList.add('js');
// Posés ici plutôt que dans le HTML : la page reste entière quand un hébergeur fournit lui-même la balise <body>.
document.body.classList.add('loading');
document.body.dataset.tone = 'night';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = matchMedia('(max-width: 899px)').matches || !fine;
const one = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const all = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

// ─── Langue et contenu ──────────────────────────────────────────────────
let lang: Lang = detectLang();
async function arabicFonts() {
  await Promise.all([import('@fontsource/amiri/400.css'), import('@fontsource/amiri/400-italic.css'), import('@fontsource/ibm-plex-sans-arabic/300.css'), import('@fontsource/ibm-plex-sans-arabic/400.css')]);
}
mountLogos();
applyLang(lang);
renderDynamic(lang);
if (lang === 'ar') void arabicFonts();
one('#yr').textContent = String(new Date().getFullYear());
one<HTMLAnchorElement>('#partnerLink').href = CONFIG.api + '/prestataires';
const form = initForm(() => lang);
form.update();

// ─── Scène 3D ───────────────────────────────────────────────────────────
const scene = createScene(one<HTMLCanvasElement>('#gl'), { mobile, reduced });
if (!scene) html.classList.add('no-gl');

// ─── Défilement doux ────────────────────────────────────────────────────
let velocity = 0;
let lastY = window.scrollY;
const lenis = reduced ? null : new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
if (lenis) {
  lenis.on('scroll', (e: { velocity: number }) => { velocity = e.velocity; ScrollTrigger.update(); });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
} else {
  window.addEventListener('scroll', () => { velocity = window.scrollY - lastY; lastY = window.scrollY; }, { passive: true });
}
gsap.ticker.add(() => { scene?.kick(velocity); velocity *= 0.9; });

const nav = one('#nav');
const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
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
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  else target.scrollIntoView();
});

// ─── Sections ───────────────────────────────────────────────────────────
const watchReveal = initReveal();
const watchVideos = initVideos(mobile);
if (!reduced) { initFilm(); initManifesto(); }
else all('#manifesto .w').forEach((w) => w.classList.add('lit'));
const refreshDoors = initDoors(!mobile && !reduced);
if (fine && !reduced) { initTilt(); initCursor(); }
const showThread = initMessage(reduced);
initMarquee(() => velocity, reduced);

// Fond, encre et place du A selon la section en vue.
const pose = (el: HTMLElement): Pose => {
  const raw = (mobile && el.dataset.keyM) || el.dataset.key || '0,0,0,0';
  const [x, y, s, r] = raw.split(',').map(Number);
  return { x: html.dir === 'rtl' ? -x : x, y, s, r };
};
let active: HTMLElement | null = null;
const activate = (el: HTMLElement) => {
  active = el;
  const tone = el.dataset.tone || 'night';
  document.body.dataset.tone = tone;
  scene?.setTone(tone === 'night' || tone === 'bordeaux');
  scene?.setPose(el.dataset.key !== undefined ? pose(el) : { x: 0, y: 0, s: 0, r: 7 });
};
all('main > section, .foot').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 70%', end: 'bottom 70%', onToggle: (st) => { if (st.isActive) activate(el); } }));
activate(one('#top'));
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
  all('.hero .reveal, .hero [data-lines]').forEach((el) => el.classList.add('in'));
  if (reduced) all('#manifesto .w').forEach((w) => w.classList.add('lit'));
  watchReveal();
  watchVideos();
  showThread();
  form.update();
  if (active) activate(active);
  refreshDoors();
  ScrollTrigger.refresh();
}));

// ─── Fin du chargement ──────────────────────────────────────────────────
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
Promise.race([Promise.all([document.fonts?.ready ?? Promise.resolve(), wait(reduced ? 0 : 1500)]), wait(3500)]).then(() => {
  document.body.classList.remove('loading');
  all('.hero .reveal, .hero [data-lines]').forEach((el, i) => window.setTimeout(() => el.classList.add('in'), reduced ? 0 : 250 + i * 130));
  ScrollTrigger.refresh();
});
