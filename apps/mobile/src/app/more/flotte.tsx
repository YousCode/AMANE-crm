import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { parseDate } from '@amane/shared';
import { useStore } from '@/store';
import { vehiclesSorted } from '@/store/select';
import { useTheme } from '@/theme';
import { Screen, Panel, Row, Chip, Mono, Empty } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { fmtDay, fmtE } from '@/lib/format';

export default function Flotte() {
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data);
  const vs = vehiclesSorted(data); const now = new Date();
  return (
    <Screen testID="screen-flotte" title="Flotte" eyebrow={`${vs.length} véhicules`} back>
      <Panel pad={false}>
        {vs.length ? vs.map((v, i) => {
          const busy = data.missions.find((m) => m.vehiculeId === v.id && ['confirmee', 'encours'].includes(m.statut) && parseDate(m.debut) && (parseDate(m.debut) as Date) <= now && ((parseDate(m.fin) || parseDate(m.debut)) as Date) >= now);
          const rev = parseDate(v.revision); const revSoon = rev && +rev - +now < 7 * 864e5;
          return <Row key={v.id} testID={`veh-${v.id}`} last={i === vs.length - 1} title={v.nom} sub={[v.categorie, v.plaque, v.km ? `${v.km} km` : '', rev ? `révision ${fmtDay(rev)}` : ''].filter(Boolean).join(' · ')} left={<View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' }}><Icon name="car" size={17} color={c.accent} /></View>} right={<View style={{ alignItems: 'flex-end', gap: 4 }}><Mono style={{ fontSize: 12 }}>{fmtE(v.tarifJour)}/j</Mono><Chip small text={v.statut === 'entretien' ? 'En entretien' : v.statut === 'indisponible' ? 'Indisponible' : busy ? 'En mission' : revSoon ? 'Révision J-7' : 'Disponible'} color={v.statut === 'entretien' || v.statut === 'indisponible' || revSoon ? c.warn : busy ? c.info : c.ok} /></View>} onPress={() => router.push(`/vehicule/${v.id}`)} />;
        }) : <Empty>Aucun véhicule.</Empty>}
      </Panel>
    </Screen>
  );
}
