// Flotte et services de départ (valeurs de @amane/shared, identiques à crm/tests/mock.js), posés une seule fois.
import { VEHICULES_DEFAUT, SERVICES_DEFAUT, WA_TEMPLATES } from '@amane/shared';
import { DEFAULT_TEMPLATE_BODIES } from './templates.js';

export const DEFAULT_VEHICULES = VEHICULES_DEFAUT;
export const DEFAULT_SERVICES = SERVICES_DEFAUT;

/** Idempotent : upsert avec $setOnInsert, rien n'est écrasé. */
export async function seedIfEmpty(db, nowIso) {
  const [nv, ns] = await Promise.all([
    db.collection('vehicules').countDocuments({}),
    db.collection('services').countDocuments({}),
  ]);
  if (nv || ns) return false;
  const put = (col, entries) => Promise.all(Object.entries(entries).map(([id, d]) =>
    db.collection(col).updateOne(
      { _id: id },
      { $setOnInsert: { ...d, createdAt: nowIso, updatedAt: nowIso, updatedBy: 'systeme' } },
      { upsert: true },
    ).catch((e) => { if (e && e.code !== 11000) throw e; })));
  await put('vehicules', DEFAULT_VEHICULES);
  await put('services', DEFAULT_SERVICES);
  await db.collection('reglages').updateOne(
    { _id: 'templates' },
    { $setOnInsert: { modeles: WA_TEMPLATES.map((t) => ({ ...t, body: DEFAULT_TEMPLATE_BODIES[t.name] || '' })), createdAt: nowIso, updatedAt: nowIso, updatedBy: 'systeme' } },
    { upsert: true },
  ).catch((e) => { if (e && e.code !== 11000) throw e; });
  return true;
}
