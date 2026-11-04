/* Services : carte des prestations et tarifs internes. */
import s from './Lists.module.css';
import { Icon, SVC_ICON } from '../components/Icon';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { services, ACTIVE } from '../lib/rules';
import { fmtK } from '../lib/format';

export function Services() {
  const D = useData(); const { openDrawer } = useUI(); const ms = D.missions;
  return <>
    <div className="view-h"><div><div className="label">Carte des services</div><h2>Services</h2></div><div className="tools"><button className="btn sm primary" type="button" onClick={() => openDrawer('service')}><Icon k="plus" />Service</button></div></div>
    <p className="muted" style={{ margin: '-8px 0 16px', maxWidth: '70ch', fontSize: 13 }}>Tarifs internes, jamais publiés sur le site. Ils servent de repère quand Amel prépare une proposition.</p>
    <div className={s.svc}>{services(D.services).map((x) => { const n = ms.filter((m) => m.service === x.id).length; const ca = ms.filter((m) => m.service === x.id && ACTIVE.includes(m.statut)).reduce((y, m) => y + (+(m.montant || 0)), 0); return <button key={x.id} className={`panel ${s.scard}`} type="button" onClick={() => openDrawer('service', x.id)}><span className={s.ic}><Icon k={SVC_ICON[x.id] || 'spark'} /></span><h3>{x.nom}</h3><p>{x.description || ''}</p><span className={s.tf}>{x.tarif || ''}</span><span className={s.us}>{n} demande{n > 1 ? 's' : ''} · {fmtK(ca)} signés</span></button>; })}</div>
  </>;
}
