import React, { useMemo, useState } from 'react';
import { View, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { convsSorted, convName, convMsgs, convMission, unreadTotal } from '@/store/select';
import { useTheme, FONT, GUTTER } from '@/theme';
import { Screen, Panel, Empty, Seg, Label, H1 } from '@/components/ui';
import { ConvRow } from '@/components/ConvRow';
import { Icon } from '@/components/Icon';
import { SyncPill } from '@/components/SyncPill';

type F = 'tous' | 'nonlus' | 'moi' | 'sansdemande';

export default function Messages() {
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const health = useStore((s) => s.health);
  const [q, setQ] = useState(''); const [f, setF] = useState<F>('tous');
  const all = convsSorted(data); const nU = unreadTotal(data);
  const list = useMemo(() => {
    const qq = q.toLowerCase().trim();
    return all.filter((cv) => {
      if (f === 'nonlus' && !cv.unread) return false;
      if (f === 'moi' && cv.assigne !== me?.id) return false;
      if (f === 'sansdemande' && convMission(data, cv)) return false;
      return !qq || [convName(data, cv), cv.id, cv.nom, cv.lastText].join(' ').toLowerCase().includes(qq);
    });
  }, [all, q, f, me, data]);
  return (
    <Screen testID="screen-messages">
      <View style={{ paddingTop: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Label>WhatsApp{nU ? ` · ${nU} non lu${nU > 1 ? 's' : ''}` : ''}</Label>
          <H1>Messages</H1>
        </View>
        <SyncPill />
      </View>
      {health && health.whatsapp === false ? <Panel style={{ marginBottom: 12, borderStyle: 'dashed' }}><Label>WhatsApp n’est pas encore relié au serveur.</Label></Panel> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel, marginBottom: 10 }}>
        <Icon name="search" size={16} color={c.fg3} />
        <TextInput testID="conv-search" value={q} onChangeText={setQ} placeholder="Nom, numéro, message…" placeholderTextColor={c.fg3} accessibilityLabel="Rechercher une conversation" style={{ flex: 1, fontFamily: FONT.ui, fontSize: 15, color: c.fg, height: 44 }} autoCorrect={false} />
      </View>
      <Seg value={f} onChange={setF} style={{ marginBottom: 12, marginHorizontal: -GUTTER, paddingHorizontal: GUTTER }} options={[{ id: 'tous', label: 'Toutes' }, { id: 'nonlus', label: 'Non lus', n: nU }, { id: 'moi', label: 'À moi' }, { id: 'sansdemande', label: 'Sans demande' }]} />
      <Panel pad={false}>
        {list.length ? list.map((cv) => <ConvRow key={cv.id} cv={cv} testID={`conv-${cv.id}`} last={convMsgs(data, cv.id).slice(-1)[0]} onPress={() => router.push(`/conv/${encodeURIComponent(cv.id)}`)} />)
          : <Empty>{q ? 'Aucune conversation ne correspond.' : 'Aucune conversation pour l’instant. Les messages WhatsApp reçus par Amane arrivent ici.'}</Empty>}
      </Panel>
    </Screen>
  );
}
