/* Formats français : dates, montants, téléphones, temps relatif. */
export const pad = (n: number) => String(n).padStart(2, '0');
export const parse = (s?: string | Date | null): Date | null => { if (!s) return null; const d = new Date(s); return isNaN(+d) ? null : d; };
export const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const today = () => toLocal(new Date()).slice(0, 10);
export const nowISO = () => new Date().toISOString();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const r2 = (n: unknown) => Math.round((+(n as number) || 0) * 100) / 100;

export const fmtE = (n: unknown) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(+(n as number) || 0);
export const fmtE2 = (n: unknown) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(+(n as number) || 0);
export const fmtK = (n: unknown) => { const v = +(n as number) || 0; return Math.abs(v) >= 10000 ? (Math.round(v / 100) / 10).toLocaleString('fr-FR') + ' k€' : fmtE(v); };
export const fmtL = (n: unknown, loc: string) => new Intl.NumberFormat(loc || 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(+(n as number) || 0);
export const fmtDay = (d?: Date | null) => (d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
/** Fin d'une échéance proche : « 22:43 » aujourd'hui, « demain 22:43 », sinon « ven. 13 nov. 22:43 ». */
export const fmtUntil = (d?: Date | null, now = new Date()) => { if (!d) return ''; const t = new Date(now); t.setDate(t.getDate() + 1); const pre = d.toDateString() === now.toDateString() ? '' : d.toDateString() === t.toDateString() ? 'demain ' : fmtDay(d) + ' '; return pre + fmtTime(d); };
export const fmtDayLong = (d?: Date | null) => (d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—');
export const fmtTime = (d?: Date | null) => (d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDT = (d?: Date | null) => (d ? fmtDay(d) + ' · ' + fmtTime(d) : '—');
export const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function fmtPhone(x?: string): string {
  const d = String(x || '').replace(/\D/g, ''); if (!d) return '';
  if (/^33\d{9}$/.test(d)) return '+33 ' + d.slice(2, 3) + ' ' + d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
  const m = d.match(/^(1|7|2\d|3\d|4\d|5\d|6\d|8\d|9\d{2}|9\d)(\d+)$/); return m ? '+' + m[1] + ' ' + m[2].replace(/(\d{3})(?=\d{2})/g, '$1 ') : '+' + d;
}
export function relTime(iso?: string): string {
  const d = parse(iso); if (!d) return ''; const s = (Date.now() - +d) / 1000;
  if (s < 45) return 'à l’instant'; if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  const now = new Date();
  if (sameDay(d, now)) return s < 4 * 3600 ? `il y a ${Math.round(s / 3600)} h` : 'aujourd’hui à ' + fmtTime(d);
  if (sameDay(d, addD(now, -1))) return 'hier à ' + fmtTime(d);
  if (+now - +d < 6 * 864e5) return d.toLocaleDateString('fr-FR', { weekday: 'long' }) + ' à ' + fmtTime(d);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + fmtTime(d);
}
export function shortTime(iso?: string): string {
  const d = parse(iso); if (!d) return ''; const now = new Date();
  if (sameDay(d, now)) return fmtTime(d); if (sameDay(d, addD(now, -1))) return 'Hier';
  if (+now - +d < 6 * 864e5) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
export function dayLabel(d?: Date | null): string {
  if (!d) return ''; const now = new Date();
  if (sameDay(d, now)) return 'Aujourd’hui'; if (sameDay(d, addD(now, -1))) return 'Hier'; if (sameDay(d, addD(now, 1))) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
export const initial = (s?: string) => { const m = String(s || '').replace(/^(M\.|Mme|Mlle|Mr|Mrs|Ms|Dr)\s+/i, '').match(/\p{L}/u); return m ? m[0].toUpperCase() : '#'; };
export const norm = (x?: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-.]+/g, ' ');
export const slug = (x?: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'document';
export const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export const monthBounds = (d: Date): [Date, Date] => [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)];
export const monthOf = (off: number) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + off, 15); };
export function overlapDays(m: { debut?: string; fin?: string }, from: Date, to: Date): number {
  const a = parse(m.debut), b = parse(m.fin) || a; if (!a) return 0;
  const s = Math.max(+sod(a), +sod(from)), e = Math.min(+sod(b as Date), +sod(to)); if (e < s) return 0; return Math.round((e - s) / 864e5) + 1;
}
export const isRTL = (lang?: string) => String(lang || '').toUpperCase().startsWith('AR');
export const telHref = (t?: string) => { const d = String(t || '').replace(/[^\d+]/g, ''); return d.replace(/\D/g, '').length >= 8 ? 'tel:' + (d.startsWith('+') ? d : '+' + d.replace(/^0/, '33')) : ''; };
export const isIOS = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export function download(filename: string, data: string | Blob) {
  const type = /\.json$/.test(filename) ? 'application/json' : /\.csv$/.test(filename) ? 'text/csv;charset=utf-8' : /\.ics$/.test(filename) ? 'text/calendar' : /\.html?$/.test(filename) ? 'text/html;charset=utf-8' : 'application/octet-stream';
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export async function copyText(t: string): Promise<boolean> { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }
export const getK = (o: unknown, k: string): unknown => k.split('.').reduce<unknown>((x, p) => (x == null ? '' : (x as Record<string, unknown>)[p]), o);
export function setK(o: Record<string, unknown>, k: string, v: unknown) {
  const ps = k.split('.'); let x = o as Record<string, unknown>;
  ps.slice(0, -1).forEach((p) => { if (x[p] == null || typeof x[p] !== 'object') x[p] = /^\d+$/.test(ps[ps.indexOf(p) + 1] || '') ? [] : {}; x = x[p] as Record<string, unknown>; });
  x[ps[ps.length - 1]] = v;
}
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
