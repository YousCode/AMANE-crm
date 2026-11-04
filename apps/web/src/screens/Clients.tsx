/* Clients : liste triée par chiffre, recherche, étiquettes, relances. */
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { Av, Chip, QA, Empty, helloTxt, label, clientTags } from '../components/ui';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { ACTIVE } from '../lib/rules';
import { parse, fmtK, fmtDay } from '../lib/format';
import { CLIENT_STATUTS, CLIENT_TAGS } from '../shared';

export function Clients() {
  const D = useData(); const { openDrawer, filters, setFilter } = useUI(); const q = (filters.q || '').toLowerCase();
  const cs = D.clients.filter((c) => !q || [c.nom, c.tel, c.email, c.pays, c.hotel].join(' ').toLowerCase().includes(q)).map((c) => { const mine = D.missions.filter((m) => m.clientId === c.id); const ca = mine.filter((m) => ACTIVE.includes(m.statut)).reduce((x, m) => x + (+(m.montant || 0)), 0); const last = mine.map((m) => parse(m.debut)).filter(Boolean).sort((a, b) => +(b as Date) - +(a as Date))[0]; return { c, ca, last, n: mine.length }; }).sort((a, b) => b.ca - a.ca);
  const tags = (c: { tags?: Record<string, boolean> | string[] }) => CLIENT_TAGS.filter((x) => clientTags(c).includes(x.id)).map((x) => x.label);
  return <>
    <div className="view-h"><div><div className="label">Carnet</div><h2>Clients</h2></div><div className="tools"><input className="field-inline" type="search" placeholder="Nom, téléphone, pays…" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} aria-label="Rechercher un client" /><button className="btn sm primary" type="button" onClick={() => openDrawer('client')}><Icon k="plus" />Client</button></div></div>
    <div className="panel"><div className={`list-h ${s.clients} ${s.hideM}`}><span /><span>Client</span><span>Origine</span><span>Statut</span><span>Chiffre</span><span>Dernière</span><span /></div>
      <div className="list">{cs.length ? cs.map(({ c, ca, last, n }) => <div key={c.id} className={`row ${s.clients}`} role="button" tabIndex={0} onClick={() => openDrawer('client', c.id)} onKeyDown={(e) => { if (e.key === 'Enter') openDrawer('client', c.id); }} data-testid={`client-${c.id}`}><Av id={c.responsable} /><span style={{ minWidth: 0 }}><div className="main-t" dir="auto">{c.nom}{tags(c).map((l) => <span key={l} className="tagc">{l}</span>)}</div><div className="sub-t">{[c.tel, c.langue, c.canal].filter(Boolean).join(' · ')}</div></span><span className={`sub-t ${s.hideM}`}>{[c.hotel, c.pays].filter(Boolean).join(' · ') || '—'}</span><span className={s.hideM}><Chip cls={c.statut === 'vip' ? 'c-vip' : ''}>{label(CLIENT_STATUTS, c.statut)}</Chip></span><span className="num">{fmtK(ca)}<div className="sub-t">{n} mission{n > 1 ? 's' : ''}</div></span><span className={`sub-t ${s.hideM}`}>{last ? fmtDay(last) : '—'}</span><QA tel={c.tel} wa={helloTxt(c)} who={c.nom} keep /></div>) : <Empty>{q ? 'Aucun client ne correspond.' : 'Aucun client pour l’instant.'}</Empty>}</div></div>
  </>;
}
