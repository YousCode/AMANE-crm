/* Carnet : partenaires (chauffeurs, restaurants, hôtels, boutiques, garages). */
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { QA, Empty, label } from '../components/ui';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { PART_TYPES } from '../shared';

export function Carnet() {
  const D = useData(); const { openDrawer, filters, setFilter } = useUI(); const q = (filters.pq || '').toLowerCase(); const t = filters.pt || ''; const all = D.partenaires;
  const ps = all.filter((p) => (!t || p.type === t) && (!q || [p.nom, p.contact, p.tel, p.email, p.adresse, p.langues].join(' ').toLowerCase().includes(q))).sort((a, b) => (a.type + a.nom).localeCompare(b.type + b.nom));
  const ico = (p: { type: string }) => p.type === 'chauffeur' ? 'key' : p.type === 'boutique' ? 'bag' : p.type === 'restaurant' ? 'star' : p.type === 'garage' ? 'flotte' : p.type === 'hotel' ? 'salon' : 'user';
  return <>
    <div className="view-h"><div><div className="label">Partenaires</div><h2>Carnet</h2></div><div className="tools"><input className="field-inline" type="search" placeholder="Nom, téléphone, langue…" value={filters.pq || ''} onChange={(e) => setFilter('pq', e.target.value)} aria-label="Rechercher un partenaire" /><button className="btn sm primary" type="button" onClick={() => openDrawer('partenaire', null, 'main', { type: t || 'chauffeur' })}><Icon k="plus" />Partenaire</button></div></div>
    <div className="seg wrap" role="group" aria-label="Type de partenaire" style={{ marginBottom: 14 }}><button type="button" aria-pressed={!t} onClick={() => setFilter('pt', '')}>Tous {all.length}</button>{PART_TYPES.map((x) => <button key={x.id} type="button" aria-pressed={t === x.id} onClick={() => setFilter('pt', x.id)}>{x.label} {all.filter((p) => p.type === x.id).length}</button>)}</div>
    <div className="panel"><div className="list">{ps.length ? ps.map((p) => <div key={p.id} className={`row ${s.partners}`} role="button" tabIndex={0} onClick={() => openDrawer('partenaire', p.id)} onKeyDown={(e) => { if (e.key === 'Enter') openDrawer('partenaire', p.id); }}><span className="ic-s"><Icon k={ico(p)} /></span><span style={{ minWidth: 0 }}><div className="main-t">{p.nom}{p.actif === false ? <span className="tagc">inactif</span> : null}</div><div className="sub-t">{[label(PART_TYPES, p.type), p.contact, p.langues].filter(Boolean).join(' · ')}</div></span><span className={`sub-t ${s.hideM}`}>{p.tel || p.adresse || ''}</span><span className={`num ${s.hideM}`}>{p.commission ? p.commission + ' %' : ''}</span><QA tel={p.tel} wa={'Bonjour ' + String(p.contact || p.nom || '').trim() + ', '} who={p.nom} keep /></div>) : <Empty>{q || t ? 'Aucun partenaire ne correspond.' : 'Carnet vide. Ajoutez vos chauffeurs, restaurants, boutiques et garages.'}</Empty>}</div></div>
  </>;
}
