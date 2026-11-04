/* À relancer : liste calculée par le serveur (/api/relances), message suggéré dans la langue du client, envoi en un geste. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { Empty, QA, helloTxt } from '../components/ui';
import { useUI } from '../store/ui';
import { useStore, byId } from '../store/store';
import { api } from '../lib/api';
import { relTime, copyText } from '../lib/format';
import { waLink, telNorm, type Relance } from '../shared';

const TYPES: Record<string, [string, string]> = { proposition: ['Proposition sans réponse', 'clock'], habitue: ['Habitué silencieux', 'star'], anniversaire: ['Anniversaire', 'spark'], acompte: ['Acompte attendu', 'euro'], facture: ['Facture en retard', 'contrats'] };
export function Relances() {
  const clients = useStore((x) => x.clients); const convs = useStore((x) => x.conversations); const lastSync = useStore((x) => x.lastSync); const { openDrawer, toast, filters, setFilter } = useUI(); const nav = useNavigate();
  const [items, setItems] = useState<Relance[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { let on = true; api<{ items: Relance[] }>('GET', '/api/relances').then((r) => { if (on) setItems(r.items || []); }).catch(() => { if (on) { setErr('Relances indisponibles hors connexion.'); setItems([]); } }); return () => { on = false; }; }, [lastSync]);
  const f = filters.cvf || ''; const list = (items || []).filter((x) => !f || x.type === f);
  const counts = Object.keys(TYPES).map((k) => [k, (items || []).filter((x) => x.type === k).length] as const);
  return <>
    <div className="view-h"><div><div className="label">Relation client</div><h2>À relancer</h2></div><div className="tools"><span className="muted">{items ? `${items.length} relance${items.length > 1 ? 's' : ''} suggérée${items.length > 1 ? 's' : ''}` : '…'}</span></div></div>
    <div className="pills" role="group" aria-label="Type" style={{ marginBottom: 14 }}><button type="button" aria-pressed={!f} onClick={() => setFilter('cvf', '')}>Toutes<span className="n">{items?.length || 0}</span></button>{counts.map(([k, n]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setFilter('cvf', k)}>{TYPES[k][0]}<span className="n">{n}</span></button>)}</div>
    {err && <div className="banner"><Icon k="alert" /><span>{err}</span></div>}
    <div className="panel"><div className="list">{!items ? <Empty arch={false}>Calcul…</Empty> : list.length ? list.map((x, i) => { const c = byId(clients, x.clientId); const cv = convs.find((k) => k.clientId === x.clientId || (c && telNorm(c.tel) === k.id)); const [l, ic] = TYPES[x.type] || [x.type, 'spark'];
      return <div key={i} className={`row ${s.rel}`} role="button" tabIndex={0} onClick={() => (x.missionId ? openDrawer('mission', x.missionId) : openDrawer('client', x.clientId))} onKeyDown={(e) => { if (e.key === 'Enter') openDrawer('client', x.clientId); }} data-testid={`relance-${x.type}`}><span className="ic-s"><Icon k={ic} /></span><span style={{ minWidth: 0 }}><div className="main-t">{c?.nom || 'Client'}<span className="tagc">{l}</span></div><div className="sub-t">{x.raison}</div><div className={s.relMsg} dir="auto">{x.messageSuggere}</div></span><span className={`sub-t ${s.hideM}`}>{c?.langue || ''}{x.depuis ? ' · ' + relTime(x.depuis) : ''}</span><span className={s.hideM} /><span style={{ display: 'inline-flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>{cv ? <button className="btn sm" type="button" onClick={() => nav(`/messages/${cv.id}?draft=${encodeURIComponent(x.messageSuggere)}`)}><Icon k="messages" />Envoyer</button> : c && telNorm(c.tel) ? <a className="btn sm" href={waLink(c.tel, x.messageSuggere)} target="_blank" rel="noopener"><Icon k="wa" />WhatsApp</a> : <button className="btn sm" type="button" onClick={() => copyText(x.messageSuggere).then((ok) => toast(ok ? 'Message copié' : 'Copie impossible'))}><Icon k="copy" />Copier</button>}<QA tel={c?.tel} wa={helloTxt(c)} who={c?.nom} /></span></div>; }) : <Empty>Rien à relancer. Beau travail.</Empty>}</div></div>
    <p className="muted" style={{ marginTop: 12 }}>Propositions sans réponse depuis 48 h, habitués sans mission depuis 90 jours, anniversaires sous 21 jours, acomptes non reçus à J-3, factures en retard.</p>
  </>;
}
