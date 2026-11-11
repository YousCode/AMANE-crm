// Notifications d'équipe déclenchées par le bus : push Expo et alertes WhatsApp (devis accepté, nouvelle demande du site,
// prestataires : inscription à valider, véhicule proposé, réponse à une demande de disponibilité).
import { bus } from './bus.js';
import { track } from './background.js';
import { sendPush } from './push.js';
import { sendTeamAlert, shortTitle, teamNumbers } from './whatsapp.js';

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
  on('rappel_envoye', (db, p) => sendPush(db, { userIds: [p.responsable || 'amel'], title: 'Rappel envoyé', body: `${p.nom || p.convId} — rappel ${p.type}`, data: { type: 'rappel', convId: p.convId, missionId: p.missionId } }));
  on('prestataire_inscrit', async (db, p) => {
    await sendTeamAlert(db, { who: 'amel', texte: `Amane — inscription prestataire à valider : ${p.nom} (${p.tel})${p.vehicules ? ' : « ' + shortTitle(p.vehicules) + ' »' : ''}`, params: [p.nom, 'Inscription prestataire à valider'] });
    await sendPush(db, { userIds: ['amel'], title: 'Inscription prestataire à valider', body: `${p.nom}${p.vehicules ? ' : ' + shortTitle(p.vehicules) : ''}`, data: { type: 'partenaire', partenaireId: p.partenaireId } });
  });
  on('vehicule_propose', async (db, p) => {
    const who = teamNumbers().youssouf ? 'youssouf' : 'amel';
    await sendTeamAlert(db, { who, texte: `Amane — ${p.partenaire} propose un véhicule à valider : ${p.nom}.`, params: [p.partenaire, `Véhicule proposé : ${p.nom}`.slice(0, 60)] });
    await sendPush(db, { userIds: ['youssouf', 'amel'], title: 'Véhicule proposé à valider', body: `${p.partenaire} : ${p.nom}`, data: { type: 'vehicule', vehiculeId: p.vehiculeId } });
  });
  on('dispo_reponse', async (db, p) => {
    const mot = p.reponse === 'oui' ? 'disponible' : 'pas disponible';
    const who = p.responsable || 'amel';
    await sendTeamAlert(db, { who, texte: `Amane — ${p.partenaire} : ${p.vehicule} ${mot} ${p.periode}${p.titre ? ' (' + p.titre + ')' : ''}.`, params: [p.partenaire, `${p.vehicule} : ${mot}`.slice(0, 60)] });
    await sendPush(db, { userIds: [who], title: p.reponse === 'oui' ? 'Prestataire disponible' : 'Prestataire pas disponible', body: `${p.partenaire} : ${p.vehicule} ${mot} ${p.periode}`, data: { type: 'demande', missionId: p.missionId } });
  });
}
