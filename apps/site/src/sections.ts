/* Contenu dépendant de la langue (portes, étapes, flotte, questions, échange) et animations de chaque section. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tr, type Lang } from './i18n';
import { markSvg } from './logo';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Les huit services : identifiant du CRM, clé de texte, film de la porte. */
export const DOORS = [
  { id: 'location', key: 's1', v: 'jour-montaigne' }, { id: 'chauffeur', key: 's2', v: 'm-chauffeur' },
  { id: 'van', key: 's3', v: 'm-van' }, { id: 'transfert', key: 's7', v: 'arrivee' },
  { id: 'shopping', key: 's4', v: 'shopping' }, { id: 'sejour', key: 's5', v: 'salon' },
  { id: 'conciergerie', key: 's6', v: 'vendome' }, { id: 'clip', key: 's8', v: 'rivoli' },
] as const;
const FLEET = [{ key: 'c1', img: 'fleet-m5' }, { key: 'c2', img: 'fleet-g63' }, { key: 'c3', img: 'fleet-f296' }, { key: 'c4', img: 'fleet-classev' }] as const;

export function mountLogos() { $$('[data-logo]').forEach((el) => (el.innerHTML = markSvg())); }

/** Découpe un texte en mots (les <em> restent en place) pour les animer un à un. */
export function splitWords(el: HTMLElement) {
  const wrap = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').split(/(\s+)/).map((part) => {
        if (!part.trim()) return document.createTextNode(part);
        const w = document.createElement('span'); w.className = 'w'; const i = document.createElement('span'); i.textContent = part; w.appendChild(i); return w;
      });
    }
    if (node instanceof HTMLElement && !node.classList.contains('w')) { const kids = [...node.childNodes].flatMap(wrap); node.replaceChildren(...kids); }
    return [node];
  };
  el.replaceChildren(...[...el.childNodes].flatMap(wrap));
}

/** (Re)construit tout ce qui dépend de la langue. */
export function renderDynamic(lang: Lang) {
  const names = DOORS.map((d) => String(tr(lang, d.key + '.0')));
  $('#marquee').innerHTML = [...names, ...names].map((n) => `<span>${esc(n)}</span><i></i>`).join('');
  $('#doorsTrack').innerHTML = DOORS.map((d) => `<article class="door" data-service="${d.id}">
    <div class="arch"><video muted loop playsinline preload="none" poster="./media/${d.v}-poster.jpg" data-src="${d.v}"></video></div>
    <h3>${esc(tr(lang, d.key + '.0'))}</h3><p>${esc(tr(lang, d.key + '.1'))}</p><p class="meta">${esc(tr(lang, d.key + '.2'))}</p>
    <a class="link" href="#demande" data-ask="${d.id}">${esc(tr(lang, 'ask'))}</a></article>`).join('');
  $('#steps').innerHTML = (tr(lang, 'steps') as string[][]).map(([t, p]) => `<li class="reveal"><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('');
  $('#fleet').innerHTML = FLEET.map((c) => `<article class="car tilt reveal" data-tilt="9"><div class="arch"><img src="./media/${c.img}.jpg" alt="" loading="lazy" decoding="async"></div><h3>${esc(tr(lang, c.key + '.0'))}</h3><p>${esc(tr(lang, c.key + '.1'))}</p></article>`).join('');
  $('#faq').innerHTML = (tr(lang, 'qa') as string[][]).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  $('#thread').innerHTML = (tr(lang, 'chat') as string[]).map((m, i) => `<p class="bub ${i % 2 ? 'out' : 'in'}" dir="auto">${esc(m)}</p>`).join('');
  const sel = $<HTMLSelectElement>('#f-service'); const keep = sel.value;
  sel.innerHTML = DOORS.map((d, i) => `<option value="${d.id}">${esc(names[i])}</option>`).join(''); if (keep) sel.value = keep;
  $$('[data-lines], [data-words]').forEach(splitWords);
}

/** Apparitions à l'entrée dans l'écran. */
export function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  const watch = () => $$('.reveal:not(.in), [data-lines]:not(.in)').forEach((el) => { if (!el.closest('.hero')) io.observe(el); });
  watch(); return watch;
}

/** Films : la source n'est posée, et la lecture lancée, que quand le film est en vue. */
export function initVideos(mobile: boolean) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target as HTMLVideoElement;
    if (e.isIntersecting) {
      if (!v.dataset.ready) {
        const name = (mobile && v.dataset.srcM) || v.dataset.src; v.dataset.ready = '1';
        v.innerHTML = `<source src="./media/${name}.webm" type="video/webm"><source src="./media/${name}.mp4" type="video/mp4">`; v.load();
      }
      v.play().catch(() => { /* lecture automatique refusée : l'affiche reste */ });
    } else v.pause();
  }), { rootMargin: '25% 0px 25% 0px' });
  const watch = () => $$<HTMLVideoElement>('video[data-src]').forEach((v) => io.observe(v));
  watch(); return watch;
}

/** Le film s'ouvre comme une arcade qui devient plein écran. */
export function initFilm() {
  gsap.fromTo('#filmFrame', { scale: 0.8, borderTopLeftRadius: '50vw', borderTopRightRadius: '50vw' },
    { scale: 1, borderTopLeftRadius: '0vw', borderTopRightRadius: '0vw', ease: 'none', scrollTrigger: { trigger: '#film', start: 'top bottom', end: 'top top', scrub: true } });
  gsap.fromTo('#filmFrame video', { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: { trigger: '#film', start: 'top bottom', end: 'bottom top', scrub: true } });
}

/** Le texte de la maison s'éclaire mot à mot. */
export function initManifesto() {
  ScrollTrigger.create({ trigger: '#manifesto', start: 'top 82%', end: 'bottom 48%', scrub: true,
    onUpdate: (st) => { const ws = $$('#manifesto .w'); const n = Math.round(st.progress * ws.length); ws.forEach((w, i) => w.classList.toggle('lit', i < n)); } });
}

/** Les portes : sur grand écran, le défilement vertical les fait passer de côté. */
export function initDoors(desktop: boolean) {
  if (!desktop) return () => undefined;
  const section = $('#services'), track = $('#doorsTrack'), bar = $('#doorsBar');
  section.classList.add('pinned');
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const rtl = () => document.documentElement.dir === 'rtl';
  const tween = gsap.to(track, { x: () => (rtl() ? dist() : -dist()), ease: 'none',
    scrollTrigger: { trigger: '#doorsPin', pin: true, start: 'top top', end: () => '+=' + dist(), scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (st) => gsap.set(bar, { scaleX: 0.12 + st.progress * 0.88 }) } });
  return () => tween.scrollTrigger?.refresh();
}

/** Inclinaison au pointeur des éléments .tilt. */
export function initTilt() {
  document.addEventListener('pointermove', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.tilt'); if (!el) return;
    const r = el.getBoundingClientRect(), max = Number(el.dataset.tilt || 8);
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${(x * max).toFixed(2)}deg) rotateX(${(-y * max).toFixed(2)}deg)`;
    el.addEventListener('pointerleave', () => (el.style.transform = ''), { once: true });
  }, { passive: true });
}

/** L'échange par message se joue quand il entre dans l'écran ; la proposition se scelle au clic. */
export function initMessage(reduced: boolean) {
  let played = false;
  const play = () => { $$('#thread .bub').forEach((b, i) => window.setTimeout(() => b.classList.add('show'), reduced ? 0 : 500 + i * 950)); };
  ScrollTrigger.create({ trigger: '#phone', start: 'top 72%', once: true, onEnter: () => { played = true; play(); } });
  if (!reduced) gsap.fromTo('#proposal', { y: 70, rotate: 3 }, { y: 0, rotate: 0, ease: 'none', scrollTrigger: { trigger: '#message', start: 'top 70%', end: 'center 55%', scrub: true } });
  $('#accept').addEventListener('click', () => { $('#accept').hidden = true; $('#acceptOk').hidden = false; });
  return () => { if (played) $$('#thread .bub').forEach((b) => b.classList.add('show')); };
}

/** Bandeau : il défile seul, et plus vite quand la page défile. */
export function initMarquee(getVelocity: () => number, reduced: boolean) {
  const track = $('#marquee'); let x = 0;
  if (reduced) return;
  gsap.ticker.add(() => {
    const half = track.scrollWidth / 2; if (!half) return;
    const dir = document.documentElement.dir === 'rtl' ? 1 : -1;
    x += dir * (0.6 + Math.min(14, Math.abs(getVelocity()) * 0.35));
    if (x <= -half) x += half; if (x >= half) x -= half;
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  });
}

/** Curseur : un anneau d'or qui grossit sur ce qui se clique. */
export function initCursor() {
  const c = $('#cursor'); let x = 0, y = 0, cx = 0, cy = 0;
  window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.classList.add('on'); c.classList.toggle('hot', !!(e.target as HTMLElement).closest('a, button, summary, .door, .car, select, input, textarea')); }, { passive: true });
  document.addEventListener('pointerleave', () => c.classList.remove('on'));
  gsap.ticker.add(() => { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; c.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`; });
}
