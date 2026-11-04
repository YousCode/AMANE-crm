// Notifications push Expo : jetons enregistrés par POST /api/push/register, envoi par lots à exp.host.
import { nowIso } from './clock.js';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,}\]$/;

export async function registerToken(db, { token, platform, userId }) {
  const at = nowIso();
  await db.collection('push_tokens').updateOne(
    { _id: token },
    { $set: { userId, platform: platform || '', at, updatedAt: at }, $setOnInsert: { createdAt: at } },
    { upsert: true },
  );
}

export async function unregisterToken(db, token) {
  await db.collection('push_tokens').deleteOne({ _id: token });
}

/**
 * Envoie une notification aux jetons de `userIds` (tous les membres si vide). Jamais d'exception.
 * data : {type, convId?, missionId?, …} pour ouvrir le bon écran.
 */
export async function sendPush(db, { userIds, title, body, data = {} }) {
  try {
    const filter = Array.isArray(userIds) && userIds.length ? { userId: { $in: userIds } } : {};
    const tokens = await db.collection('push_tokens').find(filter).toArray();
    if (!tokens.length) return { sent: 0 };
    const messages = tokens.map((t) => ({ to: t._id, sound: 'default', title: String(title).slice(0, 100), body: String(body).slice(0, 400), data, priority: 'high', channelId: 'amane' }));
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const r = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(8000),
      });
      const j = await r.json().catch(() => ({}));
      const tickets = Array.isArray(j.data) ? j.data : [];
      tickets.forEach((tk, k) => {
        if (tk && tk.status === 'ok') sent++;
        else if (tk && tk.details && tk.details.error === 'DeviceNotRegistered') db.collection('push_tokens').deleteOne({ _id: batch[k].to }).catch(() => {});
      });
    }
    return { sent };
  } catch (e) {
    console.error('[amane] push', e && e.message);
    return { sent: 0, error: e && e.message };
  }
}
