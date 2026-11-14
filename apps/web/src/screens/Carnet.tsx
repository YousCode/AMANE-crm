/* Carnet : partenaires (chauffeurs, loueurs, restaurants, hôtels, boutiques, garages). Les inscriptions de prestataires à valider restent à part, en tête. */
import { useState } from 'react';
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { QA, Empty, label } from '../components/ui';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { inscriptions } from '../lib/rules';
import { relTime } from '../lib/format';
import { portailLien, errMsg } from '../lib/presta';
import { PART_TYPES } from '../shared';

export function Carnet() {
  const D = useData(); const del = useStore((x) => x.del); const { openDrawer, filters, setFilter, toast } = useUI(); const q = (filters.pq || '').toLowerCase(); const t = filters.pt || '';
  const av = inscriptions(D.partenaires); const all = D.partenaires.filter((p) => !av.includes(p)); const [busy, setBusy] = useState(''); const [refus, setRefus] = useState('');
  const ps = all.filter((p) => (!t || p.type === t) && (!q || [p.nom, p.contact, p.tel, p.email, p.adresse, p.langues, p.societe, p.siren].join(' ').toLowerCase().includes(q))).sort((a, b) => (a.type + a.nom).localeCompare(b.type + b.nom));
  const ico = (p: { type: string }) => p.type === 'chauffeur' ? 'key' : p.type === 'loueur' ? 'car' : p.type === 'boutique' ? 'bag' : p.type === 'restaurant' ? 'star' : p.type === 'garage' ? 'flotte' : p.type === 'hotel' ? 'salon' : 'user';
  const nv = (id: string) => { const n = D.vehicules.filter((v) => v.partenaireId === id).length; return n ? `${n} véhicule${n > 1 ? 's' : ''}` : ''; };
  /* Valider crée le lien du portail : la fiche s'ouvre pour l'envoyer au prestataire. */
  async function valider(id: string) { setBusy(id); try { await portailLien(id, { valider: true }); toast('Inscription validée, lien du portail créé'); openDrawer('partenaire', id); } catch (e) { toast(errMsg(e, 'Hors ligne : la validation attend le retour du réseau.', 'Validation impossible pour l’instant.')); } finally { setBusy(''); } }
  async function refuser(id: string) { setRefus(''); await del('partenaires', id); toast('Inscription refusée'); }
  return <>
    <div className="view-h"><div><div className="label">Partenaires</div><h2>Carnet</h2></div><div className="tools"><input className="field-inline" type="search" placeholder="Nom, téléphone, langue…" value={filters.pq || ''} onChange={(e) => setFilter('pq', e.target.value)} aria-label="Rechercher un partenaire" /><button className="btn sm primary" type="button" onClick={() => openDrawer('partenaire', null, 'main', { type: t || 'chauffeur' })}><Icon k="plus" />Partenaire</button></div></div>
    {av.length > 0 && (!t || t === 'loueur') && <div className="panel" style={{ marginBottom: 14 }} data-testid="inscriptions"><div className="list-h"><span>Inscriptions de prestataires à valider · {av.length}</span></div>
      <div className="list">{av.map((p) => <div key={p.id} className={`row ${s.aval}`} role="button" tabIndex={0} onClick={() => openDrawer('partenaire', p.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openDrawer('partenaire', p.id); }} data-testid={`insc-${p.id}`}><span className="ic-s"><Icon k="car" /></span>
        <span style={{ minWidth: 0 }}><div className="main-t">{p.nom}</div><div className="sub-t">{[p.contact, p.tel, p.siren ? 'SIREN ' + p.siren : '', p.inscription?.at ? 'reçue ' + relTime(p.inscription.at) : ''].filter(Boolean).join(' · ')}</div>{p.inscription?.vehicules ? <div className="sub-t">{p.inscription.vehicules}</div> : null}</span>
        <span className={s.avalA} onClick={(e) => e.stopPropagation()}>{refus === p.id ? <span className={s.cf}>Refuser et supprimer ? <button className="btn sm danger" type="button" onClick={() => refuser(p.id)} data-testid={`insc-refus-oui-${p.id}`}>Oui, refuser</button><button className="btn sm ghost" type="button" onClick={() => setRefus('')}>Annuler</button></span>
          : <><button className="btn sm primary" type="button" disabled={busy === p.id} onClick={() => valider(p.id)} data-testid={`insc-ok-${p.id}`}><Icon k="check" />Valider</button><button className="btn sm ghost danger" type="button" onClick={() => setRefus(p.id)} data-testid={`insc-refus-${p.id}`}>Refuser</button></>}</span></div>)}</div></div>}
    <div className="seg wrap" role="group" aria-label="Type de partenaire" style={{ marginBottom: 14 }}><button type="button" aria-pressed={!t} onClick={() => setFilter('pt', '')}>Tous {all.length}</button>{PART_TYPES.map((x) => <button key={x.id} type="button" aria-pressed={t === x.id} onClick={() => setFilter('pt', x.id)} title={x.label}>{x.label.split(' / ')[0]} {all.filter((p) => p.type === x.id).length}</button>)}</div>
    <div className="panel"><div className="list">{ps.length ? ps.map((p) => <div key={p.id} className={`row ${s.partners}`} role="button" tabIndex={0} onClick={() => openDrawer('partenaire', p.id)} onKeyDown={(e) => { if (e.key === 'Enter') openDrawer('partenaire', p.id); }} data-testid={`part-${p.id}`}><span className="ic-s"><Icon k={ico(p)} /></span><span style={{ minWidth: 0 }}><div className="main-t">{p.nom}{p.actif === false ? <span className="tagc">inactif</span> : null}</div><div className="sub-t">{[label(PART_TYPES, p.type), p.contact, p.langues, p.type === 'loueur' ? nv(p.id) : ''].filter(Boolean).join(' · ')}</div></span><span className={`sub-t ${s.hideM}`}>{p.tel || p.adresse || ''}</span><span className={`num ${s.hideM}`}>{p.commission ? p.commission + ' %' : ''}</span><QA tel={p.tel} wa={'Bonjour ' + String(p.contact || p.nom || '').trim() + ', '} who={p.nom} keep /></div>) : <Empty>{q || t ? 'Aucun partenaire ne correspond.' : 'Carnet vide. Ajoutez vos chauffeurs, loueurs, restaurants, boutiques et garages.'}</Empty>}</div></div>
  </>;
}
