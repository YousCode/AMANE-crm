import { parseDate as parseDate0, toLocal } from '@amane/shared';
const parseDate = (x: unknown) => parseDate0(x as string | Date | null | undefined);

const p2 = (n: number) => String(n).padStart(2, '0');
export const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.toDateString() === b.toDateString();

export function fmtTime(x: unknown): string {
  const d = parseDate(x); if (!d) return '';
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_C = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function fmtDay(x: unknown): string {
  const d = parseDate(x); if (!d) return '';
  return `${JOURS_C[d.getDay()]} ${d.getDate()} ${MOIS_C[d.getMonth()]}`;
}
export function fmtDayLong(x: unknown): string {
  const d = parseDate(x); if (!d) return '';
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
export function fmtDT(x: unknown): string {
  const d = parseDate(x); if (!d) return '';
  return `${fmtDay(d)} · ${fmtTime(d)}`;
}
export function fmtDate(x: unknown): string {
  const d = parseDate(x); if (!d) return '';
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
/** « Aujourd’hui », « Hier », « Demain » ou le jour. */
export function dayLabel(x: unknown, now = new Date()): string {
  const d = parseDate(x); if (!d) return '';
  if (sameDay(d, now)) return 'Aujourd’hui';
  if (sameDay(d, addD(now, -1))) return 'Hier';
  if (sameDay(d, addD(now, 1))) return 'Demain';
  return fmtDayLong(d);
}
/** Heure si aujourd’hui, sinon jour court. */
export function shortTime(x: unknown, now = new Date()): string {
  const d = parseDate(x); if (!d) return '';
  if (sameDay(d, now)) return fmtTime(d);
  if (sameDay(d, addD(now, -1))) return 'hier';
  return fmtDay(d);
}
export function relTime(x: unknown, now = new Date()): string {
  const d = parseDate(x); if (!d) return '';
  const s = Math.round((+now - +d) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400 && sameDay(d, now)) return `il y a ${Math.round(s / 3600)} h`;
  return shortTime(d, now);
}

export function fmtE(n: unknown): string {
  const v = +(n as number) || 0;
  const s = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '-' : ''}${s} €`;
}
export function fmtE2(n: unknown): string {
  const v = +(n as number) || 0;
  const [i, f] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${f} €`;
}
export function fmtK(n: unknown): string {
  const v = +(n as number) || 0;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',').replace(',0', '')} k€`;
  return fmtE(v);
}
export function fmtPhone(x: unknown): string {
  const d = String(x || '').replace(/\D/g, ''); if (!d) return '';
  if (/^33\d{9}$/.test(d)) return '+33 ' + d.slice(2, 3) + ' ' + d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
  const m = d.match(/^(1|7|2\d|3\d|4\d|5\d|6\d|8\d|9\d{2}|9\d)(\d+)$/);
  return m ? '+' + m[1] + ' ' + m[2].replace(/(\d{3})(?=\d{2})/g, '$1 ') : '+' + d;
}
export function initial(s: unknown): string {
  const t = String(s || '').trim();
  const w = t.split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : w[0][0]).toUpperCase();
}
export function fmtDuration(sec: unknown): string {
  const s = Math.max(0, Math.round(+(sec as number) || 0));
  return `${Math.floor(s / 60)}:${p2(s % 60)}`;
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const nowISO = () => new Date().toISOString();

/** Date → valeur locale « AAAA-MM-JJTHH:mm » attendue par les champs de mission. */
export const toLocalInput = (d: Date) => toLocal(d);
