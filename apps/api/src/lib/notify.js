// Notifications d'équipe déclenchées par le bus : push Expo et alertes WhatsApp (devis accepté, nouvelle demande du site,
// prestataires : inscription à valider, véhicule proposé, réponse à une demande de disponibilité).
import { bus } from './bus.js';
import { track } from './background.js';
import { sendPush } from './push.js';
import { sendTeamAlert, shortTitle, teamNumbers } from './whatsapp.js';

/** Texte saisi par un prestataire, repris dans une alerte à l'équipe : sans adresse web cliquable, 40 caractères au plus. */
export const sansLien = (s) => String(s || '').replace(/(?:https?:\/\/|www\.)\S*/gi, '').replace(/(\w)\.(?=\w)/g, '$1 ').replace(/\s+/g, ' ').trim().slice(0, 40) || '—';

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
  // Aucun texte libre de l'inscrit dans l'alerte : elle part du numéro de la maison vers l'équipe, ce serait un canal d'hameçonnage.
  on('prestataire_inscrit', async (db, p) => {
    await sendTeamAlert(db, { who: 'amel', texte: `Amane — nouvelle inscription de prestataire (${p.tel}) : à valider dans le Carnet.`, params: [p.tel, 'Inscription prestataire à valider'] });
    await sendPush(db, { userIds: ['amel'], title: 'Inscription prestataire à valider', body: `${p.tel} — à voir dans le Carnet`, data: { type: 'partenaire', partenaireId: p.partenaireId } });
  });
  on('vehicule_propose', async (db, p) => {
    const who = teamNumbers().youssouf ? 'youssouf' : 'amel';
    const [qui, quoi] = [sansLien(p.partenaire), sansLien(p.nom)];
    await sendTeamAlert(db, { who, texte: `Amane — ${qui} propose un véhicule à valider : ${quoi}.`, params: [qui, `Véhicule proposé : ${quoi}`.slice(0, 60)] });
    await sendPush(db, { userIds: ['youssouf', 'amel'], title: 'Véhicule proposé à valider', body: `${qui} : ${quoi}`, data: { type: 'vehicule', vehiculeId: p.vehiculeId } });
  });
  on('dispo_reponse', async (db, p) => {
    const mot = p.reponse === 'oui' ? 'disponible' : 'pas disponible';
    const who = p.responsable || 'amel';
    p = { ...p, partenaire: sansLien(p.partenaire), vehicule: sansLien(p.vehicule) };
    await sendTeamAlert(db, { who, texte: `Amane — ${p.partenaire} : ${p.vehicule} ${mot} ${p.periode}${p.titre ? ' (' + p.titre + ')' : ''}.`, params: [p.partenaire, `${p.vehicule} : ${mot}`.slice(0, 60)] });
    await sendPush(db, { userIds: [who], title: p.reponse === 'oui' ? 'Prestataire disponible' : 'Prestataire pas disponible', body: `${p.partenaire} : ${p.vehicule} ${mot} ${p.periode}`, data: { type: 'demande', missionId: p.missionId } });
  });
}
