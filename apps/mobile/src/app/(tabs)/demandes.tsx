import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { STATUTS, nextStatut, prevStatut, type Mission } from '@amane/shared';
import { useStore } from '@/store';
import { clientOf, vehicleOf, svcName } from '@/store/select';
import { useTheme, FONT, GUTTER, statutColor } from '@/theme';
import { Screen, Panel, Empty, Seg, Label, H1, Sub, Txt, Mono, Avatar, IconBtn, Btn } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SyncPill } from '@/components/SyncPill';
import { fmtDay, fmtTime, fmtE, toLocalInput } from '@/lib/format';
import { tap } from '@/lib/haptics';

export default function Demandes() {
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const save = useStore((s) => s.save); const setToast = useStore((s) => s.setToast);
  const [st, setSt] = useState<string>('ouvertes'); const [q, setQ] = useState(''); const [mine, setMine] = useState(false);
  const groups = STATUTS.filter((s) => (st === 'ouvertes' ? !['terminee', 'perdue'].includes(s.id) : st === 'toutes' ? true : s.id === st));
  const qq = q.toLowerCase().trim();
  const list = data.missions.filter((m) => (!mine || m.responsable === me?.id) && (!qq || [m.titre, clientOf(data, m)?.nom, m.lieu, vehicleOf(data, m)?.nom].join(' ').toLowerCase().includes(qq)));
  const move = async (m: Mission, to: string | null) => {
    if (!to) return; tap('success');
    await save('missions', { ...m, statut: to as Mission['statut'] }, 'Changer le statut');
    setToast(`${m.titre} → ${STATUTS.find((s) => s.id === to)?.label}`);
  };
  const newMission = async () => {
    const id = 'm_' + Date.now().toString(36); const a = new Date(); a.setDate(a.getDate() + 1); a.setHours(10, 0, 0, 0); const b = new Date(a); b.setHours(19);
    await save('missions', { id, titre: 'Nouvelle demande', clientId: '', service: 'location', vehiculeId: '', debut: toLocalInput(a), fin: toLocalInput(b), lieu: '', montant: '', acompte: '', statut: 'nouvelle', responsable: me?.id || 'amel', chauffeur: '', chauffeurId: '', programme: [], taches: [], commissions: [], devis: null, notes: '', paiement: 'non', contrat: { statut: 'a_rediger', caution: '', cautionStatut: 'aucune', pieces: { permis: false, passeport: false, domicile: false }, edlDepart: { fait: false, km: '', carburant: 'Plein', notes: '' }, edlRetour: { fait: false, km: '', carburant: 'Plein', notes: '' } } }, 'Créer la demande');
    router.push(`/mission/${id}?edit=1`);
  };
  return (
    <Screen testID="screen-demandes">
      <View style={{ paddingTop: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}><Label>{list.length} demande{list.length > 1 ? 's' : ''}</Label><H1>Demandes</H1></View>
        <SyncPill />
        <IconBtn name="plus" accessibilityLabel="Nouvelle demande" bg={c.fg} color={c.bg} testID="new-mission" onPress={() => void newMission()} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel, marginBottom: 10 }}>
        <Icon name="search" size={16} color={c.fg3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Titre, client, voiture, lieu…" placeholderTextColor={c.fg3} accessibilityLabel="Rechercher une demande" style={{ flex: 1, fontFamily: FONT.ui, fontSize: 15, color: c.fg, height: 44 }} autoCorrect={false} />
        <Pressable accessibilityRole="button" accessibilityState={{ selected: mine }} onPress={() => { tap('select'); setMine((v) => !v); }} hitSlop={6}><Text style={{ fontFamily: FONT.ui, fontSize: 12, color: mine ? c.fg : c.fg3, textDecorationLine: mine ? 'underline' : 'none' }}>À moi</Text></Pressable>
      </View>
      <Seg value={st} onChange={setSt} style={{ marginBottom: 6, marginHorizontal: -GUTTER, paddingHorizontal: GUTTER }} options={[{ id: 'ouvertes', label: 'Ouvertes' }, ...STATUTS.map((s) => ({ id: s.id, label: s.label, n: data.missions.filter((m) => m.statut === s.id).length })), { id: 'toutes', label: 'Toutes' }]} />
      {groups.map((g) => {
        const rows = list.filter((m) => m.statut === g.id).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
        if (!rows.length && st === 'ouvertes') return null;
        return (
          <View key={g.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 8, paddingHorizontal: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statutColor(c, g.id) }} />
              <Text style={{ fontFamily: FONT.display, fontSize: 20, color: c.fg }}>{g.label}</Text>
              <Mono style={{ color: c.fg3, fontSize: 12 }}>{rows.length}</Mono>
            </View>
            <Panel pad={false}>
              {rows.length ? rows.map((m, i) => {
                const cl = clientOf(data, m); const v = vehicleOf(data, m); const nxt = nextStatut(m.statut); const prv = prevStatut(m.statut);
                return (
                  <View key={m.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                    <Pressable testID={`mission-${m.id}`} accessibilityRole="button" onPress={() => { tap('select'); router.push(`/mission/${m.id}`); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? c.panel2 : 'transparent' })}>
                      <Avatar id={m.responsable} size={30} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt numberOfLines={1} style={{ fontFamily: FONT.uiMedium }}>{m.titre}</Txt>
                        <Sub numberOfLines={1}>{[cl?.nom, v?.nom || svcName(data, m.service), m.debut ? `${fmtDay(m.debut)} ${fmtTime(m.debut)}` : ''].filter(Boolean).join(' · ')}</Sub>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>{+(m.montant || 0) ? <Mono style={{ fontSize: 13 }}>{fmtE(m.montant)}</Mono> : null}<Icon name="right" size={14} color={c.fg3} /></View>
                    </Pressable>
                    {!['terminee', 'perdue'].includes(m.statut) ? (
                      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 12 }}>
                        {prv ? <Btn small kind="ghost" title={`← ${STATUTS.find((s) => s.id === prv)?.label}`} testID={`prev-${m.id}`} onPress={() => void move(m, prv)} /> : null}
                        <View style={{ flex: 1 }} />
                        {nxt ? <Btn small kind="primary" title={`${STATUTS.find((s) => s.id === nxt)?.label} →`} testID={`next-${m.id}`} onPress={() => void move(m, nxt)} /> : null}
                        {m.statut === 'proposition' || m.statut === 'nouvelle' ? <Btn small kind="danger" title="Perdue" onPress={() => void move(m, 'perdue')} /> : null}
                      </View>
                    ) : null}
                  </View>
                );
              }) : <Empty>Aucune demande {g.label.toLowerCase()}.</Empty>}
            </Panel>
          </View>
        );
      })}
      {!list.length ? <Empty style={{ marginTop: 30 }}>Aucune demande. Les demandes WhatsApp et du site arrivent ici.</Empty> : null}
    </Screen>
  );
}
