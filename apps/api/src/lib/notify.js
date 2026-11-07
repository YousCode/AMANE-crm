// Notifications d'équipe déclenchées par le bus : push Expo et alertes WhatsApp (devis accepté, nouvelle demande du site, mission confirmée par un prestataire).
import { bus } from './bus.js';
import { track } from './background.js';
import { sendPush } from './push.js';
import { sendTeamAlert, shortTitle } from './whatsapp.js';

export function installNotifications(getDb) {
  const on = (type, fn) => bus.on(type, (p) => track((async () => fn(await getDb(), p))(), 'notification ' + type));
  on('message_in', (db, p) => sendPush(db, {
    userIds: [p.responsable || 'amel'],
    title: p.createdMission ? 'Nouvelle demande WhatsApp' : 'Nouveau message',
    body: `${p.nom} : ${shortTitle(p.text)}`,
    data: { type: p.createdMission ? 'demande' : 'message', convId: p.convId, missionId: p.missionId || '' },
  }));
  on('lead', (db, p) => sendPush(db, { userIds: ['amel'], title: 'Nouvelle demande du site', body: `${p.nom}${p.message ? ' : ' + shortTitle(p.message) : ''}`, data: { type: 'demande', missionId: p.missionId } }));
  on('devis_accepte', async (db, p) => {
    await sendTeamAlert(db, { who: p.responsable || 'amel', texte: `Amane — devis ${p.numero || ''} accepté par le client via le lien (${p.titre}).`.replace(/\s+/g, ' '), params: [p.titre || 'Devis', `Devis ${p.numero || ''} accepté`.slice(0, 60)] });
    await sendPush(db, { userIds: [p.responsable || 'amel'], title: 'Devis accepté', body: `${p.titre} — devis ${p.numero || ''} accepté par le client`, data: { type: 'devis', missionId: p.missionId } });
  });
  on('confirmation', (db, p) => (p.confirme && p.via === 'espace' ? sendPush(db, { userIds: [p.responsable || 'youssouf'], title: 'Mission confirmée', body: `${p.nom} a confirmé : ${p.titre || 'mission'}`, data: { type: 'confirmation', missionId: p.missionId } }) : null));
  on('rappel_envoye', (db, p) => sendPush(db, { userIds: [p.responsable || 'amel'], title: 'Rappel envoyé', body: `${p.nom || p.convId} — rappel ${p.type}`, data: { type: 'rappel', convId: p.convId, missionId: p.missionId } }));
}
