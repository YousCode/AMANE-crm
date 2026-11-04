// WhatsApp Cloud API : envoi (Graph v21.0), signature des webhooks, traitement des messages reçus,
// suites (réponse automatique, IA, traduction, médias, transcription, alertes), accusés de lecture.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { t as tr, firstName } from '@amane/shared';
import { now, nowIso } from './clock.js';
import { newId, isDuplicate, withLock, toApi } from './db.js';
import { saveDoc, logActivity } from './docs.js';
import { normPhone } from './phone.js';
import { detectLang, langFromPhone, guessService } from './lang.js';
import { effectiveReglages, autoReplyText } from './autoreply.js';
import { aiConfigured, extractRequest } from './ai.js';
import { translateCached } from './translate.js';
import { downloadInboundMedia, uploadToMeta, toBuffer, GRAPH_BASE as MEDIA_GRAPH_BASE } from './media.js';
import { transcribeConfigured, transcribeMessage } from './transcribe.js';
import { emit } from './bus.js';
import { effectiveTemplates } from './templates.js';

export const GRAPH_VERSION = 'v21.0';
export const GRAPH_BASE = MEDIA_GRAPH_BASE;
export const WINDOW_MS = 24 * 3600 * 1000;
export const AUTO_REPLY_GAP_MS = 12 * 3600 * 1000;
export const OPEN_STATUTS = ['nouvelle', 'proposition', 'confirmee', 'encours'];
export const ALERT_TEMPLATE = 'amane_alerte';

export function waConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export class GraphError extends Error {
  constructor(status, error) {
    super((error && error.message) || `Graph ${status}`);
    this.status = status;
    this.graph = error || null;
  }
}

/** Codes d'erreur Meta → phrase lisible (affichée dans le fil). */
export const META_ERRORS = {
  131047: 'Plus de 24 h depuis le dernier message du client : un modèle approuvé est nécessaire.',
  131026: 'Ce numéro n’est pas joignable sur WhatsApp.',
  131030: 'Numéro non autorisé (liste de test Meta).',
  131021: 'Impossible d’envoyer un message à son propre numéro.',
  131053: 'Média refusé par WhatsApp (format ou taille).',
  131056: 'Trop de messages envoyés à ce numéro : réessayez plus tard.',
  132000: 'Le nombre de paramètres ne correspond pas au modèle.',
  132001: 'Modèle inexistant ou non approuvé dans cette langue.',
  132012: 'Paramètre de modèle invalide.',
  133010: 'Numéro WhatsApp Business non enregistré.',
  130472: 'Ce client a refusé les messages marketing.',
  100: 'Requête refusée par Meta (paramètre invalide).',
  190: 'Jeton WhatsApp expiré ou invalide.',
  2: 'WhatsApp temporairement indisponible.',
};
export function metaErrorText(code, fallback) {
  return META_ERRORS[Number(code)] || fallback || (code ? `Erreur WhatsApp ${code}` : 'Erreur WhatsApp');
}

/** Envoie un message ; renvoie le wamid. */
export async function graphSend(payload, { timeoutMs = 4000 } = {}) {
  const url = `${GRAPH_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new GraphError(0, { message: e && e.name === 'TimeoutError' ? 'délai dépassé' : 'injoignable' });
  }
  let j = {};
  try { j = await r.json(); } catch { j = {}; }
  if (!r.ok) throw new GraphError(r.status, j.error);
  if (payload.status === 'read') return 'read';
  const id = j.messages && j.messages[0] && j.messages[0].id;
  if (!id) throw new GraphError(r.status, { message: 'réponse sans identifiant' });
  return id;
}

const base = (to) => ({ messaging_product: 'whatsapp', recipient_type: 'individual', to });
export function textPayload(to, body) {
  return { ...base(to), type: 'text', text: { preview_url: false, body } };
}
export function templatePayload(to, name, lang, params = []) {
  const template = { name, language: { code: lang || 'fr' } };
  if (params.length) template.components = [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: String(p) })) }];
  return { ...base(to), type: 'template', template };
}
export function mediaPayload(to, type, { id, link, caption, filename }) {
  const m = {};
  if (id) m.id = id; else m.link = link;
  if (caption && type !== 'audio') m.caption = caption;
  if (filename && type === 'document') m.filename = filename;
  return { ...base(to), type, [type]: m };
}
export function locationPayload(to, { lat, lng, name, address }) {
  const location = { latitude: lat, longitude: lng };
  if (name) location.name = name;
  if (address) location.address = address;
  return { ...base(to), type: 'location', location };
}
export function contactPayload(to, { nom, tel, email, org }) {
  const parts = String(nom || '').trim().split(/\s+/);
  const c = { name: { formatted_name: nom, first_name: parts[0] || nom, ...(parts.length > 1 ? { last_name: parts.slice(1).join(' ') } : {}) } };
  if (tel) c.phones = [{ phone: '+' + normPhone(tel), type: 'WORK', wa_id: normPhone(tel) }];
  if (email) c.emails = [{ email, type: 'WORK' }];
  if (org) c.org = { company: org };
  return { ...base(to), type: 'contacts', contacts: [c] };
}
export function readPayload(messageId) {
  return { messaging_product: 'whatsapp', status: 'read', message_id: messageId };
}

/** X-Hub-Signature-256 = « sha256=<hex HMAC du corps brut> ». Comparaison à temps constant. */
export function verifySignature(raw, header, secret) {
  if (!secret || !header || typeof header !== 'string') return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const got = Buffer.from(m[1].toLowerCase(), 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** TEAM_ALERT_NUMBERS « amel:33600000001,aziz:33600000002 » → { amel:'33600000001', … } */
export function teamNumbers() {
  const out = {};
  for (const part of String(process.env.TEAM_ALERT_NUMBERS || '').split(',')) {
    const [who, num] = part.split(':').map((s) => (s || '').trim());
    const n = normPhone(num && (num.startsWith('+') ? num : '+' + num));
    if (who && n) out[who.toLowerCase()] = n;
  }
  return out;
}

export function teamMemberFor(phone) {
  for (const [who, n] of Object.entries(teamNumbers())) if (n === phone) return who;
  return null;
}

async function emitConversation(db, convId) {
  const c = await db.collection('conversations').findOne({ _id: convId });
  if (c) emit('conversation', { conversation: toApi(c) });
}

/** Enregistre un message sortant et met la conversation à jour. */
export async function recordOutgoing(db, { convId, id, type, text, by, template, media, location, contacts, replyTo, extra }) {
  const at = nowIso();
  const doc = { _id: id, convId, dir: 'out', type, text, at, status: 'envoye', by, createdAt: at, updatedAt: at, updatedBy: by };
  if (template) doc.template = template;
  if (media) doc.media = media;
  if (location) doc.location = location;
  if (contacts) doc.contacts = contacts;
  if (replyTo) doc.replyTo = replyTo;
  if (extra) Object.assign(doc, extra);
  try { await db.collection('messages').insertOne(doc); } catch (e) { if (!isDuplicate(e)) throw e; }
  const set = { lastAt: at, lastText: String(text).slice(0, 200), lastDir: 'out', lastOutAt: at, updatedAt: at, updatedBy: by };
  if (by !== 'auto' && by !== 'rappel') set.lastHumanOutAt = at; // une réponse automatique ne « répond » pas au client
  await db.collection('conversations').updateOne({ _id: convId }, { $set: set });
  emit('message', { message: toApi(doc) });
  await emitConversation(db, convId);
  return doc;
}

/** Note interne (jamais envoyée au client), affichée dans le fil. */
export async function recordNote(db, { convId, text, by, missionId }) {
  const at = nowIso();
  const doc = { _id: newId('n'), convId, dir: 'note', type: 'note', text, at, status: 'recu', by, createdAt: at, updatedAt: at, updatedBy: by };
  if (missionId) doc.missionId = missionId;
  await db.collection('messages').insertOne(doc);
  emit('message', { message: toApi(doc) });
  return doc;
}

// ---------- réception ----------

const RANK = { envoye: 1, distribue: 2, lu: 3 };
const STATUS_MAP = { sent: 'envoye', delivered: 'distribue', read: 'lu', failed: 'echec' };
const MEDIA_LABELS = { image: '[Photo]', video: '[Vidéo]', document: '[Document]', audio: '[Message vocal]', sticker: '[Autocollant]' };

export function messageContent(msg) {
  const t = msg.type;
  switch (t) {
    case 'text': return { text: (msg.text && msg.text.body) || '' };
    case 'button': return { text: (msg.button && msg.button.text) || '' };
    case 'interactive': {
      const i = msg.interactive || {};
      const r = i.button_reply || i.list_reply || {};
      return { text: r.title || '' };
    }
    case 'image': case 'video': case 'document': case 'audio': case 'sticker': {
      const m = msg[t] || {};
      const media = { id: m.id || '', mime: String(m.mime_type || '').slice(0, 100) };
      if (m.filename) media.filename = String(m.filename).slice(0, 120);
      if (m.caption) media.caption = String(m.caption).slice(0, 1024);
      if (m.voice) media.voice = true;
      const label = t === 'audio' && m.voice === false ? '[Audio]' : MEDIA_LABELS[t];
      return { text: m.caption ? `${label} ${m.caption}` : m.filename ? `${label} ${m.filename}` : label, media, caption: m.caption || '' };
    }
    case 'location': {
      const l = msg.location || {};
      const location = { lat: Number(l.latitude), lng: Number(l.longitude) };
      if (l.name) location.name = String(l.name).slice(0, 200);
      if (l.address) location.address = String(l.address).slice(0, 300);
      if (l.url) location.url = String(l.url).slice(0, 300);
      return { text: `[Position] ${[l.name, l.address].filter(Boolean).join(', ')} (${l.latitude}, ${l.longitude})`.replace(/\s+/g, ' '), location };
    }
    case 'contacts': {
      const contacts = (Array.isArray(msg.contacts) ? msg.contacts : []).slice(0, 10).map((c) => {
        const o = { nom: String((c.name && (c.name.formatted_name || [c.name.first_name, c.name.last_name].filter(Boolean).join(' '))) || '').slice(0, 120) };
        const ph = Array.isArray(c.phones) && c.phones[0];
        if (ph) o.tel = String(ph.wa_id ? '+' + ph.wa_id : ph.phone || '').slice(0, 40);
        const em = Array.isArray(c.emails) && c.emails[0];
        if (em && em.email) o.email = String(em.email).slice(0, 120);
        if (c.org && c.org.company) o.org = String(c.org.company).slice(0, 120);
        return o;
      });
      return { text: `[Contact partagé]${contacts[0] && contacts[0].nom ? ' ' + contacts[0].nom : ''}`, contacts };
    }
    case 'reaction': {
      const r = msg.reaction || {};
      return { text: String(r.emoji || ''), reaction: { reactionTo: String(r.message_id || ''), emoji: String(r.emoji || '') } };
    }
    default: return null; // unsupported, system… : ignorés
  }
}

export function shortTitle(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 48) return s;
  const cut = s.slice(0, 48);
  const i = cut.lastIndexOf(' ');
  return (i > 24 ? cut.slice(0, i) : cut) + '…';
}

/**
 * Traite le corps d'un webhook déjà authentifié.
 * Fait les écritures essentielles et renvoie la liste des tâches de suite
 * (réponse automatique, IA, traduction, médias, alerte) à lancer après avoir répondu à Meta.
 */
export async function handleWebhook(db, payload) {
  const followups = [];
  const stats = { messages: 0, duplicates: 0, statuses: 0 };
  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return { followups, stats };
  for (const entry of payload.entry) {
    for (const change of (entry && entry.changes) || []) {
      const value = change && change.value;
      if (!value || change.field !== 'messages') continue;
      for (const st of value.statuses || []) {
        stats.statuses++;
        await handleStatus(db, st);
      }
      for (const msg of value.messages || []) {
        const r = await handleInbound(db, value, msg);
        if (r === 'duplicate') stats.duplicates++;
        else if (r) { stats.messages++; followups.push(...r); }
      }
    }
  }
  return { followups, stats };
}

async function handleStatus(db, st) {
  const status = STATUS_MAP[st && st.status];
  if (!status || !st.id) return;
  const col = db.collection('messages');
  const m = await col.findOne({ _id: String(st.id) });
  if (!m) return;
  if (status !== 'echec' && (RANK[m.status] || 0) >= RANK[status]) return; // jamais de retour en arrière
  const set = { status, updatedAt: nowIso(), updatedBy: 'whatsapp' };
  if (status === 'echec' && Array.isArray(st.errors) && st.errors[0]) {
    const e = st.errors[0];
    set.erreurCode = Number(e.code) || 0;
    set.erreur = metaErrorText(e.code, String(e.title || e.message || e.code || '').slice(0, 200));
  }
  await col.updateOne({ _id: String(st.id) }, { $set: set });
  emit('message', { message: toApi({ ...m, ...set }) });
}

async function handleInbound(db, value, msg) {
  if (!msg || !msg.id || !msg.from) return null;
  const content = messageContent(msg);
  if (!content) return null;
  const phone = normPhone('+' + String(msg.from).replace(/\D/g, ''));
  if (!phone) return null;
  const contact = (value.contacts || []).find((c) => c && normPhone('+' + c.wa_id) === phone) || (value.contacts || [])[0] || {};
  const profileName = String((contact.profile && contact.profile.name) || '').slice(0, 80);
  const tsMs = Number(msg.timestamp) > 0 ? Number(msg.timestamp) * 1000 : now();
  const at = new Date(Math.min(tsMs, now())).toISOString();
  const stamp = nowIso();
  const text = String(content.text || '').slice(0, 4096);

  // 1. Idempotence : le wamid est la clé du message.
  const mdoc = { _id: String(msg.id), convId: phone, dir: 'in', type: msg.type, text, at, status: 'recu', by: 'client', createdAt: stamp, updatedAt: stamp, updatedBy: 'whatsapp' };
  if (content.media) mdoc.media = content.media;
  if (content.location) mdoc.location = content.location;
  if (content.contacts) mdoc.contacts = content.contacts;
  if (content.reaction) { mdoc.reactionTo = content.reaction.reactionTo; mdoc.emoji = content.reaction.emoji; }
  if (msg.context && msg.context.id) mdoc.replyTo = String(msg.context.id).slice(0, 200);
  if (msg.context && msg.context.forwarded) mdoc.forwarded = true;
  try {
    await db.collection('messages').insertOne(mdoc);
  } catch (e) {
    if (isDuplicate(e)) return 'duplicate';
    throw e;
  }
  emit('message', { message: toApi(mdoc) });

  const convCol = db.collection('conversations');
  // Réaction : stockée, rien d'autre (ni non-lu, ni demande, ni réponse automatique).
  if (content.reaction) {
    await convCol.updateOne({ _id: phone }, { $set: { updatedAt: stamp, updatedBy: 'whatsapp' } });
    await emitConversation(db, phone);
    return [];
  }

  // Sérialisé par numéro : une rafale de messages ne crée qu'un client et qu'une demande.
  const locked = await withLock(db, 'wa:' + phone, async () => {
    const prev = await convCol.findOne({ _id: phone });
    const team = teamMemberFor(phone);
    const detected = detectLang(content.media ? content.media.caption || '' : text);
    const lang = detected || (prev && prev.lang) || langFromPhone(phone) || 'FR';

    let client = null;
    let mission = null;
    let createdClient = false;
    let createdMission = false;
    if (!team) {
      // 2. Client retrouvé par téléphone normalisé, sinon créé.
      client = await db.collection('clients').findOne({ telNorm: phone, _deleted: { $ne: true } });
      if (!client) {
        const id = newId('c');
        const fields = { nom: profileName || '+' + phone, tel: '+' + phone, canal: 'WhatsApp', statut: 'prospect', langue: lang, responsable: 'amel' };
        await saveDoc(db, 'clients', id, fields, 'whatsapp', { activity: false });
        client = { _id: id, ...fields };
        createdClient = true;
      } else if (!client.langue && detected) {
        // 4. Langue détectée mémorisée sur le client si vide.
        await saveDoc(db, 'clients', client._id, { langue: detected }, 'whatsapp', { activity: false });
        client.langue = detected;
      }
      // 3. Demande ouverte de moins de 30 jours, sinon nouvelle demande.
      const since = new Date(now() - 30 * 86400000).toISOString();
      mission = await db.collection('missions').findOne(
        { clientId: client._id, statut: { $in: OPEN_STATUTS }, _deleted: { $ne: true }, updatedAt: { $gt: since } },
        { sort: { updatedAt: -1 } },
      );
      if (!mission) {
        const id = newId('m');
        const fields = {
          titre: `WhatsApp — ${shortTitle(text)}`,
          clientId: client._id,
          statut: 'nouvelle',
          service: guessService(content.media ? content.media.caption || text : text),
          responsable: 'amel',
          source: 'whatsapp',
          canal: 'WhatsApp',
          convId: phone,
          notes: `Message d’origine :\n${text}`,
        };
        await saveDoc(db, 'missions', id, fields, 'whatsapp', {
          action: 'whatsapp',
          resume: `Nouvelle demande WhatsApp : ${client.nom || '+' + phone}${createdClient ? ' (nouveau client)' : ''}`,
        });
        mission = { _id: id, ...fields };
        createdMission = true;
      }
    }

    // 5. Conversation : non lus +1, fenêtre de 24 h, langue.
    const set = {
      phone,
      nom: (client && client.nom) || (team ? `Équipe — ${team}` : '') || profileName || (prev && prev.nom) || '+' + phone,
      lang,
      lastAt: at,
      lastText: text.slice(0, 200),
      lastDir: 'in',
      lastInAt: at,
      lastInId: String(msg.id),
      windowUntil: new Date(Math.min(tsMs, now()) + WINDOW_MS).toISOString(),
      updatedAt: stamp,
      updatedBy: 'whatsapp',
    };
    if (profileName) set.profil = profileName;
    if (client) set.clientId = client._id;
    if (mission) set.missionId = mission._id;
    if (team) set.equipe = team;
    await convCol.updateOne(
      { _id: phone },
      { $set: set, $inc: { unread: 1 }, $setOnInsert: { createdAt: stamp, lastOutAt: '' } },
      { upsert: true },
    );
    if (!prev && !createdMission && !team) {
      await logActivity(db, { user: 'whatsapp', col: 'conversations', docId: phone, action: 'whatsapp', resume: `Nouvelle conversation WhatsApp : ${set.nom}` });
    }
    return { prev, team, lang, client, mission, createdMission };
  });
  const { prev, team, lang, client, mission, createdMission } = locked;
  await emitConversation(db, phone);
  if (team) return [];

  const ctx = { phone, profileName, lang, text, client, mission, createdMission, prev, at, messageId: String(msg.id), media: content.media || null };
  emit('message_in', { convId: phone, nom: (client && client.nom) || profileName || '+' + phone, text, responsable: (mission && mission.responsable) || 'amel', createdMission, missionId: mission && mission._id, clientId: client && client._id });
  const tasks = [() => autoReply(db, ctx)];
  if (content.media) tasks.push(() => mediaFollowup(db, ctx));
  if (aiConfigured() && text && !content.media && lang !== 'FR') tasks.push(() => translateIn(db, ctx));
  if (aiConfigured() && mission) tasks.push(() => enrich(db, ctx));
  const lastIn = prev && prev.lastInAt ? Date.parse(prev.lastInAt) : 0;
  if (createdMission || !lastIn || now() - lastIn > 6 * 3600 * 1000) tasks.push(() => alertTeam(db, ctx));
  return tasks;
}

// ---------- suites (après la réponse à Meta) ----------

export async function getReglages(db) {
  return effectiveReglages(await db.collection('reglages').findOne({ _id: 'general', _deleted: { $ne: true } }));
}

export async function getTemplates(db) {
  return effectiveTemplates(await db.collection('reglages').findOne({ _id: 'templates', _deleted: { $ne: true } }));
}

async function autoReply(db, ctx) {
  if (!waConfigured()) return { skipped: 'whatsapp_off' };
  const reglages = await getReglages(db);
  if (!reglages.autoReply) return { skipped: 'desactive' };
  const convCol = db.collection('conversations');
  const t = now();
  const cutoff = new Date(t - AUTO_REPLY_GAP_MS).toISOString();
  // Réservation atomique : un seul envoi même si plusieurs messages arrivent ensemble.
  const claimed = await convCol.findOneAndUpdate(
    { _id: ctx.phone, lastOutAt: { $lt: cutoff } },
    { $set: { lastOutAt: new Date(t).toISOString() } },
    { returnDocument: 'before', projection: { lastOutAt: 1 } },
  );
  if (!claimed) {
    const fixed = await convCol.updateOne({ _id: ctx.phone, lastOutAt: { $exists: false } }, { $set: { lastOutAt: '' } });
    if (!fixed.matchedCount) return { skipped: 'deja_repondu' };
    return autoReply(db, ctx);
  }
  const { text, moment } = autoReplyText({ lang: ctx.lang, profileName: ctx.profileName, ms: t, reglages });
  try {
    const id = await graphSend(textPayload(ctx.phone, text), { timeoutMs: 4000 });
    await recordOutgoing(db, { convId: ctx.phone, id, type: 'text', text, by: 'auto' });
    return { sent: id, moment };
  } catch (e) {
    await convCol.updateOne({ _id: ctx.phone }, { $set: { lastOutAt: claimed.lastOutAt || '' } });
    console.error('[amane] réponse automatique impossible', e && e.message);
    return { error: e && e.message };
  }
}

/** Traduction vers le français du message reçu (message.translation). */
export async function translateIn(db, ctx) {
  try {
    const r = await translateCached(db, { text: ctx.text, to: 'FR', from: ctx.lang && ctx.lang !== 'FR' ? ctx.lang : undefined, context: 'message' });
    if (!r.text || r.text === ctx.text) return { skipped: 'identique' };
    const at = nowIso();
    await db.collection('messages').updateOne({ _id: ctx.messageId }, { $set: { translation: r.text, translationLang: 'FR', sourceLang: r.from || ctx.lang, updatedAt: at, updatedBy: 'ia' } });
    const m = await db.collection('messages').findOne({ _id: ctx.messageId });
    if (m) emit('message', { message: toApi(m) });
    return { ok: true, cached: r.cached };
  } catch (e) {
    console.error('[amane] traduction ignorée', e && (e.code || e.message));
    return { error: e && (e.code || e.message) };
  }
}

/** Média entrant : téléchargement depuis Meta, puis transcription + traduction pour un vocal. */
async function mediaFollowup(db, ctx) {
  const out = {};
  if (!waConfigured()) return { skipped: 'whatsapp_off' };
  try {
    out.media = await downloadInboundMedia(db, ctx.messageId);
  } catch (e) {
    console.error('[amane] média non téléchargé', e && e.message);
    out.media = { error: e && e.message };
  }
  const isVoice = ctx.media && (ctx.media.voice || /^audio\//.test(ctx.media.mime || ''));
  if (isVoice && transcribeConfigured()) {
    try {
      const tr = await transcribeMessage(db, ctx.messageId);
      out.transcript = tr.text;
      const lang = tr.lang || ctx.lang;
      if (aiConfigured() && tr.text && lang !== 'FR') {
        const r = await translateCached(db, { text: tr.text, to: 'FR', from: lang, context: 'message' });
        await db.collection('messages').updateOne({ _id: ctx.messageId }, { $set: { translation: r.text, translationLang: 'FR', sourceLang: r.from || lang } });
      }
    } catch (e) {
      console.error('[amane] transcription ignorée', e && (e.code || e.message));
      out.transcript = { error: e && (e.code || e.message) };
    }
  }
  const m = await db.collection('messages').findOne({ _id: ctx.messageId });
  if (m) emit('message', { message: toApi(m) });
  return out;
}

async function enrich(db, ctx) {
  try {
    const recent = await db.collection('messages').find({ convId: ctx.phone, dir: { $in: ['in', 'out'] } }, { sort: { at: -1 }, limit: 8 }).toArray();
    const transcript = recent.reverse().map((m) => ({ dir: m.dir, text: m.transcript || m.text }));
    const x = await extractRequest({ nom: ctx.profileName || (ctx.client && ctx.client.nom), transcript, timeoutMs: 8000 });
    const missions = db.collection('missions');
    const cur = await missions.findOne({ _id: ctx.mission._id });
    if (cur && !cur._deleted) {
      const empty = (k) => cur[k] === undefined || cur[k] === null || cur[k] === '' || cur[k] === 0;
      const fill = {};
      if (x.service && empty('service')) fill.service = x.service;
      if (x.debut && empty('debut')) fill.debut = x.debut;
      if (x.fin && empty('fin')) fill.fin = x.fin;
      if (x.lieu && empty('lieu')) fill.lieu = x.lieu;
      if (x.passagers && empty('passagers')) fill.passagers = x.passagers;
      if (x.budget && empty('budget')) fill.budget = x.budget;
      if (x.urgence && empty('priorite')) fill.priorite = x.urgence;
      if (x.vehicule && empty('vehiculeId')) {
        const v = await matchVehicule(db, x.vehicule);
        if (v) fill.vehiculeId = v;
      }
      if (Object.keys(fill).length) {
        await saveDoc(db, 'missions', cur._id, fill, 'ia', {
          resume: `IA : complété ${[...new Set(Object.keys(fill).map((k) => (k === 'debut' || k === 'fin' ? 'dates' : k)))].join(', ')}`,
        });
      }
    }
    if (ctx.client && x.langue) {
      const c = await db.collection('clients').findOne({ _id: ctx.client._id }, { projection: { langue: 1 } });
      if (c && !c.langue) await saveDoc(db, 'clients', ctx.client._id, { langue: x.langue }, 'ia', { activity: false });
    }
    const at = nowIso();
    await db.collection('conversations').updateOne(
      { _id: ctx.phone },
      { $set: { aiSummary: x.resume, aiDraft: x.brouillon, aiFields: x, aiAt: at, updatedAt: at, updatedBy: 'ia' } },
    );
    await emitConversation(db, ctx.phone);
    return { ok: true };
  } catch (e) {
    console.error('[amane] analyse IA ignorée', e && (e.code || e.message));
    return { error: e && (e.code || e.message) };
  }
}

const GENERIC = new Set(['se', 'vip', 'gtb', 'touring', 'classe', 'class', 'sport']);

async function matchVehicule(db, name) {
  const n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!n) return null;
  const list = await db.collection('vehicules').find({ _deleted: { $ne: true } }, { projection: { nom: 1 } }).toArray();
  for (const v of list) {
    const vid = String(v._id).toLowerCase();
    if (n.includes(vid)) return v._id;
    const tokens = String(v.nom || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !GENERIC.has(t));
    if (tokens.some((t) => n.includes(t))) return v._id;
  }
  return null;
}

async function alertTeam(db, ctx) {
  const nom = (ctx.client && ctx.client.nom) || ctx.profileName || '+' + ctx.phone;
  return sendTeamAlert(db, {
    who: (ctx.mission && ctx.mission.responsable) || 'amel',
    texte: `Amane — ${ctx.createdMission ? 'nouvelle demande' : 'nouveau message'} WhatsApp de ${nom} (+${ctx.phone}) : « ${shortTitle(ctx.text)} »`,
    params: [nom, shortTitle(ctx.text)],
  });
}

/**
 * Alerte au membre de l'équipe (TEAM_ALERT_NUMBERS) : texte si sa fenêtre de 24 h est ouverte,
 * sinon modèle `amane_alerte` (2 paramètres : nom du client, extrait). Jamais d'exception.
 */
export async function sendTeamAlert(db, { who, texte, params }) {
  if (!waConfigured()) return { skipped: 'whatsapp_off' };
  const numbers = teamNumbers();
  const to = numbers[who] || numbers.amel;
  if (!to) return { skipped: 'aucun_numero' };
  try {
    const conv = await db.collection('conversations').findOne({ _id: to }, { projection: { windowUntil: 1 } });
    const open = Boolean(conv && conv.windowUntil && Date.parse(conv.windowUntil) > now());
    const payload = open ? textPayload(to, texte) : templatePayload(to, ALERT_TEMPLATE, 'fr', params.map((p) => String(p).slice(0, 60)));
    const id = await graphSend(payload, { timeoutMs: 4000 });
    return { sent: id, template: !open };
  } catch (e) {
    console.error('[amane] alerte équipe impossible', e && e.message);
    return { error: e && e.message };
  }
}

/** Accusé de lecture côté Meta pour le dernier message reçu de la conversation. Jamais d'exception. */
export async function markReadMeta(db, conv) {
  if (!waConfigured() || !conv || !conv.lastInId || conv.lastReadId === conv.lastInId) return { skipped: true };
  try {
    await graphSend(readPayload(conv.lastInId), { timeoutMs: 4000 });
    await db.collection('conversations').updateOne({ _id: conv._id }, { $set: { lastReadId: conv.lastInId } });
    return { ok: true };
  } catch (e) {
    return { error: e && e.message };
  }
}

/**
 * Envoi d'un message d'équipe à une conversation (texte, média, position, contact, modèle).
 * Lève HttpError-like {status, code, message}. `fallbackTemplate` : hors fenêtre, bascule sur ce modèle {name, lang, params}.
 */
export async function sendToConversation(db, { conv, by, text, media, location, contact, template, replyTo, fallbackTemplate, timeoutMs = 8000, extra }) {
  const fail = (status, code, message) => Object.assign(new Error(message), { status, code, http: true });
  const to = conv._id;
  const open = Boolean(conv.windowUntil && Date.parse(conv.windowUntil) > now());
  let payload; let type; let body; let tpl; let mediaDoc; let locDoc; let contactsDoc;
  if (template || (!open && fallbackTemplate)) {
    const t = template || fallbackTemplate;
    if (!t || typeof t.name !== 'string' || !/^[a-z0-9_]{1,512}$/.test(t.name)) throw fail(400, 'modele_invalide', 'Nom de modèle invalide.');
    const lang = typeof t.lang === 'string' && /^[a-z]{2,3}(_[A-Z]{2})?$/.test(t.lang) ? t.lang : 'fr';
    const params = Array.isArray(t.params) ? t.params.slice(0, 10).map((p) => String(p).slice(0, 1024)) : [];
    payload = templatePayload(to, t.name, lang, params);
    type = 'template';
    tpl = { name: t.name, lang, params };
    body = `[Modèle ${t.name}]${params.length ? ' ' + params.join(' · ') : ''}`;
  } else {
    if (!open) throw fail(409, 'window_closed', 'Plus de 24 h depuis le dernier message du client : utilisez un modèle approuvé.');
    if (media) {
      const kind = ['image', 'document', 'video', 'audio'].includes(media.type) ? media.type : null;
      if (!kind) throw fail(400, 'media_invalide', 'Type de média invalide (image, document, video, audio).');
      const caption = typeof media.caption === 'string' ? media.caption.slice(0, 1024) : '';
      let id = null; let link = null; let mime = ''; let size = 0; let filename = typeof media.filename === 'string' ? media.filename.slice(0, 120) : '';
      if (media.photoId) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(media.photoId))) throw fail(400, 'media_invalide', 'Photo invalide.');
        const p = await db.collection('photos').findOne({ _id: media.photoId });
        const buf = p && toBuffer(p.data);
        if (!buf) throw fail(404, 'introuvable', 'Photo introuvable.');
        mime = p.type; size = buf.length; filename = filename || p.filename || (kind === 'image' ? 'photo.jpg' : 'document');
        try {
          id = await uploadToMeta({ buf, mime, filename });
        } catch (e) {
          throw fail(502, 'whatsapp_erreur', `WhatsApp a refusé le média${e.graph && e.graph.message ? ' : ' + String(e.graph.message).slice(0, 160) : '.'}`);
        }
      } else if (typeof media.url === 'string' && /^https:\/\/[^\s]{1,1000}$/.test(media.url)) {
        link = media.url;
      } else throw fail(400, 'media_invalide', 'Indiquez photoId ou une URL https.');
      payload = mediaPayload(to, kind, { id, link, caption, filename });
      type = kind;
      body = `${MEDIA_LABELS[kind]}${caption ? ' ' + caption : filename ? ' ' + filename : ''}`;
      mediaDoc = { id: id || '', mime, filename: filename || undefined, caption: caption || undefined, photoId: media.photoId || undefined, url: link || undefined, size: size || undefined };
      for (const k of Object.keys(mediaDoc)) if (mediaDoc[k] === undefined) delete mediaDoc[k];
    } else if (location) {
      const lat = Number(location.lat); const lng = Number(location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw fail(400, 'position_invalide', 'Coordonnées invalides.');
      locDoc = { lat, lng, name: typeof location.name === 'string' ? location.name.slice(0, 200) : '', address: typeof location.address === 'string' ? location.address.slice(0, 300) : '' };
      payload = locationPayload(to, locDoc);
      type = 'location';
      body = `[Position] ${[locDoc.name, locDoc.address].filter(Boolean).join(', ') || `${lat}, ${lng}`}`;
    } else if (contact) {
      let c = contact;
      if (contact.partenaireId) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(contact.partenaireId))) throw fail(400, 'contact_invalide', 'Partenaire invalide.');
        const p = await db.collection('partenaires').findOne({ _id: contact.partenaireId, _deleted: { $ne: true } });
        if (!p) throw fail(404, 'introuvable', 'Partenaire introuvable.');
        c = { nom: p.nom, tel: p.tel, email: p.email, org: p.type === 'chauffeur' ? 'Amane' : p.nom };
      }
      if (!c.nom || typeof c.nom !== 'string') throw fail(400, 'contact_invalide', 'Nom du contact requis.');
      contactsDoc = [{ nom: String(c.nom).slice(0, 120), ...(c.tel ? { tel: '+' + normPhone(c.tel) } : {}), ...(c.email ? { email: String(c.email).slice(0, 120) } : {}), ...(c.org ? { org: String(c.org).slice(0, 120) } : {}) }];
      payload = contactPayload(to, { ...c, org: c.org });
      type = 'contacts';
      body = `[Contact partagé] ${contactsDoc[0].nom}`;
    } else {
      body = typeof text === 'string' ? text.trim() : '';
      if (!body) throw fail(400, 'texte_vide', 'Message vide.');
      if (body.length > 4096) throw fail(400, 'texte_trop_long', 'Message trop long (4 096 caractères maximum).');
      payload = textPayload(to, body);
      type = 'text';
    }
    if (replyTo && /^[A-Za-z0-9_.=+/-]{1,200}$/.test(String(replyTo))) payload.context = { message_id: String(replyTo) };
  }
  let id;
  try {
    id = await graphSend(payload, { timeoutMs });
  } catch (e) {
    if (e instanceof GraphError) {
      const code = e.graph && e.graph.code;
      if (code === 131047) throw fail(409, 'window_closed', 'Plus de 24 h depuis le dernier message du client : utilisez un modèle approuvé.');
      throw fail(502, 'whatsapp_erreur', `WhatsApp a refusé l’envoi : ${metaErrorText(code, e.graph && e.graph.message ? String(e.graph.message).slice(0, 160) : 'injoignable')}`);
    }
    throw e;
  }
  const doc = await recordOutgoing(db, { convId: to, id, type, text: body, by, template: tpl, media: mediaDoc, location: locDoc, contacts: contactsDoc, replyTo: replyTo || undefined, extra });
  return { id, type, text: body, doc };
}

/** Lance les suites avec un plafond de temps global. */
export async function runFollowups(tasks, budgetMs = 12000) {
  if (!tasks.length) return [];
  const all = Promise.allSettled(tasks.map((f) => f()));
  let timer;
  const cap = new Promise((resolve) => { timer = setTimeout(() => resolve('delai'), budgetMs); });
  const r = await Promise.race([all, cap]);
  clearTimeout(timer);
  return r;
}

/** Prénom pour les messages client. */
export const clientFirstName = (client, conv) => firstName((client && client.nom) || (conv && conv.profil) || '');
/** Texte traduit d'une clé pour un client (t de @amane/shared). */
export const tClient = (lang, key, vars) => tr(lang, key, vars);
