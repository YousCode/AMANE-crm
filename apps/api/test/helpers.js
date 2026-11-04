// Outils de test : application Express réelle sur un port local, base en mémoire, fetch remplacé.
// `call(handler, opts)` garde la signature des tests historiques (le premier argument est ignoré : tout passe par HTTP).
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { FakeDb } from '../src/lib/fakedb.js';
import { setDb } from '../src/lib/db.js';
import { setClock } from '../src/lib/clock.js';
import { drain } from '../src/lib/background.js';
import { createApp } from '../src/app.js';

export const api = await createApp({ fake: false, webDist: '/nonexistent', siteDir: '/nonexistent', crmFile: null });
export const PORT = await api.listen(0, '127.0.0.1');
api.server.unref();
export const BASE = `http://127.0.0.1:${PORT}`;

export const H = { auth: 'auth', sync: 'sync', doc: 'doc', photo: 'photo', ai: 'ai', whatsapp: 'whatsapp', lead: 'lead', health: 'health' };

export const APP_SECRET = 'test-app-secret';
export const BASE_ENV = {
  AUTH_SECRET: 'x'.repeat(40),
  AMANE_SETUP_CODE: 'code-secret-42',
  WHATSAPP_TOKEN: 'EAAtest',
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_VERIFY_TOKEN: 'verif-amane',
  WHATSAPP_APP_SECRET: APP_SECRET,
};
const ENV_KEYS = [...Object.keys(BASE_ENV), 'ANTHROPIC_API_KEY', 'TEAM_ALERT_NUMBERS', 'MONGODB_URI', 'MONGODB_DB', 'AMANE_DEV', 'WHISPER_API_KEY', 'PUBLIC_URL', 'CORS_ORIGINS', 'INTERNAL_KEY', 'WHATSAPP_PUBLIC_NUMBER', 'FAKE_DB', 'EXPO_ACCESS_TOKEN'];

/** Nouvelle base, nouvel environnement, horloge réelle, fetch par défaut (Meta OK). */
export function fresh(env = {}) {
  const db = new FakeDb();
  setDb(db);
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, BASE_ENV, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  setClock(null);
  const net = stubFetch();
  return { db, net };
}

export function at(iso) {
  const t = Date.parse(iso);
  setClock(() => t);
  return t;
}

/**
 * call(_, {method, url, body, raw, headers, cookie, ip}) → {status, headers, body (Buffer), text, json}
 * Attend ensuite la fin des tâches de fond (réponse automatique, IA, alertes…).
 */
export async function call(_handler, { method = 'GET', url = '/', body, raw, headers = {}, cookie, ip = '203.0.113.7', noDrain = false } = {}) {
  const buf = raw !== undefined ? Buffer.from(raw) : body !== undefined ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
  const h = { host: 'amane.test', 'x-forwarded-proto': 'https', 'x-forwarded-for': ip, ...lower(headers) };
  if (buf.length && !h['content-type']) h['content-type'] = 'application/json';
  if (cookie) h.cookie = cookie;
  h['content-length'] = String(buf.length);
  const r = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: url, headers: h, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: flatten(res.headers), body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (buf.length) req.write(buf);
    req.end();
  });
  if (!noDrain) await drain();
  let json = null;
  try { json = JSON.parse(r.body.toString('utf8')); } catch { json = null; }
  return { status: r.status, headers: r.headers, body: r.body, text: r.body.toString('utf8'), json };
}

function flatten(h) {
  const o = {};
  for (const [k, v] of Object.entries(h)) o[k] = Array.isArray(v) ? (k === 'set-cookie' ? v[0] : v.join(', ')) : v;
  return o;
}
function lower(h) {
  const o = {};
  for (const [k, v] of Object.entries(h)) o[k.toLowerCase()] = v;
  return o;
}

/** Crée le PIN d'un membre de l'équipe et renvoie son cookie de session. */
export async function login(userId = 'amel', pin = '1234') {
  const s = await call(H.auth, { method: 'POST', url: '/api/auth/setup', body: { code: BASE_ENV.AMANE_SETUP_CODE, userId, pin } });
  if (s.status !== 200) throw new Error('setup ' + s.status + ' ' + s.text);
  const r = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId, pin } });
  if (r.status !== 200) throw new Error('login ' + r.status + ' ' + r.text);
  return cookieOf(r);
}

export function cookieOf(r) {
  return String(r.headers['set-cookie']).split(';')[0];
}

// ---------- fetch remplacé ----------

export function stubFetch() {
  let n = 0;
  const net = {
    calls: [],
    graphFn: (c) => {
      if (/\/media$/.test(c.url)) return { status: 200, json: { id: `media.UP${++n}` } };
      if (c.method === 'GET' || !c.method) return { status: 200, json: { url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=' + c.url.split('/').pop(), mime_type: /voc|audio/i.test(c.url) ? 'audio/ogg' : 'image/jpeg', sha256: 'abc', file_size: 1000 } };
      return { status: 200, json: { messaging_product: 'whatsapp', messages: [{ id: `wamid.OUT${++n}` }] } };
    },
    lookasideFn: (c) => ({ status: 200, bytes: /voc|audio/i.test(c.url) ? Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100, 1)]) : jpeg(1000), type: /voc|audio/i.test(c.url) ? 'audio/ogg' : 'image/jpeg' }),
    anthropicFn: () => { throw new Error('anthropic non prévu dans ce test'); },
    openaiFn: () => ({ status: 200, json: { text: 'Bonjour, une voiture pour samedi.', language: 'french' } }),
    expoFn: (c) => ({ status: 200, json: { data: (Array.isArray(c.body) ? c.body : []).map(() => ({ status: 'ok', id: 'tk' })) } }),
    graph(fn) { this.graphFn = fn; },
    anthropic(fn) { this.anthropicFn = fn; },
    openai(fn) { this.openaiFn = fn; },
    expo(fn) { this.expoFn = fn; },
    get graphCalls() { return this.calls.filter((c) => c.url.startsWith('https://graph.facebook.com/') && /\/messages$/.test(c.url)); },
    get graphAll() { return this.calls.filter((c) => c.url.startsWith('https://graph.facebook.com/')); },
    get anthropicCalls() { return this.calls.filter((c) => c.url.startsWith('https://api.anthropic.com/')); },
    get openaiCalls() { return this.calls.filter((c) => c.url.startsWith('https://api.openai.com/')); },
    get expoCalls() { return this.calls.filter((c) => c.url.startsWith('https://exp.host/')); },
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    let body = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(init.body); } catch { /* brut */ } }
    const call = { url, method: init.method, headers: init.headers || {}, body };
    net.calls.push(call);
    let fn;
    if (url.startsWith('https://graph.facebook.com/')) fn = net.graphFn;
    else if (url.startsWith('https://lookaside.fbsbx.com/')) fn = net.lookasideFn;
    else if (url.startsWith('https://api.anthropic.com/')) fn = net.anthropicFn;
    else if (url.startsWith('https://api.openai.com/')) fn = net.openaiFn;
    else if (url.startsWith('https://exp.host/')) fn = net.expoFn;
    else if (url.startsWith(BASE)) return realFetch(input, init);
    else throw new Error('réseau interdit en test : ' + url);
    const r = await fn(call, init);
    if (r.bytes) return new Response(r.bytes, { status: r.status, headers: { 'content-type': r.type || 'application/octet-stream' } });
    return new Response(typeof r.json === 'string' ? r.json : JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  return net;
}
const realFetch = globalThis.fetch;

/** Réponse Messages API avec un bloc texte. */
export function claudeResponse(text, extra = {}) {
  return {
    status: 200,
    json: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, ...extra },
  };
}

// ---------- webhooks Meta ----------

export function sign(raw, secret = APP_SECRET) {
  return 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
}

/** Corps réel d'un webhook « messages » de la WhatsApp Cloud API. */
export function inboundPayload({ from = '33612345678', name = 'Jean Dupont', id = 'wamid.HBgLMzM2MTIzNDU2NzgVAgASGBQzQTRGQjE1RkI4RjA5NjU4M0E1MAA=', text = 'Bonjour', ts, type = 'text', extra } = {}) {
  const timestamp = String(Math.floor((ts ?? Date.now()) / 1000));
  const message = { from, id, timestamp, type };
  if (type === 'text') message.text = { body: text };
  if (extra) Object.assign(message, extra);
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '102290129340398',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '33187654321', phone_number_id: BASE_ENV.WHATSAPP_PHONE_NUMBER_ID },
          contacts: [{ profile: { name }, wa_id: from }],
          messages: [message],
        },
        field: 'messages',
      }],
    }],
  };
}

export function statusPayload({ id, status, recipient = '33612345678', ts, errors }) {
  const st = {
    id, status, timestamp: String(Math.floor((ts ?? Date.now()) / 1000)), recipient_id: recipient,
    conversation: { id: 'CONVERSATION_ID', origin: { type: 'service' } },
    pricing: { billable: true, pricing_model: 'CBP', category: 'service' },
  };
  if (errors) st.errors = errors;
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '102290129340398', changes: [{ value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '33187654321', phone_number_id: BASE_ENV.WHATSAPP_PHONE_NUMBER_ID }, statuses: [st] }, field: 'messages' }] }],
  };
}

/** POST signé vers /api/whatsapp. Meta échappe les caractères non ASCII : on fait pareil. */
export async function postWebhook(payload, { secret = APP_SECRET, signature } = {}) {
  const raw = JSON.stringify(payload).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return call(H.whatsapp, {
    method: 'POST', url: '/api/whatsapp', raw,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature ?? sign(raw, secret), 'user-agent': 'facebookexternalua' },
  });
}

/** Petite image JPEG valide (en-tête) de la taille voulue. */
export function jpeg(size = 1000) {
  const b = Buffer.alloc(size, 0x11);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0;
  b[size - 2] = 0xff; b[size - 1] = 0xd9;
  return b;
}
