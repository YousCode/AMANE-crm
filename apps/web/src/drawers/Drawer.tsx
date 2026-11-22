import type React from 'react';
/* Tiroir de fiche : demande, client, véhicule, partenaire, service. Brouillon local, enregistrement optimiste, barre d'actions collante sur mobile. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './Drawer.module.css';
import { Icon, CarSil } from '../components/Icon';
import { ContactBtns, Field, Check, Chip, Empty, Av, SysAv, teamOf, whoName, helloTxt, label, clientTags } from '../components/ui';
import { useStore, byId } from '../store/store';
import { useUI, type DrawerState } from '../store/ui';
import { useData, useIsMobile } from '../lib/hooks';
import { svcName, services, vehicles, chauffeurs, loueurs, proprio, blank, nowLine, seuil, vehMissions, driverAt, contratHTML, partLabel, vehicleOn, ST_CHIP, isVan } from '../lib/rules';
import { parse, fmtE, fmtDT, fmtDay, fmtK, clone, setK, getK, download, slug, relTime, today, toLocal, sod, addD, fmtDate, fmtTime } from '../lib/format';
import { api, uploadPhoto, photoURL } from '../lib/api';
import { STATUTS, CLIENT_STATUTS, CLIENT_TAGS, LANGUES, CANAUX, CONTRAT_ST, CAUTION_ST, PAIEMENT_ST, PART_TYPES, JOURNAL_T, CARBURANT, TEAM, clashes, chClashes, durDays, devisTotals, numeroFormat, paiementStatut, validate, type Mission, type Client, type Vehicule, type Partenaire, type Activity } from '../shared';
import { MissionTabs, ACT_CACHE } from './MissionTabs';
import { LoueurBloc, JoursDeclares, DispoBloc } from './Prestataire';
import { Strip } from '../screens/Flotte';
import { convClient } from '../screens/Messages';
import { telNorm } from '../shared';

const COL: Record<string, 'missions' | 'clients' | 'vehicules' | 'partenaires' | 'services'> = { mission: 'missions', client: 'clients', vehicule: 'vehicules', partenaire: 'partenaires', service: 'services' };
export type Draft = Record<string, unknown>;

export function Drawer() { const d = useUI((x) => x.drawer); if (!d) return null; return <DrawerBody key={`${d.kind}:${d.id || 'new'}`} st={d} />; }

export function useActivity(id: string | null) {
  const [items, setItems] = useState<Activity[] | null>(id && ACT_CACHE[id] ? ACT_CACHE[id] : null); const [err, setErr] = useState(false); const lastSync = useStore((x) => x.lastSync);
  useEffect(() => { if (!id) return; let on = true; api<{ items: Activity[] }>('GET', '/api/activity?docId=' + encodeURIComponent(id) + '&limit=50').then((r) => { if (on) { ACT_CACHE[id] = r.items || []; setItems(r.items || []); } }).catch(() => { if (on) setErr(true); }); return () => { on = false; }; }, [id, lastSync]);
  return { items, err };
}
export function ActList({ id }: { id: string | null }) {
  const { items, err } = useActivity(id);
  if (!items) return <Empty arch={false}>{err ? 'Historique indisponible hors connexion.' : 'Chargement de l’historique…'}</Empty>;
  if (!items.length) return <Empty arch={false}>Aucune modification enregistrée pour l’instant.</Empty>;
  return <div>{items.map((a, i) => <div key={i} className="act-i">{teamOf(a.user) ? <Av id={a.user} /> : <SysAv u={a.user} />}<span className="w" style={{ minWidth: 0 }}><b>{whoName(a.user)}</b> · {a.resume}</span><span className="d">{relTime(a.at)}</span></div>)}</div>;
}

function DrawerBody({ st }: { st: DrawerState }) {
  const { kind, id, tab, preset } = st; const D = useData(); const user = useStore((x) => x.user); const put = useStore((x) => x.put); const del = useStore((x) => x.del); const counter = useStore((x) => x.counter); const convs = useStore((x) => x.conversations);
  const { closeDrawer, setTab, toast, openDrawer } = useUI(); const nav = useNavigate(); const mobile = useIsMobile();
  const me = user?.id || 'amel';
  const src = kind === 'mission' ? D.missions : kind === 'client' ? D.clients : kind === 'vehicule' ? D.vehicules : kind === 'partenaire' ? D.partenaires : services(D.services);
  const ex = id ? byId(src as { id: string }[], id) : undefined;
  const pre = { ...(preset || {}) } as Draft; const pend = (pre.__pending as Draft | undefined) || null; delete pre.__pending;
  const [d, setD] = useState<Draft>(() => (ex ? { ...clone(ex as Draft), ...pre } : { ...blank(kind, me, pre) }));
  const [curId, setCurId] = useState<string | null>(id); const [confirmDel, setConfirmDel] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [pendingMission, setPendingMission] = useState<Draft | null>(pend);
  const isNew = !curId;
  const upd = (k: string, v: unknown) => setD((o) => { const n = clone(o); setK(n, k, v); return n; });
  const uc = (k: string) => (v: unknown) => upd(k, v);
  const col = COL[kind];

  async function save(extra?: (d: Draft) => Promise<boolean> | boolean) {
    const n = clone(d); setErrs({});
    if (kind === 'mission') { if (!String(n.titre || '').trim()) n.titre = `${svcName(D.services, String(n.service))}${byId(D.clients, String(n.clientId)) ? ' — ' + byId(D.clients, String(n.clientId))!.nom : ''}`; const v = validate.mission(n as Partial<Mission>); if (!v.ok) { setErrs(v.errors); toast(Object.values(v.errors)[0]); return; } }
    if (kind === 'client') { const v = validate.client(n as Partial<Client>); if (!v.ok) { setErrs(v.errors); toast(Object.values(v.errors)[0]); return; } }
    if (kind === 'vehicule' && !String(n.nom || '').trim()) { setErrs({ nom: 'Indiquez le modèle.' }); toast('Indiquez le modèle.'); return; }
    if (kind === 'partenaire' && !String(n.nom || '').trim()) { setErrs({ nom: 'Indiquez un nom.' }); toast('Indiquez un nom.'); return; }
    if (kind === 'service') { if (!String(n.nom || '').trim()) { toast('Indiquez un nom.'); return; } if (!D.services.length) for (const sv of services(D.services)) if (sv.id !== n.id) await put('services', { ...sv }); if (!n.id) n.id = slug(String(n.nom)); }
    if (kind === 'mission') {
      const m = n as unknown as Mission;
      if (m.chauffeurId) { const ch = byId(D.partenaires, m.chauffeurId); if (ch) m.chauffeur = ch.nom; }
      m.taches = (m.taches || []).filter((x) => String(x.t || '').trim()); m.programme = (m.programme || []).filter((x) => x.dt || x.lieu || x.client);
      m.commissions = (m.commissions || []).filter((c) => c.partenaireId || +(c.base ?? 0)); m.commissions.forEach((c) => { if (c.statut === 'recue' && !c.recueLe) c.recueLe = today(); if (c.statut !== 'recue') delete c.recueLe; });
      if (m.devis) { const dv = m.devis; dv.lignes = (dv.lignes || []).filter((l) => String(l.d || '').trim() || +l.pu); dv.paiements = (dv.paiements || []).filter((q) => +q.montant); if (!dv.date) dv.date = today();
        try { const y = new Date().getFullYear(); if (!dv.numero) dv.numero = numeroFormat('devis', y, await counter('devis-' + y)); if (dv.wantFacture && !dv.factureNumero) { dv.factureNumero = numeroFormat('facture', y, await counter('facture-' + y)); dv.factureDate = today(); } } catch { toast('Numérotation impossible pour l’instant (hors ligne ?), réessayez.'); return; }
        delete dv.wantFacture; const tt = devisTotals(dv); if (dv.lignes.length) m.montant = tt.ttc; if (dv.paiements.length) { m.acompte = tt.paid; m.paiement = paiementStatut(m); } }
      (n as Draft).aiDraft = undefined; delete (n as Draft).aiDraft;
    }
    if (kind === 'vehicule') n.journal = ((n.journal as Vehicule['journal']) || []).filter((j) => j.dt || j.desc || +(j.cout || 0) || j.photo);
    /* Champs que seul le serveur pose (réponses des prestataires, lien du portail, validation d'une inscription) : on renvoie la valeur reçue, jamais celle du brouillon. */
    const recu = curId ? (byId(src as { id: string }[], curId) as Draft | undefined) : undefined;
    if (recu) (kind === 'mission' ? ['dispoDemandes'] : kind === 'partenaire' ? ['portailToken', 'portailAt', 'aValider'] : []).forEach((k) => { if (recu[k] === undefined) delete n[k]; else n[k] = clone(recu[k]); });
    if (extra && !(await extra(n))) return;
    setBusy(true);
    try { const nid = await put(col, { ...n, id: curId || (n.id as string) || undefined } as never); setCurId(nid); setD({ ...n, id: nid }); toast('Enregistré'); if (kind === 'client' && pendingMission) { const pm = pendingMission; setPendingMission(null); openDrawer('mission', null, 'main', { ...pm, clientId: nid }); } }
    finally { setBusy(false); }
  }
  async function remove(msg = 'Supprimé') { if (!curId) return; await del(col, curId); closeDrawer(); toast(msg); }

  let title = '', eyebrow = '', tabs: [string, string][] = [], body: React.ReactElement | null = null, foot: React.ReactElement | null = null, contact: React.ReactElement | null = null;
  if (kind === 'mission') {
    const m = d as unknown as Mission; const c = byId(D.clients, m.clientId); const ch = byId(D.partenaires, m.chauffeurId); const cl = clashes(m, D.missions), cc = chClashes(m, D.missions); const v = byId(D.vehicules, m.vehiculeId); const a = parse(m.debut);
    eyebrow = isNew ? 'Nouvelle demande' : `${label(STATUTS, m.statut)} · ${svcName(D.services, m.service)}`; title = m.titre || 'Demande sans titre';
    const nT = (m.taches || []).filter((x) => !x.fait).length;
    tabs = [['main', 'Demande'], ['devis', 'Devis & facture'], ['prog', 'Programme'], ['taches', 'Tâches' + (nT ? ` (${nT})` : '')], ['contrat', 'Contrat & dossier'], ['ia', 'Message client']]; if (!isNew) tabs.push(['act', 'Historique']);
    const cv = (c && convs.find((k) => k.clientId === c.id || k.id === telNorm(c.tel))) || (m.convId ? byId(convs, m.convId) : undefined);
    contact = <ContactBtns tel={c?.tel} email={c?.email} lieu={m.lieu} wa={helloTxt(c)}>{ch && telNorm(ch.tel) ? <ContactBtns tel={ch.tel} telLabel="Chauffeur" waLabel="WhatsApp chauffeur" noSms wa={`Bonjour ${ch.nom}, mission « ${m.titre || svcName(D.services, m.service)} »${a ? ' le ' + fmtDT(a) : ''}${m.lieu ? ', prise en charge : ' + m.lieu : ''}${c?.nom ? '. Client : ' + c.nom : ''}.`} /> : null}{cv && <button className="ct" type="button" onClick={() => { closeDrawer(); nav(`/messages/${cv.id}`); }}><Icon k="messages" />Conversation{+(cv.unread || 0) ? <span className="ub">{cv.unread}</span> : null}</button>}</ContactBtns>;
    const est = v && m.debut ? durDays(m) * (+(v.tarifJour || 0)) : 0;
    if (tab === 'main') body = <>
      <div className="fg">
        <Field k="titre" label="Titre" value={m.titre} onChange={upd} full ph="Ex. G 63 — anniversaire de mariage" />
        <div className="f"><label htmlFor="f_clientId">Client</label><select id="f_clientId" value={m.clientId || ''} onChange={(e) => { if (e.target.value === '__new') { const pm = clone(d); delete pm.id; openDrawer('client', null, 'main', { __pending: pm }); } else upd('clientId', e.target.value); }}><option value="">— Choisir —</option>{D.clients.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}<option value="__new">+ Nouveau client…</option></select></div>
        <Field k="responsable" label="Responsable" value={m.responsable} onChange={upd} type="select" opts={TEAM.map((x) => ({ id: x.id, label: x.nom + ' · ' + x.role }))} />
        <Field k="service" label="Service" value={m.service} onChange={upd} type="select" opts={services(D.services).map((x) => ({ id: x.id, label: x.nom }))} err={errs.service} />
        <Field k="vehiculeId" label="Véhicule" value={m.vehiculeId} onChange={upd} type="select" opts={[{ id: '', label: 'Aucun' }, ...vehicles(D.vehicules).map((x) => { const st0 = vehicleOn(D.missions, x, parse(m.debut), parse(m.fin), m.id); return { id: x.id, label: x.nom + (st0.k === 'b' ? ' — réservé sur ce créneau' : st0.k === 'o' ? ' — option en cours' : st0.k === 'off' ? ' — ' + (st0.t || '').toLowerCase() : '') }; })]} />
        <Field k="debut" label="Début" value={m.debut} onChange={upd} type="datetime-local" /><Field k="fin" label="Fin" value={m.fin} onChange={upd} type="datetime-local" err={errs.fin} />
        {v && v.partenaireId ? <div className={s.span}><DispoBloc key={v.id} m={m} v={v} D={D} curId={curId} /></div> : null}
        <Field k="lieu" label="Lieu de remise" value={m.lieu} onChange={upd} ph="Hôtel, adresse, aéroport" />
        <Field k="chauffeurId" label="Chauffeur (carnet)" value={m.chauffeurId} onChange={upd} type="select" opts={[{ id: '', label: 'Aucun' }, ...chauffeurs(D.partenaires).map((p) => ({ id: p.id, label: p.nom + (chClashes({ ...m, chauffeurId: p.id }, D.missions).length ? ' — déjà pris sur ce créneau' : '') }))]} />
        {!m.chauffeurId && <Field k="chauffeur" label="Chauffeur hors carnet" value={m.chauffeur} onChange={upd} ph="Nom, si absent du carnet" />}
        <Field k="montant" label="Montant total (€ TTC)" value={m.montant} onChange={upd} type="number" err={errs.montant} /><Field k="acompte" label="Acompte reçu (€)" value={m.acompte} onChange={upd} type="number" />
        <Field k="statut" label="Statut" value={m.statut} onChange={upd} type="select" opts={STATUTS as unknown as { id: string; label: string }[]} /><Field k="paiement" label="Paiement" value={m.paiement || 'non'} onChange={upd} type="select" opts={PAIEMENT_ST} />
        <Field k="notes" label="Notes internes" value={m.notes} onChange={upd} type="textarea" full />
      </div>
      {cc.length > 0 && <div className="warn-box"><Icon k="alert" /><span>Ce chauffeur est déjà pris sur ce créneau : {cc.map((o) => `${o.titre} (${fmtDT(parse(o.debut))})`).join(', ')}.</span></div>}
      {cl.length > 0 && <div className="warn-box" data-testid="clash"><Icon k="alert" /><span>Ce véhicule est déjà réservé sur ce créneau : {cl.map((o) => `${o.titre} (${fmtDT(parse(o.debut))})`).join(', ')}.</span></div>}
      {v && m.debut ? <div className="note">Repère : {durDays(m)} jour{durDays(m) > 1 ? 's' : ''} × {fmtE(v.tarifJour)} = <b className="num">{fmtE(est)}</b> au tarif {v.nom}.{(+(m.montant || 0)) && (+(m.montant || 0)) < est * .85 ? ' Le montant saisi est plus de 15 % sous ce repère.' : ''}</div> : null}
    </>;
    else if (tab === 'act') body = <><p className="muted" style={{ margin: 0 }}>Qui a modifié cette demande, et quand.</p><ActList id={curId} /></>;
    else body = <MissionTabs tab={tab} d={m} D={D} upd={upd} setD={setD as (f: (o: Draft) => Draft) => void} save={save} curId={curId} isNew={isNew} />;
    if (tab === 'contrat' && !isNew) foot = <button className="btn sm" type="button" onClick={() => download(`contrat-amane-${slug(m.titre || 'mission')}.html`, contratHTML(D, { ...m, id: curId || '' }))}><Icon k="down" />Télécharger le contrat</button>;
  }
  if (kind === 'client') {
    const c = d as unknown as Client; eyebrow = isNew ? 'Nouveau client' : label(CLIENT_STATUTS, c.statut); title = c.nom || 'Client sans nom'; tabs = [['main', 'Fiche'], ['plus', 'Entourage & attentions'], ['hist', 'Historique']];
    const cv = !isNew ? convs.find((k) => k.clientId === curId || k.id === telNorm(c.tel)) : undefined;
    contact = !isNew ? <ContactBtns tel={c.tel} email={c.email} lieu={c.hotel} wa={helloTxt(c)}>{cv && <button className="ct" type="button" onClick={() => { closeDrawer(); nav(`/messages/${cv.id}`); }}><Icon k="messages" />Conversation{+(cv.unread || 0) ? <span className="ub">{cv.unread}</span> : null}</button>}</ContactBtns> : null;
    const tags = clientTags(c); const toggleTag = (id: string, on: boolean) => upd('tags', on ? [...tags.filter((x) => x !== id), id] : tags.filter((x) => x !== id));
    if (tab === 'main') body = <div className="fg">
      <Field k="nom" label="Nom" value={c.nom} onChange={upd} full ph="Nom ou famille" err={errs.nom} /><Field k="tel" label="Téléphone / WhatsApp" value={c.tel} onChange={upd} type="tel" err={errs.tel} /><Field k="email" label="E-mail" value={c.email} onChange={upd} type="email" err={errs.email} />
      <Field k="langue" label="Langue" value={c.langue} onChange={upd} type="select" opts={LANGUES} /><Field k="pays" label="Pays" value={c.pays} onChange={upd} /><Field k="hotel" label="Hôtel / adresse à Paris" value={c.hotel} onChange={upd} /><Field k="canal" label="Canal d’arrivée" value={c.canal} onChange={upd} type="select" opts={CANAUX} />
      <Field k="statut" label="Statut" value={c.statut} onChange={upd} type="select" opts={CLIENT_STATUTS} /><Field k="responsable" label="Interlocuteur" value={c.responsable} onChange={upd} type="select" opts={TEAM.map((x) => ({ id: x.id, label: x.nom }))} /><Field k="naissance" label="Date de naissance" value={c.naissance} onChange={upd} type="date" /><Field k="nationalite" label="Nationalité" value={c.nationalite} onChange={upd} />
      <div className="f full"><span className="lab">Documents reçus</span><div className="checks">{[['passeport', 'Passeport'], ['permis', 'Permis'], ['domicile', 'Justificatif de domicile']].map(([x, l]) => <Check key={x} k={`docs.${x}`} label={l} checked={!!(c.docs || {})[x]} onChange={upd} />)}</div></div>
      <div className="f full"><span className="lab">Étiquettes</span><div className="checks">{CLIENT_TAGS.map((x) => <Check key={x.id} k={x.id} label={x.label} checked={tags.includes(x.id)} onChange={(k, v) => toggleTag(k, v)} />)}</div></div>
      <Field k="prefs" label="Goûts et préférences" value={c.prefs} onChange={upd} type="textarea" full /><Field k="notes" label="Notes internes" value={c.notes} onChange={upd} type="textarea" full />
    </div>;
    if (tab === 'plus') body = <>
      <div className="sec-t">Entourage</div>
      {(c.entourage || []).map((e, i) => <div key={i} className={s.ent}><input className="inp" aria-label="Nom" placeholder="Nom" value={e.nom || ''} onChange={(ev) => upd(`entourage.${i}.nom`, ev.target.value)} /><input className="inp" aria-label="Lien" placeholder="Lien (épouse, fils…)" value={e.lien || ''} onChange={(ev) => upd(`entourage.${i}.lien`, ev.target.value)} /><input className="inp" aria-label="Téléphone" placeholder="Téléphone" value={e.tel || ''} onChange={(ev) => upd(`entourage.${i}.tel`, ev.target.value)} /><button type="button" className="x-s" aria-label="Retirer" onClick={() => upd('entourage', (c.entourage || []).filter((_, j) => j !== i))}><Icon k="close" /></button></div>)}
      <div><button className="btn sm" type="button" onClick={() => upd('entourage', [...(c.entourage || []), { nom: '', lien: '', tel: '' }])}><Icon k="plus" />Personne</button></div>
      <div className="sec-t">Dates importantes</div>
      {(c.datesImportantes || []).map((e, i) => <div key={i} className="ln dim"><input className="inp" type="date" aria-label="Date" value={e.date || ''} onChange={(ev) => upd(`datesImportantes.${i}.date`, ev.target.value)} /><input className="inp" aria-label="Événement" placeholder="Anniversaire de mariage, fête…" value={e.label || ''} onChange={(ev) => upd(`datesImportantes.${i}.label`, ev.target.value)} /><button type="button" className="x-s" aria-label="Retirer" onClick={() => upd('datesImportantes', (c.datesImportantes || []).filter((_, j) => j !== i))}><Icon k="close" /></button></div>)}
      <div><button className="btn sm" type="button" onClick={() => upd('datesImportantes', [...(c.datesImportantes || []), { date: '', label: '' }])}><Icon k="plus" />Date</button></div>
      <div className="fg"><Field k="allergies" label="Allergies et régimes" value={c.allergies} onChange={upd} type="textarea" full /><Field k="marques" label="Marques et maisons préférées" value={c.marques} onChange={upd} type="textarea" full /></div>
      <div className="sec-t">Attentions particulières</div>
      <div className={s.att}>{(c.attentions || []).map((a, i) => <span key={i}>{a}<button type="button" aria-label="Retirer" onClick={() => upd('attentions', (c.attentions || []).filter((_, j) => j !== i))}><Icon k="close" size={12} /></button></span>)}</div>
      <AddLine ph="Eau plate en cabine, sièges enfant, presse en arabe…" onAdd={(v) => upd('attentions', [...(c.attentions || []), v])} />
      <p className="muted">Ces attentions se retrouvent dans le programme, le rappel de la veille et l’espace client.</p>
    </>;
    if (tab === 'hist') { const ms = D.missions.filter((m) => m.clientId === curId).sort((a, b) => +(parse(b.debut) || 0) - +(parse(a.debut) || 0)); const ca = ms.filter((m) => ['confirmee', 'encours', 'terminee'].includes(m.statut)).reduce((x, m) => x + (+(m.montant || 0)), 0);
      body = <><div className="kv"><div><span>Chiffre total</span><b>{fmtE(ca)}</b></div><div><span>Missions</span><b>{ms.length}</b></div></div><div className="hist">{ms.length ? ms.map((m) => <button key={m.id} type="button" onClick={() => openDrawer('mission', m.id)}><span><span dir="auto">{m.titre}</span><div className="sub-t" style={{ fontSize: '0.75rem' }}>{fmtDay(parse(m.debut))}</div></span><Chip st={m.statut} /></button>) : <Empty arch={false}>Aucune mission.</Empty>}</div>{!isNew && <button className="btn sm primary" type="button" onClick={() => openDrawer('mission', null, 'main', { clientId: curId })}><Icon k="plus" />Nouvelle demande pour ce client</button>}{!isNew && <><div className="sec-t">Modifications de la fiche</div><ActList id={curId} /></>}</>; }
  }
  if (kind === 'vehicule') {
    const v = d as unknown as Vehicule; eyebrow = isNew ? 'Nouveau véhicule' : nowLine(D.missions, v); title = v.nom || 'Véhicule'; const own = proprio(D.partenaires, v); const ls = loueurs(D.partenaires); const mj = (+(v.tarifJour || 0)) - (+(v.prixAchatJour || 0)); tabs = isNew ? [['main', 'Fiche']] : [['main', 'Fiche'], ['photos', 'Photos' + ((v.photos || []).length ? ` (${v.photos!.length})` : '')], ['dispo', 'Disponibilités'], ['journal', 'Journal' + ((v.journal || []).length ? ` (${v.journal!.length})` : '')]]; const se = seuil(v);
    if (tab === 'main') body = <>
      {v.aValider && <div className={`panel ${s.blk}`} data-testid="veh-avalider"><div className={s.blkH}><span className="label">Véhicule à valider</span></div><div>Proposé par <b style={{ fontWeight: 500 }}>{own?.nom || 'un prestataire'}</b> depuis son portail. Tant qu’il n’est pas validé, il n’est pas proposé à la location.</div><div className={s.acts}><button className="btn sm primary" type="button" disabled={busy} onClick={() => save((n) => { delete n.aValider; return true; })} data-testid="veh-ok"><Icon k="check" />Valider</button></div></div>}
      <div className="fg"><Field k="nom" label="Modèle" value={v.nom} onChange={upd} ph="Ex. G 63" err={errs.nom} /><Field k="categorie" label="Catégorie" value={v.categorie} onChange={upd} ph="SUV, supercar, van…" /><Field k="plaque" label="Immatriculation" value={v.plaque} onChange={upd} /><Field k="couleur" label="Couleur" value={v.couleur} onChange={upd} />
      <Field k="partenaireId" label="Appartient à" value={v.partenaireId || ''} onChange={upd} type="select" opts={[{ id: '', label: 'La maison' }, ...ls.map((x) => ({ id: x.id, label: x.nom })), ...(own && !ls.includes(own) ? [{ id: own.id, label: own.nom + (own.aValider ? ' (à valider)' : ' (inactif)') }] : [])]} />
      {v.partenaireId ? <Field k="prixAchatJour" label="Prix d’achat / jour (€)" value={v.prixAchatJour} onChange={upd} type="number" /> : null}
      <Field k="tarifJour" label="Tarif location / jour (€)" value={v.tarifJour} onChange={upd} type="number" />{!v.partenaireId && <><Field k="loyerMois" label="Loyer leasing / mois (€)" value={v.loyerMois} onChange={upd} type="number" /><Field k="chargesMois" label="Assurance + entretien / mois (€)" value={v.chargesMois} onChange={upd} type="number" /></>}
      <Field k="statut" label="Statut" value={v.statut} onChange={upd} type="select" opts={[{ id: 'disponible', label: 'Disponible' }, { id: 'entretien', label: 'En entretien' }, { id: 'indisponible', label: 'Indisponible' }]} />
      <Field k="km" label="Kilométrage" value={v.km} onChange={upd} type="number" /><Field k="revision" label="Prochaine révision" value={v.revision} onChange={upd} type="date" /><Field k="echeances.assurance" label="Échéance assurance" value={(v.echeances || {}).assurance} onChange={upd} type="date" /><Field k="echeances.ct" label="Contrôle technique" value={(v.echeances || {}).ct} onChange={upd} type="date" />{!v.partenaireId && <Field k="echeances.leasing" label="Fin de leasing" value={(v.echeances || {}).leasing} onChange={upd} type="date" />}<Field k="notes" label="Notes" value={v.notes} onChange={upd} type="textarea" full /></div>
      {v.partenaireId ? (+(v.tarifJour || 0)) && (+(v.prixAchatJour || 0)) ? <div className="note">Marge : {fmtE(v.tarifJour)} − {fmtE(v.prixAchatJour)} = <b className="num" style={{ color: mj < 0 ? 'var(--bad)' : undefined }}>{fmtE(mj)}</b> par jour loué. Ni loyer ni charges : le véhicule reste chez {own?.nom || 'le prestataire'}.</div> : <div className="note">Véhicule de {own?.nom || 'prestataire'} : indiquez le tarif et le prix d’achat par jour pour voir la marge.</div>
        : se ? <div className="note">Point mort : <b className="num">{se.toFixed(1).replace('.', ',')} jours</b> de location par mois couvrent loyer, assurance et entretien.</div> : null}</>;
    if (tab === 'photos') body = <PhotosTab v={v} upd={upd} save={save} />;
    if (tab === 'dispo') { const now = sod(new Date()); const ms = vehMissions(D.missions, v).filter((m) => (parse(m.fin) || parse(m.debut))! >= now).sort((a, b) => +parse(a.debut)! - +parse(b.debut)!);
      body = <><div className="note"><b style={{ fontWeight: 500, color: 'var(--fg)' }}>{nowLine(D.missions, v)}</b></div>{v.partenaireId ? <JoursDeclares v={v} upd={upd} /> : null}<div className="sec-t">30 prochains jours</div><Strip v={v} ms={D.missions} n={30} /><div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', color: 'var(--fg3)' }}><span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--fg)', marginRight: 6 }} />réservé</span><span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, boxShadow: 'inset 0 0 0 1px var(--line)', marginRight: 6 }} />option</span></div>
        <div className="sec-t">Réservations à venir</div><div className="hist">{ms.length ? ms.map((m) => { const c = byId(D.clients, m.clientId); return <button key={m.id} type="button" onClick={() => openDrawer('mission', m.id)}><span><span dir="auto">{m.titre}</span><div className="sub-t" style={{ fontSize: '0.75rem' }}>{c?.nom || '—'} · {fmtDT(parse(m.debut))} → {fmtDT(parse(m.fin))}</div></span><Chip st={m.statut} /></button>; }) : <Empty arch={false}>Aucune réservation à venir.</Empty>}</div></>; }
    if (tab === 'journal') body = <JournalTab v={v} vid={curId} upd={upd} D={D} save={save} />;
  }
  if (kind === 'partenaire') {
    const p = d as Draft; const lo = p.type === 'loueur'; eyebrow = isNew ? 'Nouveau partenaire' : partLabel(String(p.type)); title = String(p.nom || 'Partenaire'); tabs = isNew ? [['main', 'Fiche']] : [['main', 'Fiche'], ['hist', 'Missions']];
    contact = !isNew ? <ContactBtns tel={String(p.tel || '')} email={String(p.email || '')} lieu={String(p.adresse || '')} wa={'Bonjour ' + String(p.contact || p.nom || '').trim() + ', '} /> : null;
    if (tab === 'hist') { const pid = curId; const vids = new Set(D.vehicules.filter((x) => x.partenaireId === pid).map((x) => x.id)); const ms = D.missions.filter((m) => m.chauffeurId === pid || (!!m.vehiculeId && vids.has(m.vehiculeId)) || (m.commissions || []).some((c) => c.partenaireId === pid) || (m.programme || []).some((x) => x.partenaireId === pid)).sort((a, b) => +(parse(b.debut) || 0) - +(parse(a.debut) || 0)); const comm = D.missions.reduce((x, m) => x + (m.commissions || []).filter((c) => c.partenaireId === pid).reduce((y, c) => y + (+(c.base ?? 0)) * (+(c.pct ?? 0)) / 100, 0), 0);
      body = <><div className="kv"><div><span>Missions</span><b>{ms.length}</b></div><div><span>Commissions</span><b>{fmtE(comm)}</b></div></div><div className="hist">{ms.length ? ms.map((m) => <button key={m.id} type="button" onClick={() => openDrawer('mission', m.id)}><span><span dir="auto">{m.titre}</span><div className="sub-t" style={{ fontSize: '0.75rem' }}>{fmtDT(parse(m.debut))}</div></span><Chip st={m.statut} /></button>) : <Empty arch={false}>Aucune mission.</Empty>}</div></>; }
    else body = <>{lo && <><LoueurBloc p={p as unknown as Partenaire} curId={curId} D={D} onValide={() => setD((o) => { const n = clone(o); delete n.aValider; return n; })} onRefuse={() => remove('Inscription refusée')} /><div className="sec-t">Coordonnées</div></>}
      <div className="fg"><Field k="nom" label="Nom" value={p.nom} onChange={upd} full err={errs.nom} /><Field k="type" label="Type" value={p.type} onChange={upd} type="select" opts={PART_TYPES} />{lo && <><Field k="societe" label="Société" value={p.societe} onChange={upd} ph="Raison sociale" /><Field k="siren" label="SIREN" value={p.siren} onChange={upd} ph="9 chiffres" /></>}<Field k="contact" label="Contact" value={p.contact} onChange={upd} /><Field k="tel" label="Téléphone" value={p.tel} onChange={upd} type="tel" /><Field k="email" label="E-mail" value={p.email} onChange={upd} type="email" /><Field k="langues" label="Langues" value={p.langues} onChange={upd} ph="FR, EN, AR" /><Field k="commission" label="Commission (%)" value={p.commission} onChange={upd} type="number" /><Field k="adresse" label="Adresse" value={p.adresse} onChange={upd} full /><div className="f full checks"><Check k="actif" label="Actif" checked={p.actif !== false} onChange={upd} /></div><Field k="notes" label="Notes" value={p.notes} onChange={upd} type="textarea" full /></div></>;
  }
  if (kind === 'service') { const p = d as Draft; eyebrow = isNew ? 'Nouveau service' : 'Service'; title = String(p.nom || 'Service'); tabs = [['main', 'Fiche']]; body = <div className="fg"><Field k="nom" label="Nom" value={p.nom} onChange={upd} full /><Field k="description" label="Description" value={p.description} onChange={upd} type="textarea" full /><Field k="tarif" label="Tarif interne indicatif" value={p.tarif} onChange={upd} full /><Field k="ordre" label="Ordre d’affichage" value={p.ordre} onChange={upd} type="number" /></div>; }

  const canDel = !isNew && !(kind === 'service' && !D.services.length);
  return <>
    <div className={s.scrim} onClick={closeDrawer} />
    <aside className={s.drawer} role="dialog" aria-modal="true" aria-labelledby="drTitle" data-testid="drawer">
      <div className={s.h}><div style={{ minWidth: 0 }}><div className="label">{eyebrow}</div><h2 id="drTitle" dir="auto">{title}</h2></div><button className={s.x} type="button" onClick={closeDrawer} aria-label="Fermer"><Icon k="close" /></button></div>
      {contact && <div className={s.c}>{contact}</div>}
      {tabs.length > 1 && <div className={s.tabs} role="tablist" data-hscroll="1">{tabs.map(([t, l]) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`tab-${t}`}>{l}</button>)}</div>}
      <div className={s.b} data-drawer-body="1">{body}</div>
      <div className={s.f} data-hscroll="1">{canDel && (confirmDel ? <span className={s.confirm}>Supprimer définitivement ? <button className="btn sm danger" type="button" onClick={() => remove()}>Oui, supprimer</button><button className="btn sm ghost" type="button" onClick={() => setConfirmDel(false)}>Annuler</button></span> : <button className="btn sm ghost danger" type="button" onClick={() => setConfirmDel(true)}>Supprimer</button>)}{foot}<span className={s.grow} /><button className={`btn sm ghost ${s.close}`} type="button" onClick={closeDrawer}>Fermer</button><button className={`btn sm primary ${s.save}`} type="button" onClick={() => save()} disabled={busy} data-testid="save">Enregistrer</button></div>
    </aside>
  </>;
}

export function AddLine({ ph, onAdd }: { ph: string; onAdd: (v: string) => void }) { const [v, setV] = useState(''); return <div style={{ display: 'flex', gap: 8 }}><input className="inp" placeholder={ph} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { e.preventDefault(); onAdd(v.trim()); setV(''); } }} aria-label={ph} /><button className="btn sm" type="button" onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(''); } }}><Icon k="plus" />Ajouter</button></div>; }

function PhotosTab({ v, upd, save }: { v: Vehicule; upd: (k: string, x: unknown) => void; save: () => Promise<void> }) {
  const { toast } = useUI(); const [busy, setBusy] = useState(''); const [over, setOver] = useState(false); const ph = v.photos || [];
  async function add(files: FileList | File[] | null) { const fl = [...(files || [])].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)); if (!fl.length) return; const ids: string[] = []; let i = 0, fail = 0; for (const f of fl) { i++; setBusy(`${i} / ${fl.length}`); try { const r = await uploadPhoto(f); ids.push(r.id); } catch { fail++; } } setBusy(''); if (ids.length) { upd('photos', [...ph, ...ids]); setTimeout(() => save(), 0); } toast(`${ids.length} photo${ids.length > 1 ? 's' : ''} ajoutée${ids.length > 1 ? 's' : ''}${fail ? ` · ${fail} échec${fail > 1 ? 's' : ''}` : ''}`); }
  return <>
    <div className={`drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}><div>Glissez des photos ici</div><label className="btn sm" style={{ cursor: 'pointer' }}><Icon k="plus" />Choisir des photos<input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} /></label><div style={{ fontSize: '0.75rem' }}>JPG, PNG ou WebP, réduites à 1600 px. La première photo sert de couverture.</div></div>
    {busy && <div className="note">Envoi {busy}… gardez la fiche ouverte.</div>}
    {ph.length ? <div className="gal">{ph.map((id, i) => <figure key={id}><img src={photoURL(id)} alt={`Photo ${i + 1} — ${v.nom}`} loading="lazy" />{i === 0 && <span className="chip cover">Couverture</span>}<div className="acts">{i > 0 && <button type="button" onClick={() => { upd('photos', [id, ...ph.filter((x) => x !== id)]); setTimeout(() => save(), 0); }}>Couverture</button>}<button type="button" onClick={() => { upd('photos', ph.filter((x) => x !== id)); setTimeout(() => save(), 0); }}>Retirer</button></div></figure>)}</div> : <Empty>Aucune photo pour ce véhicule.</Empty>}
  </>;
}
function JournalTab({ v, vid, upd, D, save }: { v: Vehicule; vid: string | null; upd: (k: string, x: unknown) => void; D: ReturnType<typeof useData>; save: () => Promise<void> }) {
  const { openDrawer, toast } = useUI(); const js = [...(v.journal || [])];
  return <>
    {js.length ? js.map((j, i) => { const m = j.type === 'pv' ? driverAt(D.missions, vid || '', j.dt) : null; const c = m && byId(D.clients, m.clientId);
      return <div key={i} className="pst"><div className="ln jr"><input className="inp" type="datetime-local" aria-label="Date et heure" value={j.dt || ''} onChange={(e) => upd(`journal.${i}.dt`, e.target.value)} /><select aria-label="Type" value={j.type} onChange={(e) => upd(`journal.${i}.type`, e.target.value)}>{JOURNAL_T.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select><input type="number" inputMode="numeric" aria-label="Kilométrage" placeholder="km" value={j.km ?? ''} onChange={(e) => upd(`journal.${i}.km`, e.target.value === '' ? '' : +e.target.value)} /><input type="number" step="any" inputMode="decimal" aria-label="Coût" placeholder="Coût €" value={j.cout ?? ''} onChange={(e) => upd(`journal.${i}.cout`, e.target.value === '' ? '' : +e.target.value)} /><button type="button" className="x-s" aria-label="Supprimer l’entrée" onClick={() => upd('journal', js.filter((_, k) => k !== i))}><Icon k="close" /></button></div>
        <div className="ln jr2"><input aria-label="Description" placeholder="Description" value={j.desc || ''} onChange={(e) => upd(`journal.${i}.desc`, e.target.value)} /><span className="jph">{j.photo && <img src={photoURL(j.photo)} alt="Pièce jointe" />}<label className="btn sm ghost" style={{ cursor: 'pointer' }}>{j.photo ? 'Changer la photo' : 'Photo'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const r = await uploadPhoto(f); upd(`journal.${i}.photo`, r.id); toast('Photo ajoutée au journal'); } catch { toast('Envoi impossible.'); } }} /></label></span></div>
        {j.type === 'pv' && <div className="pvbox">{m ? <>Conducteur à désigner : <b>{c ? c.nom : 'client inconnu'}</b>{c?.tel ? ' · ' + c.tel : ''} — <button type="button" className="lnk" onClick={() => openDrawer('mission', m.id)}>{m.titre}</button></> : j.dt ? 'Aucune demande à cette date : le véhicule était chez Amane.' : 'Indiquez la date et l’heure de l’infraction.'}<label className="tkc"><input type="checkbox" checked={!!j.traite} onChange={(e) => upd(`journal.${i}.traite`, e.target.checked)} />Désignation faite</label></div>}
      </div>; }) : <Empty>Journal vide.</Empty>}
    <div><button className="btn sm" type="button" onClick={() => upd('journal', [{ dt: toLocal(new Date()), type: 'entretien', km: v.km || '', cout: '', desc: '' }, ...js])}><Icon k="plus" />Entrée</button></div>
    <p className="muted">Pour un PV, la date et l’heure suffisent : le CRM retrouve la demande et le client qui avaient la voiture, pour la désignation ANTAI.</p>
  </>;
}
export { CarSil, isVan, getK, ST_CHIP, fmtK, fmtDate, fmtTime, addD, convClient };
