// Réponse automatique WhatsApp : textes par défaut (@amane/shared), horaires (Europe/Paris), prénom.
// Jamais de prix ni d'engagement : seulement un accusé de réception personnel.
import { DICT, WA_LANGS, firstName as sharedFirstName, fillVars } from '@amane/shared';

export const DEFAULT_TEXTES = Object.fromEntries(WA_LANGS.map((L) => [L, { jour: DICT[L]['auto.jour'], nuit: DICT[L]['auto.nuit'] }]));

export const DEFAULT_REGLAGES = {
  autoReply: true,
  horaires: { debut: '09:00', fin: '21:00' },
  fuseau: 'Europe/Paris',
  textes: DEFAULT_TEXTES,
};

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** reglages/general (ou null) → réglages complets avec valeurs par défaut. */
export function effectiveReglages(doc) {
  const d = doc || {};
  const h = d.horaires || {};
  const textes = {};
  for (const L of Object.keys(DEFAULT_TEXTES)) {
    const t = (d.textes && d.textes[L]) || {};
    textes[L] = {
      jour: typeof t.jour === 'string' && t.jour.trim() ? t.jour : DEFAULT_TEXTES[L].jour,
      nuit: typeof t.nuit === 'string' && t.nuit.trim() ? t.nuit : DEFAULT_TEXTES[L].nuit,
    };
  }
  let fuseau = typeof d.fuseau === 'string' && d.fuseau ? d.fuseau : 'Europe/Paris';
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau }); } catch { fuseau = 'Europe/Paris'; }
  return {
    autoReply: d.autoReply !== false,
    horaires: {
      debut: HM_RE.test(h.debut || '') ? h.debut : '09:00',
      fin: HM_RE.test(h.fin || '') ? h.fin : '21:00',
    },
    fuseau,
    textes,
  };
}

/** « HH:MM » dans le fuseau donné (Intl, indépendant du fuseau du serveur). */
export function localHM(ms, timeZone = 'Europe/Paris') {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const hh = parts.find((p) => p.type === 'hour').value;
  const mm = parts.find((p) => p.type === 'minute').value;
  return `${hh === '24' ? '00' : hh}:${mm}`;
}

export function isDaytime(ms, reglages) {
  const r = reglages || DEFAULT_REGLAGES;
  const hm = localHM(ms, r.fuseau);
  const { debut, fin } = r.horaires;
  if (debut <= fin) return hm >= debut && hm < fin;
  return hm >= debut || hm < fin; // horaires qui passent minuit
}

export const firstName = sharedFirstName;

export function fillTemplate(text, prenom) {
  return fillVars(text, { prenom });
}

/** Texte de la réponse automatique. */
export function autoReplyText({ lang, profileName, ms, reglages }) {
  const r = reglages || DEFAULT_REGLAGES;
  const L = r.textes[lang] ? lang : 'FR';
  const moment = isDaytime(ms, r) ? 'jour' : 'nuit';
  return { text: fillTemplate(r.textes[L][moment], firstName(profileName)), moment, lang: L };
}
