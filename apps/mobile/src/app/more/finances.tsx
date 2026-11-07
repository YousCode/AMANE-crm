import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { devisTotals, parseDate } from '@amane/shared';
import { useStore } from '@/store';
import { clientOf, caMois } from '@/store/select';
import { useTheme, FONT } from '@/theme';
import { Screen, Panel, Label, Sub, Mono, Row, Empty, Section } from '@/components/ui';
import { fmtE, fmtK, fmtDay } from '@/lib/format';
import { api } from '@/lib/api';

export default function Finances() {
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data);
  const now = new Date();
  const [rent, setRent] = useState<any[] | null>(null);
  useEffect(() => { api<{ items: any[] }>('GET', `/api/flotte/rentabilite?mois=${now.toISOString().slice(0, 7)}`).then((r) => setRent(r.items || [])).catch(() => setRent([])); }, []);
  const facture = data.missions.filter((m) => m.devis?.factureNumero);
  const encaisse = data.missions.reduce((s, m) => s + devisTotals(m.devis).paid, 0);
  const retards = facture.filter((m) => { const t = devisTotals(m.devis); const d = parseDate(m.devis?.factureDate); return t.solde > 0 && d && +now - +d > 7 * 864e5; });
  const aEncaisser = facture.filter((m) => devisTotals(m.devis).solde > 0);
  const commissions = data.missions.reduce((s, m) => s + (m.commissions || []).reduce((x, k) => x + (+(k.base || 0)) * (+(k.pct || 0)) / 100, 0), 0);
  const months = [2, 1, 0].map((i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 15); return { d, v: caMois(data, d) }; });
  const kpi = (l: string, v: string, col?: string) => <Panel style={{ flex: 1, minWidth: '45%' }}><Label>{l}</Label><Mono style={{ fontFamily: FONT.display, fontSize: 26, marginTop: 6, color: col || c.fg }}>{v}</Mono></Panel>;
  return (
    <Screen testID="screen-finances" title="Finances" eyebrow="Résumé" back>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {kpi('Chiffre du mois', fmtK(caMois(data, now)))}{kpi('Encaissé', fmtK(encaisse))}{kpi('À encaisser', fmtK(aEncaisser.reduce((s, m) => s + devisTotals(m.devis).solde, 0)), aEncaisser.length ? c.warn : undefined)}{kpi('Commissions', fmtK(commissions))}
      </View>
      <Section title="Trois derniers mois" />
      <Panel style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 120 }}>
        {months.map(({ d, v }, i) => { const max = Math.max(1, ...months.map((x) => x.v)); return <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}><Mono style={{ fontSize: 11 }}>{fmtK(v)}</Mono><View style={{ width: '70%', height: Math.max(4, (v / max) * 60), backgroundColor: i === 2 ? c.fg : c.stone, borderRadius: 3 }} /><Label style={{ fontSize: 9.5 }}>{d.toLocaleDateString('fr-FR', { month: 'short' })}</Label></View>; })}
      </Panel>
      <Section title="Factures à encaisser" sub="rouge : plus de 7 jours" />
      <Panel pad={false}>
        {aEncaisser.length ? aEncaisser.map((m, i) => { const t = devisTotals(m.devis); const late = retards.includes(m); return <Row key={m.id} last={i === aEncaisser.length - 1} title={`${m.devis?.factureNumero} · ${clientOf(data, m)?.nom || ''}`} sub={`${m.titre} · ${fmtDay(m.devis?.factureDate)}`} right={<Mono style={{ color: late ? c.bad : c.fg }}>{fmtE(t.solde)}</Mono>} onPress={() => router.push(`/mission/${m.id}?tab=devis`)} />; }) : <Empty>Toutes les factures sont soldées.</Empty>}
      </Panel>
      <Section title="Rentabilité par véhicule" sub="ce mois" />
      <Panel pad={false}>
        {rent === null ? <Empty>Chargement…</Empty> : rent.length ? rent.map((r, i) => <Row key={r.vehiculeId || i} last={i === rent.length - 1} title={r.nom} sub={`${r.joursLoues} j loués · CA ${fmtE(r.ca)} · ${Math.round(+r.occupation || 0)} %`} right={<Mono style={{ color: r.marge >= 0 ? c.ok : c.bad }}>{fmtE(r.marge)}</Mono>} chevron={false} />) : <Empty>Indisponible hors ligne.</Empty>}
      </Panel>
      <Sub style={{ marginTop: 14 }}>L’export CSV et les factures se font depuis le back-office.</Sub>
    </Screen>
  );
}
