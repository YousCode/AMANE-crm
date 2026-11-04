// Météo de Paris pour le salon : Open-Meteo (gratuit, sans clé), mise en cache 15 min, jamais bloquante.
// Sortie stable pour les fronts : état courant, journée, prochaines heures, demain, lever/coucher, conseil de conciergerie.
import { nowIso } from './clock.js';

const LAT = 48.8566, LON = 2.3522, TZ = 'Europe/Paris';
export const METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=${encodeURIComponent(TZ)}`
  + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,precipitation'
  + '&hourly=temperature_2m,weather_code,precipitation_probability&forecast_hours=12'
  + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&forecast_days=2';

const TTL = 15 * 60 * 1000;
let cache = { at: 0, data: null };

/** Code WMO → libellé français et icône monoligne (clé pour les fronts). */
export function describe(code, isDay = 1) {
  const c = Number(code);
  if (c === 0) return { label: isDay ? 'Ciel dégagé' : 'Nuit claire', icon: isDay ? 'soleil' : 'lune' };
  if (c === 1) return { label: isDay ? 'Beau temps' : 'Nuit claire', icon: isDay ? 'soleil' : 'lune' };
  if (c === 2) return { label: 'Éclaircies', icon: isDay ? 'soleil-nuage' : 'lune-nuage' };
  if (c === 3) return { label: 'Couvert', icon: 'nuage' };
  if (c === 45 || c === 48) return { label: 'Brume', icon: 'brume' };
  if (c >= 51 && c <= 57) return { label: 'Bruine', icon: 'bruine' };
  if (c >= 61 && c <= 67) return { label: c >= 65 ? 'Pluie forte' : 'Pluie', icon: 'pluie' };
  if (c >= 71 && c <= 77) return { label: 'Neige', icon: 'neige' };
  if (c >= 80 && c <= 82) return { label: 'Averses', icon: 'averse' };
  if (c === 85 || c === 86) return { label: 'Averses de neige', icon: 'neige' };
  if (c >= 95) return { label: 'Orage', icon: 'orage' };
  return { label: 'Variable', icon: 'nuage' };
}

/** Un mot de conciergerie, jamais une consigne : ce que la journée change pour les voitures et les clients. */
export function conseil({ code, tempMax, pluieProba, vent }) {
  const c = Number(code);
  if (c >= 95) return 'Orages annoncés : prévoir les transferts avec marge et prévenir les clients.';
  if (c >= 71 && c <= 86 && c !== 80 && c !== 81 && c !== 82) return 'Neige possible : privilégier le G 63 et le van, éviter la supercar.';
  if (pluieProba >= 60 || (c >= 61 && c <= 67)) return 'Pluie probable : parapluies dans les voitures, chauffeur à la porte.';
  if (c >= 51 && c <= 57) return 'Bruine : prévoir des serviettes et une arrivée au plus près de l’entrée.';
  if (vent >= 50) return 'Vent fort : les toits ouverts resteront fermés.';
  if (tempMax >= 28) return 'Chaleur : eau fraîche à bord et climatisation lancée avant la remise.';
  if (tempMax <= 4) return 'Froid vif : préchauffer les voitures et prévoir des plaids dans le van.';
  if (c <= 1) return 'Journée claire : une voiture décapotée se propose bien aujourd’hui.';
  return 'Temps calme : rien à prévoir de particulier côté voitures.';
}

function shape(j) {
  const cur = j.current || {}, d = j.daily || {}, h = j.hourly || {};
  const isDay = cur.is_day ?? 1;
  const now0 = describe(cur.weather_code, isDay);
  const heures = (h.time || []).map((t, i) => ({ t, temp: Math.round(h.temperature_2m[i]), code: h.weather_code[i], pluie: h.precipitation_probability?.[i] ?? null, ...describe(h.weather_code[i], 1) })).slice(0, 12);
  const jour = (i) => d.time ? ({ date: d.time[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), code: d.weather_code[i], pluie: d.precipitation_probability_max?.[i] ?? null, lever: d.sunrise?.[i], coucher: d.sunset?.[i], ...describe(d.weather_code[i], 1) }) : null;
  const aujourdhui = jour(0), demain = jour(1);
  return {
    ville: 'Paris', maj: nowIso(),
    actuel: { temp: Math.round(cur.temperature_2m), ressenti: Math.round(cur.apparent_temperature ?? cur.temperature_2m), code: cur.weather_code, vent: Math.round(cur.wind_speed_10m ?? 0), jour: Boolean(isDay), ...now0 },
    aujourdhui, demain, heures,
    conseil: conseil({ code: aujourdhui?.code ?? cur.weather_code, tempMax: aujourdhui?.max ?? cur.temperature_2m, pluieProba: aujourdhui?.pluie ?? 0, vent: cur.wind_speed_10m ?? 0 }),
  };
}

/** Météo mise en cache ; `null` si indisponible (réseau, délai). */
export async function getMeteo() {
  const t = Date.now();
  if (cache.data && t - cache.at < TTL) return { ...cache.data, cache: true };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(METEO_URL, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('meteo ' + r.status);
    const data = shape(await r.json());
    cache = { at: t, data };
    return { ...data, cache: false };
  } catch (e) {
    if (cache.data) return { ...cache.data, cache: true, perime: true };
    return null;
  } finally { clearTimeout(timer); }
}

export function resetMeteoCache() { cache = { at: 0, data: null }; }

/** Réponse de démonstration (FAKE_DB / tests) : un bel après-midi d'automne à Paris. */
export function fakeMeteoPayload(base = new Date()) {
  const d = new Date(base); const day = d.toISOString().slice(0, 10);
  const next = new Date(d); next.setDate(next.getDate() + 1); const day2 = next.toISOString().slice(0, 10);
  const hours = [...Array(12)].map((_, i) => { const x = new Date(d); x.setMinutes(0, 0, 0); x.setHours(x.getHours() + i); return x.toISOString().slice(0, 16); });
  return {
    current: { temperature_2m: 13.4, apparent_temperature: 12.1, weather_code: 2, wind_speed_10m: 14, is_day: 1, precipitation: 0 },
    hourly: { time: hours, temperature_2m: hours.map((_, i) => 13 + Math.round(Math.sin(i / 3) * 2)), weather_code: hours.map((_, i) => (i < 5 ? 2 : i < 9 ? 3 : 61)), precipitation_probability: hours.map((_, i) => (i < 6 ? 5 : 20 + i * 5)) },
    daily: { time: [day, day2], weather_code: [2, 61], temperature_2m_max: [15, 12], temperature_2m_min: [8, 9], sunrise: [`${day}T07:48`, `${day2}T07:50`], sunset: [`${day}T17:21`, `${day2}T17:19`], precipitation_probability_max: [20, 70] },
  };
}
