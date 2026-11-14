/* Films qui avancent au rythme du défilement : une suite d'images (`sequences.json`, préparées par `scripts/frames.mjs`
   dans `public/media/seq/<nom>/`) dessinée sur un canvas, cadrée « cover » autour d'un point d'intérêt.
   Le canvas doit recevoir sa taille du CSS (width/height, inset…) : le moteur n'ajuste que sa définition (écrans denses, plafond × 2).
   Mémoire : chaque image décodée pèse largeur × hauteur × 4 octets (≈ 3,7 Mo en 1280 × 720, ≈ 1,2 Mo sur téléphone) :
   `destroy()` quand un film ne sert plus.
   Le mouvement réduit n'est pas traité ici : c'est la page qui choisit d'appeler `set` ou non. */
import defs from '../sequences.json';

export interface SequenceOptions {
  canvas: HTMLCanvasElement;
  /** clé de sequences.json */
  name: string;
  /** version allégée (dossier m/, une image sur deux) */
  mobile?: boolean;
  /** point de l'image gardé au centre quand le cadrage rogne (0…1, 0…1) ; peut dépendre de l'avancement */
  focus?: [number, number] | ((progress: number) => [number, number]);
  /** appelé pendant le chargement */
  onProgress?: (loaded: number, total: number) => void;
}
export interface Sequence {
  /** résolue quand la première image est dessinée */
  ready: Promise<void>;
  /** résolue quand toutes les images sont chargées (ou ont échoué) */
  loaded: Promise<void>;
  /** avancement 0…1 : dessine l'image correspondante */
  set(progress: number): void;
  /** à appeler si le canvas change de taille (le moteur écoute déjà window.resize) */
  resize(): void;
  destroy(): void;
}

type Frame = ImageBitmap | HTMLImageElement;
const FILMS = defs as Record<string, { count: number; width: number; height: number }>;
const CONCURRENCY = 6; // chargements de front, une fois la première image arrivée
const DPR_MAX = 2;
const clamp = (v: number, min: number, max: number) => (v > min ? (v < max ? v : max) : min); // NaN → min

export function createSequence(o: SequenceOptions): Sequence {
  const def = FILMS[o.name];
  if (!def) throw new Error(`film inconnu : « ${o.name} » (voir sequences.json)`);
  const { canvas } = o, ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas sans contexte 2D');
  const total = o.mobile ? Math.ceil(def.count / 2) : def.count; // téléphone : une image sur deux (règle de scripts/frames.mjs)
  const iw = def.width, ih = def.height; // seules les proportions comptent : la version téléphone garde celles du film
  const url = (i: number) => `./media/seq/${o.name}/${o.mobile ? 'm/' : ''}${String(i + 1).padStart(3, '0')}.jpg`;
  const focusAt = (p: number): [number, number] => (typeof o.focus === 'function' ? o.focus(p) : o.focus ?? [0.5, 0.5]);

  const frames: (Frame | null)[] = new Array<Frame | null>(total).fill(null);
  const state = new Uint8Array(total); // 0 à charger · 1 en cours · 2 terminée (chargée ou en échec)
  let want = 0, [fx, fy] = focusAt(0); // image et point d'intérêt demandés
  let shown = -1, sfx = NaN, sfy = NaN; // image et point d'intérêt dessinés
  let raf = 0, dirty = false, dead = false, loose = false;
  let isReady = false, okReady!: () => void, okLoaded!: () => void;
  const ready = new Promise<void>((r) => { okReady = r; }), loaded = new Promise<void>((r) => { okLoaded = r; });

  // ---- dessin
  /** image chargée la plus proche de i (à distance égale, celle d'avant) ; −1 si aucune */
  const nearest = (i: number) => { for (let d = 0; d < total; d++) { if (frames[i - d]) return i - d; if (frames[i + d]) return i + d; } return -1; };
  const paint = () => {
    const i = nearest(want);
    if (dead || i < 0 || (i === shown && fx === sfx && fy === sfy && !dirty)) return;
    const f = frames[i] as Frame, cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / iw, ch / ih), sw = cw / s, sh = ch / s; // part de l'image qui reste visible
    const sx = clamp(fx * iw - sw / 2, 0, iw - sw), sy = clamp(fy * ih - sh / 2, 0, ih - sh); // centrée sur le point d'intérêt, sans sortir de l'image
    const kx = ('naturalWidth' in f ? f.naturalWidth : f.width) / iw, ky = ('naturalHeight' in f ? f.naturalHeight : f.height) / ih;
    ctx.drawImage(f, sx * kx, sy * ky, sw * kx, sh * ky, 0, 0, cw, ch);
    shown = i; sfx = fx; sfy = fy; dirty = false;
    if (!isReady) { isReady = true; okReady(); }
  };
  /** un seul dessin par image d'animation : la dernière demande gagne */
  const schedule = () => { if (!raf && !dead) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };

  const resize = () => {
    if (dead || loose) return;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX), cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (!w || !h || (w === canvas.width && h === canvas.height)) return;
    canvas.width = w; canvas.height = h;
    // sans taille CSS, la taille affichée suit la définition et grossirait à chaque passage : on la rend et on n'y touche plus
    if (w !== cssW && canvas.clientWidth === w) { canvas.width = cssW; canvas.height = cssH; loose = true; }
    ctx.imageSmoothingQuality = 'high';
    dirty = true; paint(); // changer la définition efface le canvas : on redessine dans la foulée, sans image vide
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; // barre de défilement, mise en page tardive…
  observer?.observe(canvas);
  window.addEventListener('resize', resize);
  ctx.imageSmoothingQuality = 'high';
  resize();

  // ---- chargement : la première image seule, puis un aperçu de tout le film (une sur 8, sur 4, sur 2), puis le reste
  const order: number[] = [], queued = new Uint8Array(total);
  const queue = (i: number) => { if (!queued[i]) { queued[i] = 1; order.push(i); } };
  queue(total - 1);
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < total; i += step) queue(i);
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const pending = new Set<HTMLImageElement>();
  const viaImg = (src: string): Promise<Frame> => {
    const img = new Image(); img.decoding = 'async'; pending.add(img);
    const got = typeof img.decode === 'function' ? (img.src = src, img.decode()) : new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error(src)); img.src = src; });
    return got.finally(() => pending.delete(img)).then(() => img);
  };
  /** décodage hors du fil principal (fetch + createImageBitmap) ; à défaut, ou si ce chemin échoue hors erreur HTTP, balise <img> */
  const load = async (i: number): Promise<Frame> => {
    if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
      let r: Response | null = null;
      try { r = await fetch(url(i), abort ? { signal: abort.signal } : undefined); } catch { /* réseau, file://… : repli */ }
      if (dead) throw new Error('détruit');
      if (r && (!r.ok || (r.headers.get('content-type') || '').startsWith('text/'))) throw new Error(`${r.status} ${url(i)}`); // 404, ou page de repli du serveur à la place de l'image
      if (r) try { return await createImageBitmap(await r.blob()); } catch { /* repli */ }
      if (dead) throw new Error('détruit');
    }
    return viaImg(url(i));
  };
  let active = 0, done = 0, limit = 1, cursor = 0;
  /** l'image demandée en ce moment passe devant la file */
  const next = () => { if (!state[want]) return want; while (cursor < order.length && state[order[cursor]]) cursor++; return cursor < order.length ? order[cursor] : -1; };
  const pump = () => {
    while (!dead && active < limit) {
      const i = next();
      if (i < 0) return;
      state[i] = 1; active++;
      load(i).then((f) => {
        if (dead) { if ('close' in f) f.close(); return; }
        frames[i] = f;
        if (shown < 0) paint(); else schedule(); // la première s'affiche tout de suite ; ensuite, seulement si elle est plus proche de l'image demandée
      }, () => { /* une image en échec ne bloque rien : la voisine la remplace */ }).then(() => {
        if (dead) return;
        state[i] = 2; active--; done++; limit = CONCURRENCY;
        if (done === total) { if (!isReady) { isReady = true; okReady(); } okLoaded(); } else pump();
        o.onProgress?.(done, total);
      });
    }
  };
  void Promise.resolve().then(pump); // au tour suivant : un `set()` posé dès la création désigne la première image à charger

  return {
    ready, loaded, resize,
    set(progress) {
      if (dead) return;
      const p = clamp(progress, 0, 1), i = Math.round(p * (total - 1)), [x, y] = focusAt(p);
      if (i === want && x === fx && y === fy) return;
      want = i; fx = x; fy = y; schedule();
    },
    destroy() {
      if (dead) return;
      dead = true;
      window.removeEventListener('resize', resize); observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      abort?.abort(); pending.forEach((img) => { img.src = ''; }); pending.clear();
      for (const f of frames) if (f && 'close' in f) f.close();
      frames.fill(null);
      okReady(); okLoaded(); // personne ne reste en attente
    },
  };
}
