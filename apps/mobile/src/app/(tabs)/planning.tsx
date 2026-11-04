import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { parseDate, clashes, freeVehicles, type Mission } from '@amane/shared';
import { useStore } from '@/store';
import { clientOf, vehiclesSorted } from '@/store/select';
import { useTheme, FONT, GUTTER, statutColor } from '@/theme';
import { Screen, Panel, Label, H1, Sub, Txt, Mono, Seg, IconBtn, Empty, Chip } from '@/components/ui';
import { SyncPill } from '@/components/SyncPill';
import { sod, addD, sameDay, fmtTime, fmtDayLong, fmtDay } from '@/lib/format';
import { tap } from '@/lib/haptics';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ACTIVE = ['confirmee', 'encours', 'proposition', 'nouvelle'];

export default function Planning() {
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data);
  const [mode, setMode] = useState<'jour' | 'semaine'>('jour'); const [off, setOff] = useState(0);
  const now = new Date();
  const day = addD(sod(now), off); const monday = addD(sod(now), -((now.getDay() + 6) % 7) + off * 7);
  const days = Array.from({ length: 7 }, (_, i) => addD(monday, i));
  const vs = vehiclesSorted(data);
  const ms = data.missions.filter((m) => ACTIVE.includes(m.statut) && parseDate(m.debut));
  const on = (m: Mission, d: Date) => { const a = parseDate(m.debut) as Date; const b = parseDate(m.fin) || a; return a < addD(d, 1) && b >= d; };
  const free = freeVehicles(vs, data.missions, day, addD(day, 1));
  const dayMs = ms.filter((m) => on(m, day)).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  return (
    <Screen testID="screen-planning">
      <View style={{ paddingTop: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Label>Flotte · {vs.length} véhicules</Label><H1>Planning</H1></View>
        <SyncPill />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Seg value={mode} onChange={(v) => { setMode(v); setOff(0); }} options={[{ id: 'jour', label: 'Jour' }, { id: 'semaine', label: 'Semaine' }]} />
        <View style={{ flex: 1 }} />
        <IconBtn name="left" size={34} accessibilityLabel="Précédent" onPress={() => setOff((o) => o - 1)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Aujourd’hui" onPress={() => { tap('select'); setOff(0); }}><Txt style={{ fontSize: 13, textDecorationLine: 'underline', color: c.fg2 }}>{off ? 'Aujourd’hui' : mode === 'jour' ? fmtDay(day) : `S${Math.ceil(((+monday - +new Date(monday.getFullYear(), 0, 1)) / 864e5 + 1) / 7)}`}</Txt></Pressable>
        <IconBtn name="right" size={34} accessibilityLabel="Suivant" onPress={() => setOff((o) => o + 1)} />
      </View>

      {mode === 'jour' ? (
        <View style={{ gap: 12 }}>
          <Text numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 21, color: c.fg }}>{sameDay(day, now) ? 'Aujourd’hui · ' : ''}<Text style={{ color: c.fg3 }}>{fmtDayLong(day)}</Text></Text>
          <Panel pad={false}>
            {vs.map((v, i) => {
              const rows = dayMs.filter((m) => m.vehiculeId === v.id);
              const conflict = rows.some((m) => clashes(m, data.missions).length);
              return (
                <View key={v.id} style={{ flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2, backgroundColor: conflict ? (c.bad + '10') : 'transparent' }}>
                  <View style={{ width: 92 }}><Txt style={{ fontFamily: FONT.uiMedium, fontSize: 13.5 }} numberOfLines={1}>{v.nom}</Txt><Sub style={{ fontSize: 11.5 }}>{v.statut === 'entretien' ? 'En entretien' : v.statut === 'indisponible' ? 'Indisponible' : rows.length ? '' : 'Libre'}</Sub></View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {rows.map((m) => {
                      const cl = clientOf(data, m); const a = parseDate(m.debut) as Date; const b = parseDate(m.fin) || a; const clash = clashes(m, data.missions).length > 0;
                      return (
                        <Pressable key={m.id} testID={`pl-${m.id}`} accessibilityRole="button" onPress={() => { tap('select'); router.push(`/mission/${m.id}`); }} style={{ borderLeftWidth: 3, borderLeftColor: clash ? c.bad : statutColor(c, m.statut), paddingLeft: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: c.panel2 }}>
                          <Txt numberOfLines={1} style={{ fontSize: 13.5 }}>{m.titre}</Txt>
                          <Sub numberOfLines={1} style={{ fontSize: 12 }}>{sameDay(a, day) ? fmtTime(a) : fmtDay(a)} → {sameDay(b, day) ? fmtTime(b) : fmtDay(b)}{cl ? ` · ${cl.nom}` : ''}{clash ? ' · conflit' : ''}</Sub>
                        </Pressable>
                      );
                    })}
                    {!rows.length ? <View style={{ height: 1, backgroundColor: c.line2, marginTop: 10 }} /> : null}
                  </View>
                </View>
              );
            })}
          </Panel>
          <Panel>
            <Label>Qui est libre ce jour-là ?</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {free.length ? free.map((v) => <Chip key={v.id} text={v.nom} color={c.ok} />) : <Sub>Aucun véhicule libre.</Sub>}
            </View>
          </Panel>
          {dayMs.filter((m) => !m.vehiculeId).length ? <Panel><Label>Sans véhicule</Label>{dayMs.filter((m) => !m.vehiculeId).map((m) => <Pressable key={m.id} onPress={() => router.push(`/mission/${m.id}`)} style={{ marginTop: 6 }}><Txt>{m.titre}</Txt><Sub>{fmtTime(m.debut)} · {clientOf(data, m)?.nom || ''}</Sub></Pressable>)}</Panel> : null}
        </View>
      ) : (
        <Panel pad={false}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line2 }}>
            <View style={{ width: 84 }} />
            {days.map((d, i) => <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: sameDay(d, now) ? c.panel2 : 'transparent' }}><Label style={{ fontSize: 9.5 }}>{JOURS[i]}</Label><Mono style={{ fontSize: 12, color: sameDay(d, now) ? c.accent : c.fg }}>{d.getDate()}</Mono></View>)}
          </View>
          {vs.map((v, vi) => (
            <View key={v.id} style={{ flexDirection: 'row', minHeight: 54, borderTopWidth: vi ? 1 : 0, borderTopColor: c.line2 }}>
              <View style={{ width: 84, padding: 8, justifyContent: 'center' }}><Txt numberOfLines={2} style={{ fontSize: 12.5, fontFamily: FONT.uiMedium }}>{v.nom}</Txt></View>
              {days.map((d, i) => {
                const rows = ms.filter((m) => m.vehiculeId === v.id && on(m, d));
                return (
                  <View key={i} style={{ flex: 1, padding: 2, gap: 2, justifyContent: 'center', backgroundColor: sameDay(d, now) ? c.panel2 : 'transparent', borderLeftWidth: 1, borderLeftColor: c.line2 }}>
                    {rows.map((m) => { const clash = clashes(m, data.missions).length > 0; return <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.titre} onPress={() => router.push(`/mission/${m.id}`)} style={{ height: 18, borderRadius: 4, backgroundColor: clash ? c.bad : m.statut === 'proposition' || m.statut === 'nouvelle' ? 'transparent' : statutColor(c, m.statut), borderWidth: 1, borderColor: clash ? c.bad : statutColor(c, m.statut) }} />; })}
                    {rows.length > 1 && rows.some((m) => clashes(m, data.missions).length) ? <Text style={{ fontFamily: FONT.mono, fontSize: 8, color: c.bad, textAlign: 'center' }}>conflit</Text> : null}
                  </View>
                );
              })}
            </View>
          ))}
          {!ms.length ? <Empty>Aucune mission planifiée.</Empty> : null}
          <View style={{ flexDirection: 'row', gap: 10, padding: 10, flexWrap: 'wrap' }}>
            <Chip text="Confirmée" color={c.ok} small /><Chip text="En cours" color={c.info} small /><Chip text="Proposition" color={c.warn} small /><Chip text="Conflit" color={c.bad} small />
          </View>
        </Panel>
      )}
      <View style={{ height: GUTTER }} />
    </Screen>
  );
}
