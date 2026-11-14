/* Contenu dépendant de la langue (services, étapes, flotte, questions) et réactions au défilement de chaque partie. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tr, type Lang } from './i18n';
import { markSvg } from './logo';
import { createSequence, type Sequence } from './sequence';
import SEQUENCES from '../sequences.json';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 0 avant `a`, 1 après `b`, linéaire entre les deux. */
const ramp = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

/** Les huit services : identifiant du CRM, clé de texte, film montré dans la porte. */
export const SERVICES = [
  { id: 'location', key: 's1', v: 'jour-montaigne' }, { id: 'chauffeur', key: 's2', v: 'm-chauffeur' },
  { id: 'van', key: 's3', v: 'm-van' }, { id: 'transfert', key: 's7', v: 'arrivee' },
  { id: 'shopping', key: 's4', v: 'shopping' }, { id: 'sejour', key: 's5', v: 'salon' },
  { id: 'conciergerie', key: 's6', v: 'vendome' }, { id: 'clip', key: 's8', v: 'hero' },
] as const;
const FLEET = [{ key: 'c1', img: 'fleet-m5' }, { key: 'c2', img: 'fleet-g63' }, { key: 'c3', img: 'fleet-f296' }, { key: 'c4', img: 'fleet-classev' }] as const;

// ---------- le motif de la maison : arcades à double filet, une serrure sur trois ----------
const ARCH = '<path pathLength="1" d="M14 190 V64 A46 46 0 0 1 106 64 V190"/><path pathLength="1" stroke-width=".8" d="M22 190 V64 A38 38 0 0 1 98 64 V190"/>';
const KEYHOLE = '<g transform="translate(60 112)" stroke="none" fill="currentColor"><circle r="8"/><path d="M-3.4 5 H3.4 L7 26 H-7Z"/></g>';
const arch = (x: number, y: number, key: boolean) => `<g transform="translate(${x} ${y})">${ARCH}${key ? KEYHOLE : ''}</g>`;

/** Frise : une rangée d'arcades au trait. */
function friseSvg(n = 16) {
  let g = ''; for (let i = 0; i < n; i++) g += arch(i * 120, 0, i % 3 === 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 58 ${n * 120} 132" preserveAspectRatio="xMidYMax slice" fill="none" stroke="currentColor" stroke-width="1.6">${g}</svg>`;
}
/** Tapisserie : le motif en deux rangs décalés, ton sur ton, pour un fond. */
function tapestry(stroke: string) {
  const tiles = [[0, 0, 0], [120, 0, 1], [240, 0, 0], [60, 190, 0], [180, 190, 0], [300, 190, 1], [-60, 190, 0]].map(([x, y, k]) => arch(x, y, !!k)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 380" width="360" height="380" fill="none" stroke="${stroke}" stroke-width="2" color="${stroke}">${tiles}</svg>`;
  return `url("data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}")`;
}

/** Ce qui ne dépend pas de la langue : logo de la barre, frises, tapisserie. */
export function mountStatic() {
  $('#navMark').innerHTML = markSvg();
  $$('.frise').forEach((f) => (f.innerHTML = friseSvg()));
  $('#prestataires').style.backgroundImage = tapestry('#4a1320');
}

/** Découpe un texte en mots (les <em> restent en place) pour les révéler un à un. */
export function splitWords(el: HTMLElement) {
  const wrap = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').split(/(\s+)/).map((part) => {
        if (!part.trim()) return document.createTextNode(part);
        const w = document.createElement('span'); w.className = 'w'; const i = document.createElement('span'); i.textContent = part; w.appendChild(i); return w;
      });
    }
    if (node instanceof HTMLElement && !node.classList.contains('w')) node.replaceChildren(...[...node.childNodes].flatMap(wrap));
    return [node];
  };
  el.replaceChildren(...[...el.childNodes].flatMap(wrap));
}

/** (Re)construit tout ce qui dépend de la langue. */
export function renderDynamic(lang: Lang) {
  const names = SERVICES.map((s) => String(tr(lang, s.key + '.0')));
  $('#svcList').innerHTML = SERVICES.map((s, i) => `<li data-i="${i}"><h3>${esc(names[i])}</h3><p>${esc(tr(lang, s.key + '.1'))}</p><p class="meta">${esc(tr(lang, s.key + '.2'))}</p><a class="link" href="#demande" data-ask="${s.id}">${esc(tr(lang, 'ask'))}</a></li>`).join('');
  $('#steps').innerHTML = (tr(lang, 'steps') as string[][]).map(([t, p]) => `<li class="reveal"><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('');
  $('#fleet').innerHTML = FLEET.map((c) => `<article class="car reveal"><div class="arch"><img src="./media/${c.img}.jpg" alt="" loading="lazy" decoding="async"></div><h3>${esc(tr(lang, c.key + '.0'))}</h3><p>${esc(tr(lang, c.key + '.1'))}</p></article>`).join('');
  $('#faq').innerHTML = (tr(lang, 'qa') as string[][]).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const sel = $<HTMLSelectElement>('#f-service'); const keep = sel.value;
  sel.innerHTML = SERVICES.map((s, i) => `<option value="${s.id}">${esc(names[i])}</option>`).join(''); if (keep) sel.value = keep;
  $$('[data-lines], [data-words]').forEach(splitWords);
}

/** Apparitions à l'entrée dans l'écran. Renvoie de quoi observer les éléments ajoutés ensuite. */
export function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  const watch = () => $$('.reveal:not(.in)').forEach((el) => io.observe(el));
  watch(); return watch;
}

/** Filet de progression sous la barre du haut. */
export function initProgress() {
  const bar = $('#progress');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (st) => { bar.style.transform = `scaleX(${st.progress.toFixed(4)})`; } });
}

/** Le seuil : le défilement ouvre la porte ; le premier texte s'efface, le second arrive quand le hall se découvre. */
export function initSeuil(seq: Sequence) {
  const a = $('#seuilA'), b = $('#seuilB'), hint = $('#hint');
  ScrollTrigger.create({ trigger: '#top', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (st) => {
      const p = st.progress;
      seq.set(ramp(p, 0, 0.84));
      const out = ramp(p, 0.05, 0.22), inn = ramp(p, 0.66, 0.84);
      a.style.opacity = String(1 - out); a.style.transform = `translate3d(0,${(-out * 40).toFixed(1)}px,0)`; a.style.visibility = out >= 1 ? 'hidden' : 'visible';
      b.style.opacity = String(inn); b.style.transform = `translate3d(0,${((1 - inn) * 30).toFixed(1)}px,0)`; b.style.visibility = inn <= 0 ? 'hidden' : 'visible';
      hint.style.opacity = String(1 - ramp(p, 0, 0.05));
    } });
}

/** L'heure bleue : le film avance avec le défilement, la légende arrive en cours de route. */
export function initHeure(seq: Sequence) {
  const text = $('#heureText');
  ScrollTrigger.create({ trigger: '#heure', start: 'top bottom', end: 'bottom top', scrub: true, onUpdate: (st) => seq.set(st.progress) });
  ScrollTrigger.create({ trigger: '#heure', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (st) => { const v = ramp(st.progress, 0.08, 0.34); text.style.opacity = String(v); text.style.transform = `translate3d(0,${((1 - v) * 30).toFixed(1)}px,0)`; } });
}

/** Le rituel : dans la porte, la remise des clés avance pendant qu'on lit les étapes. */
export function initRituel(seq: Sequence) {
  ScrollTrigger.create({ trigger: '#rituel', start: 'top 80%', end: 'bottom 30%', scrub: true, onUpdate: (st) => seq.set(st.progress) });
}

/** Le texte de la maison s'éclaire mot à mot. */
export function initManifesto() {
  ScrollTrigger.create({ trigger: '#manifesto', start: 'top 84%', end: 'bottom 52%', scrub: true,
    onUpdate: (st) => { const ws = $$('#manifesto .w'); const n = Math.round(st.progress * ws.length); ws.forEach((w, i) => w.classList.toggle('lit', i < n)); } });
}

/**
 * Les services : la porte de gauche montre le film du service en cours de lecture — la porte bordeaux qui s'ouvre
 * sur sa scène — et l'ouvre au rythme du défilement. Un film absent (pas encore généré) laisse l'affiche du service.
 */
export function initServices(opts: { mobile: boolean; animate: boolean }) {
  const arch = $('#svcArch');
  const poster = document.createElement('img'); poster.alt = ''; poster.decoding = 'async';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  arch.replaceChildren(poster, canvas);
  const has = (k: string) => Object.prototype.hasOwnProperty.call(SEQUENCES, k);
  let current = -1;
  let seq: Sequence | null = null;
  const show = (i: number) => {
    if (i === current) return;
    current = i;
    $$('#svcList li').forEach((li) => li.classList.toggle('on', Number(li.dataset.i) === i));
    poster.src = `./media/${SERVICES[i].v}-poster.jpg`;
    const key = 'porte-' + SERVICES[i].id;
    seq?.destroy();
    seq = null;
    // L'affiche du nouveau service reste visible tant que son film charge.
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.seq = key;
    canvas.hidden = !has(key);
    if (canvas.hidden) return;
    // Un seul canvas : on monte le film du service affiché (les images déjà vues restent dans le cache du navigateur).
    seq = createSequence({ canvas, name: key, mobile: opts.mobile });
    seq.set(opts.animate ? 0 : 1);
  };
  let triggers: ScrollTrigger[] = [];
  const bind = () => {
    triggers.forEach((t) => t.kill());
    triggers = $$('#svcList li').map((li) => ScrollTrigger.create({
      trigger: li, start: 'top 70%', end: 'bottom 45%',
      onToggle: (st) => { if (st.isActive) show(Number(li.dataset.i)); },
      onUpdate: (st) => { if (opts.animate && st.isActive && Number(li.dataset.i) === current) seq?.set(st.progress); },
    }));
    const keep = Math.max(0, current);
    current = -1;
    show(keep);
  };
  bind();
  return bind;
}

/** Les photos de la flotte glissent légèrement dans leur arcade. */
export function initFleet() {
  const bind = () => $$('.car .arch img').forEach((img) => gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  bind(); return bind;
}

/** Les frises se tracent à l'entrée dans l'écran. */
export function initFrises() {
  $$('.frise').forEach((f) => {
    const paths = f.querySelectorAll('path[pathLength]');
    gsap.fromTo(paths, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', stagger: 0.012, scrollTrigger: { trigger: f, start: 'top 96%', end: 'top 55%', scrub: true } });
  });
}
