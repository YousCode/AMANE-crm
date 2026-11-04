import React, { useState } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEAM, PROG_TYPES } from '@amane/shared';
import { useStore } from '@/store';
import { todayItems, todos, convsSorted, convMsgs, clientOf, vehicleOf, svcName, caMois, pipeline, byId, label, helloTxt } from '@/store/select';
import { useTheme, FONT, GUTTER } from '@/theme';
import { Hero } from '@/components/Hero';
import { SyncPill } from '@/components/SyncPill';
import { ConvRow } from '@/components/ConvRow';
import { Panel, Section, Empty, Sub, Txt, Label, Avatar, Em, IconBtn, Mono } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Dot } from '@/components/Icon';
import { fmtTime, fmtDayLong, fmtK } from '@/lib/format';
import { telUrl, waUrl, mapsUrl, open } from '@/lib/links';
import { tap } from '@/lib/haptics';

export default function Aujourdhui() {
  const { c } = useTheme(); const ins = useSafeAreaInsets(); const router = useRouter();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const syncNow = useStore((s) => s.syncNow); const sync = useStore((s) => s.sync);
  const [sel, setSel] = useState<string>(me?.id || 'amel'); const [all, setAll] = useState(false);
  const now = new Date();
  const items = todayItems(data, now); const T = todos(data, now); const mine = T[sel] || []; const shown = all ? mine : mine.slice(0, 5);
  const unread = convsSorted(data).filter((cv) => (cv.unread || 0) > 0).slice(0, 4);
  const nMiss = data.missions.filter((m) => items.some((x) => x.m.id === m.id)).length; const nNew = data.missions.filter((m) => m.statut === 'nouvelle').length;
  const qa = (tel?: string, wa?: string, lieu?: string, who?: string) => {
    const t = telUrl(tel), w = waUrl(tel, wa), m = mapsUrl(lieu);
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {t ? <IconBtn name="phone" size={34} accessibilityLabel={`Appeler ${who || ''}`} onPress={() => void open(t)} /> : null}
        {w ? <IconBtn name="wa" size={34} accessibilityLabel={`WhatsApp ${who || ''}`} onPress={() => void open(w)} /> : null}
        {m ? <IconBtn name="nav" size={34} accessibilityLabel={`Itinéraire vers ${lieu}`} onPress={() => void open(m)} /> : null}
      </View>
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView testID="screen-aujourdhui" refreshControl={<RefreshControl refreshing={sync === 'syncing'} onRefresh={() => void syncNow()} tintColor={c.accent} />} contentContainerStyle={{ paddingTop: ins.top + 14, paddingHorizontal: GUTTER, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Label numberOfLines={1} style={{ flexShrink: 1 }}>{fmtDayLong(now)} · {fmtTime(now)}</Label>
          <View style={{ flex: 1 }} />
          <SyncPill />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 34, lineHeight: 40, color: c.fg, marginTop: 4 }}>Bonjour, <Em style={{ fontSize: 34 }}>{me?.nom || ''}</Em>.</Text>
        <Txt style={{ color: c.fg2, marginTop: 4, marginBottom: 18 }}>{nMiss} mission{nMiss > 1 ? 's' : ''} aujourd’hui · {nNew} demande{nNew > 1 ? 's' : ''} à traiter</Txt>

        <Hero now={now} />

        <Section title="Aujourd’hui" sub={fmtDayLong(now)} />
        <Panel pad={false}>
          {items.length ? items.map((x, i) => {
            const m = x.m; const cl = clientOf(data, m);
            if (x.p) {
              const pt = byId(data.partenaires, x.p.partenaireId); const lieu = x.p.lieu || pt?.adresse || '';
              return (
                <Pressable key={`${m.id}-${i}`} accessibilityRole="button" onPress={() => { tap('select'); router.push(`/mission/${m.id}?tab=prog`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, paddingLeft: 26, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                  <Mono style={{ width: 44, fontSize: 12.5, color: c.fg3 }}>{fmtTime(x.t)}</Mono>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt numberOfLines={1} style={{ fontSize: 14 }}>{label(PROG_TYPES, x.p.type)}{pt ? ` — ${pt.nom}` : ''}</Txt>
                    <Sub numberOfLines={1}>{[cl?.nom, lieu].filter(Boolean).join(' · ')}</Sub>
                  </View>
                  {qa(pt?.tel, undefined, lieu, pt?.nom)}
                </Pressable>
              );
            }
            const v = vehicleOf(data, m);
            return (
              <Pressable key={`${m.id}-${i}`} testID={`tl-${m.id}`} accessibilityRole="button" onPress={() => { tap('select'); router.push(`/mission/${m.id}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                <Mono style={{ width: 44, fontSize: 13 }}>{x.t ? fmtTime(x.t) : 'suite'}</Mono>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt numberOfLines={1} style={{ fontFamily: FONT.uiMedium }}>{m.titre}</Txt>
                  <Sub numberOfLines={1}>{[cl?.nom, v?.nom, m.lieu].filter(Boolean).join(' · ') || svcName(data, m.service)}</Sub>
                </View>
                {qa(cl?.tel, helloTxt(cl), m.lieu, cl?.nom)}
              </Pressable>
            );
          }) : <Empty>Rien de prévu aujourd’hui.</Empty>}
        </Panel>

        <Section title="À faire" sub={`${mine.length} en attente`} />
        <Panel pad={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, padding: 12, paddingBottom: 8 }}>
            {TEAM.map((p) => {
              const on = sel === p.id;
              return (
                <Pressable key={p.id} testID={`todo-${p.id}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap('select'); setSel(p.id); setAll(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingLeft: 6, paddingRight: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? c.fg : c.line2, backgroundColor: on ? c.fg : c.panel }}>
                  <Avatar id={p.id} name={p.nom} size={22} />
                  <Text style={{ fontFamily: FONT.uiMedium, fontSize: 12.5, color: on ? c.bg : c.fg }}>{p.nom}</Text>
                  <Text style={{ fontFamily: FONT.mono, fontSize: 11, color: on ? c.bg : c.fg3 }}>{(T[p.id] || []).length}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {shown.length ? shown.map((t, i) => (
            <Pressable key={i} accessibilityRole="button" onPress={() => { tap('select'); router.push(`/mission/${t.id}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: c.line2 }}>
              <Dot size={7} color={t.sev === 'bad' ? c.bad : c.warn} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt numberOfLines={1}>{t.t}</Txt>
                <Sub numberOfLines={1}>{t.d}</Sub>
              </View>
              <Icon name="right" size={15} color={c.fg3} />
            </Pressable>
          )) : <Empty>Rien en attente pour {TEAM.find((p) => p.id === sel)?.nom}.</Empty>}
          {mine.length > shown.length ? <Pressable onPress={() => setAll(true)} style={{ padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line2 }}><Txt style={{ fontSize: 13, color: c.fg2, textDecorationLine: 'underline' }}>Voir les {mine.length - shown.length} autres</Txt></Pressable> : null}
        </Panel>

        <Section title="Messages" action="Tout voir" onAction={() => router.push('/(tabs)/messages')} />
        <Panel pad={false}>
          {unread.length ? unread.map((cv) => <ConvRow key={cv.id} cv={cv} last={convMsgs(data, cv.id).slice(-1)[0]} onPress={() => router.push(`/conv/${encodeURIComponent(cv.id)}`)} />) : <Empty>Aucun message non lu.</Empty>}
        </Panel>

        <Section title="Ce mois" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Panel style={{ flex: 1 }}><Label>Chiffre</Label><Text style={{ fontFamily: FONT.display, fontSize: 30, color: c.fg, marginTop: 8 }}>{fmtK(caMois(data, now))}</Text></Panel>
          <Panel style={{ flex: 1 }}><Label>En négociation</Label><Text style={{ fontFamily: FONT.display, fontSize: 30, color: c.fg, marginTop: 8 }}>{fmtK(pipeline(data))}</Text></Panel>
        </View>
      </ScrollView>
    </View>
  );
}
