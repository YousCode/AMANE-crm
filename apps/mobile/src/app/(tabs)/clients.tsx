import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { CLIENT_STATUTS, CLIENT_TAGS } from '@amane/shared';
import { useStore } from '@/store';
import { label } from '@/store/select';
import { useTheme, FONT, GUTTER } from '@/theme';
import { Screen, Panel, Label, H1, Row, Avatar, Chip, Empty, Seg, IconBtn } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SyncPill } from '@/components/SyncPill';
import { fmtDay } from '@/lib/format';

export const tagsOf = (t: unknown): string[] => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t as object).filter((k) => (t as Record<string, boolean>)[k]) : []);

export default function Clients() {
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const save = useStore((s) => s.save);
  const [q, setQ] = useState(''); const [st, setSt] = useState('tous');
  const qq = q.toLowerCase().trim();
  const list = data.clients.filter((x) => (st === 'tous' || x.statut === st) && (!qq || [x.nom, x.tel, x.email, x.hotel, x.pays].join(' ').toLowerCase().includes(qq))).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const newClient = async () => {
    const id = 'c_' + Date.now().toString(36);
    await save('clients', { id, nom: 'Nouveau client', tel: '', email: '', langue: 'FR', pays: '', hotel: '', canal: 'WhatsApp', statut: 'prospect', responsable: me?.id || 'amel', prefs: '', notes: '' }, 'Créer la fiche');
    router.push(`/client/${id}?edit=1`);
  };
  return (
    <Screen testID="screen-clients">
      <View style={{ paddingTop: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}><Label>{data.clients.length} fiches</Label><H1>Clients</H1></View>
        <SyncPill />
        <IconBtn name="plus" accessibilityLabel="Nouveau client" bg={c.fg} color={c.bg} onPress={() => void newClient()} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel, marginBottom: 10 }}>
        <Icon name="search" size={16} color={c.fg3} />
        <TextInput testID="client-search" value={q} onChangeText={setQ} placeholder="Nom, téléphone, hôtel…" placeholderTextColor={c.fg3} accessibilityLabel="Rechercher un client" style={{ flex: 1, fontFamily: FONT.ui, fontSize: 15, color: c.fg, height: 44 }} autoCorrect={false} />
      </View>
      <Seg value={st} onChange={setSt} style={{ marginBottom: 12, marginHorizontal: -GUTTER, paddingHorizontal: GUTTER }} options={[{ id: 'tous', label: 'Tous' }, ...CLIENT_STATUTS.map((s) => ({ id: s.id, label: s.label, n: data.clients.filter((x) => x.statut === s.id).length }))]} />
      <Panel pad={false}>
        {list.length ? list.map((x, i) => {
          const last = data.missions.filter((m) => m.clientId === x.id).sort((a, b) => String(b.debut).localeCompare(String(a.debut)))[0];
          const tags = tagsOf(x.tags);
          return <Row key={x.id} testID={`client-${x.id}`} last={i === list.length - 1} title={x.nom} sub={[label(CLIENT_STATUTS, x.statut), x.langue, x.hotel || x.pays, last ? `dernière : ${fmtDay(last.debut)}` : ''].filter(Boolean).join(' · ')} left={<Avatar id={x.responsable} size={30} />} right={tags.length ? <Chip small text={label(CLIENT_TAGS, tags[0])} /> : undefined} onPress={() => router.push(`/client/${x.id}`)} />;
        }) : <Empty>{q ? 'Aucun client ne correspond.' : 'Aucun client pour l’instant.'}</Empty>}
      </Panel>
    </Screen>
  );
}
