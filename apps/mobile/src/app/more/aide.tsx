import React from 'react';
import { View, Text } from 'react-native';
import { TEAM } from '@amane/shared';
import { useTheme, FONT } from '@/theme';
import { Screen, Panel, Label, Sub, Txt, Avatar } from '@/components/ui';

const STEPS: [string, string][] = [
  ['Aujourd’hui', 'La prochaine mission en carte noire : appeler le client, lui écrire sur WhatsApp, lancer l’itinéraire, ouvrir la demande. En dessous, la journée, vos tâches, les messages non lus.'],
  ['Messages', 'Chaque message reçu est traduit en français. Vous écrivez en français, l’appli traduit dans la langue du client avec un aperçu avant envoi. Réponses rapides, brouillon IA, photo, lieu de la mission, contact du chauffeur, note interne.'],
  ['Demandes', 'Nouvelle → Proposition → Confirmée → En cours → Terminée. Changez le statut d’un geste. La fiche réunit contrat, caution, pièces, états des lieux (avec photos), devis, programme et tâches.'],
  ['Planning', 'Jour ou semaine par véhicule. Un conflit apparaît en rouge discret. « Qui est libre ? » répond tout de suite.'],
  ['Hors ligne', 'Tout reste consultable sans réseau. Vos modifications sont mises en attente et envoyées dès le retour du réseau ; le point en haut de l’écran l’indique.'],
];

export default function Aide() {
  const { c } = useTheme();
  return (
    <Screen testID="screen-aide" title="Aide" eyebrow="Comment ça marche" back>
      <Panel pad={false}>
        {STEPS.map(([t, p], i) => (
          <View key={t} style={{ flexDirection: 'row', gap: 14, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
            <View style={{ width: 36, height: 44, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: FONT.display, fontSize: 17, color: c.accent }}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontFamily: FONT.display, fontSize: 19, color: c.fg }}>{t}</Text><Sub style={{ marginTop: 4, color: c.fg2 }}>{p}</Sub></View>
          </View>
        ))}
      </Panel>
      <Label style={{ marginTop: 22, marginBottom: 8 }}>Qui fait quoi</Label>
      <Panel pad={false}>
        {TEAM.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
            <Avatar id={t.id} name={t.nom} size={34} />
            <View style={{ flex: 1 }}><Txt style={{ fontFamily: FONT.uiMedium }}>{t.nom}</Txt><Sub>{t.role}{t.id === 'amel' ? ' · demandes, messages, clients' : t.id === 'youssouf' ? ' · flotte, préparation, chauffeurs' : ' · contrats, cautions, factures'}</Sub></View>
          </View>
        ))}
      </Panel>
      <Sub style={{ marginTop: 16 }}>Les demandes WhatsApp et du site arrivent seules. Le serveur relance, remercie et alerte l’équipe automatiquement.</Sub>
    </Screen>
  );
}
