/* Contrats & dossiers (espace d'Aziz) : contrat, pièces, caution, états des lieux, paiement. */
import s from './Lists.module.css';
import { Chip, Empty, label } from '../components/ui';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { contratScore } from '../lib/rules';
import { parse, fmtDay, fmtK } from '../lib/format';
import { CONTRAT_ST, PAIEMENT_ST } from '../shared';

export function Contrats() {
  const D = useData(); const { openDrawer } = useUI();
  const ms = D.missions.filter((m) => ['proposition', 'confirmee', 'encours', 'terminee'].includes(m.statut) && (m.vehiculeId || (m.contrat && m.contrat.statut !== 'a_rediger'))).sort((a, b) => +(parse(a.debut) || 0) - +(parse(b.debut) || 0));
  const Ck = ({ ok, l, warn }: { ok: boolean; l: string; warn?: boolean }) => <span className={`ck ${ok ? 'y' : warn ? 'w' : ''}`}><b>{ok ? '✓' : ''}</b><span>{l}</span></span>;
  return <>
    <div className="view-h"><div><div className="label">Espace d’Aziz</div><h2>Contrats & dossiers</h2></div></div>
    <div className="panel"><div className={`list-h ${s.contrats} ${s.hideM}`}><span>Mission</span><span>Contrat</span><span>Pièces</span><span>Caution</span><span>Départ</span><span>Retour</span><span>Paiement</span></div>
      <div className="list">{ms.length ? ms.map((m) => { const k = m.contrat || ({} as NonNullable<typeof m.contrat>), p = k.pieces || {}, c = D.clients.find((x) => x.id === m.clientId), sc = contratScore(m); const pc = [p.permis, p.passeport, p.domicile].filter(Boolean).length;
        return <button key={m.id} className={`row ${s.contrats}`} type="button" onClick={() => openDrawer('mission', m.id, 'contrat')}><span style={{ minWidth: 0 }}><div className="main-t">{m.titre}</div><div className="sub-t">{c?.nom || '—'} · {fmtDay(parse(m.debut))} · <Chip st={m.statut} /></div><div className="prog"><i style={{ width: `${sc.done / sc.total * 100}%` }} /></div></span>
          <span className={s.hideM}><Ck ok={k.statut === 'signe'} l={label(CONTRAT_ST, k.statut || 'a_rediger')} warn={k.statut === 'envoye'} /></span><span className={s.hideM}><Ck ok={pc === 3} l={pc + '/3'} warn={pc > 0} /></span><span className={s.hideM}><Ck ok={['preautorisee', 'encaissee', 'restituee'].includes(k.cautionStatut || '') || !(+(k.caution || 0))} l={(+(k.caution || 0)) ? fmtK(k.caution) : '—'} /></span><span className={s.hideM}><Ck ok={!!(k.edlDepart && k.edlDepart.fait)} l="État des lieux" /></span><span className={s.hideM}><Ck ok={!!(k.edlRetour && k.edlRetour.fait)} l="État des lieux" /></span><span className="num" style={{ fontSize: 12.5, color: m.paiement === 'solde' ? 'var(--ok)' : m.statut === 'terminee' ? 'var(--bad)' : 'var(--fg2)' }}>{label(PAIEMENT_ST, m.paiement || 'non')}</span></button>; }) : <Empty>Aucun dossier ouvert. Les missions avec véhicule apparaissent ici dès leur proposition.</Empty>}</div></div>
  </>;
}
