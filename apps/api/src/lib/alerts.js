// Alertes équipe programmées : message client sans réponse depuis 6 h, révision à J-7, PV reçu.
import { now, nowIso } from './clock.js';
import { sendTeamAlert, shortTitle, teamNumbers } from './whatsapp.js';
import { parisDay, addWallDays } from './paris.js';
import { sendPush } from './push.js';

const H6 = 6 * 3600000;

export async function runAlerts(db, nowMs = now()) {
  const out = { sansReponse: 0, revisions: 0 };
  // 1. Conversations clientes sans réponse depuis 6 h.
  const cutoff = new Date(nowMs - H6).toISOString();
  const convs = await db.collection('conversations').find({ lastInAt: { $lt: cutoff }, equipe: { $exists: false } }).toArray();
  for (const c of convs) {
    if (!c.lastInId || c.alerte6hFor === c.lastInId) continue;
    if (c.lastHumanOutAt && c.lastHumanOutAt >= c.lastInAt) continue; // l'équipe a répondu (la réponse automatique ne compte pas)
    if (c.lastInAt < new Date(nowMs - 3 * 86400000).toISOString()) continue; // trop ancien : on n'insiste pas
    const r = await db.collection('conversations').updateOne({ _id: c._id, alerte6hFor: { $ne: c.lastInId } }, { $set: { alerte6hFor: c.lastInId } });
    if (!r.modifiedCount) continue;
    const mission = c.missionId ? await db.collection('missions').findOne({ _id: c.missionId }, { projection: { responsable: 1 } }) : null;
    const who = (mission && mission.responsable) || 'amel';
    await sendTeamAlert(db, { who, texte: `Amane — ${c.nom || '+' + c._id} attend une réponse depuis plus de 6 h : « ${shortTitle(c.lastText)} »`, params: [c.nom || '+' + c._id, `Sans réponse depuis 6 h : ${shortTitle(c.lastText)}`.slice(0, 60)] });
    await sendPush(db, { userIds: [who], title: 'Message sans réponse', body: `${c.nom || '+' + c._id} attend depuis plus de 6 h`, data: { type: 'message', convId: c._id } });
    out.sansReponse++;
  }
  // 2. Révision à J-7 (champ `revision` du véhicule, AAAA-MM-JJ).
  const today = parisDay(nowMs);
  const limit = addWallDays(today, 7);
  const vs = await db.collection('vehicules').find({ _deleted: { $ne: true }, revision: { $gte: today, $lte: limit } }).toArray();
  for (const v of vs) {
    const key = String(v.revision).slice(0, 10);
    if (v.revisionAlerteFor === key) continue;
    const r = await db.collection('vehicules').updateOne({ _id: v._id, revisionAlerteFor: { $ne: key } }, { $set: { revisionAlerteFor: key } });
    if (!r.modifiedCount) continue;
    const who = v.responsable || (teamNumbers().youssouf ? 'youssouf' : 'amel');
    await sendTeamAlert(db, { who, texte: `Amane — révision de ${v.nom} prévue le ${key} (dans 7 jours ou moins).`, params: [v.nom, `Révision le ${key}`] });
    await sendPush(db, { userIds: [who], title: 'Révision à prévoir', body: `${v.nom} : révision le ${key}`, data: { type: 'vehicule', vehiculeId: v._id } });
    out.revisions++;
  }
  return out;
}

/** PV reçu : appelé par PUT /api/doc/vehicules/:id quand une entrée de journal « pv » apparaît. Jamais d'exception. */
export async function alertPv(db, vehicule, entries) {
  try {
    const who = vehicule.responsable || (teamNumbers().youssouf ? 'youssouf' : 'amel');
    for (const j of entries) {
      const txt = `Amane — PV reçu pour ${vehicule.nom}${j.dt ? ' (' + String(j.dt).slice(0, 10) + ')' : ''}${j.cout ? ' : ' + j.cout + ' €' : ''}${j.notes ? ' — ' + shortTitle(j.notes) : ''}`;
      await sendTeamAlert(db, { who, texte: txt, params: [vehicule.nom, `PV reçu${j.cout ? ' ' + j.cout + ' €' : ''}`.slice(0, 60)] });
    }
    await db.collection('vehicules').updateOne({ _id: vehicule._id }, { $set: { pvAlerteAt: nowIso() } });
  } catch (e) {
    console.error('[amane] alerte PV', e && e.message);
  }
}
