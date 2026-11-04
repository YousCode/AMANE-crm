// POST /api/push/register {token, platform} ; POST /api/push/unregister {token}
import { Router, wrap, sendJson, HttpError, auth, requireOrigin } from './_common.js';
import { readJson } from '../lib/http.js';
import { registerToken, unregisterToken, EXPO_TOKEN_RE } from '../lib/push.js';

export const router = Router();

router.post('/api/push/register', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  const body = await readJson(req, 4 * 1024);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!EXPO_TOKEN_RE.test(token)) throw new HttpError(400, 'token_invalide', 'Jeton Expo invalide (ExponentPushToken[…]).');
  const platform = ['ios', 'android', 'web'].includes(body.platform) ? body.platform : '';
  await registerToken(db, { token, platform, userId: user.id });
  sendJson(res, 200, { ok: true });
}));

router.post('/api/push/unregister', wrap(async (req, res) => {
  requireOrigin(req);
  const { db } = await auth(req);
  const body = await readJson(req, 4 * 1024);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!EXPO_TOKEN_RE.test(token)) throw new HttpError(400, 'token_invalide', 'Jeton Expo invalide.');
  await unregisterToken(db, token);
  sendJson(res, 200, { ok: true });
}));
