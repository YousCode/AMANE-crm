// /api/auth/setup | login | logout | me (aussi /api/auth?action=…)
import { Router, wrap, sendJson, HttpError, getDb, requireSession, requireOrigin, query, methodNotAllowed } from './_common.js';
import { readJson, clientIp } from '../lib/http.js';
import {
  TEAM, normUserId, publicUser, hashPin, verifyPin, validPin, safeEqual,
  makeSessionValue, sessionCookie, clearCookie, rateCount, rateHit, rateReset, tooMany,
} from '../lib/auth.js';
import { nowIso } from '../lib/clock.js';

const FAIL_WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 5;

export const router = Router();

const dispatch = wrap(async (req, res) => {
  const action = req.params.action || query(req).action || '';
  switch (action) {
    case 'setup': return setup(req, res);
    case 'login': return login(req, res);
    case 'logout': return logout(req, res);
    case 'me': return me(req, res);
    default: throw new HttpError(404, 'introuvable', 'Route inconnue.');
  }
});
router.all('/api/auth', dispatch);
router.all('/api/auth/:action', dispatch);

async function setup(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const expected = process.env.AMANE_SETUP_CODE || '';
  if (!expected) throw new HttpError(503, 'config', 'Code d’installation non configuré (AMANE_SETUP_CODE).');
  const body = await readJson(req, 4 * 1024);
  const db = await getDb();
  const ipKey = 'setup:ip:' + clientIp(req);
  if (await rateCount(db, ipKey) >= MAX_FAILS) throw tooMany();
  if (!safeEqual(String(body.code ?? ''), expected)) {
    await rateHit(db, ipKey, FAIL_WINDOW);
    throw new HttpError(401, 'bad_code', 'Code d’installation incorrect.');
  }
  const userId = normUserId(body.userId);
  if (!TEAM[userId]) throw new HttpError(400, 'utilisateur_inconnu', 'Prénom inconnu (amel, youssouf ou aziz).');
  const pin = String(body.pin ?? '');
  if (!validPin(pin)) throw new HttpError(400, 'pin_invalide', 'Le code PIN doit comporter de 4 à 8 chiffres.');
  const pinHash = await hashPin(pin);
  const at = nowIso();
  await db.collection('users').updateOne(
    { _id: userId },
    { $set: { pinHash, nom: TEAM[userId].nom, role: TEAM[userId].role, pinAt: at, updatedAt: at }, $inc: { sv: 1 }, $setOnInsert: { createdAt: at } },
    { upsert: true },
  );
  await rateReset(db, 'login:u:' + userId);
  sendJson(res, 200, { ok: true });
}

async function login(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const body = await readJson(req, 4 * 1024);
  const db = await getDb();
  const userId = normUserId(body.userId);
  const pin = String(body.pin ?? '');
  const ipKey = 'login:ip:' + clientIp(req);
  const userKey = 'login:u:' + (TEAM[userId] ? userId : 'inconnu');
  const [ipFails, userFails] = await Promise.all([rateCount(db, ipKey), rateCount(db, userKey)]);
  if (ipFails >= MAX_FAILS || userFails >= MAX_FAILS) throw tooMany();
  const fail = async () => {
    await Promise.all([rateHit(db, ipKey, FAIL_WINDOW), rateHit(db, userKey, FAIL_WINDOW)]);
    throw new HttpError(401, 'bad_pin', 'Prénom ou code PIN incorrect.');
  };
  if (!TEAM[userId] || !validPin(pin)) return fail();
  const user = await db.collection('users').findOne({ _id: userId });
  if (!user || !user.pinHash) throw new HttpError(409, 'no_pin', 'Aucun code PIN n’a encore été créé pour ce prénom.');
  if (!(await verifyPin(pin, user.pinHash))) return fail();
  await rateReset(db, userKey);
  sendJson(res, 200, { user: publicUser(userId) }, { 'Set-Cookie': sessionCookie(req, makeSessionValue(userId, user.sv || 0)) });
}

async function logout(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const db = await getDb();
  await requireSession(req, db);
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(req) });
}

async function me(req, res) {
  if (req.method !== 'GET') throw methodNotAllowed(['GET']);
  const db = await getDb();
  const user = await requireSession(req, db);
  sendJson(res, 200, { user });
}
