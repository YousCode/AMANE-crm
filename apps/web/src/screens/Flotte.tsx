/* Flotte : cartes véhicules (maison et prestataires, pastille du propriétaire), véhicules proposés à valider en tête, « Qui est libre ? »,
   bande d'occupation 14 jours ; Rentabilité par véhicule (/api/flotte/rentabilite). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import s from './Lists.module.css';
import { Icon, CarSil } from '../components/Icon';
import { Chip, Empty, Kpi } from '../components/ui';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { vehicles, vehicleOn, nowLine, joursLoues, seuil, isVan, vehMissions, proprio, BOOK, ST_CHIP } from '../lib/rules';
import { parse, sod, addD, fmtE, fmtDT, fmtDay, toLocal, monthOf, pad, fmtK } from '../lib/format';
import { api, photoURL } from '../lib/api';
import type { Vehicule, Mission, Rentabilite as Rent } from '../shared';

export function Strip({ v, ms, n }: { v: Vehicule; ms: Mission[]; n: number }) {
  const t0 = sod(new Date()); const vm = vehMissions(ms, v);
  return <><div className="strip" data-strip="1" style={{ gridTemplateColumns: `repeat(${n},minmax(0,1fr))` }} aria-label={`Occupation sur ${n} jours`}>{[...Array(n)].map((_, i) => { const d = addD(t0, i), e = addD(d, 1); const ov = vm.filter((m) => parse(m.debut)! < e && (parse(m.fin) || parse(m.debut))! >= d); const c = ov.some((m) => BOOK.includes(m.statut)) ? 'b' : ov.length ? 'o' : ''; return <i key={i} className={`${c}${i === 0 ? ' t' : ''}`} title={`${fmtDay(d)} · ${c === 'b' ? 'réservé' : c === 'o' ? 'option' : 'libre'}`} />; })}</div><div className="strip-l"><span>{fmtDay(t0)}</span><span>{fmtDay(addD(t0, n - 1))}</span></div></>;
}

export function Flotte() {
  const D = useData(); const put = useStore((x) => x.put); const { openDrawer, filters, setFilter, toast } = useUI(); const now = new Date();
  const [from, setFrom] = useState(filters.from || toLocal(now)); const [to, setTo] = useState(filters.to || toLocal(new Date(+now + 864e5)));
  /* Proposés par un prestataire depuis son portail : à part, en tête, tant que l'équipe ne les a pas validés. */
  const av = vehicles(D.vehicules).filter((v) => v.aValider); const vs = vehicles(D.vehicules).filter((v) => !v.aValider);
  async function valider(v: Vehicule) { const n: Record<string, unknown> = { ...v }; delete n.aValider; await put('vehicules', n); toast('Véhicule validé'); }
  const a = parse(from), b = parse(to); const st = vs.map((v) => vehicleOn(D.missions, v, a, b)); const nf = st.filter((x) => x.k === 'f').length;
  return <>
    <div className="view-h"><div><div className="label">Garage</div><h2>Flotte</h2></div><div className="tools"><Link className="btn sm" to="/flotte/rentabilite"><Icon k="finances" />Rentabilité</Link><button className="btn sm primary" type="button" onClick={() => openDrawer('vehicule')}><Icon k="plus" />Véhicule</button></div></div>
    <div className="panel" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '14px 18px', marginBottom: 16, boxShadow: 'none' }}><span className="label">Qui est libre ?</span><span className="pair"><label className="label" htmlFor="availFrom">Du</label><input className="field-inline" type="datetime-local" id="availFrom" value={from} onChange={(e) => { setFrom(e.target.value); setFilter('from', e.target.value); }} /></span><span className="pair"><label className="label" htmlFor="availTo">au</label><input className="field-inline" type="datetime-local" id="availTo" value={to} onChange={(e) => { setTo(e.target.value); setFilter('to', e.target.value); }} /></span><span style={{ marginLeft: 'auto', color: 'var(--fg2)' }}><b className="num" style={{ color: 'var(--ok)', fontWeight: 500 }}>{nf}</b> / {vs.length} libre{nf > 1 ? 's' : ''} sur la période</span></div>
    {av.length > 0 && <div className="panel" style={{ marginBottom: 16 }} data-testid="veh-a-valider"><div className="list-h"><span>Véhicules proposés à valider · {av.length}</span></div>
      <div className="list">{av.map((v) => { const o = proprio(D.partenaires, v); return <div key={v.id} className={`row ${s.aval}`} role="button" tabIndex={0} onClick={() => openDrawer('vehicule', v.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openDrawer('vehicule', v.id); }} data-testid={`aval-${v.id}`}><span className="ic-s"><Icon k={isVan(v) ? 'van' : 'car'} /></span>
        <span style={{ minWidth: 0 }}><div className="main-t">{v.nom}</div><div className="sub-t">{['Proposé par ' + (o?.nom || 'un prestataire'), v.categorie, v.plaque, +(v.prixAchatJour || 0) ? `${fmtE(v.prixAchatJour)} / jour` : ''].filter(Boolean).join(' · ')}</div></span>
        <span className={s.avalA} onClick={(e) => e.stopPropagation()}><button className="btn sm primary" type="button" onClick={() => valider(v)} data-testid={`aval-ok-${v.id}`}><Icon k="check" />Valider</button></span></div>; })}</div></div>}
    {vs.length ? <div className={s.fleet}>{vs.map((v, i) => { const x = st[i], j = joursLoues(D.missions, v, now), se = seuil(v), r = parse(v.revision), c = v.photos && v.photos[0]; const n = (v.photos || []).length; const [cc, l] = ST_CHIP[x.k]; const mc = x.m ? D.clients.find((k) => k.id === x.m!.clientId) : undefined; const o = proprio(D.partenaires, v);
      return <button key={v.id} className={`panel ${s.vcard}`} type="button" onClick={() => openDrawer('vehicule', v.id)} data-testid={`veh-${v.id}`}><div className={`${s.win} ${c ? s.ph : ''}`}>{c ? <img src={photoURL(c)} alt={v.nom} loading="lazy" /> : <CarSil van={isVan(v)} />}<span className={s.st}><Chip st={cc}>{x.k === 'off' ? x.t : l}</Chip></span></div><div className={s.body}><div><div className={s.nm}>{v.nom}</div><div className={s.cat}>{[v.categorie, v.plaque, v.couleur, n ? n + ' photo' + (n > 1 ? 's' : '') : ''].filter(Boolean).join(' · ')}</div></div>
        {v.partenaireId ? <span className={`chip ${s.own}`} title="Véhicule d’un prestataire" data-testid={`own-${v.id}`}><Icon k="key" /><span>{o?.nom || 'Prestataire'}</span></span> : null}
        <div className={s.now}>{x.m ? `${x.k === 'b' ? 'Réservé' : 'Option'} : ${mc?.nom || x.m.titre}, ${fmtDT(parse(x.m.debut))} → ${fmtDT(parse(x.m.fin))}` : nowLine(D.missions, v)}</div>
        <Strip v={v} ms={D.missions} n={14} />
        <div className="kv"><div><span>Tarif / jour</span><b>{fmtE(v.tarifJour)}</b></div>{v.partenaireId ? <><div><span>Achat / j</span><b>{fmtE(v.prixAchatJour)}</b></div><div><span>Ce mois</span><b>{j} j loué{j > 1 ? 's' : ''}</b></div></> : <><div><span>Coût / mois</span><b>{fmtE((+(v.loyerMois || 0)) + (+(v.chargesMois || 0)))}</b></div><div><span>Ce mois</span><b style={{ color: j >= se ? 'var(--ok)' : 'inherit' }}>{j} j / {se.toFixed(1).replace('.', ',')} j</b></div></>}<div><span>Révision</span><b style={{ color: r && +r - +now < 7 * 864e5 ? 'var(--bad)' : 'inherit' }}>{r ? r.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</b></div></div></div></button>; })}</div> : <div className="panel"><Empty>Aucun véhicule enregistré.</Empty></div>}
  </>;
}

export function Rentabilite() {
  const { filters, setFilter, openDrawer } = useUI(); const off = filters.fm || 0; const ref = monthOf(off); const mois = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}`;
  const [items, setItems] = useState<Rent[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { let on = true; setItems(null); setErr(''); api<{ items: Rent[] }>('GET', '/api/flotte/rentabilite?mois=' + mois).then((r) => { if (on) setItems(r.items || []); }).catch(() => { if (on) setErr('Rentabilité indisponible hors connexion.'); }); return () => { on = false; }; }, [mois]);
  const tot = (k: keyof Rent) => (items || []).reduce((x, i) => x + (+(i[k] as number) || 0), 0);
  const lab = ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return <>
    <div className="view-h"><div><div className="label">Flotte</div><h2>Rentabilité · {lab}</h2></div><div className="tools"><button className="btn sm" type="button" aria-label="Mois précédent" onClick={() => setFilter('fm', off - 1)}><Icon k="left" /></button><button className="btn sm" type="button" onClick={() => setFilter('fm', 0)}>Ce mois</button><button className="btn sm" type="button" aria-label="Mois suivant" onClick={() => setFilter('fm', off + 1)}><Icon k="right" /></button><Link className="btn sm" to="/flotte">Retour à la flotte</Link></div></div>
    {err ? <div className="banner"><Icon k="alert" /><span>{err}</span></div> : !items ? <Empty arch={false}>Calcul…</Empty> : <>
      <div className={s.finK}><Kpi label="Chiffre loué" v={fmtK(tot('ca'))} h="confirmé, au prorata des jours" /><Kpi label="Loyers + charges" v={fmtK(tot('loyer') + tot('charges'))} h={`${items.some((i) => i.partenaireId) ? 'journal et achats aux prestataires' : 'journal'} ${fmtE(tot('couts'))}`} /><Kpi label="Marge nette" v={fmtK(tot('marge'))} col={tot('marge') < 0 ? 'var(--bad)' : 'var(--ok)'} h="chiffre − loyers − charges − journal" /></div>
      <div className="panel"><div className={`list-h ${s.rent} ${s.hideM}`}><span>Véhicule</span><span>Loyer</span><span>Charges</span><span>Jours</span><span>Chiffre</span><span>Coûts</span><span>Marge</span></div>
        <div className="list">{items.map((i) => <button key={i.vehiculeId} className={`row ${s.rent}`} type="button" onClick={() => openDrawer('vehicule', i.vehiculeId)}><span style={{ minWidth: 0 }}><div className="main-t">{i.nom}</div><div className="sub-t">{i.partenaireId ? 'prestataire · ' : ''}occupation {i.occupation} %</div></span><span className={`num ${s.hideM}`}>{i.partenaireId ? '—' : fmtE(i.loyer)}</span><span className={`num ${s.hideM}`}>{i.partenaireId ? '—' : fmtE(i.charges)}</span><span className={`num ${s.hideM}`}>{i.joursLoues} j</span><span className="num">{fmtE(i.ca)}</span><span className={`num ${s.hideM}`}>{fmtE(i.couts)}</span><span className="num" style={{ color: i.marge < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmtE(i.marge)}</span></button>)}</div></div>
      <p className="muted" style={{ marginTop: 12 }}>Marge nette = chiffre loué − loyer − charges − coûts du journal (entretien, réparations, PV). {items.some((i) => i.partenaireId) ? ' Véhicule de prestataire : chiffre − prix d’achat par jour loué.' : ''} Estimation de trésorerie, hors salaires et TVA.</p>
    </>}
  </>;
}
