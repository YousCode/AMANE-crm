// Équipe, codes PIN (scrypt), cookie de session signé, limites de débit.
import { scrypt as scryptCb, randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, parseCookies } from './http.js';
import { now } from './clock.js';

const scrypt = promisify(scryptCb);

export const TEAM = {
  amel: { id: 'amel', nom: 'Amel', role: 'Relation client' },
  youssouf: { id: 'youssouf', nom: 'Youssouf', role: 'Tech & flotte' },
  aziz: { id: 'aziz', nom: 'Aziz', role: 'Contrats & conformité' },
};

export const COOKIE = 'amane_s';
export const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** « Amel », « amel », « AMEL » → « amel ». */
export function normUserId(v) {
  return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function publicUser(id) {
  const u = TEAM[id];
  return u ? { id: u.id, nom: u.nom, role: u.role } : null;
}

// ---------- comparaisons à temps constant ----------

export function safeEqual(a, b) {
  const ba = Buffer.isBuffer(a) ? a : Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? ''), 'utf8');
  // On compare des empreintes de même longueur : pas de fuite sur la longueur.
  const ha = createHash('sha256').update(ba).digest();
  const hb = createHash('sha256').update(bb).digest();
  return timingSafeEqual(ha, hb) && ba.length === bb.length;
}

// ---------- PIN ----------

export async function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = await scrypt(String(pin), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPin(pin, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const got = await scrypt(String(pin), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function validPin(pin) {
  return typeof pin === 'string' && /^\d{4,8}$/.test(pin);
}

// ---------- session ----------

function authSecret() {
  const s = process.env.AUTH_SECRET || '';
  if (s.length < 32) throw new HttpError(503, 'config', 'Serveur mal configuré : AUTH_SECRET manquant ou trop court (32 caractères minimum).');
  return s;
}

function sign(payload) {
  return createHmac('sha256', authSecret()).update(payload).digest('base64url');
}

/** Le numéro de version du PIN (`sv`) est inclus dans la signature : changer le PIN déconnecte. */
export function makeSessionValue(userId, sv = 0, days = SESSION_DAYS) {
  const exp = Math.floor(now() / 1000) + days * 86400;
  return `${userId}.${exp}.${sign(`${userId}.${exp}.${sv}`)}`;
}

function cookieAttrs(req, maxAge) {
  const insecure = process.env.AMANE_DEV === '1' && !isHttps(req);
  return `Path=/; HttpOnly;${insecure ? '' : ' Secure;'} SameSite=Lax; Max-Age=${maxAge}`;
}

function isHttps(req) {
  const p = req.headers && req.headers['x-forwarded-proto'];
  return p ? String(p).split(',')[0].trim() === 'https' : Boolean(req.socket && req.socket.encrypted);
}

export function sessionCookie(req, value) {
  return `${COOKIE}=${value}; ${cookieAttrs(req, SESSION_DAYS * 86400)}`;
}

export function clearCookie(req) {
  return `${COOKIE}=; ${cookieAttrs(req, 0)}`;
}

/** Utilisateur de la session, ou null. */
export async function getSession(req, db) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw || raw.length > 300) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (!TEAM[userId] || !/^\d{1,12}$/.test(expStr)) return null;
  if (Number(expStr) * 1000 < now()) return null;
  const user = await db.collection('users').findOne({ _id: userId }, { projection: { sv: 1 } });
  if (!user) return null;
  const expected = sign(`${userId}.${expStr}.${user.sv || 0}`);
  if (!safeEqual(sig, expected)) return null;
  return publicUser(userId);
}

export async function requireSession(req, db) {
  const u = await getSession(req, db);
  if (!u) throw new HttpError(401, 'non_connecte', 'Connexion requise.');
  return u;
}

// ---------- limites de débit (collection `ratelimits`, index TTL sur expireAt) ----------

/** Nombre de coups dans la fenêtre courante (sans incrémenter). */
export async function rateCount(db, key) {
  const d = await db.collection('ratelimits').findOne({ _id: key });
  if (!d || !(d.resetAt instanceof Date) || d.resetAt.getTime() <= now()) return 0;
  return d.count || 0;
}

/** Ajoute un coup ; renvoie le total dans la fenêtre. */
export async function rateHit(db, key, windowMs) {
  const col = db.collection('ratelimits');
  const t = now();
  const d = await col.findOneAndUpdate(
    { _id: key, resetAt: { $gt: new Date(t) } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' },
  );
  if (d) return d.count;
  try {
    await col.updateOne(
      { _id: key },
      { $set: { count: 1, resetAt: new Date(t + windowMs), expireAt: new Date(t + windowMs) } },
      { upsert: true },
    );
  } catch (e) {
    if (!(e && e.code === 11000)) throw e;
    return rateHit(db, key, windowMs);
  }
  return 1;
}

export async function rateReset(db, key) {
  await db.collection('ratelimits').deleteOne({ _id: key });
}

export function tooMany(message = 'Trop de tentatives. Réessayez dans quelques minutes.') {
  return new HttpError(429, 'trop_de_tentatives', message);
}
