import React from 'react';
import { useStore } from '@/store';
import { Screen, Sub } from '@/components/ui';
import { RelancesList } from '@/components/Relances';

export default function RelancesScreen() {
  const setToast = useStore((s) => s.setToast);
  return (
    <Screen testID="screen-relances" title="À relancer" eyebrow="Relation client" back>
      <RelancesList onToast={setToast} />
      <Sub style={{ marginTop: 8 }}>Devis sans réponse, acomptes, soldes, factures en retard, missions à faire confirmer par les prestataires. Une relance faite n’est plus proposée avant son délai.</Sub>
    </Screen>
  );
}
