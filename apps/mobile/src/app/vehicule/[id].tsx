import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { JOURNAL_T, type Vehicule } from '@amane/shared';
import type { JournalEntry } from '@/types';
import { useStore } from '@/store';
import { byId, label } from '@/store/select';
import { useTheme, FONT } from '@/theme';
import { Screen, Panel, Label, Sub, Txt, Btn, Seg, Input, Mono, Empty, Chip } from '@/components/ui';
import { fmtDate, fmtE, uid } from '@/lib/format';
import { photoUrl } from '@/lib/api';
import { takeAndUpload } from '@/lib/photo';
import { tap } from '@/lib/haptics';

export default function VehiculeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const save = useStore((s) => s.save); const setToast = useStore((s) => s.setToast);
  const v = byId(data.vehicules, String(id));
  const [add, setAdd] = useState(false); const [e, setE] = useState<JournalEntry>({ dt: new Date().toISOString().slice(0, 10), type: 'entretien', notes: '', cout: '', km: '', photos: [] });
  if (!v) return <Screen title="Véhicule" back><Empty>Véhicule introuvable.</Empty></Screen>;
  const commit = (patch: Partial<Vehicule>, lbl: string) => save('vehicules', { ...v, ...patch }, lbl).catch((err) => setToast(err instanceof Error ? err.message : 'Enregistrement impossible.'));
  const journal = [...((v.journal || []) as JournalEntry[])].sort((a, b) => String(b.dt).localeCompare(String(a.dt)));
  const addEntry = async () => {
    if (!String(e.notes || '').trim()) { setToast('Décrivez l’intervention.'); return; }
    const entry: JournalEntry = { ...e, id: uid(), par: me?.id, cout: e.cout === '' || e.cout == null ? '' : +e.cout, km: e.km === '' || e.km == null ? '' : +e.km };
    await commit({ journal: [...(v.journal || []), entry], km: e.km !== '' && e.km != null && +e.km > +(v.km || 0) ? +e.km : v.km }, 'Journal du véhicule');
    setAdd(false); setE({ dt: new Date().toISOString().slice(0, 10), type: 'entretien', notes: '', cout: '', km: '', photos: [] }); tap('success');
  };
  const photo = async () => { try { const r = await takeAndUpload('camera'); if (r) setE((x) => ({ ...x, photos: [...(x.photos || []), r.id] })); } catch (err) { setToast(err instanceof Error ? err.message : 'Photo impossible.'); } };
  const cost = journal.reduce((s, j) => s + (+(j.cout || 0)), 0);
  return (
    <Screen testID="screen-vehicule" title={v.nom} eyebrow={[v.categorie, v.plaque, v.couleur].filter(Boolean).join(' · ')} back right={<Btn small kind="primary" title="Journal +" icon="plus" testID="journal-add" onPress={() => setAdd((x) => !x)} />}>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <Panel style={{ flex: 1 }}><Label>Kilométrage</Label><Mono style={{ fontFamily: FONT.display, fontSize: 24, marginTop: 6 }}>{v.km ? `${v.km} km` : '—'}</Mono></Panel>
        <Panel style={{ flex: 1 }}><Label>Tarif / jour</Label><Mono style={{ fontFamily: FONT.display, fontSize: 24, marginTop: 6 }}>{fmtE(v.tarifJour)}</Mono></Panel>
      </View>
      <Panel style={{ gap: 8, marginBottom: 12 }}>
        <Label>Statut</Label>
        <Seg value={v.statut || 'disponible'} onChange={(statut) => void commit({ statut }, 'Statut du véhicule')} options={[{ id: 'disponible', label: 'Disponible' }, { id: 'entretien', label: 'En entretien' }, { id: 'indisponible', label: 'Indisponible' }]} />
        <Sub>Prochaine révision : {v.revision ? fmtDate(v.revision) : '—'}</Sub>
        <Sub>Loyer {fmtE(v.loyerMois)} · charges {fmtE(v.chargesMois)} / mois</Sub>
        {v.notes ? <Txt>{v.notes}</Txt> : null}
      </Panel>
      {add ? (
        <Panel style={{ gap: 10, marginBottom: 12, borderColor: c.accent }}>
          <Label color={c.accent}>Nouvelle entrée au journal</Label>
          <Seg value={e.type} onChange={(type) => setE({ ...e, type })} options={JOURNAL_T.map((x) => ({ id: x.id, label: x.label }))} />
          <Input label="Description" value={e.notes || ''} onChangeText={(notes) => setE({ ...e, notes })} multiline testID="journal-text" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input style={{ flex: 1 }} label="Date" value={e.dt} onChangeText={(dt) => setE({ ...e, dt })} />
            <Input style={{ flex: 1 }} label="Coût (€)" value={String(e.cout ?? '')} onChangeText={(cout) => setE({ ...e, cout })} keyboardType="decimal-pad" />
            <Input style={{ flex: 1 }} label="Km" value={String(e.km ?? '')} onChangeText={(km) => setE({ ...e, km })} keyboardType="number-pad" />
          </View>
          {e.photos?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{e.photos.map((pid: string) => <Image key={pid} source={{ uri: photoUrl(pid) }} style={{ width: 96, height: 72, borderRadius: 8, backgroundColor: c.stone }} contentFit="cover" />)}</ScrollView> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small title="Photo" icon="camera" onPress={() => void photo()} />
            <View style={{ flex: 1 }} />
            <Btn small kind="ghost" title="Annuler" onPress={() => setAdd(false)} />
            <Btn small kind="primary" title="Enregistrer" testID="journal-save" onPress={() => void addEntry()} />
          </View>
        </Panel>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 }}><Label>Journal · {journal.length} entrée{journal.length > 1 ? 's' : ''}</Label><Sub>coûts : {fmtE(cost)}</Sub></View>
      <Panel pad={false}>
        {journal.length ? journal.map((j, i) => (
          <View key={j.id || i} style={{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Chip small text={label(JOURNAL_T, j.type)} color={j.type === 'dommage' || j.type === 'pv' ? c.bad : c.fg2} /><Sub>{fmtDate(j.dt)}{j.km ? ` · ${j.km} km` : ''}</Sub><View style={{ flex: 1 }} />{+(j.cout || 0) ? <Mono style={{ fontSize: 13 }}>{fmtE(j.cout)}</Mono> : null}</View>
            <Txt>{j.notes}</Txt>
            {j.photos?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 4 }}>{j.photos.map((pid: string) => <Image key={pid} source={{ uri: photoUrl(pid) }} style={{ width: 96, height: 72, borderRadius: 8, backgroundColor: c.stone }} contentFit="cover" />)}</ScrollView> : null}
          </View>
        )) : <Empty>Aucune entrée. Entretiens, dommages, PV : tout se note ici avec une photo.</Empty>}
      </Panel>
    </Screen>
  );
}
