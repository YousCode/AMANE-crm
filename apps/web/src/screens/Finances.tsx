/* Finances (espace d'Aziz) : facturé, encaissé, retards, commissions, coûts flotte, export CSV. */
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { Empty, Kpi } from '../components/ui';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { finData, finCSV, svcName } from '../lib/rules';
import { fmtE, fmtK, fmtDay, monthOf, pad, download } from '../lib/format';

export function Finances() {
  const D = useData(); const { openDrawer, filters, setFilter } = useUI(); const off = filters.fm || 0; const ref = monthOf(off); const fd = finData(D, ref); const now = new Date();
  const lab = ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const svcRows = Object.entries(fd.bySvc).sort((a, b) => b[1] - a[1]); const vehRows = Object.entries(fd.byVeh).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...svcRows.map((x) => x[1]), ...vehRows.map((x) => x[1]));
  const bar = (l: string, v: number) => <div key={l} className="b"><span>{l}</span><span><i style={{ width: `${v / mx * 100}%` }} /></span><span className="num">{fmtK(v)}</span></div>;
  return <>
    <div className="view-h"><div><div className="label">Espace d’Aziz</div><h2>Finances · {lab}</h2></div><div className="tools"><button className="btn sm" type="button" aria-label="Mois précédent" onClick={() => setFilter('fm', off - 1)}><Icon k="left" /></button><button className="btn sm" type="button" onClick={() => setFilter('fm', 0)}>Ce mois</button><button className="btn sm" type="button" aria-label="Mois suivant" onClick={() => setFilter('fm', off + 1)}><Icon k="right" /></button><button className="btn sm" type="button" onClick={() => download(`amane-finances-${ref.getFullYear()}-${pad(ref.getMonth() + 1)}.csv`, finCSV(D, fd))}><Icon k="down" />Export CSV</button></div></div>
    <div className={s.finK}>
      <Kpi label="Facturé" v={fmtE(fd.facture)} h="Factures émises ce mois, TTC" /><Kpi label="Encaissé" v={fmtE(fd.encaisse)} h="Règlements reçus ce mois" /><Kpi label="Reste à encaisser" v={fmtE(fd.reste)} h={`${fd.factures.length} facture${fd.factures.length > 1 ? 's' : ''} non soldée${fd.factures.length > 1 ? 's' : ''}, tous mois`} col={fd.reste > 0 ? 'var(--bad)' : undefined} />
      <Kpi label="Commissions à recevoir" v={fmtE(fd.comA)} h={`${fmtE(fd.comR)} reçues ce mois`} /><Kpi label="Coûts flotte" v={fmtE(fd.fixe + fd.journ)} h={`Loyers et charges ${fmtE(fd.fixe)} · journal ${fmtE(fd.journ)}`} /><Kpi label="Résultat estimé" v={fmtE(fd.res)} h="Encaissé + commissions reçues − coûts flotte" col={fd.res < 0 ? 'var(--bad)' : 'var(--ok)'} />
    </div>
    <div className="grid2"><div className="stack"><div className="panel pad"><div className="panel-h"><h2>Factures à encaisser</h2><span className="sub">en rouge : émises depuis plus de 7 jours</span></div><div className="list">{fd.factures.length ? fd.factures.map((x) => { const late = x.date && +now - +x.date > 7 * 864e5; const c = D.clients.find((k) => k.id === x.m.clientId); return <button key={x.m.id} className={`row ${s.fin}`} type="button" onClick={() => openDrawer('mission', x.m.id, 'devis')}><span style={{ minWidth: 0 }}><div className="main-t">{x.m.devis?.factureNumero} · {c?.nom || ''}</div><div className="sub-t">{x.m.titre}</div></span><span className="num" style={{ color: late ? 'var(--bad)' : 'var(--fg)' }}>{fmtE(x.t.solde)}</span><span className={`sub-t ${s.hideM}`}>{x.date ? fmtDay(x.date) : ''}</span></button>; }) : <Empty>Toutes les factures sont soldées.</Empty>}</div></div></div>
      <div className="stack"><div className="panel pad"><div className="panel-h"><h2>Signé par service</h2><span className="sub">début ce mois</span></div><div className="bars">{svcRows.length ? svcRows.map(([k, v]) => bar(svcName(D.services, k), v)) : <Empty arch={false}>Aucune demande confirmée ce mois.</Empty>}</div></div>
        <div className="panel pad"><div className="panel-h"><h2>Par véhicule</h2></div><div className="bars">{vehRows.length ? vehRows.map(([k, v]) => bar(D.vehicules.find((x) => x.id === k)?.nom || '—', v)) : <Empty arch={false}>—</Empty>}</div></div></div></div>
    <p className="muted" style={{ marginTop: 12 }}>Montants TTC. Le résultat est une estimation de trésorerie, pas une comptabilité : il ne tient compte ni des salaires, ni de la TVA à reverser, ni des impôts.</p>
  </>;
}
