import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { STATUTS, CONTRAT_ST, CAUTION_ST, PROG_TYPES, TEAM, DEVIS_ST, nextStatut, prevStatut, devisTotals, durDays, tplTasks, clashes, chClashes, validate, docLang, firstName, t as tr, type Mission } from '@amane/shared';
import { useStore } from '@/store';
import { contratOf } from '@/types';
import { byId, clientOf, vehicleOf, chauffeurOf, svcName, chauffeurs, vehiclesSorted, convByClient, helloTxt, label } from '@/store/select';
import { useTheme, FONT, statutColor } from '@/theme';
import { Screen, Panel, Section, Sub, Txt, Label, Mono, Btn, Seg, Check, Input, Chip, StatutChip, Empty, Avatar } from '@/components/ui';
import { ContactBar } from '@/components/ContactBar';
import { Icon } from '@/components/Icon';
import { fmtDT, fmtDay, fmtTime, fmtE, fmtE2, fmtDate } from '@/lib/format';
import { api, ApiError, photoUrl } from '@/lib/api';
import { takeAndUpload } from '@/lib/photo';
import { waUrl, open } from '@/lib/links';
import { tap } from '@/lib/haptics';

type Tab = 'main' | 'devis' | 'prog' | 'taches' | 'contrat';

export default function MissionScreen() {
  const { id, tab: tab0, edit: edit0 } = useLocalSearchParams<{ id: string; tab?: string; edit?: string }>();
  const { c } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const save = useStore((s) => s.save); const remove = useStore((s) => s.remove); const setToast = useStore((s) => s.setToast);
  const m0 = byId(data.missions, String(id));
  const [tab, setTab] = useState<Tab>((tab0 as Tab) || 'main');
  const [edit, setEdit] = useState(edit0 === '1'); const [d, setD] = useState<Mission | null>(m0); const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (m0 && !edit) setD(m0); }, [m0, edit]);
  if (!m0 || !d) return <Screen title="Demande" back><Empty>Demande introuvable.</Empty></Screen>;
  const cl = clientOf(data, d); const v = vehicleOf(data, d); const ch = chauffeurOf(data, d); const cv = convByClient(data, cl);
  const kc = contratOf(d);
  const set = (patch: Partial<Mission>) => setD((x) => (x ? { ...x, ...patch } : x));
  const commit = async (patch: Partial<Mission>, lbl = 'Enregistrer la demande') => {
    const next = { ...(edit ? d : m0), ...patch }; setD(next);
    try { await save('missions', next, lbl); } catch (e) { setToast(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
  };
  const saveAll = async () => {
    const r = validate.mission(d); setErrors(r.errors); if (!r.ok) { tap('error'); return; }
    setBusy(true); try { await save('missions', d); setEdit(false); setToast('Demande enregistrée.'); tap('success'); } catch (e) { setToast(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); }
  };
  const move = (to: string | null) => { if (to) { tap('success'); void commit({ statut: to as Mission['statut'] }, 'Changer le statut'); } };
  const vc = clashes(d, data.missions); const cc = chClashes(d, data.missions);
  const tot = devisTotals(d.devis); const nDays = durDays(d);
  const L = docLang(cl);
  const shareEspace = async () => {
    try {
      const r = await api<{ token: string; url: string }>('POST', `/api/missions/${d.id}/espace`);
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
      const url = `${base}/espace/${r.token}`;
      const txt = tr(L, 'quick.espace_lien', { prenom: firstName(cl?.nom || ''), lien: url });
      const wa = waUrl(cl?.tel, txt);
      if (wa) await open(wa); else if (Platform.OS !== 'web') await Share.share({ message: txt }); else setToast(url);
    } catch (e) { setToast(e instanceof ApiError ? e.message : 'Lien indisponible.'); }
  };
  const shareDevis = async () => {
    try {
      const r = await api<{ token: string; url: string }>('POST', `/api/devis/${d.id}/share`);
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
      const txt = tr(L, 'quick.devis_lien', { prenom: firstName(cl?.nom || ''), numero: d.devis?.numero || '', lien: base + r.url });
      const wa = waUrl(cl?.tel, txt); if (wa) await open(wa); else setToast(base + r.url);
    } catch (e) { setToast(e instanceof ApiError ? e.message : 'Lien indisponible.'); }
  };
  const edlPhoto = async (key: 'edlDepart' | 'edlRetour') => {
    try {
      const r = await takeAndUpload('camera'); if (!r) return;
      const k = contratOf(d); const e = { ...(k[key] || { fait: false, km: '', carburant: 'Plein', notes: '' }) }; e.photos = [...(e.photos || []), r.id]; k[key] = e;
      await commit({ contrat: k }, 'Photo d’état des lieux'); tap('success');
    } catch (e) { setToast(e instanceof Error ? e.message : 'Photo impossible.'); }
  };
  const toggleTask = (i: number) => { const taches = (d.taches || []).map((x, j) => (j === i ? { ...x, fait: !x.fait } : x)); void commit({ taches }, 'Tâche'); };
  const right = edit ? <Btn small kind="primary" title="Enregistrer" loading={busy} testID="save-mission" onPress={() => void saveAll()} /> : <Btn small title="Modifier" testID="edit-mission" onPress={() => setEdit(true)} />;

  return (
    <Screen testID="screen-mission" title={d.titre || 'Demande sans titre'} eyebrow={`${label(STATUTS, d.statut)} · ${svcName(data, d.service)}`} back right={right}>
      {cl || d.lieu ? <ContactBar tel={cl?.tel} waText={helloTxt(cl)} lieu={d.lieu} compact extra={cv ? <Btn small title="Fil WhatsApp" icon="messages" onPress={() => router.push(`/conv/${encodeURIComponent(cv.id)}`)} /> : null} /> : null}
      <Seg<Tab> value={tab} onChange={setTab} style={{ marginVertical: 10 }} options={[{ id: 'main', label: 'Demande' }, { id: 'devis', label: 'Devis & facture' }, { id: 'prog', label: 'Programme', n: d.programme?.length || undefined }, { id: 'taches', label: 'Tâches', n: (d.taches || []).filter((x) => !x.fait).length || undefined }, { id: 'contrat', label: 'Contrat & dossier' }]} />

      {tab === 'main' ? (
        <View style={{ gap: 12 }}>
          {vc.length ? <Panel style={{ borderColor: c.bad }}><Txt style={{ color: c.bad }}>Ce véhicule est déjà réservé sur ce créneau : {vc.map((o) => `${o.titre} (${fmtDT(o.debut)})`).join(', ')}.</Txt></Panel> : null}
          {cc.length ? <Panel style={{ borderColor: c.bad }}><Txt style={{ color: c.bad }}>Ce chauffeur est déjà pris sur ce créneau : {cc.map((o) => o.titre).join(', ')}.</Txt></Panel> : null}
          <Panel>
            <Label>Statut</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {STATUTS.map((s) => <Pressable key={s.id} testID={`st-${s.id}`} accessibilityRole="button" accessibilityState={{ selected: d.statut === s.id }} onPress={() => move(s.id)} style={{ height: 32, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: d.statut === s.id ? c.fg : c.line2, backgroundColor: d.statut === s.id ? c.fg : c.panel, flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statutColor(c, s.id) }} /><Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: d.statut === s.id ? c.bg : c.fg2 }}>{s.label}</Text></Pressable>)}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {prevStatut(d.statut) ? <Btn small kind="ghost" title={`← ${label(STATUTS, prevStatut(d.statut))}`} onPress={() => move(prevStatut(d.statut))} /> : null}
              <View style={{ flex: 1 }} />
              {nextStatut(d.statut) ? <Btn small kind="primary" title={`${label(STATUTS, nextStatut(d.statut))} →`} testID="next-statut" onPress={() => move(nextStatut(d.statut))} /> : null}
            </View>
          </Panel>
          <Panel style={{ gap: 12 }}>
            {edit ? (<>
              <Input label="Titre" value={d.titre} onChangeText={(titre) => set({ titre })} error={errors.titre} testID="f-titre" />
              <Label>Client</Label>
              <Seg value={d.clientId || ''} onChange={(clientId) => set({ clientId })} options={[{ id: '', label: '— aucun —' }, ...data.clients.map((x) => ({ id: x.id, label: x.nom }))]} />
              <Label>Service</Label>
              <Seg value={d.service || 'location'} onChange={(service) => set({ service, taches: d.taches?.length ? d.taches : tplTasks({ ...d, service }) })} options={data.services.map((x) => ({ id: x.id, label: x.nom }))} />
              <Label>Véhicule</Label>
              <Seg value={d.vehiculeId || ''} onChange={(vehiculeId) => set({ vehiculeId })} options={[{ id: '', label: '— aucun —' }, ...vehiclesSorted(data).map((x) => ({ id: x.id, label: x.nom + (clashes({ ...d, vehiculeId: x.id }, data.missions).length ? ' · pris' : '') }))]} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Input style={{ flex: 1 }} label="Début (AAAA-MM-JJTHH:mm)" value={d.debut} onChangeText={(debut) => set({ debut })} error={errors.debut} autoCapitalize="none" />
                <Input style={{ flex: 1 }} label="Fin" value={d.fin} onChangeText={(fin) => set({ fin })} error={errors.fin} autoCapitalize="none" />
              </View>
              <Input label="Lieu de prise en charge" value={d.lieu} onChangeText={(lieu) => set({ lieu })} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Input style={{ flex: 1 }} label="Montant TTC (€)" value={String(d.montant ?? '')} onChangeText={(montant) => set({ montant })} keyboardType="decimal-pad" error={errors.montant} />
                <Input style={{ flex: 1 }} label="Acompte (€)" value={String(d.acompte ?? '')} onChangeText={(acompte) => set({ acompte })} keyboardType="decimal-pad" />
              </View>
              <Label>Responsable</Label>
              <Seg value={d.responsable || 'amel'} onChange={(responsable) => set({ responsable: responsable as Mission['responsable'] })} options={TEAM.map((x) => ({ id: x.id, label: x.nom }))} />
              <Label>Chauffeur</Label>
              <Seg value={d.chauffeurId || ''} onChange={(chauffeurId) => set({ chauffeurId })} options={[{ id: '', label: '— aucun —' }, ...chauffeurs(data).map((x) => ({ id: x.id, label: x.nom }))]} />
              <Input label="Notes internes" value={d.notes} onChangeText={(notes) => set({ notes })} multiline />
              <Btn kind="danger" title="Supprimer la demande" icon="trash" onPress={() => { void remove('missions', d.id); router.back(); }} />
            </>) : (<>
              {[['Client', cl?.nom || '—'], ['Service', svcName(data, d.service)], ['Voiture', v?.nom || '—'], ['Du', d.debut ? fmtDT(d.debut) : '—'], ['Au', d.fin ? fmtDT(d.fin) : '—'], ['Durée', nDays ? `${nDays} jour${nDays > 1 ? 's' : ''}` : '—'], ['Lieu', d.lieu || '—'], ['Chauffeur', ch?.nom || d.chauffeur || '—'], ['Montant', +(d.montant || 0) ? fmtE(d.montant) : '—'], ['Acompte', +(d.acompte || 0) ? fmtE(d.acompte) : '—'], ['Responsable', TEAM.find((x) => x.id === d.responsable)?.nom || d.responsable]].map(([k, val]) => (
                <View key={k} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><Label style={{ width: 96, paddingTop: 4 }}>{k}</Label><Txt style={{ flex: 1 }} selectable>{val}</Txt></View>
              ))}
              {v && d.debut ? <Sub>Repère : {nDays} jour{nDays > 1 ? 's' : ''} × {fmtE(v.tarifJour)} = <Mono style={{ fontSize: 12.5, color: c.fg3 }}>{fmtE(nDays * (+(v.tarifJour || 0)))}</Mono> au tarif {v.nom}.</Sub> : null}
              {d.notes ? <View style={{ padding: 12, borderRadius: 10, backgroundColor: c.panel2 }}><Label>Notes</Label><Txt style={{ marginTop: 4 }}>{d.notes}</Txt></View> : null}
              {cv?.aiSummary ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}><Icon name="spark" size={14} color={c.accent} /><Sub style={{ flex: 1 }}>{cv.aiSummary}</Sub></View> : null}
            </>)}
          </Panel>
          {cl ? (
            <Panel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={cl.nom} size={36} dark />
                <View style={{ flex: 1 }}><Txt style={{ fontFamily: FONT.uiMedium }}>{cl.nom}</Txt><Sub>{[cl.langue, cl.pays, cl.hotel].filter(Boolean).join(' · ')}</Sub></View>
                <Btn small title="Fiche" onPress={() => router.push(`/client/${cl.id}`)} />
              </View>
              {cl.prefs ? <Sub style={{ marginTop: 8 }}>Préférences : {cl.prefs}</Sub> : null}
              {cl.allergies ? <Sub style={{ color: c.warn }}>Allergies : {cl.allergies}</Sub> : null}
            </Panel>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} title="Espace client" icon="link" testID="share-espace" onPress={() => void shareEspace()} />
            {ch?.tel ? <Btn style={{ flex: 1 }} title={`Appeler ${ch.nom.split(' ')[0]}`} icon="phone" onPress={() => void open(`tel:+${String(ch.tel).replace(/\D/g, '')}`)} /> : null}
          </View>
        </View>
      ) : null}

      {tab === 'devis' ? (
        <View style={{ gap: 12 }}>
          {d.devis && d.devis.lignes?.length ? (<>
            <Panel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}><Label>Devis</Label><Text style={{ fontFamily: FONT.display, fontSize: 24, color: c.fg, marginTop: 4 }}>{d.devis.numero || 'Brouillon'}</Text><Sub>{d.devis.date ? fmtDate(d.devis.date) : ''}{d.devis.acceptedAt ? ` · accepté le ${fmtDate(d.devis.acceptedAt)}` : d.devis.vuAt ? ` · vu le ${fmtDate(d.devis.vuAt)}` : ''}</Sub></View>
                <Chip text={label(DEVIS_ST, d.devis.statut || 'brouillon')} color={d.devis.statut === 'accepte' ? c.ok : d.devis.statut === 'refuse' ? c.bad : c.fg2} />
              </View>
              <View style={{ marginTop: 14, gap: 8 }}>
                {d.devis.lignes.map((l, i) => <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline' }}><Txt style={{ flex: 1, fontSize: 14 }}>{l.d}</Txt><Sub>{l.q} {l.u}</Sub><Mono style={{ fontSize: 13 }}>{fmtE2(+l.q * +l.pu)}</Mono></View>)}
                <View style={{ height: 1, backgroundColor: c.line2, marginVertical: 4 }} />
                {[['Total HT', tot.ht], tot.rem ? ['Remise', -tot.rem] : null, [`TVA ${tot.rate} %`, tot.tva], ['Total TTC', tot.ttc], ['Déjà réglé', tot.paid], ['Reste à payer', tot.solde]].filter(Boolean).map((r) => { const [k, val] = r as [string, number]; const strong = k === 'Total TTC' || k === 'Reste à payer'; return <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt style={{ fontFamily: strong ? FONT.uiMedium : FONT.ui, fontSize: 14 }}>{k}</Txt><Mono style={{ fontSize: strong ? 15 : 13, color: k === 'Reste à payer' && val > 0 ? c.bad : c.fg }}>{fmtE2(val)}</Mono></View>; })}
              </View>
            </Panel>
            {d.devis.paiements?.length ? <Panel><Label>Règlements</Label>{d.devis.paiements.map((p, i) => <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}><Sub>{fmtDate(p.date)} · {p.moyen}</Sub><Mono style={{ fontSize: 13 }}>{fmtE2(p.montant)}</Mono></View>)}</Panel> : null}
            {d.devis.factureNumero ? <Panel><Label>Facture</Label><Txt style={{ marginTop: 4 }}>{d.devis.factureNumero} · {fmtDate(d.devis.factureDate)}</Txt></Panel> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn style={{ flex: 1 }} kind="primary" title="Envoyer le lien du devis" icon="wa" testID="share-devis" onPress={() => void shareDevis()} />
            </View>
          </>) : <Empty>Aucun devis. Les devis se rédigent depuis le back-office ; ils apparaissent ici une fois créés.</Empty>}
        </View>
      ) : null}

      {tab === 'prog' ? (
        <Panel pad={false}>
          {d.programme?.length ? [...d.programme].sort((a, b) => String(a.dt).localeCompare(String(b.dt))).map((p, i) => {
            const pt = byId(data.partenaires, p.partenaireId);
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                <View style={{ width: 54 }}><Mono style={{ fontSize: 13 }}>{fmtTime(p.dt)}</Mono><Sub style={{ fontSize: 11 }}>{fmtDay(p.dt)}</Sub></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontFamily: FONT.uiMedium }}>{label(PROG_TYPES, p.type)}{pt ? ` — ${pt.nom}` : ''}</Txt>
                  {p.lieu ? <Sub>{p.lieu}</Sub> : null}
                  {p.client ? <Txt style={{ fontSize: 13.5, color: c.fg2 }}>{p.client}</Txt> : null}
                  {p.notes ? <Sub style={{ color: c.warn }}>Interne : {p.notes}</Sub> : null}
                  {pt || p.lieu ? <ContactBar tel={pt?.tel} lieu={p.lieu || pt?.adresse} compact /> : null}
                </View>
              </View>
            );
          }) : <Empty>Programme vide. Les étapes se composent depuis le back-office.</Empty>}
        </Panel>
      ) : null}

      {tab === 'taches' ? (
        <Panel>
          {d.taches?.length ? d.taches.map((x, i) => <Check key={i} testID={`task-${i}`} checked={!!x.fait} label={x.t} sub={`${TEAM.find((u) => u.id === x.resp)?.nom || x.resp} · ${fmtDay(x.due)}`} onToggle={() => toggleTask(i)} />) : <Empty>Aucune tâche.</Empty>}
          <Btn small title="Tâches du modèle" icon="plus" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => void commit({ taches: [...(d.taches || []), ...tplTasks(d).filter((t0) => !(d.taches || []).some((x) => x.t === t0.t))] }, 'Tâches')} />
        </Panel>
      ) : null}

      {tab === 'contrat' ? (
        <View style={{ gap: 12 }}>
          <Panel style={{ gap: 10 }}>
            <Label>Contrat</Label>
            <Seg value={kc.statut} onChange={(statut) => void commit({ contrat: { ...kc, statut: statut as Mission['contrat'] extends infer C ? C extends { statut?: infer S } ? S : never : never } })} options={CONTRAT_ST.map((x) => ({ id: x.id, label: x.label }))} />
            <Label>Caution</Label>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Input style={{ width: 120 }} value={String(kc.caution ?? '')} onChangeText={(caution) => set({ contrat: { ...kc, caution } })} onBlur={() => void commit({ contrat: d.contrat })} keyboardType="decimal-pad" placeholder="€" />
              <Seg value={kc.cautionStatut} onChange={(cautionStatut) => void commit({ contrat: { ...kc, cautionStatut: cautionStatut as typeof kc.cautionStatut } })} options={CAUTION_ST.map((x) => ({ id: x.id, label: x.label }))} />
            </View>
            <Label>Pièces</Label>
            {(['permis', 'passeport', 'domicile'] as const).map((k) => <Check key={k} checked={!!kc.pieces[k]} label={k === 'permis' ? 'Permis de conduire' : k === 'passeport' ? 'Passeport / pièce d’identité' : 'Justificatif de domicile'} onToggle={() => void commit({ contrat: { ...kc, pieces: { ...kc.pieces, [k]: !kc.pieces[k] } } })} />)}
          </Panel>
          {(['edlDepart', 'edlRetour'] as const).map((k) => {
            const e = kc[k];
            return (
              <Panel key={k} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><Label style={{ flex: 1 }}>{k === 'edlDepart' ? 'État des lieux départ' : 'État des lieux retour'}</Label>{e.fait ? <Chip text="Fait" color={c.ok} /> : null}</View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Input style={{ flex: 1 }} label="Kilométrage" value={String(e.km ?? '')} onChangeText={(km) => set({ contrat: { ...kc, [k]: { ...e, km } } })} onBlur={() => void commit({ contrat: d.contrat })} keyboardType="number-pad" />
                  <View style={{ flex: 1.4, gap: 5 }}><Label>Carburant</Label><Seg value={e.carburant || 'Plein'} onChange={(carburant) => void commit({ contrat: { ...kc, [k]: { ...e, carburant } } })} options={['1/4', '1/2', '3/4', 'Plein'].map((x) => ({ id: x, label: x }))} /></View>
                </View>
                <Input label="Observations" value={e.notes || ''} onChangeText={(notes) => set({ contrat: { ...kc, [k]: { ...e, notes } } })} onBlur={() => void commit({ contrat: d.contrat })} multiline />
                {e.photos?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{e.photos.map((pid) => <Image key={pid} source={{ uri: photoUrl(pid) }} style={{ width: 96, height: 72, borderRadius: 8, backgroundColor: c.stone }} contentFit="cover" />)}</ScrollView> : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn small title="Photo" icon="camera" testID={`photo-${k}`} onPress={() => void edlPhoto(k)} />
                  <Btn small kind={e.fait ? 'secondary' : 'primary'} title={e.fait ? 'Rouvrir' : 'Marquer fait'} onPress={() => void commit({ contrat: { ...kc, [k]: { ...e, fait: !e.fait } } })} />
                </View>
              </Panel>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
