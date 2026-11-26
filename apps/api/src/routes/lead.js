// POST /api/lead — formulaire public du site.
//  · appel du navigateur : même origine seulement, 5 envois par heure et par IP ;
//  · appel signé du site amane.paris, de serveur à serveur (en-tête X-Amane-Signature, secret SITE_LEAD_SECRET) :
//    l'origine n'est pas vérifiée, le site ayant déjà appliqué ses propres protections.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, wrap, sendJson, HttpError, getDb, methodNotAllowed } from './_common.js';
import { readJson, readRaw, clientIp } from '../lib/http.js';
import { now } from '../lib/clock.js';
import { requireSameOrigin } from '../lib/origin.js';
import { newId } from '../lib/db.js';
import { rateHit, tooMany } from '../lib/auth.js';
import { saveDoc } from '../lib/docs.js';
import { normPhone } from '../lib/phone.js';
import { detectLang, guessService } from '../lib/lang.js';
import { sendTeamAlert } from '../lib/whatsapp.js';
import { emit } from '../lib/bus.js';
import { track } from '../lib/background.js';

const SERVICES = ['location', 'chauffeur', 'van', 'transfert', 'shopping', 'sejour', 'conciergerie', 'clip'];
const LANGUES = ['FR', 'EN', 'AR', 'RU', 'ZH', 'ES', 'IT', 'DE'];
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[A-Za-z]{2,24}$/;
const LABELS = [
  ['location', /voiture|\bcars?\b|coche|سيار/i],
  ['chauffeur', /chauffeur|ch[oó]fer|driver|سائق/i],
  ['van', /\bvan\b|فان/i],
  ['shopping', /shopping|تسو/i],
  ['sejour', /s[ée]jour|\bstays?\b|estancia|إقام/i],
  ['conciergerie', /concierg|كونسيرج/i],
  ['transfert', /transfer|a[ée]roport|airport|مطار/i],
  ['clip', /\bclip\b/i],
];
function serviceFrom(label, message) {
  const l = String(label || '').trim();
  if (SERVICES.includes(l.toLowerCase())) return l.toLowerCase();
  for (const [id, re] of LABELS) if (re.test(l)) return id;
  return guessService(message);
}
// Services du site amane.paris : ceux que le CRM connaît, et ceux qu'il range en conciergerie
// en gardant leur nom en tête des notes de la demande.
const SITE_SERVICES = { voitures: 'location', sejours: 'sejour' };
const SITE_LABELS = {
  immobilier: 'Immobilier',
  tables: 'Tables & restaurants',
  evenements: 'Événements',
  esthetique: 'Séjour esthétique',
  creation: 'Création & marketing',
  autre: 'Autre demande',
};
const SIGNATURE_RE = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/;
const SIGNATURE_MAX_AGE_S = 300;

/**
 * L'appel est-il signé par le site ? Sans en-tête : non (appel de navigateur).
 * Avec en-tête : la signature doit être juste et récente, sinon l'appel est refusé.
 * Signature : HMAC-SHA256 de « <horodatage>.<corps brut> » avec SITE_LEAD_SECRET, en hexadécimal.
 */
function signedBySite(req, raw) {
  const header = String(req.headers['x-amane-signature'] || '');
  if (!header) return '';
  const refuse = () => new HttpError(403, 'signature_refusee', 'Signature refusée.');
  const secret = process.env.SITE_LEAD_SECRET || '';
  const m = SIGNATURE_RE.exec(header);
  if (secret.length < 32 || !m) throw refuse();
  if (Math.abs(now() / 1000 - Number(m[1])) > SIGNATURE_MAX_AGE_S) throw refuse();
  const expected = createHmac('sha256', secret).update(m[1] + '.').update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(m[2], 'hex'))) throw refuse();
  return m[2];
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');

export const router = Router();

router.all('/api/lead', wrap(async (req, res) => {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  const raw = await readRaw(req, 16 * 1024);
  const signature = signedBySite(req, raw);
  if (!signature) requireSameOrigin(req);
  req.rawBody = raw;
  const body = await readJson(req, 16 * 1024);
  if (str(body.website, 200)) return sendJson(res, 200, { ok: true });
  const db = await getDb();
  if (signature) {
    // Une même demande signée n'est enregistrée qu'une fois, même si le site la renvoie.
    if (await rateHit(db, 'lead:sig:' + signature, 2 * SIGNATURE_MAX_AGE_S * 1000) > 1) return sendJson(res, 200, { ok: true });
    // Garde-fou si le secret venait à fuiter : le site ne peut pas déposer plus de 300 demandes par heure.
    if (await rateHit(db, 'lead:site', 60 * 60 * 1000) > 300) throw tooMany('Trop de demandes reçues du site.');
  } else if (await rateHit(db, 'lead:ip:' + clientIp(req), 60 * 60 * 1000) > 5) {
    throw tooMany('Trop de demandes envoyées. Réessayez plus tard ou écrivez-nous sur WhatsApp.');
  }
  const nom = str(body.nom, 120);
  const telRaw = str(body.tel, 40);
  const email = str(body.email, 200).toLowerCase();
  const message = str(body.message, 4000);
  const date = str(body.date, 40);
  const telNorm = normPhone(telRaw);
  if (!telNorm && !email) throw new HttpError(400, 'contact_requis', 'Indiquez un téléphone ou une adresse e-mail.');
  if (telRaw && !telNorm) throw new HttpError(400, 'tel_invalide', 'Numéro de téléphone invalide.');
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'email_invalide', 'Adresse e-mail invalide.');
  const langueIn = str(body.langue, 4).toUpperCase();
  const langue = LANGUES.includes(langueIn) ? langueIn : detectLang(message) || 'FR';
  const asked = str(body.service, 80);
  const siteLabel = SITE_LABELS[asked.toLowerCase()] || '';
  const service = siteLabel ? 'conciergerie' : serviceFrom(SITE_SERVICES[asked.toLowerCase()] || asked, message);
  // « 1 » à « 7 », ou « 8+ » : tel que le site l'envoie.
  const passagers = /^\d{1,2}\+?$/.test(str(String(body.passagers ?? ''), 4)) ? str(String(body.passagers), 4) : '';
  const clients = db.collection('clients');
  let client = null;
  if (telNorm) client = await clients.findOne({ telNorm, _deleted: { $ne: true } });
  if (!client && email) client = await clients.findOne({ email, _deleted: { $ne: true } });
  let clientId;
  const displayName = nom || (client && client.nom) || email || '+' + telNorm;
  if (client) {
    clientId = client._id;
    const fill = {};
    if (!client.email && email) fill.email = email;
    if (!client.tel && telNorm) fill.tel = '+' + telNorm;
    if (!client.nom && nom) fill.nom = nom;
    if (Object.keys(fill).length) await saveDoc(db, 'clients', clientId, fill, 'site', { activity: false });
  } else {
    clientId = newId('c');
    await saveDoc(db, 'clients', clientId, {
      nom: displayName, tel: telNorm ? '+' + telNorm : '', email, langue, canal: 'Site', statut: 'prospect', responsable: 'amel',
    }, 'site', { activity: false });
  }
  const mission = {
    titre: `Site — ${displayName}`, clientId, statut: 'nouvelle', service, responsable: 'amel', source: 'site', canal: 'Site',
    notes: [
      siteLabel ? `Service demandé sur le site : ${siteLabel}` : '',
      message,
      date && !/^\d{4}-\d{2}-\d{2}/.test(date) ? `Date souhaitée : ${date}` : '',
      passagers ? `Passagers : ${passagers}` : '',
    ].filter(Boolean).join('\n\n'),
  };
  const dm = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(date);
  if (dm) mission.debut = dm[2] ? `${dm[1]}T${dm[2]}` : dm[1];
  const missionId = newId('m');
  await saveDoc(db, 'missions', missionId, mission, 'site', {
    action: 'lead',
    resume: `Demande reçue du site : ${displayName}${client ? '' : ' (nouveau client)'}`,
  });
  emit('lead', { missionId, clientId, nom: displayName, message });
  await sendTeamAlert(db, {
    who: 'amel',
    texte: `Amane — nouvelle demande du site : ${displayName}${telNorm ? ' (+' + telNorm + ')' : ''}${message ? ' : « ' + message.slice(0, 120) + ' »' : ''}`,
    params: [displayName, (message || service).slice(0, 60)],
  }).catch(() => {});
  void track;
  sendJson(res, 200, { ok: true });
}));
