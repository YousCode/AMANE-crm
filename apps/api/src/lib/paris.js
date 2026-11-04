// Heure de Paris : conversion entre instants (ms UTC) et heure murale « AAAA-MM-JJTHH:MM » (celle des fiches).
const TZ = 'Europe/Paris';
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Instant → {y, m, d, hh, mm} en heure de Paris. */
export function parisParts(ms) {
  const p = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour === 24 ? 0 : +p.hour, mm: +p.minute };
}

/** Décalage (ms) de Paris par rapport à UTC à l'instant donné. */
export function parisOffset(ms) {
  const p = parisParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0) - Math.floor(ms / 60000) * 60000;
}

/** Heure murale de Paris (y, m, d, hh, mm) → instant (ms). */
export function parisToMs(y, m, d, hh = 0, mm = 0) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const off = parisOffset(guess);
  const first = guess - off;
  const off2 = parisOffset(first);
  return off2 === off ? first : guess - off2;
}

/** « AAAA-MM-JJ[THH:MM] » (heure de Paris) → instant (ms), ou null. */
export function wallToMs(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s || ''));
  if (!m) return null;
  return parisToMs(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

/** Instant → « AAAA-MM-JJTHH:MM » en heure de Paris. */
export function msToWall(ms) {
  const p = parisParts(ms);
  const z = (n) => String(n).padStart(2, '0');
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.hh)}:${z(p.mm)}`;
}

/** « AAAA-MM-JJ » de Paris pour un instant. */
export const parisDay = (ms) => msToWall(ms).slice(0, 10);

/** Ajoute n jours à une date murale « AAAA-MM-JJ » (calendaire). */
export function addWallDays(day, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}
