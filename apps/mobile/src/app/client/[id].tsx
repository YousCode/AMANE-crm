import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_STATUTS, CLIENT_TAGS, LANGUES, CANAUX, TEAM, validate, type Client } from '@amane/shared';
import { useStore } from '@/store';
import { byId, convByClient, helloTxt, label, vehicleOf } from '@/store/select';
import { useTheme, FONT } from '@/theme';
import { Screen, Panel, Label, Sub, Txt, Btn, Seg, Input, Chip, StatutChip, Empty, Row, Mono } from '@/components/ui';
import { ContactBar } from '@/components/ContactBar';
import { fmtDay, fmtDate, fmtE, fmtPhone } from '@/lib/format';
import { tap } from '@/lib/haptics';

const tagsOf = (t: unknown): string[] => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t as object).filter((k) => (t as Record<string, boolean>)[k]) : []);

export default function ClientScreen() {
  const { id, edit: edit0 } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data); const save = useStore((s) => s.save); const remove = useStore((s) => s.remove); const setToast = useStore((s) => s.setToast);
  const c0 = byId(data.clients, String(id));
  const [edit, setEdit] = useState(edit0 === '1'); const [d, setD] = useState<Client | null>(c0); const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (c0 && !edit) setD(c0); }, [c0, edit]);
  if (!c0 || !d) return <Screen title="Client" back><Empty>Fiche introuvable.</Empty></Screen>;
  const set = (p: Partial<Client>) => setD((x) => (x ? { ...x, ...p } : x));
  const cv = convByClient(data, d); const tags = tagsOf(d.tags);
  const missions = data.missions.filter((m) => m.clientId === d.id).sort((a, b) => String(b.debut).localeCompare(String(a.debut)));
  const ca = missions.filter((m) => ['confirmee', 'encours', 'terminee'].includes(m.statut)).reduce((s, m) => s + (+(m.montant || 0)), 0);
  const saveAll = async () => {
    const r = validate.client(d); setErrors(r.errors); if (!r.ok) { tap('error'); return; }
    setBusy(true); try { await save('clients', d); setEdit(false); setToast('Fiche enregistrée.'); tap('success'); } catch (e) { setToast(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); }
  };
  const field = (k: string, val?: string | null) => (val ? <View style={{ flexDirection: 'row', gap: 12 }}><Label style={{ width: 96, paddingTop: 4 }}>{k}</Label><Txt style={{ flex: 1 }} selectable>{val}</Txt></View> : null);
  return (
    <Screen testID="screen-client" title={d.nom} eyebrow={[label(CLIENT_STATUTS, d.statut), d.langue, d.pays].filter(Boolean).join(' · ')} back right={edit ? <Btn small kind="primary" title="Enregistrer" loading={busy} onPress={() => void saveAll()} /> : <Btn small title="Modifier" onPress={() => setEdit(true)} />}>
      <ContactBar tel={d.tel} waText={helloTxt(d)} email={d.email} lieu={d.hotel} extra={cv ? <Btn small title="Fil WhatsApp" icon="messages" onPress={() => router.push(`/conv/${encodeURIComponent(cv.id)}`)} /> : null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
        <Chip text={label(CLIENT_STATUTS, d.statut)} color={d.statut === 'vip' ? c.accent : c.fg2} />
        {tags.map((t) => <Chip key={t} text={label(CLIENT_TAGS, t)} dot={false} />)}
        {d.canal ? <Chip text={d.canal} dot={false} /> : null}
      </View>
      {edit ? (
        <Panel style={{ gap: 12 }}>
          <Input label="Nom" value={d.nom} onChangeText={(nom) => set({ nom })} error={errors.nom} />
          <Input label="Téléphone" value={d.tel || ''} onChangeText={(tel) => set({ tel })} keyboardType="phone-pad" error={errors.tel} />
          <Input label="E-mail" value={d.email || ''} onChangeText={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
          <Label>Langue</Label><Seg value={d.langue || 'FR'} onChange={(langue) => set({ langue: langue as Client['langue'] })} options={LANGUES.map((l) => ({ id: l, label: l }))} />
          <Label>Statut</Label><Seg value={d.statut || 'prospect'} onChange={(statut) => set({ statut: statut as Client['statut'] })} options={CLIENT_STATUTS.map((s) => ({ id: s.id, label: s.label }))} />
          <Label>Étiquettes</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{CLIENT_TAGS.map((t) => <Btn key={t.id} small kind={tags.includes(t.id) ? 'primary' : 'secondary'} title={t.label} onPress={() => set({ tags: tags.includes(t.id) ? tags.filter((x) => x !== t.id) : [...tags, t.id] })} />)}</View>
          <Input label="Pays" value={d.pays || ''} onChangeText={(pays) => set({ pays })} />
          <Input label="Hôtel / adresse à Paris" value={d.hotel || ''} onChangeText={(hotel) => set({ hotel })} />
          <Label>Canal d’arrivée</Label><Seg value={d.canal || ''} onChange={(canal) => set({ canal })} options={CANAUX.map((x) => ({ id: x, label: x }))} />
          <Label>Responsable</Label><Seg value={d.responsable || 'amel'} onChange={(responsable) => set({ responsable: responsable as Client['responsable'] })} options={TEAM.map((x) => ({ id: x.id, label: x.nom }))} />
          <Input label="Préférences" value={d.prefs || ''} onChangeText={(prefs) => set({ prefs })} multiline />
          <Input label="Allergies" value={d.allergies || ''} onChangeText={(allergies) => set({ allergies })} />
          <Input label="Marques préférées" value={d.marques || ''} onChangeText={(marques) => set({ marques })} />
          <Input label="Attentions particulières (une par ligne)" value={(d.attentions || []).join('\n')} onChangeText={(v) => set({ attentions: v.split('\n').map((x) => x.trim()).filter(Boolean) })} multiline />
          <Input label="Entourage (Nom — lien, une par ligne)" value={(d.entourage || []).map((e) => [e.nom, e.lien].filter(Boolean).join(' — ')).join('\n')} onChangeText={(v) => set({ entourage: v.split('\n').filter((x) => x.trim()).map((l) => { const [nom, lien] = l.split('—').map((x) => x.trim()); return { nom, lien }; }) })} multiline />
          <Input label="Dates importantes (AAAA-MM-JJ — libellé, une par ligne)" value={(d.datesImportantes || []).map((e) => `${e.date} — ${e.label}`).join('\n')} onChangeText={(v) => set({ datesImportantes: v.split('\n').filter((x) => x.trim()).map((l) => { const [date, lbl] = l.split('—').map((x) => x.trim()); return { date, label: lbl || '' }; }) })} multiline />
          <Input label="Notes" value={d.notes || ''} onChangeText={(notes) => set({ notes })} multiline />
          <Btn kind="danger" title="Supprimer la fiche" icon="trash" onPress={() => { void remove('clients', d.id); router.back(); }} />
        </Panel>
      ) : (
        <View style={{ gap: 12 }}>
          <Panel style={{ gap: 8 }}>
            {field('Téléphone', fmtPhone(d.tel) || d.tel)}{field('E-mail', d.email)}{field('Hôtel', d.hotel)}{field('Pays', d.pays)}{field('Canal', d.canal)}{field('Responsable', TEAM.find((x) => x.id === d.responsable)?.nom)}{field('Préférences', d.prefs)}
            {d.allergies ? <View style={{ flexDirection: 'row', gap: 12 }}><Label style={{ width: 96, paddingTop: 4 }} color={c.warn}>Allergies</Label><Txt style={{ flex: 1, color: c.warn }}>{d.allergies}</Txt></View> : null}
            {field('Marques', d.marques)}
            {d.attentions?.length ? <View style={{ flexDirection: 'row', gap: 12 }}><Label style={{ width: 96, paddingTop: 4 }}>Attentions</Label><View style={{ flex: 1 }}>{d.attentions.map((a, i) => <Txt key={i}>· {a}</Txt>)}</View></View> : null}
            {d.entourage?.length ? <View style={{ flexDirection: 'row', gap: 12 }}><Label style={{ width: 96, paddingTop: 4 }}>Entourage</Label><View style={{ flex: 1 }}>{d.entourage.map((e, i) => <Txt key={i}>{e.nom}{e.lien ? <Sub> — {e.lien}</Sub> : null}</Txt>)}</View></View> : null}
            {d.datesImportantes?.length ? <View style={{ flexDirection: 'row', gap: 12 }}><Label style={{ width: 96, paddingTop: 4 }}>Dates</Label><View style={{ flex: 1 }}>{d.datesImportantes.map((e, i) => <Txt key={i}>{fmtDate(e.date)} · {e.label}</Txt>)}</View></View> : null}
            {d.notes ? <View style={{ padding: 12, borderRadius: 10, backgroundColor: c.panel2 }}><Label>Notes</Label><Txt style={{ marginTop: 4 }}>{d.notes}</Txt></View> : null}
          </Panel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Panel style={{ flex: 1 }}><Label>Chiffre</Label><Mono style={{ fontFamily: FONT.display, fontSize: 26, marginTop: 6 }}>{fmtE(ca)}</Mono></Panel>
            <Panel style={{ flex: 1 }}><Label>Missions</Label><Mono style={{ fontFamily: FONT.display, fontSize: 26, marginTop: 6 }}>{missions.length}</Mono></Panel>
          </View>
          <Panel pad={false}>
            {missions.length ? missions.map((m, i) => <Row key={m.id} last={i === missions.length - 1} title={m.titre} sub={[fmtDay(m.debut), vehicleOf(data, m)?.nom, +(m.montant || 0) ? fmtE(m.montant) : ''].filter(Boolean).join(' · ')} right={<StatutChip statut={m.statut} small />} onPress={() => router.push(`/mission/${m.id}`)} />) : <Empty>Aucune demande pour ce client.</Empty>}
          </Panel>
        </View>
      )}
    </Screen>
  );
}
