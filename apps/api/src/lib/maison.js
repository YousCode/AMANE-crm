// Identité de la maison sur les documents client : document `reglages/maison` (saisi dans Réglages),
// complété par les variables d'environnement historiques (BANK_IBAN, BANK_BIC, PUBLIC_PHONE).
import { maisonInfo } from '@amane/shared';

export async function getMaison(db) {
  const doc = await db.collection('reglages').findOne({ _id: 'maison', _deleted: { $ne: true } });
  return maisonInfo(doc, { iban: process.env.BANK_IBAN, bic: process.env.BANK_BIC, tel: process.env.PUBLIC_PHONE });
}
