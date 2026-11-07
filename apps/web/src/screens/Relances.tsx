/* À relancer : vue unique calculée par le serveur (/api/relances). Relance en un geste par WhatsApp (texte dans la fenêtre de 24 h,
   sinon modèle approuvé), relance faite ailleurs notée en un geste, et jamais deux fois : une relance faite reste bloquée pendant son délai. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { Empty, QA, whoName } from '../components/ui';
import { useUI } from '../store/ui';
import { useStore } from '../store/store';
import { api, type ApiError } from '../lib/api';
import { relTime, fmtDayLong } from '../lib/format';
import { waLink, telNorm, RELANCE_TYPES, type Relance } from '../shared';

const ICON: Record<string, string> = { proposition: 'clock', acompte: 'euro', solde: 'euro', facture: 'contrats', prestataire: 'key', habitue: 'star', anniversaire: 'spark' };
export const relanceLabel = (type: string) => RELANCE_TYPES.find((x) => x.id === type)?.court || type;
/** « Relancé il y a 2 j par Amel (modèle) » */
export function derniereTxt(d: Relance['derniere']) {
  if (!d) return '';
  const canal = d.canal === 'modele' ? 'modèle approuvé' : d.canal === 'manuel' ? 'hors CRM' : d.canal === 'rappel' ? 'rappel automatique' : 'WhatsApp';
  return `Relancé ${relTime(d.at)} par ${d.by === 'rappel' ? 'le rappel automatique' : whoName(d.by)} · ${canal}`;
}

export function Relances() {
  const lastSync = useStore((x) => x.lastSync); const convs = useStore((x) => x.conversations); const { openDrawer, toast, filters, setFilter } = useUI(); const nav = useNavigate();
  const [items, setItems] = useState<Relance[] | null>(null); const [err, setErr] = useState(''); const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(''); const [edit, setEdit] = useState<Record<string, string>>({}); const [waOff, setWaOff] = useState(false);
  useEffect(() => { let on = true; api<{ items: Relance[] }>('GET', '/api/relances').then((r) => { if (on) { setItems(r.items || []); setErr(''); } }).catch(() => { if (on) { setErr('Relances indisponibles hors connexion.'); setItems((x) => x || []); } }); return () => { on = false; }; }, [lastSync, tick]);
  const f = filters.cvf || ''; const vue = filters.cvv || 'afaire';
  const all = items || []; const afaire = all.filter((x) => !x.bloqueeJusqua); const faites = all.filter((x) => x.bloqueeJusqua);
  const base = vue === 'faites' ? faites : afaire; const list = base.filter((x) => !f || x.type === f);
  const counts = RELANCE_TYPES.map((t) => [t.id, base.filter((x) => x.type === t.id).length] as const).filter(([, n]) => n);
  const open = (x: Relance) => (x.cible === 'prestataire' && x.partenaireId ? openDrawer('partenaire', x.partenaireId, 'espace') : x.missionId ? openDrawer('mission', x.missionId) : openDrawer('client', x.clientId));

  async function relancer(x: Relance) {
    setBusy(x.key);
    try {
      const r = await api<{ canal: string }>('POST', '/api/relances/envoyer', { key: x.key, ...(edit[x.key] !== undefined ? { texte: edit[x.key] } : {}) });
      toast(r.canal === 'modele' ? `Relance envoyée à ${x.nom} (modèle approuvé, hors fenêtre de 24 h)` : `Relance envoyée à ${x.nom}`);
      setEdit((o) => { const n = { ...o }; delete n[x.key]; return n; }); setTick((t) => t + 1);
    } catch (e) {
      const a = e as ApiError;
      if (a.code === 'whatsapp_off') { setWaOff(true); toast('WhatsApp n’est pas relié au serveur : envoyez depuis votre téléphone, puis notez la relance.'); }
      else { toast(a.message || 'Envoi impossible.'); if (a.status === 409 || a.status === 404) setTick((t) => t + 1); }
    } finally { setBusy(''); }
  }
  async function noter(x: Relance) {
    setBusy(x.key);
    try { await api('POST', '/api/relances/marquer', { key: x.key }); toast(`Relance notée pour ${x.nom}`); setTick((t) => t + 1); }
    catch (e) { toast((e as ApiError).message || 'Impossible pour l’instant.'); setTick((t) => t + 1); }
    finally { setBusy(''); }
  }

  return <>
    <div className="view-h"><div><div className="label">Relation client</div><h2>À relancer</h2></div><div className="tools"><span className="muted">{items ? `${afaire.length} à faire · ${faites.length} relancée${faites.length > 1 ? 's' : ''}` : '…'}</span></div></div>
    <div className="seg" role="group" aria-label="Vue" style={{ marginBottom: 10 }}><button type="button" aria-pressed={vue === 'afaire'} onClick={() => setFilter('cvv', 'afaire')} data-testid="vue-afaire">À faire {afaire.length}</button><button type="button" aria-pressed={vue === 'faites'} onClick={() => setFilter('cvv', 'faites')} data-testid="vue-faites">Déjà relancées {faites.length}</button></div>
    <div className="pills" role="group" aria-label="Type" style={{ marginBottom: 14 }}><button type="button" aria-pressed={!f} onClick={() => setFilter('cvf', '')}>Toutes<span className="n">{base.length}</span></button>{counts.map(([k, n]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setFilter('cvf', k)}>{relanceLabel(k)}<span className="n">{n}</span></button>)}</div>
    {err && <div className="banner"><Icon k="alert" /><span>{err}</span></div>}
    {waOff && <div className="banner"><Icon k="alert" /><span>WhatsApp n’est pas relié au serveur. Ouvrez WhatsApp sur votre téléphone avec le bouton vert, puis « Noter » pour garder la trace et ne pas relancer deux fois.</span></div>}
    <div className="panel"><div className="list">{!items ? <Empty arch={false}>Calcul…</Empty> : list.length ? list.map((x) => {
      const cv = convs.find((k) => k.id === x.convId); const txt = edit[x.key] ?? x.messageSuggere; const bloq = !!x.bloqueeJusqua; const tel = telNorm(x.tel);
      return <div key={x.key} className={`row ${s.rel}`} role="button" tabIndex={0} onClick={() => open(x)} onKeyDown={(e) => { if (e.key === 'Enter') open(x); }} data-testid={`relance-${x.type}`}>
        <span className="ic-s"><Icon k={ICON[x.type] || 'spark'} /></span>
        <span style={{ minWidth: 0 }}>
          <div className="main-t">{x.nom || 'Client'}<span className="tagc">{relanceLabel(x.type)}</span>{x.cible === 'prestataire' && <span className="tagc">Prestataire</span>}</div>
          <div className="sub-t">{x.raison}</div>
          {edit[x.key] !== undefined && !bloq
            ? <textarea className="inp" rows={4} dir="auto" value={txt} aria-label="Message de relance" onClick={(e) => e.stopPropagation()} onChange={(e) => setEdit((o) => ({ ...o, [x.key]: e.target.value }))} style={{ marginTop: 6, width: '100%' }} />
            : <div className={s.relMsg} dir="auto">{txt}</div>}
          {x.derniere && <div className="sub-t" style={{ marginTop: 6 }} data-testid="derniere">{derniereTxt(x.derniere)}{bloq ? ` · prochaine relance possible le ${fmtDayLong(new Date(x.bloqueeJusqua!))}` : ''}</div>}
        </span>
        <span className={`sub-t ${s.hideM}`}>{x.lang || ''}{x.depuis ? ' · ' + relTime(x.depuis) : ''}</span>
        <span className={`sub-t ${s.hideM}`} title={x.fenetre ? 'Le contact a écrit il y a moins de 24 h : message libre.' : 'Plus de 24 h sans message du contact : WhatsApp impose le modèle approuvé « amane_relance ».'}>{bloq ? '' : x.fenetre ? 'Fenêtre ouverte' : 'Modèle approuvé'}</span>
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          {bloq ? <span className="tagc" data-testid="bloquee"><Icon k="check" />Relancé</span> : <>
            {tel ? <button className="btn sm primary" type="button" disabled={busy === x.key} onClick={() => relancer(x)} data-testid="relancer"><Icon k="wa" />{busy === x.key ? 'Envoi…' : 'Relancer'}</button> : <span className="sub-t">Pas de numéro</span>}
            {edit[x.key] === undefined ? <button className="btn sm ghost" type="button" onClick={() => setEdit((o) => ({ ...o, [x.key]: x.messageSuggere }))} disabled={!x.fenetre} title={x.fenetre ? 'Modifier le message avant l’envoi' : 'Hors fenêtre, le modèle approuvé est envoyé tel quel'}>Modifier</button> : <button className="btn sm ghost" type="button" onClick={() => setEdit((o) => { const n = { ...o }; delete n[x.key]; return n; })}>Annuler</button>}
            {waOff && tel && <a className="btn sm" href={waLink(x.tel || '', txt)} target="_blank" rel="noopener"><Icon k="wa" />WhatsApp</a>}
            <button className="btn sm ghost" type="button" disabled={busy === x.key} onClick={() => noter(x)} title="Relance faite par téléphone ou depuis votre WhatsApp : la noter évite de relancer deux fois" data-testid="noter">Noter</button>
          </>}
          {cv && <button className="btn sm ghost" type="button" onClick={() => nav(`/messages/${cv.id}`)} aria-label={`Conversation avec ${x.nom}`} title="Ouvrir la conversation"><Icon k="messages" /></button>}
          <QA tel={x.tel} noWa who={x.nom} />
        </span>
      </div>; }) : <Empty>{vue === 'faites' ? 'Aucune relance faite ces derniers jours.' : 'Rien à relancer. Beau travail.'}</Empty>}</div></div>
    <p className="muted" style={{ marginTop: 12 }}>Devis sans réponse depuis 48 h, acomptes à J-3, soldes après la mission, factures en retard, missions à faire confirmer par les prestataires (7 jours avant), habitués silencieux, dates importantes. Une relance envoyée ou notée n’est plus proposée avant son délai : {RELANCE_TYPES.map((t) => `${t.court.toLowerCase()} ${t.delai} j`).join(', ')}.</p>
  </>;
}
