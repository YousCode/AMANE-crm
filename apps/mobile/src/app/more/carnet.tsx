import React, { useState } from 'react';
import { View } from 'react-native';
import { PART_TYPES } from '@amane/shared';
import { useStore } from '@/store';
import { label } from '@/store/select';
import { useTheme, GUTTER } from '@/theme';
import { Screen, Panel, Seg, Sub, Txt, Empty, RoundPic, Section } from '@/components/ui';
import { ContactBar } from '@/components/ContactBar';

export default function Carnet() {
  const { c } = useTheme();
  const data = useStore((s) => s.data);
  const [type, setType] = useState('chauffeur');
  const list = data.partenaires.filter((p) => p.type === type && p.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return (
    <Screen testID="screen-carnet" title="Carnet" eyebrow={`${data.partenaires.length} contacts`} back>
      <Seg value={type} onChange={setType} style={{ marginBottom: 12, marginHorizontal: -GUTTER, paddingHorizontal: GUTTER }} options={PART_TYPES.map((t) => ({ id: t.id, label: t.label, n: data.partenaires.filter((p) => p.type === t.id).length }))} />
      {list.length ? list.map((p) => (
        <Panel key={p.id} style={{ marginBottom: 10, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <RoundPic name={p.nom} size={40} />
            <View style={{ flex: 1 }}><Txt style={{ fontSize: 16 }}>{p.nom}</Txt><Sub>{[label(PART_TYPES, p.type), p.contact, p.langues, p.commission ? `commission ${p.commission} %` : ''].filter(Boolean).join(' · ')}</Sub></View>
          </View>
          {p.adresse ? <Sub>{p.adresse}</Sub> : null}
          {p.notes ? <Sub style={{ color: c.fg2 }}>{p.notes}</Sub> : null}
          <ContactBar tel={p.tel} email={p.email} lieu={p.adresse} compact />
        </Panel>
      )) : <Empty>Aucun contact de ce type.</Empty>}
    </Screen>
  );
}
