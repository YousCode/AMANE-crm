// POST /api/lead — formulaire public du site. Même origine seulement, 5 envois par heure et par IP.
import { Router, wrap, sendJson, HttpError, getDb, methodNotAllowed } from './_common.js';
import { readJson, clientIp } from '../lib/http.js';
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
const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');

export const router = Router();

router.all('/api/lead', wrap(async (req, res) => {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireSameOrigin(req);
  const body = await readJson(req, 16 * 1024);
  if (str(body.website, 200)) return sendJson(res, 200, { ok: true });
  const db = await getDb();
  if (await rateHit(db, 'lead:ip:' + clientIp(req), 60 * 60 * 1000) > 5) {
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
  const service = serviceFrom(str(body.service, 80), message);
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
    notes: [message, date && !/^\d{4}-\d{2}-\d{2}/.test(date) ? `Date souhaitée : ${date}` : ''].filter(Boolean).join('\n\n'),
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
