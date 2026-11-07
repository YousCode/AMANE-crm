/* Fiche partenaire, onglet « Espace » : lien personnel sans compte (créer, copier, envoyer, renouveler, révoquer),
   missions confiées et leur confirmation, relances envoyées. Et l'historique des relances d'une fiche (client, partenaire). */
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Empty, Av, SysAv, teamOf, whoName } from '../components/ui';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { api, type ApiError } from '../lib/api';
import { relTime, fmtDT, parse, copyText } from '../lib/format';
import { waLink, telNorm, firstName, type EspacePrestataireInfo, type RelanceEnvoi } from '../shared';
import { relanceLabel } from '../screens/Relances';

const CANAL: Record<string, string> = { texte: 'WhatsApp', modele: 'modèle approuvé', manuel: 'notée hors CRM', rappel: 'rappel automatique' };

/** Relances d'une fiche : `q` = « clientId=c1 », « missionId=m1 » ou « partenaireId=p1 ». */
export function RelancesHist({ q }: { q: string }) {
  const lastSync = useStore((x) => x.lastSync); const [items, setItems] = useState<RelanceEnvoi[] | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { let on = true; api<{ items: RelanceEnvoi[] }>('GET', '/api/relances/historique?' + q).then((r) => { if (on) setItems(r.items || []); }).catch(() => { if (on) setErr(true); }); return () => { on = false; }; }, [q, lastSync]);
  if (!items) return <Empty arch={false}>{err ? 'Historique des relances indisponible hors connexion.' : 'Chargement…'}</Empty>;
  if (!items.length) return <Empty arch={false}>Aucune relance pour l’instant.</Empty>;
  return <div data-testid="relances-hist">{items.map((r) => <div key={r.id} className="act-i">{teamOf(r.by) ? <Av id={r.by} /> : <SysAv u={r.by === 'rappel' ? 'auto' : r.by} />}<span className="w" style={{ minWidth: 0 }}><b>{r.type === 'rappel' ? 'Rappel automatique' : relanceLabel(r.type)}</b> · {r.statut === 'echec' ? <span style={{ color: 'var(--bad)' }}>échec{r.erreur ? ' : ' + r.erreur : ''}</span> : `${CANAL[r.canal] || r.canal}, par ${r.by === 'rappel' ? 'Amane' : whoName(r.by)}`}{r.texte ? <div className="sub-t" dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{r.texte.length > 160 ? r.texte.slice(0, 160) + '…' : r.texte}</div> : null}</span><span className="d">{relTime(r.at)}</span></div>)}</div>;
}

export function EspaceTab({ pid, nom, contact, tel }: { pid: string; nom: string; contact?: string; tel?: string }) {
  const { toast, openDrawer } = useUI(); const lastSync = useStore((x) => x.lastSync);
  const [info, setInfo] = useState<EspacePrestataireInfo | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState<'' | 'renew' | 'revoke'>(''); const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; api<EspacePrestataireInfo>('GET', `/api/partenaires/${encodeURIComponent(pid)}/espace`).then((r) => { if (on) { setInfo(r); setErr(''); } }).catch((e: ApiError) => { if (on) setErr(e.code === 'offline' ? 'Espace prestataire indisponible hors connexion.' : e.message || 'Espace indisponible.'); }); return () => { on = false; }; }, [pid, lastSync, tick]);
  async function run(f: () => Promise<unknown>, ok: string) { setBusy(true); try { await f(); toast(ok); setAsk(''); setTick((t) => t + 1); } catch (e) { toast((e as ApiError).message || 'Impossible pour l’instant.'); } finally { setBusy(false); } }
  const create = (renouveler = false) => run(() => api('POST', `/api/partenaires/${encodeURIComponent(pid)}/espace`, { renouveler }), renouveler ? 'Nouveau lien créé : l’ancien ne fonctionne plus' : 'Lien de l’espace créé');
  const revoke = () => run(() => api('DELETE', `/api/partenaires/${encodeURIComponent(pid)}/espace`), 'Lien révoqué');
  const confirmer = (mid: string, confirme: boolean) => run(() => api('POST', `/api/missions/${encodeURIComponent(mid)}/confirmation`, { partenaireId: pid, confirme }), confirme ? 'Confirmation notée' : 'Confirmation retirée');
  if (err && !info) return <Empty arch={false}>{err}</Empty>;
  if (!info) return <Empty arch={false}>Chargement…</Empty>;
  const prenom = firstName(contact || nom);
  const msg = info.url ? `Bonjour${prenom ? ' ' + prenom : ''}, voici votre espace prestataire Amane : vos missions et les disponibilités de notre flotte, à jour en temps réel. ${info.url}` : '';
  return <>
    <div className="sec-t">Lien personnel</div>
    {info.actif && info.url ? <>
      <div style={{ display: 'flex', gap: 8 }}><input className="inp" readOnly value={info.url} aria-label="Lien de l’espace prestataire" onFocus={(e) => e.currentTarget.select()} data-testid="espace-url" style={{ flex: 1, minWidth: 0 }} /><button className="btn sm" type="button" onClick={() => copyText(info.url!).then((ok) => toast(ok ? 'Lien copié' : 'Copie impossible'))}><Icon k="copy" />Copier</button></div>
      <div className="ctc" role="group" aria-label="Partager le lien" data-hscroll="1" style={{ marginTop: 8 }}>
        {telNorm(tel) && <a className="ct dark" href={waLink(tel || '', msg)} target="_blank" rel="noopener"><Icon k="wa" />Envoyer par WhatsApp</a>}
        <a className="ct" href={info.url} target="_blank" rel="noopener"><Icon k="link" />Ouvrir l’espace</a>
        {ask === 'renew' ? <span className="ct">Nouveau lien ? L’ancien cessera de fonctionner. <button className="btn sm" type="button" disabled={busy} onClick={() => create(true)}>Oui</button><button className="btn sm ghost" type="button" onClick={() => setAsk('')}>Non</button></span>
          : <button className="ct" type="button" onClick={() => setAsk('renew')}><Icon k="relances" />Nouveau lien</button>}
        {ask === 'revoke' ? <span className="ct">Couper l’accès de {nom} ? <button className="btn sm danger" type="button" disabled={busy} onClick={revoke} data-testid="revoquer-oui">Révoquer</button><button className="btn sm ghost" type="button" onClick={() => setAsk('')}>Annuler</button></span>
          : <button className="ct" type="button" onClick={() => setAsk('revoke')} data-testid="revoquer"><Icon k="close" />Révoquer</button>}
      </div>
      <p className="muted">Créé {relTime(info.createdAt)}{info.createdBy ? ` par ${whoName(info.createdBy)}` : ''} · {info.vues ? `ouvert ${info.vues} fois, dernière fois ${relTime(info.vuAt)}` : 'pas encore ouvert'}.</p>
    </> : <div className="note"><p style={{ margin: '0 0 10px' }}>{nom} verra les missions que vous lui confiez (date, lieu, prénom du client, véhicule) et les disponibilités de la flotte, sans compte ni mot de passe. Jamais de montants ni de téléphones de clients.</p><button className="btn sm primary" type="button" disabled={busy} onClick={() => create(false)} data-testid="espace-creer"><Icon k="link" />Créer le lien</button></div>}
    <div className="sec-t">Missions confiées</div>
    <div>{info.missions.length ? info.missions.map((m) => <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 0', borderBottom: '1px solid var(--line2)' }}>
      <span style={{ flex: '1 1 180px', minWidth: 0 }}><button type="button" className="lnk" onClick={() => openDrawer('mission', m.id)} dir="auto">{m.titre || 'Mission'}</button><div className="sub-t" style={{ fontSize: '0.75rem' }}>{fmtDT(parse(m.debut))}</div></span>
      {m.confirmeeAt ? <><span className="tagc" title={`Confirmée ${relTime(m.confirmeeAt)}`}><Icon k="check" />Confirmée</span><button className="btn sm ghost" type="button" disabled={busy} onClick={() => confirmer(m.id, false)}>Retirer</button></> : <><span className="tagc">À confirmer</span><button className="btn sm" type="button" disabled={busy} onClick={() => confirmer(m.id, true)} data-testid={`confirmer-${m.id}`}>Noter confirmée</button></>}
    </div>) : <Empty arch={false}>Aucune mission ferme à venir pour {nom}.</Empty>}</div>
    <div className="sec-t">Relances</div>
    <RelancesHist q={'partenaireId=' + encodeURIComponent(pid)} />
  </>;
}
