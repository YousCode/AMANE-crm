// Routes de simulation (FAKE_DB=1 seulement) :
//   POST /__dev/inbound {from, name, text, id?, type?, mime?, filename?, caption?, lat, lng, locName, address, contact:{nom,tel}, emoji, reactionTo, replyTo}
//   POST /__dev/status  {id, status, code?}     statut Meta (sent, delivered, read, failed)
//   GET  /__dev/outbox                           tout ce qui est parti vers Meta / IA / Whisper / Expo
//   DELETE /__dev/outbox                         vide la boîte
//   POST /__dev/clock   {now: ISO | null}        fige l'horloge du serveur
//   POST /__dev/run     {job:'rappels'|'alertes'|'digest'}  lance une tâche de fond
//   GET  /__dev/state   {pending, ws}            tâches de fond en attente, connexions WS
import { createHmac, randomBytes } from 'node:crypto';
import { Router, wrap, sendJson, HttpError, getDb } from './_common.js';
import { readJson } from '../lib/http.js';
import * as clock from '../lib/clock.js';
import { drain, pendingCount } from '../lib/background.js';
import { runRappels } from '../lib/rappels.js';
import { runAlerts } from '../lib/alerts.js';
import { sendDigest } from '../lib/digest.js';

export function devRouter({ outbox, getPort, ws }) {
  const router = Router();
  const env = process.env;

  router.get('/__dev/outbox', (req, res) => sendJson(res, 200, { items: outbox }));
  router.delete('/__dev/outbox', (req, res) => { outbox.length = 0; sendJson(res, 200, { ok: true }); });
  router.get('/__dev/state', wrap(async (req, res) => sendJson(res, 200, { pending: pendingCount(), ws: ws ? ws.size : 0, now: clock.nowIso(), fakeAi: env.__AMANE_FAKE_AI === '1', fakeWhisper: env.__AMANE_FAKE_WHISPER === '1' })));
  router.post('/__dev/drain', wrap(async (req, res) => { await drain(); sendJson(res, 200, { ok: true }); }));
  router.post('/__dev/clock', wrap(async (req, res) => {
    const b = await readJson(req, 2048);
    const t = b.now ? Date.parse(b.now) : NaN;
    clock.setClock(Number.isNaN(t) ? null : () => t);
    sendJson(res, 200, { ok: true, now: clock.nowIso() });
  }));
  router.post('/__dev/run', wrap(async (req, res) => {
    const b = await readJson(req, 2048);
    const db = await getDb();
    const jobs = { rappels: () => runRappels(db), alertes: () => runAlerts(db), digest: () => sendDigest(db) };
    if (!jobs[b.job]) throw new HttpError(400, 'job_inconnu', 'job : rappels, alertes ou digest.');
    sendJson(res, 200, await jobs[b.job]());
  }));

  const post = async (res, payloadObj) => {
    const payload = JSON.stringify(payloadObj);
    const sig = 'sha256=' + createHmac('sha256', env.WHATSAPP_APP_SECRET || '').update(payload).digest('hex');
    const r = await fetch(`http://127.0.0.1:${getPort()}/api/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, body: payload });
    const j = await r.json().catch(() => ({}));
    await drain();
    sendJson(res, r.status, j);
  };
  const value = () => ({ messaging_product: 'whatsapp', metadata: { display_phone_number: '33100000000', phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID } });
  const wrapPayload = (v) => ({ object: 'whatsapp_business_account', entry: [{ id: '0', changes: [{ value: v, field: 'messages' }] }] });

  router.post('/__dev/inbound', wrap(async (req, res) => {
    const b = await readJson(req, 64 * 1024);
    const from = String(b.from || '33612345678').replace(/\D/g, '');
    const v = value();
    v.contacts = [{ profile: { name: b.name || '' }, wa_id: from }];
    const type = b.type || 'text';
    const m = { from, id: b.id || 'wamid.DEV' + randomBytes(10).toString('hex'), timestamp: String(Math.floor(clock.now() / 1000)), type };
    if (b.replyTo) m.context = { id: String(b.replyTo) };
    switch (type) {
      case 'text': m.text = { body: String(b.text || '') }; break;
      case 'image': case 'video': case 'document': case 'sticker':
        m[type] = { id: b.mediaId || `media.dev.${type}.${randomBytes(4).toString('hex')}`, mime_type: b.mime || (type === 'image' ? 'image/png' : type === 'video' ? 'video/mp4' : type === 'document' ? 'application/pdf' : 'image/webp'), ...(b.caption ? { caption: String(b.caption) } : {}), ...(b.filename ? { filename: String(b.filename) } : {}) }; break;
      case 'audio':
        m.audio = { id: b.mediaId || `media.dev.audio.${randomBytes(4).toString('hex')}`, mime_type: b.mime || 'audio/ogg; codecs=opus', voice: b.voice !== false }; break;
      case 'location':
        m.location = { latitude: Number(b.lat ?? 48.8566), longitude: Number(b.lng ?? 2.3522), ...(b.locName ? { name: String(b.locName) } : {}), ...(b.address ? { address: String(b.address) } : {}) }; break;
      case 'contacts': {
        const c = b.contact || { nom: 'Karim Benali', tel: '+33600000099' };
        m.contacts = [{ name: { formatted_name: c.nom, first_name: String(c.nom).split(' ')[0] }, phones: [{ phone: c.tel, type: 'MOBILE', wa_id: String(c.tel).replace(/\D/g, '') }] }]; break;
      }
      case 'reaction': m.reaction = { message_id: String(b.reactionTo || ''), emoji: String(b.emoji ?? '👍') }; break;
      default: throw new HttpError(400, 'type_invalide', 'type : text, image, video, document, audio, sticker, location, contacts, reaction.');
    }
    v.messages = [m];
    await post(res, wrapPayload(v));
  }));

  router.post('/__dev/status', wrap(async (req, res) => {
    const b = await readJson(req, 4096);
    const v = value();
    const st = { id: String(b.id || ''), status: b.status || 'delivered', timestamp: String(Math.floor(clock.now() / 1000)), recipient_id: String(b.to || '') };
    if (st.status === 'failed') st.errors = [{ code: Number(b.code) || 131026, title: b.title || 'Message undeliverable' }];
    v.statuses = [st];
    await post(res, wrapPayload(v));
  }));

  return router;
}
