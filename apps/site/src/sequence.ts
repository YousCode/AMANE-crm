/* Films qui avancent au rythme du défilement : une suite d'images (`sequences.json`) dessinée sur un canvas, cadrée « cover »
   autour d'un point d'intérêt. Les images arrivent en planches (`scripts/frames.mjs`) : `public/media/seq/<nom>/[m/]s01.jpg …`,
   8 images consécutives en grille 4 × 2, chaque case complétée en noir jusqu'à un multiple de 16 px ; la dernière planche peut
   être incomplète. Chaque planche est décodée une fois puis découpée en 8 images (createImageBitmap avec rectangle, à défaut un canvas).
   Le canvas doit recevoir sa taille du CSS (width/height, inset…) : le moteur n'ajuste que sa définition (écrans denses, plafond × 2).
   Mémoire : chaque image découpée pèse largeur × hauteur × 4 octets (≈ 3,7 Mo en 1280 × 726, ≈ 1,2 Mo sur téléphone), plus une
   planche en cours de découpe (≈ 30 Mo, libérée aussitôt) : `destroy()` quand un film ne sert plus.
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

type Frame = ImageBitmap | HTMLCanvasElement;
const FILMS = defs as Record<string, { count: number; width: number; height: number }>;
const COLS = 4, ROWS = 2, PER = COLS * ROWS; // géométrie des planches : la même que layout() dans scripts/frames.mjs
const MOBILE_W = 720;
const CONCURRENCY = 3; // planches chargées de front (8 images chacune), une fois la première arrivée
const DPR_MAX = 2;
const clamp = (v: number, min: number, max: number) => (v > min ? (v < max ? v : max) : min); // NaN → min
const free = (f: Frame) => { if ('close' in f) f.close(); else f.width = f.height = 0; };

export function createSequence(o: SequenceOptions): Sequence {
  const def = FILMS[o.name];
  if (!def) throw new Error(`film inconnu : « ${o.name} » (voir sequences.json)`);
  const { canvas } = o, ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas sans contexte 2D');
  const total = o.mobile ? Math.ceil(def.count / 2) : def.count; // téléphone : une image sur deux (règle de scripts/frames.mjs)
  const iw = def.width, ih = def.height; // seules les proportions comptent : la version téléphone garde celles du film
  // une image dans sa planche : w × h, dans une case de cellW × cellH (même calcul que layout() dans scripts/frames.mjs)
  const w = o.mobile ? Math.min(MOBILE_W, iw) : iw, h = o.mobile ? Math.round((ih * w) / iw / 2) * 2 : ih;
  const cellW = Math.ceil(w / 16) * 16, cellH = Math.ceil(h / 16) * 16;
  const nSheets = Math.ceil(total / PER), inSheet = (s: number) => Math.min(PER, total - s * PER);
  const url = (s: number) => `./media/seq/${o.name}/${o.mobile ? 'm/' : ''}s${String(s + 1).padStart(2, '0')}.jpg`;
  const focusAt = (p: number): [number, number] => (typeof o.focus === 'function' ? o.focus(p) : o.focus ?? [0.5, 0.5]);

  const frames: (Frame | null)[] = new Array<Frame | null>(total).fill(null);
  const state = new Uint8Array(nSheets); // par planche : 0 à charger · 1 en cours · 2 terminée (chargée ou en échec)
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
    const kx = f.width / iw, ky = f.height / ih;
    ctx.drawImage(f, sx * kx, sy * ky, sw * kx, sh * ky, 0, 0, cw, ch);
    shown = i; sfx = fx; sfy = fy; dirty = false;
    if (!isReady) { isReady = true; okReady(); }
  };
  /** un seul dessin par image d'animation : la dernière demande gagne */
  const schedule = () => { if (!raf && !dead) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };

  const resize = () => {
    if (dead || loose) return;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX), cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const cw = Math.round(cssW * dpr), ch = Math.round(cssH * dpr);
    if (!cw || !ch || (cw === canvas.width && ch === canvas.height)) return;
    canvas.width = cw; canvas.height = ch;
    // sans taille CSS, la taille affichée suit la définition et grossirait à chaque passage : on la rend et on n'y touche plus
    if (cw !== cssW && canvas.clientWidth === cw) { canvas.width = cssW; canvas.height = cssH; loose = true; }
    ctx.imageSmoothingQuality = 'high';
    dirty = true; paint(); // changer la définition efface le canvas : on redessine dans la foulée, sans image vide
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; // barre de défilement, mise en page tardive…
  observer?.observe(canvas);
  window.addEventListener('resize', resize);
  ctx.imageSmoothingQuality = 'high';
  resize();

  // ---- chargement : la planche de l'image demandée seule, puis la première et la dernière, puis un échantillonnage, puis le reste
  const order: number[] = [], queued = new Uint8Array(nSheets);
  const queue = (s: number) => { if (!queued[s]) { queued[s] = 1; order.push(s); } };
  queue(0); queue(nSheets - 1);
  for (const step of [4, 2, 1]) for (let s = 0; s < nSheets; s += step) queue(s);
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const pending = new Set<HTMLImageElement>();
  const viaImg = (src: string): Promise<HTMLImageElement> => {
    const img = new Image(); img.decoding = 'async'; pending.add(img);
    const got = typeof img.decode === 'function' ? (img.src = src, img.decode()) : new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error(src)); img.src = src; });
    return got.finally(() => pending.delete(img)).then(() => img);
  };
  /** découpe d'une planche décodée en n images ; la planche peut avoir été servie à une autre échelle */
  const cut = async (src: ImageBitmap | HTMLImageElement, n: number): Promise<Frame[]> => {
    const sw = 'naturalWidth' in src ? src.naturalWidth : src.width, sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
    const kx = sw / (COLS * cellW), ky = sh / (ROWS * cellH), fw = Math.round(w * kx), fh = Math.round(h * ky);
    const rect = (j: number) => [Math.round((j % COLS) * cellW * kx), Math.round(Math.floor(j / COLS) * cellH * ky), fw, fh] as const;
    const slots = Array.from({ length: n }, (_, j) => rect(j));
    if (typeof createImageBitmap === 'function') {
      const out = await Promise.allSettled(slots.map(([x, y, cw, ch]) => createImageBitmap(src, x, y, cw, ch)));
      if (out.every((r) => r.status === 'fulfilled')) return out.map((r) => (r as PromiseFulfilledResult<ImageBitmap>).value);
      out.forEach((r) => { if (r.status === 'fulfilled') r.value.close(); });
    }
    return slots.map(([x, y, cw, ch]) => { // repli : un canvas hors écran par image, copie au pixel près (pas de mise à l'échelle)
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.getContext('2d')?.drawImage(src, x, y, cw, ch, 0, 0, cw, ch);
      return c;
    });
  };
  /** décodage hors du fil principal (fetch + createImageBitmap) ; à défaut, ou si ce chemin échoue hors erreur HTTP, balise <img> */
  const load = async (s: number): Promise<Frame[]> => {
    const n = inSheet(s);
    if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
      let r: Response | null = null;
      try { r = await fetch(url(s), abort ? { signal: abort.signal } : undefined); } catch { /* réseau, file://… : repli */ }
      if (dead) throw new Error('détruit');
      if (r && (!r.ok || (r.headers.get('content-type') || '').startsWith('text/'))) throw new Error(`${r.status} ${url(s)}`); // 404, ou page de repli du serveur à la place de l'image
      let sheet: ImageBitmap | null = null;
      if (r) try { sheet = await createImageBitmap(await r.blob()); } catch { /* repli */ }
      if (sheet) try { return await cut(sheet, n); } finally { sheet.close(); }
      if (dead) throw new Error('détruit');
    }
    const img = await viaImg(url(s));
    try { return await cut(img, n); } finally { img.src = ''; }
  };
  let active = 0, done = 0, sheetsDone = 0, limit = 1, cursor = 0;
  /** la planche de l'image demandée en ce moment passe devant la file */
  const next = () => { const s = Math.floor(want / PER); if (!state[s]) return s; while (cursor < order.length && state[order[cursor]]) cursor++; return cursor < order.length ? order[cursor] : -1; };
  const pump = () => {
    while (!dead && active < limit) {
      const s = next();
      if (s < 0) return;
      state[s] = 1; active++;
      load(s).then((got) => {
        if (dead) { got.forEach(free); return; }
        got.forEach((f, j) => { frames[s * PER + j] = f; });
        if (shown < 0) paint(); else schedule(); // la première s'affiche tout de suite ; ensuite, seulement si elle est plus proche de l'image demandée
      }, () => { /* une planche en échec ne bloque rien : les voisines la remplacent */ }).then(() => {
        if (dead) return;
        state[s] = 2; active--; sheetsDone++; done += inSheet(s); limit = CONCURRENCY;
        if (sheetsDone === nSheets) { if (!isReady) { isReady = true; okReady(); } okLoaded(); } else pump();
        o.onProgress?.(done, total); // en images : par pas de 8 (moins pour la dernière planche)
      });
    }
  };
  void Promise.resolve().then(pump); // au tour suivant : un `set()` posé dès la création désigne la première planche à charger

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
      for (const f of frames) if (f) free(f);
      frames.fill(null);
      okReady(); okLoaded(); // personne ne reste en attente
    },
  };
}
