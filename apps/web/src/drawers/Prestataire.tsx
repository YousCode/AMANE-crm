/* Prestataires (loueurs) dans les fiches : inscription à valider et portail (fiche loueur), jours déclarés (fiche véhicule),
   disponibilité et marge (fiche demande). Les règles viennent du paquet partagé ; les appels serveur de lib/presta. */
import { useState } from 'react';
import s from './Drawer.module.css';
import { Icon } from '../components/Icon';
import { Chip, Empty } from '../components/ui';
import { byId } from '../store/store';
import { useUI } from '../store/ui';
import type { useData } from '../lib/hooks';
import { vehicles, nowState, ST_CHIP, proprio, dispoEtat, margeLignes } from '../lib/rules';
import { parse, fmtE, fmtDate, relTime, copyText } from '../lib/format';
import { portailLien, portailUrl, portailMsg, demanderDispo, errMsg } from '../lib/presta';
import { normDispos, waLink, telNorm, type Mission, type Vehicule, type Partenaire, type PortailRes, type DispoRes } from '../shared';

type D = ReturnType<typeof useData>;
/* « AAAA-MM-JJ » → date locale (les jours déclarés n'ont pas d'heure). */
const jourD = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const nbJours = (p: { du: string; au: string }) => Math.round((+jourD(p.au) - +jourD(p.du)) / 864e5) + 1;

/** Fiche loueur : inscription à valider (Valider / Refuser), lien du portail (créer, copier, WhatsApp, régénérer), ses véhicules. */
export function LoueurBloc({ p, curId, D, onValide, onRefuse }: { p: Partenaire; curId: string | null; D: D; onValide: () => void; onRefuse: () => void }) {
  const { toast, openDrawer } = useUI(); const live = byId(D.partenaires, curId); const token = live?.portailToken || '';
  const [res, setRes] = useState<PortailRes | null>(null); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState<'' | 'reset' | 'refus'>('');
  const aValider = !!(live ? live.aValider : p.aValider); const ins = p.inscription;
  const cur = res && res.token === token ? res : null; const url = cur?.url || portailUrl(token); const msg = cur?.message || portailMsg(p, url); const wa = telNorm(p.tel) ? cur?.waLink || waLink(p.tel, msg) : '';
  const vs = vehicles(D.vehicules).filter((v) => !!curId && v.partenaireId === curId);
  async function lien(o: { valider?: boolean; reset?: boolean }) {
    if (!curId || !live || live.type !== 'loueur') { toast('Enregistrez d’abord la fiche.'); return; }
    setBusy(true);
    try { const r = await portailLien(curId, o); setRes(r); if (o.valider) onValide(); toast(o.valider ? 'Inscription validée, lien du portail créé' : o.reset ? 'Nouveau lien créé' : 'Lien créé'); }
    catch (e) { toast(errMsg(e, o.valider ? 'Hors ligne : la validation attend le retour du réseau.' : 'Hors ligne : le lien se crée une fois le réseau revenu.', o.valider ? 'Validation impossible pour l’instant.' : 'Lien impossible pour l’instant.')); }
    finally { setBusy(false); setAsk(''); }
  }
  const annonce = ins && (ins.vehicules || ins.message) ? <>{ins.vehicules && <div className="stat"><span>Véhicules annoncés</span><b>{ins.vehicules}</b></div>}{ins.message && <div className={s.msg} dir="auto">{ins.message}</div>}</> : null;
  return <>
    {aValider ? <div className={`panel ${s.blk}`} data-testid="insc">
      <div className={s.blkH}><span className="label">Inscription à valider</span>{ins?.at && <span className="muted">reçue {relTime(ins.at)}</span>}</div>
      <div>{(p.societe || p.siren) && <div className="stat"><span>Société</span><b>{[p.societe, p.siren ? 'SIREN ' + p.siren : ''].filter(Boolean).join(' · ')}</b></div>}{annonce}</div>
      {ask === 'refus' ? <span className={s.confirm}>Refuser et supprimer cette inscription ? <button className="btn sm danger" type="button" onClick={onRefuse} data-testid="insc-refus-oui">Oui, refuser</button><button className="btn sm ghost" type="button" onClick={() => setAsk('')}>Annuler</button></span>
        : <div className={s.acts}><button className="btn sm primary" type="button" onClick={() => lien({ valider: true })} disabled={busy} data-testid="insc-ok"><Icon k="check" />Valider</button><button className="btn sm ghost danger" type="button" onClick={() => setAsk('refus')} data-testid="insc-refus">Refuser</button></div>}
      <p className="muted">Aucun accès pour ce prestataire tant que l’inscription n’est pas validée. Valider crée son lien personnel.</p>
    </div> : <div className={`panel ${s.blk}`} data-testid="portail">
      <div className={s.blkH}><span className="label">Portail prestataire</span>{url && live?.portailAt ? <span className="muted">lien créé {relTime(live.portailAt)}</span> : null}</div>
      {url ? <>
        <div className={s.linkBox}><Icon k="link" size={16} /><code data-testid="portail-url">{url}</code><button className="btn sm" type="button" onClick={() => copyText(url).then((ok) => toast(ok ? 'Lien copié' : 'Copie impossible'))}><Icon k="copy" />Copier</button>{wa && <a className="btn sm primary" href={wa} target="_blank" rel="noopener"><Icon k="wa" />Envoyer sur WhatsApp</a>}</div>
        {ask === 'reset' ? <span className={s.confirm}>L’ancien lien cessera de marcher. Régénérer ? <button className="btn sm danger" type="button" onClick={() => lien({ reset: true })} disabled={busy} data-testid="portail-reset-oui">Oui, régénérer</button><button className="btn sm ghost" type="button" onClick={() => setAsk('')}>Annuler</button></span>
          : <div className={s.acts}><button className="btn sm ghost" type="button" onClick={() => setAsk('reset')} data-testid="portail-reset">Régénérer le lien</button></div>}
      </> : <div className={s.acts}><button className="btn sm primary" type="button" onClick={() => lien({})} disabled={busy || !curId} data-testid="portail-btn"><Icon k="link" />{curId ? 'Créer le lien' : 'Enregistrez d’abord la fiche'}</button></div>}
      <p className="muted">{url && !wa ? 'Ajoutez son téléphone pour envoyer le lien par WhatsApp. ' : ''}Sans mot de passe : avec ce lien, le prestataire voit ses véhicules, déclare ses jours libres et répond aux demandes de dispo.</p>
    </div>}
    {curId && (!aValider || vs.length > 0) && <>
      <div className="sec-t">Ses véhicules</div>
      <div className="hist">{vs.length ? vs.map((v) => { const st = nowState(D.missions, v); const [c, l] = ST_CHIP[st.k]; return <button key={v.id} type="button" onClick={() => openDrawer('vehicule', v.id)} data-testid={`pv-${v.id}`}><span><span>{v.nom}</span><div className="sub-t" style={{ fontSize: '0.75rem' }}>{[v.categorie, v.plaque, +(v.prixAchatJour || 0) ? `achat ${fmtE(v.prixAchatJour)} / jour` : ''].filter(Boolean).join(' · ') || '—'}</div></span><Chip st={c}>{st.k === 'off' ? st.t : l}</Chip></button>; }) : <Empty arch={false}>Aucun véhicule confié pour l’instant.</Empty>}</div>
      {!aValider && <div><button className="btn sm" type="button" onClick={() => openDrawer('vehicule', null, 'main', { partenaireId: curId, loyerMois: '', chargesMois: '' })}><Icon k="plus" />Véhicule</button></div>}
    </>}
    {!aValider && annonce && <div className={`panel ${s.blk}`}><div className={s.blkH}><span className="label">Annoncé à l’inscription</span>{ins?.at && <span className="muted">{fmtDate(parse(ins.at))}</span>}</div><div>{annonce}</div></div>}
  </>;
}

/** Fiche véhicule d'un prestataire : jours où il le déclare disponible (lecture, ajout par deux dates, retrait). Enregistré avec la fiche. */
export function JoursDeclares({ v, upd }: { v: Vehicule; upd: (k: string, x: unknown) => void }) {
  const { toast } = useUI(); const ds = normDispos(v.dispos); const [du, setDu] = useState(''); const [au, setAu] = useState('');
  function add() { if (!du) { toast('Indiquez le premier jour.'); return; } const b = au || du; upd('dispos', normDispos([...ds, { du: du <= b ? du : b, au: du <= b ? b : du }])); setDu(''); setAu(''); }
  return <>
    <div className="sec-t">Jours déclarés</div>
    {ds.length ? <div data-testid="jours">{ds.map((p, i) => { const n = nbJours(p); return <div key={p.du} className={s.perRow}><span>{p.du === p.au ? `Le ${fmtDate(jourD(p.du))}` : `Du ${fmtDate(jourD(p.du))} au ${fmtDate(jourD(p.au))}`}</span><span>{n} jour{n > 1 ? 's' : ''}</span><button type="button" className="x-s" aria-label="Retirer la période" onClick={() => upd('dispos', ds.filter((_, j) => j !== i))}><Icon k="close" /></button></div>; })}</div> : <Empty arch={false}>Aucun jour déclaré : la dispo est à demander au prestataire à chaque demande.</Empty>}
    <div className={s.per}><div className="f"><label htmlFor="dispoDu">Du</label><input id="dispoDu" type="date" value={du} onChange={(e) => setDu(e.target.value)} /></div><div className="f"><label htmlFor="dispoAu">Au</label><input id="dispoAu" type="date" min={du || undefined} value={au} onChange={(e) => setAu(e.target.value)} /></div><button className="btn sm" type="button" onClick={add} data-testid="jours-add"><Icon k="plus" />Ajouter</button></div>
    <p className="muted">Sur ces jours, le véhicule compte comme libre ; en dehors, la dispo est à demander. Le prestataire les déclare aussi depuis son portail. Enregistrez pour les partager.</p>
  </>;
}

/** Fiche demande, véhicule d'un prestataire : état de la disponibilité, « Demander la dispo », marge (coût d'achat, marge en euros et en %). */
export function DispoBloc({ m, v, D, curId }: { m: Mission; v: Vehicule; D: D; curId: string | null }) {
  const { toast } = useUI(); const live = byId(D.missions, curId); const own = proprio(D.partenaires, v);
  const [sent, setSent] = useState<DispoRes | null>(null); const [busy, setBusy] = useState(false);
  /* Dates et véhicule du brouillon ; demandes et réponses telles que le serveur les a enregistrées. */
  const e = dispoEtat(D.missions, { ...m, id: curId || '', dispoDemandes: live?.dispoDemandes }, v); const mg = margeLignes(m, v);
  const change = !!live && (live.vehiculeId !== m.vehiculeId || (live.debut || '') !== (m.debut || '') || (live.fin || '') !== (m.fin || ''));
  async function ask() {
    if (!curId || !live) { toast('Enregistrez d’abord la demande.'); return; }
    if (change) { toast('Enregistrez d’abord la demande : véhicule ou dates modifiés.'); return; }
    if (!parse(m.debut)) { toast('Indiquez d’abord les dates de la demande.'); return; }
    setBusy(true);
    try { const r = await demanderDispo(curId, v.id, String(v.partenaireId)); setSent(r); toast(r.canal === 'whatsapp' ? 'Demande envoyée' : 'Demande prête : envoyez le message'); }
    catch (er) { toast(errMsg(er, 'Hors ligne : la dispo se demande une fois le réseau revenu.', 'Demande impossible pour l’instant.')); }
    finally { setBusy(false); }
  }
  const lab = e.k === 'attente' ? 'Relancer' : e.k === 'non' ? 'Redemander' : 'Demander la dispo'; const wa = sent ? sent.waLink || (telNorm(own?.tel) && sent.message ? waLink(own?.tel, sent.message) : '') : '';
  return <div className={`panel ${s.blk}`} data-testid="dispo">
    <div className={s.blkH}><span className="label">Disponibilité prestataire</span><span data-testid="dispo-etat" data-etat={e.k}><Chip st={e.st || undefined}>{e.label}</Chip></span></div>
    <div><div className={s.blkT}>{[own?.nom || 'Prestataire', v.nom].join(' · ')}</div><div className="muted">{e.d}</div></div>
    {(e.k === 'a_demander' || e.k === 'attente' || e.k === 'non') && <div className={s.acts}><button className={`btn sm${e.k === 'a_demander' ? ' primary' : ''}`} type="button" onClick={ask} disabled={busy || !curId} data-testid="dispo-btn"><Icon k="send" />{curId ? lab : 'Enregistrez d’abord la demande'}</button></div>}
    {sent && e.k === 'attente' && (sent.canal === 'whatsapp' ? <div className="note" data-testid="dispo-envoyee">Demande envoyée au prestataire sur WhatsApp. Sa réponse s’affichera ici.</div> : <>
      <div className={s.msg} dir="auto" data-testid="dispo-msg">{sent.message}</div>
      <div className={s.acts}>{wa && <a className="btn sm primary" href={wa} target="_blank" rel="noopener" data-testid="dispo-wa"><Icon k="wa" />Envoyer sur WhatsApp</a>}<button className="btn sm" type="button" onClick={() => copyText(sent.message || '').then((ok) => toast(ok ? 'Message copié' : 'Copie impossible'))}><Icon k="copy" />Copier</button></div>
      <p className="muted">{wa ? 'L’envoi automatique n’est pas disponible : envoyez ce message vous-même.' : 'Ajoutez le téléphone du prestataire pour l’envoyer par WhatsApp, ou copiez le message.'}</p>
    </>)}
    {mg ? <div data-testid="marge"><div className="stat"><span>Coût d’achat · {mg.coutD}</span><b className="num">{mg.cout}</b></div><div className="stat"><span>Marge{mg.taux ? '' : ' (montant à saisir)'}</span><b className="num" style={{ color: mg.taux ? (mg.neg ? 'var(--bad)' : 'var(--ok)') : undefined }}>{mg.marge}{mg.taux ? ' · ' + mg.taux : ''}</b></div></div> : <p className="muted">Indiquez le prix d’achat / jour sur la fiche du véhicule pour voir la marge.</p>}
  </div>;
}
