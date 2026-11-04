import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { useTheme, FONT } from '@/theme';
import { Screen, Panel, Label, H1, Row, Avatar, Sub, Btn, Txt } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SyncPill } from '@/components/SyncPill';
import { ALogo } from '@/components/ALogo';
import { ROLE_CLIENT, API_URL, MOCK_MODE } from '@/lib/api';

export default function Plus() {
  const { c } = useTheme(); const router = useRouter();
  const me = useStore((s) => s.me); const logout = useStore((s) => s.logout); const pending = useStore((s) => s.pending); const flush = useStore((s) => s.flush); const roleClient = useStore((s) => s.prefs.roleClient);
  const entries: { title: string; sub: string; icon: string; to: string; testID: string }[] = [
    { title: 'Flotte', sub: 'Véhicules, journal, photos', icon: 'car', to: '/more/flotte', testID: 'plus-flotte' },
    { title: 'Carnet', sub: 'Chauffeurs, restaurants, boutiques', icon: 'book', to: '/more/carnet', testID: 'plus-carnet' },
    { title: 'Finances', sub: 'Facturé, encaissé, retards', icon: 'euro', to: '/more/finances', testID: 'plus-finances' },
    { title: 'Réglages', sub: 'Apparence, réponses automatiques, rappels', icon: 'settings', to: '/more/reglages', testID: 'plus-reglages' },
    { title: 'Aide', sub: 'Comment ça marche', icon: 'help', to: '/more/aide', testID: 'plus-aide' },
  ];
  if (ROLE_CLIENT || roleClient) entries.push({ title: 'Espace client', sub: 'Aperçu de la page séjour (rôle client)', icon: 'star', to: '/espace/demo', testID: 'plus-espace' });
  return (
    <Screen testID="screen-plus">
      <View style={{ paddingTop: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Label>La maison</Label><H1>Plus</H1></View>
        <SyncPill />
      </View>
      <Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <Avatar id={me?.id} name={me?.nom} size={44} />
        <View style={{ flex: 1 }}><Text style={{ fontFamily: FONT.display, fontSize: 24, color: c.fg }}>{me?.nom}</Text><Sub>{me?.role}</Sub></View>
        <ALogo size={26} color={c.accent} />
      </Panel>
      {pending.length ? (
        <Panel style={{ marginBottom: 12, borderColor: c.warn, gap: 6 }}>
          <Label color={c.warn}>{pending.length} modification{pending.length > 1 ? 's' : ''} en attente</Label>
          {pending.slice(0, 5).map((op) => <Sub key={op.id}>· {op.label}</Sub>)}
          <Btn small title="Réessayer maintenant" style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => void flush()} />
        </Panel>
      ) : null}
      <Panel pad={false}>
        {entries.map((e, i) => <Row key={e.to} testID={e.testID} last={i === entries.length - 1} title={e.title} sub={e.sub} left={<View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}><Icon name={e.icon} size={17} color={c.accent} /></View>} onPress={() => router.push(e.to as never)} />)}
      </Panel>
      <View style={{ marginTop: 18, gap: 10 }}>
        <Btn title="Déconnexion" icon="logout" kind="danger" testID="logout" onPress={() => { void logout(); router.replace('/login'); }} />
        <Sub style={{ textAlign: 'center' }}>{MOCK_MODE ? 'Mode démonstration (données intégrées)' : API_URL} · Amane 2.0</Sub>
        <Txt style={{ textAlign: 'center', fontFamily: FONT.display, fontSize: 15, color: c.fg3 }}>Arrive as a <Text style={{ fontFamily: FONT.displayItalic }}>Guest</Text>. Leave with a <Text style={{ fontFamily: FONT.displayItalic }}>Story</Text>.</Txt>
      </View>
    </Screen>
  );
}
