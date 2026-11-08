import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PART_TYPES } from '@amane/shared';
import { useStore } from '@/store';
import { label } from '@/store/select';
import { Screen, Panel, Label, Sub, Empty } from '@/components/ui';
import { ContactBar } from '@/components/ContactBar';
import { EspacePrestataire } from '@/components/EspacePrestataire';
import { RelancesHist } from '@/components/Relances';

/* Fiche partenaire : contact, espace prestataire (lien personnel, missions confiées) et relances envoyées. */
export default function PartenaireScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useStore((s) => s.data.partenaires.find((x) => x.id === id)); const setToast = useStore((s) => s.setToast);
  if (!p) return <Screen title="Partenaire" back><Empty>Partenaire introuvable.</Empty></Screen>;
  return (
    <Screen testID="screen-partenaire" title={p.nom} eyebrow={label(PART_TYPES, p.type)} back>
      <View style={{ gap: 12 }}>
        <ContactBar tel={p.tel} email={p.email} lieu={p.adresse} waText={`Bonjour ${String(p.contact || p.nom || '').trim()}, `} compact />
        {p.notes ? <Sub>{p.notes}</Sub> : null}
        <EspacePrestataire pid={p.id} nom={p.nom} contact={p.contact} tel={p.tel} onToast={setToast} />
        <Panel style={{ gap: 10 }}><Label>Relances</Label><RelancesHist q={'partenaireId=' + encodeURIComponent(p.id)} /></Panel>
      </View>
    </Screen>
  );
}
