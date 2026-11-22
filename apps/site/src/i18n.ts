/* Quatre langues (français, anglais, espagnol, arabe de droite à gauche). Les textes viennent de nos propres dictionnaires :
   ils peuvent porter un <em> et sont donc posés en HTML. */
import { BASE, MSG, type Lang } from './i18n/base';
import { EXTRA } from './i18n/extra';

export type { Lang };
export const LANGS: readonly Lang[] = ['fr', 'en', 'es', 'ar'];
export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ar: 'ar' };
const DICT = Object.fromEntries(LANGS.map((l) => [l, { ...BASE[l], ...EXTRA[l] }])) as Record<Lang, Record<string, any>>;

/** Texte d'une clé, avec chemin (« s1.0 », « pr.k ») ; repli sur le français, puis sur une chaîne vide. */
/** Typographie française : espace fine insécable avant ; : ! ? » et après «, apostrophe courbe. */
const fine = (v: any): any =>
  typeof v === 'string' ? v.replace(/ ([;:!?»])/g, '\u202F$1').replace(/« /g, '«\u202F').replace(/(\p{L})'(\p{L})/gu, '$1’$2')
  : Array.isArray(v) ? v.map(fine)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fine(x)])) : v;

export function tr(lang: Lang, path: string): any {
  const walk = (o: any) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const v = walk(DICT[lang]) ?? walk(DICT.fr) ?? '';
  return lang === 'fr' ? fine(v) : v;
}
export const message = (lang: Lang, ...a: Parameters<(typeof MSG)['fr']>) => MSG[lang](...a);

export function detectLang(): Lang {
  const ok = (v: string | null | undefined): Lang | null => (LANGS as readonly string[]).includes(String(v || '').slice(0, 2).toLowerCase()) ? (String(v).slice(0, 2).toLowerCase() as Lang) : null;
  let saved: string | null = null;
  try { saved = localStorage.getItem('amane.lang'); } catch { /* stockage indisponible */ }
  return ok(new URLSearchParams(location.search).get('lang')) || ok(saved) || ok(navigator.language) || 'fr';
}

export function applyLang(lang: Lang) {
  const html = document.documentElement;
  html.lang = lang; html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  try { localStorage.setItem('amane.lang', lang); } catch { /* ignoré */ }
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { const v = tr(lang, el.dataset.i18n!); if (typeof v === 'string' && v) el.innerHTML = v; });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', String(tr(lang, el.dataset.i18nAria!))));
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
