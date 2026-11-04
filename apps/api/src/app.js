// Application Express d'Amane : API JSON, WebSocket /ws, pages publiques, fichiers statiques (back-office /app, CRM /crm, site /).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { cors } from './lib/origin.js';
import { getDb, setDb } from './lib/db.js';
import { attachWs } from './lib/ws.js';
import { installNotifications } from './lib/notify.js';
import { installFakeFetch } from './lib/fake.js';
import { errorHandler } from './routes/_common.js';
import { sendError } from './lib/http.js';
import { drain } from './lib/background.js';
import { router as health } from './routes/health.js';
import { router as auth } from './routes/auth.js';
import { router as sync } from './routes/sync.js';
import { router as doc } from './routes/doc.js';
import { router as photo } from './routes/photo.js';
import { router as ai } from './routes/ai.js';
import { router as whatsapp } from './routes/whatsapp.js';
import { router as lead } from './routes/lead.js';
import { router as relances } from './routes/relances.js';
import { router as devis } from './routes/devis.js';
import { router as espace } from './routes/espace.js';
import { router as flotte } from './routes/flotte.js';
import { router as push } from './routes/push.js';
import { devRouter } from './routes/dev.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

let notificationsInstalled = false;

/**
 * createApp({ fake, devPins, webDist, siteDir, crmFile }) → { app, server, ws, outbox, fakeDb, port(), close() }
 * fake : base en mémoire + PIN de démo + WhatsApp/IA/Whisper/Expo simulés + routes /__dev/*.
 */
export async function createApp(opts = {}) {
  const env = process.env;
  const fake = opts.fake ?? env.FAKE_DB === '1';
  const outbox = [];
  let fakeDb = null;
  if (fake) {
    env.FAKE_DB = '1';
    env.AMANE_DEV = env.AMANE_DEV || '1';
    if (!env.AUTH_SECRET) env.AUTH_SECRET = 'dev-' + randomBytes(24).toString('hex');
    if (!env.AMANE_SETUP_CODE) env.AMANE_SETUP_CODE = 'dev';
    const { FakeDb } = await import('./lib/fakedb.js');
    fakeDb = new FakeDb();
    setDb(fakeDb);
    const pins = opts.devPins ?? env.DEV_PINS ?? 'amel:1234,youssouf:1234,aziz:1234';
    if (pins && pins !== 'none') {
      const { hashPin, TEAM } = await import('./lib/auth.js');
      for (const part of pins.split(',')) {
        const [u, p] = part.split(':').map((s) => (s || '').trim());
        if (TEAM[u] && /^\d{4,8}$/.test(p)) {
          await fakeDb.collection('users').updateOne({ _id: u }, { $set: { pinHash: await hashPin(p), nom: TEAM[u].nom, role: TEAM[u].role, sv: 1 } }, { upsert: true });
        }
      }
    }
    if (!env.WHATSAPP_TOKEN) {
      Object.assign(env, { WHATSAPP_TOKEN: 'dev', WHATSAPP_PHONE_NUMBER_ID: '100000000000001', WHATSAPP_VERIFY_TOKEN: 'dev', WHATSAPP_APP_SECRET: 'dev-app-secret' });
      env.__AMANE_FAKE_WA = '1';
    }
    if (env.FAKE_AI === '1') {
      if (!env.ANTHROPIC_API_KEY) { env.ANTHROPIC_API_KEY = 'dev'; env.__AMANE_FAKE_AI = '1'; }
      if (!env.WHISPER_API_KEY) { env.WHISPER_API_KEY = 'dev'; env.__AMANE_FAKE_WHISPER = '1'; }
    }
    env.__AMANE_FAKE_PUSH = '1';
    installFakeFetch(outbox);
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.set('etag', false);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (!req.headers['x-forwarded-proto'] && !req.socket.encrypted) req.headers['x-forwarded-proto'] = 'http';
    next();
  });
  app.use(cors());

  // API
  for (const r of [health, auth, sync, doc, photo, ai, whatsapp, lead, relances, devis, espace, flotte, push]) app.use(r);

  const server = http.createServer(app);
  const ws = attachWs(server, { path: '/ws', getDb });
  if (!notificationsInstalled) { installNotifications(getDb); notificationsInstalled = true; }
  const port = () => { const a = server.address(); return a && typeof a === 'object' ? a.port : 0; };
  if (fake) app.use(devRouter({ outbox, getPort: port, ws }));

  app.all('/api/{*rest}', (req, res) => sendError(res, 404, 'introuvable', 'Route inconnue.'));
  app.all('/api', (req, res) => sendError(res, 404, 'introuvable', 'Route inconnue.'));
  app.all('/__dev/{*rest}', (req, res) => sendError(res, 404, 'introuvable', 'Route inconnue.'));

  // Back-office React (apps/web/dist) sous /app, avec repli SPA.
  const webDist = opts.webDist ?? path.join(ROOT, 'apps/web/dist');
  if (isDir(webDist) && exists(path.join(webDist, 'index.html'))) {
    app.use('/app', (req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); }, express.static(webDist, { index: 'index.html', maxAge: '1h', extensions: ['html'] }));
    app.get(['/app', '/app/{*rest}'], (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(path.join(webDist, 'index.html')); });
  } else {
    app.get(['/app', '/app/{*rest}'], (req, res) => { res.status(404).type('text/plain; charset=utf-8').send('Back-office non construit : npm run build dans apps/web.'); });
  }

  // CRM historique : crm/index.html (source, mode serveur) enveloppé comme site/make_vercel.py ; sinon site/crm/index.html tel quel.
  const crmSrc = opts.crmFile === null ? null : opts.crmFile ?? [path.join(ROOT, 'crm/index.html'), path.join(ROOT, 'site/crm/index.html')].find(exists);
  if (crmSrc) {
    let cache = { mtime: 0, html: '' };
    const crmHtml = () => {
      const st = fs.statSync(crmSrc);
      if (cache.mtime !== st.mtimeMs) {
        const src = fs.readFileSync(crmSrc, 'utf8');
        if (/<!doctype html>/i.test(src.slice(0, 200))) cache = { mtime: st.mtimeMs, html: src };
        else {
          const j = src.indexOf('</style>') + '</style>'.length;
          cache = { mtime: st.mtimeMs, html: '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="robots" content="noindex,nofollow">\n<meta name="theme-color" content="#FAF8F4">\n<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n' + src.slice(0, j) + '\n</head>\n<body>\n' + src.slice(j) + '\n</body>\n</html>\n' };
        }
      }
      return cache.html;
    };
    const serveCrm = (req, res) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'no-store'); res.type('text/html; charset=utf-8').send(crmHtml()); };
    app.get(['/crm', '/crm/', '/crm/index.html'], serveCrm);
  }

  // Site vitrine (site/) : « / » → vercel.html (sinon index.html), fichiers statiques.
  const siteDir = opts.siteDir ?? path.join(ROOT, 'site');
  if (isDir(siteDir)) {
    const home = ['vercel.html', 'index.html'].map((f) => path.join(siteDir, f)).find(exists);
    if (home) app.get('/', (req, res) => res.sendFile(home));
    app.use(express.static(siteDir, { index: false, maxAge: '1h', dotfiles: 'ignore', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-store'); } }));
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/__dev/')) return sendError(res, 404, 'introuvable', 'Route inconnue.');
    res.status(404).type('text/plain; charset=utf-8').send('404 — introuvable');
  });
  app.use(errorHandler);

  return {
    app, server, ws, outbox, fakeDb, port,
    listen: (p = Number(env.PORT || 3000), host = env.HOST || '0.0.0.0') => new Promise((resolve, reject) => { server.once('error', reject); server.listen(p, host, () => resolve(port())); }),
    close: async () => { await drain(); ws.close(); await new Promise((r) => server.close(r)); },
  };
}
