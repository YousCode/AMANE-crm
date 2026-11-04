import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PROG_TYPES, t as tr, docLang } from '@amane/shared';
import { useStore } from '@/store';
import { label } from '@/store/select';
import { useTheme, FONT } from '@/theme';
import { Screen, Panel, Label, Sub, Txt, Empty, Mono, Btn } from '@/components/ui';
import { ALogo } from '@/components/ALogo';
import { ContactBar } from '@/components/ContactBar';
import { api, ApiError, ROLE_CLIENT } from '@/lib/api';
import { fmtDT, fmtTime, fmtDay, fmtE } from '@/lib/format';

/* Espace client (rôle « client », désactivé par défaut : EXPO_PUBLIC_ROLE_CLIENT=true ou Réglages). Lit GET /api/espace/:token. */
export default function Espace() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { c } = useTheme(); const roleClient = useStore((s) => s.prefs.roleClient);
  const [d, setD] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const on = ROLE_CLIENT || roleClient;
  useEffect(() => { if (!on) return; api(`GET`, `/api/espace/${encodeURIComponent(String(token))}`).then(setD).catch((e) => setErr(e instanceof ApiError ? e.message : 'Indisponible.')); }, [token, on]);
  if (!on) return <Screen title="Espace client" back><Empty>Le rôle client est désactivé (ROLE_CLIENT=false).</Empty></Screen>;
  if (err) return <Screen title="Espace client" back><Empty>{err}</Empty></Screen>;
  if (!d) return <Screen title="Espace client" back><Empty>Chargement…</Empty></Screen>;
  const L = docLang(d.client); const rtl = L === 'AR';
  return (
    <Screen testID="screen-espace" title={d.mission?.titre || 'Votre séjour'} eyebrow={tr(L, 'doc.prog')} back>
      <View style={{ alignItems: 'center', marginVertical: 10 }}><ALogo size={30} color={c.accent} /></View>
      <Txt rtl={rtl} style={{ fontFamily: FONT.display, fontSize: 22, textAlign: 'center', marginBottom: 14 }}>{tr(L, d.client?.nom ? 'doc.hello' : 'doc.helloAnon', { nom: d.client?.nom })}</Txt>
      <Panel style={{ gap: 6, marginBottom: 12 }}>
        <Label>{tr(L, 'doc.date')}</Label>
        <Txt>{fmtDT(d.mission?.debut)} → {fmtDT(d.mission?.fin)}</Txt>
        {d.mission?.lieu ? <Sub>{d.mission.lieu}</Sub> : null}
      </Panel>
      {d.chauffeur ? <Panel style={{ gap: 6, marginBottom: 12 }}><Label>Chauffeur</Label><Txt style={{ fontSize: 17, fontFamily: FONT.display }}>{d.chauffeur.nom}</Txt><ContactBar tel={d.chauffeur.tel} compact /></Panel> : null}
      <Panel pad={false} style={{ marginBottom: 12 }}>
        {(d.mission?.programme || []).map((p: any, i: number) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
            <View style={{ width: 54 }}><Mono style={{ fontSize: 13 }}>{fmtTime(p.dt)}</Mono><Sub style={{ fontSize: 11 }}>{fmtDay(p.dt)}</Sub></View>
            <View style={{ flex: 1 }}><Txt rtl={rtl}>{tr(L, `doc.type.${p.type}`) !== `doc.type.${p.type}` ? tr(L, `doc.type.${p.type}`) : label(PROG_TYPES, p.type)}</Txt>{p.lieu ? <Sub rtl={rtl}>{p.lieu}</Sub> : null}{p.client ? <Sub rtl={rtl} style={{ color: c.fg2 }}>{p.client}</Sub> : null}</View>
          </View>
        ))}
        {!(d.mission?.programme || []).length ? <Empty>—</Empty> : null}
      </Panel>
      <Panel style={{ gap: 6, marginBottom: 12 }}>
        <Label>{tr(L, 'doc.due')}</Label>
        <Text style={{ fontFamily: FONT.display, fontSize: 26, color: c.fg }}>{fmtE(d.solde)}</Text>
        {(d.documents || []).map((doc: any, i: number) => <Sub key={i}>{tr(L, doc.type === 'facture' ? 'doc.invoice' : 'doc.quote')} {doc.numero}</Sub>)}
      </Panel>
      {d.contact?.tel ? <Btn kind="primary" title="WhatsApp Amane" icon="wa" onPress={() => void import('@/lib/links').then((l) => l.open(l.waUrl(d.contact.tel, '')))} /> : null}
    </Screen>
  );
}
