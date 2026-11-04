import type React from 'react';
/* Aujourd'hui : KPI, agenda 72 h, à faire par rôle, flotte, messages non lus, fil de l'équipe (desktop) ; carte héros + fil du jour (téléphone). */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import s from './Today.module.css';
import { Icon, CarSil } from '../components/Icon';
import { Av, Chip, QA, Kpi, Empty, SysAv, teamOf, whoName, helloTxt } from '../components/ui';
import { useStore, byId } from '../store/store';
import { useUI } from '../store/ui';
import { useData, useIsMobile } from '../lib/hooks';
import { todos, caMois, joursLoues, seuil, ACTIVE, BOOK, nowLine, nowState, ST_CHIP, svcName, vehicles, isVan, progLabel, type Todo } from '../lib/rules';
import { parse, sod, addD, sameDay, fmtK, fmtTime, fmtDT, monthBounds, relTime, dayLabel, overlapDays } from '../lib/format';
import { TEAM, mapsLink, telNorm, waLink, type Mission } from '../shared';
import { photoURL } from '../lib/api';
import { ConvRow } from './Messages';

export function TodoList({ T, sel, setSel, limit }: { T: Record<string, Todo[]>; sel: string; setSel: (s: string) => void; limit?: number }) {
  const { openDrawer } = useUI(); const [all, setAll] = useState(false);
  const mine = T[sel] || []; const sh = limit && !all ? mine.slice(0, limit) : mine;
  const go = (x: Todo) => { if (x.cid) openDrawer('client', x.cid); else if (x.vid) openDrawer('vehicule', x.vid, x.vtab || 'main'); else openDrawer('mission', x.id, x.tab || 'main'); };
  return <>
    <div className="todo-tabs" role="group" aria-label="À faire par personne">{TEAM.map((p) => <button key={p.id} type="button" aria-pressed={sel === p.id} onClick={() => { setSel(p.id); setAll(false); }}><Av id={p.id} />{p.nom} <span className="n">{T[p.id].length}</span></button>)}</div>
    {sh.length ? sh.map((x, i) => <button key={i} className="todo" type="button" onClick={() => go(x)}><span className="sev" style={{ background: `var(--${x.sev})` }} /><span><div className="tt">{x.t}</div><div className="td">{x.d}</div></span></button>) : <Empty>Rien en attente pour {teamOf(sel)?.nom}.</Empty>}
    {mine.length > sh.length && <button className={s.moreL} type="button" onClick={() => setAll(true)}>Voir les {mine.length - sh.length} autres</button>}
  </>;
}
export function Feed({ n }: { n: number }) {
  const feed = useStore((x) => x.feed); const D = useData(); const convs = useStore((x) => x.conversations); const { openDrawer } = useUI();
  if (!feed) return <Empty arch={false}>Chargement…</Empty>; const it = feed.slice(0, n); if (!it.length) return <Empty arch={false}>Aucune activité récente.</Empty>;
  return <div>{it.map((a, i) => { const k = ({ missions: 'mission', clients: 'client', vehicules: 'vehicule', partenaires: 'partenaire' } as Record<string, string>)[a.col]; const col = (D as unknown as Record<string, { id: string; titre?: string; nom?: string }[]>)[a.col]; const d = col ? byId(col, a.docId) : undefined; const cv = a.col === 'conversations' ? byId(convs, a.docId) : undefined;
    const inner = <>{teamOf(a.user) ? <Av id={a.user} /> : <SysAv u={a.user} />}<span className="w" style={{ minWidth: 0 }}><b>{whoName(a.user)}</b> · {a.resume}{(d || cv) && <small>{d ? d.titre || d.nom : cv?.nom}</small>}</span><span className="d">{relTime(a.at)}</span></>;
    if (d && k) return <button key={i} className="act-i" type="button" onClick={() => openDrawer(k as 'mission', a.docId)}>{inner}</button>;
    if (cv) return <Link key={i} className="act-i" to={`/messages/${cv.id}`} style={{ textDecoration: 'none' }}>{inner}</Link>;
    return <div key={i} className="act-i">{inner}</div>; })}</div>;
}
export function Thumb({ v }: { v: { photos?: string[]; nom?: string; categorie?: string } }) { const c = v.photos && v.photos[0]; return <span className="thumb">{c ? <img src={photoURL(c)} alt="" loading="lazy" /> : <CarSil van={isVan(v as never)} />}</span>; }

function nextMission(ms: Mission[]) {
  const now = new Date(); const bk = ms.filter((m) => BOOK.includes(m.statut) && parse(m.debut));
  const up = bk.filter((m) => parse(m.debut)! > now).sort((a, b) => +parse(a.debut)! - +parse(b.debut)!)[0];
  const cur = bk.filter((m) => parse(m.debut)! <= now && (parse(m.fin) || parse(m.debut))! > now).sort((a, b) => +(parse(a.fin) || 0) - +(parse(b.fin) || 0))[0];
  if (up && (!cur || +parse(up.debut)! - +now < 3 * 36e5)) return { m: up, cur: false }; if (cur) return { m: cur, cur: true }; return null;
}

export function Today() {
  const D = useData(); const user = useStore((x) => x.user); const convs = useStore((x) => x.conversations); const mobile = useIsMobile(); const { openDrawer } = useUI();
  const T = useMemo(() => todos(D), [D]); const [sel, setSel] = useState<string>(user?.id || 'amel');
  const now = new Date(), ms = D.missions, vs = vehicles(D.vehicules);
  const ca = caMois(ms, now); const months = [5, 4, 3, 2, 1, 0].map((i) => caMois(ms, new Date(now.getFullYear(), now.getMonth() - i, 15))); const prevCa = months[4];
  const pipe = ms.filter((m) => ['nouvelle', 'proposition'].includes(m.statut)).reduce((x, m) => x + (+(m.montant || 0)), 0);
  const won = ms.filter((m) => ACTIVE.includes(m.statut)).length, lost = ms.filter((m) => m.statut === 'perdue').length; const conv = won + lost ? Math.round(won / (won + lost) * 100) : 0;
  const [, mb] = monthBounds(now); const dim = mb.getDate(); const used = vs.reduce((x, v) => x + joursLoues(ms, v, now), 0); const occ = vs.length ? Math.round(used / (vs.length * dim) * 100) : 0;
  const cl = (m: Mission) => byId(D.clients, m.clientId);
  const unread = [...convs].filter((c) => +(c.unread || 0) > 0).sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || ''))).slice(0, 4);

  if (mobile) {
    const t0 = sod(now), t1 = addD(t0, 1); const items: { t: Date | null; m: Mission; p?: NonNullable<Mission['programme']>[number] }[] = [];
    ms.filter((m) => m.statut !== 'perdue' && parse(m.debut) && parse(m.debut)! < t1 && (parse(m.fin) || parse(m.debut))! >= t0).forEach((m) => { const a = parse(m.debut) as Date; items.push({ t: a >= t0 ? a : null, m }); (m.programme || []).forEach((p) => { const d = parse(p.dt); if (d && d >= t0 && d < t1) items.push({ t: d, m, p }); }); });
    items.sort((x, y) => (x.t ? +x.t : 0) - (y.t ? +y.t : 0));
    const nx = nextMission(ms);
    return <>
      {nx ? (() => { const m = nx.m, c = cl(m), v = byId(D.vehicules, m.vehiculeId), ch = byId(D.partenaires, m.chauffeurId); const a = parse(m.debut), b = parse(m.fin); const when = nx.cur ? 'En cours · fin prévue' : dayLabel(a);
        const cell = (href: string, ic: string, l: string, blank?: boolean) => href ? <a href={href} target={blank ? '_blank' : undefined} rel={blank ? 'noopener' : undefined}><Icon k={ic} /><span>{l}</span></a> : <span className={s.dis} aria-hidden="true"><Icon k={ic} /><span>{l}</span></span>;
        return <article className={s.hero} aria-label={nx.cur ? 'Mission en cours' : 'Prochaine mission'}><div className={s.lb}>{nx.cur ? 'Mission en cours' : 'Prochaine mission'}</div><div className={s.tm}><span>{fmtTime(nx.cur ? b : a)}</span><small>{when}</small></div><h3>{m.titre}</h3>
          <dl>{c?.nom && <><dt>Client</dt><dd>{c.nom}</dd></>}{v && <><dt>Voiture</dt><dd>{v.nom}</dd></>}{m.lieu && <><dt>Lieu</dt><dd>{m.lieu}</dd></>}{(ch || m.chauffeur) && <><dt>Chauffeur</dt><dd>{ch ? ch.nom : m.chauffeur}</dd></>}</dl>
          <div className={s.ha}>{cell(telNorm(c?.tel) ? 'tel:+' + telNorm(c?.tel) : '', 'phone', 'Appeler')}{cell(telNorm(c?.tel) ? waLink(c?.tel, helloTxt(c)) : '', 'wa', 'WhatsApp', true)}{cell(mapsLink(m.lieu || ''), 'nav', 'Itinéraire', true)}<button className={s.go} type="button" onClick={() => openDrawer('mission', m.id)}><Icon k="right" /><span>Ouvrir</span></button></div></article>; })()
        : <article className={`${s.hero} ${s.none}`}><div className={s.lb}>Prochaine mission</div><h3>Aucune mission confirmée à venir.</h3><p className="muted" style={{ margin: '8px 0 16px' }}>Dès qu’une demande est confirmée, elle apparaît ici avec l’appel au client et l’itinéraire en un geste.</p><button className="btn sm primary" type="button" onClick={() => openDrawer('mission')}><Icon k="plus" />Nouvelle demande</button></article>}
      <div className={s.mSec}><h2>Aujourd’hui</h2><span className={s.sub}>{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <div className={`panel ${s.mCard}`}><div className={s.tl}>{items.length ? items.map((x, i) => { const m = x.m, c = cl(m); if (x.p) { const pt = byId(D.partenaires, x.p.partenaireId); const lieu = x.p.lieu || pt?.adresse || ''; return <button key={i} className={`${s.tlI} ${s.sub}`} type="button" onClick={() => openDrawer('mission', m.id, 'prog')}><span className={s.t}>{fmtTime(x.t)}</span><span style={{ minWidth: 0 }}><div className={s.ti}>{progLabel(x.p.type)}{pt ? ' — ' + pt.nom : ''}</div><div className={s.meta}>{[c?.nom, lieu].filter(Boolean).join(' · ')}</div></span><QA tel={pt?.tel} noWa lieu={lieu} who={pt?.nom} keep /></button>; }
        const v = byId(D.vehicules, m.vehiculeId); return <button key={i} className={s.tlI} type="button" onClick={() => openDrawer('mission', m.id)}><span className={s.t}>{x.t ? fmtTime(x.t) : 'suite'}</span><span style={{ minWidth: 0 }}><div className={s.ti}>{m.titre}</div><div className={s.meta}>{[c?.nom, v?.nom, m.lieu].filter(Boolean).join(' · ') || svcName(D.services, m.service)}</div></span><QA tel={c?.tel} wa={helloTxt(c)} lieu={m.lieu} who={c?.nom} keep /></button>; }) : <Empty arch={false}>Rien de prévu aujourd’hui.</Empty>}</div></div>
      <div className={s.mSec}><h2>À faire</h2><span className={s.sub}>{(T[sel] || []).length} en attente</span></div>
      <div className={`panel ${s.mCard}`} style={{ paddingTop: 12, paddingBottom: 6 }}><TodoList T={T} sel={sel} setSel={setSel} limit={5} /></div>
      <div className={s.mSec}><h2>Messages</h2><Link className="lnk" to="/messages">Tout voir</Link></div>
      {unread.length ? <div className="panel" style={{ overflow: 'hidden' }}>{unread.map((cv) => <ConvRow key={cv.id} cv={cv} />)}</div> : <div className={`panel ${s.mCard}`}><Empty arch={false}>Aucun message non lu.</Empty></div>}
      <div className={s.mSec}><h2>Fil de l’équipe</h2><span className={s.sub}>en direct</span></div>
      <div className={`panel ${s.mCard}`}><Feed n={5} /></div>
      <div className={s.mSec}><h2>Ce mois</h2></div>
      <div className={s.mKpi}><Kpi label="Chiffre" v={fmtK(ca)} /><Kpi label="En négociation" v={fmtK(pipe)} /></div>
    </>;
  }

  const days = [0, 1, 2].map((i) => addD(sod(now), i));
  const counts = ['nouvelle', 'proposition', 'confirmee', 'encours', 'terminee'].map((st) => ms.filter((m) => m.statut === st).length); const mxC = Math.max(1, ...counts);
  return <>
    <div className="kpis">
      <Kpi label="Chiffre du mois" v={fmtK(ca)} h={prevCa ? `${ca >= prevCa ? '+' : ''}${Math.round((ca - prevCa) / prevCa * 100)} % vs mois dernier` : 'Missions confirmées, au prorata des jours'} spark={months} />
      <Kpi label="En négociation" v={fmtK(pipe)} h={`${ms.filter((m) => ['nouvelle', 'proposition'].includes(m.statut)).length} demandes ouvertes`} />
      <Kpi label="Transformation" v={`${conv} %`} h={`${won} gagnées · ${lost} perdues`} />
      <Kpi label="Flotte occupée" v={`${occ} %`} h={`${used} jours loués sur ${vs.length * dim}`} />
    </div>
    <div className="grid2">
      <div className="stack">
        <div className="panel pad"><div className="panel-h"><h2>Agenda</h2><span className="sub">72 prochaines heures</span></div>
          <div className={s.agenda}>{(() => { const out: React.ReactElement[] = []; days.forEach((d) => { const e = addD(d, 1); const items = ms.filter((m) => m.statut !== 'perdue' && m.statut !== 'terminee' && parse(m.debut) && parse(m.debut)! < e && (parse(m.fin) || parse(m.debut))! >= d).sort((a, b) => +parse(a.debut)! - +parse(b.debut)!); if (!items.length) return;
            out.push(<div key={'s' + d} className="day-sep">{dayLabel(d)}</div>); items.forEach((m) => { const c = cl(m), v = byId(D.vehicules, m.vehiculeId), a = parse(m.debut) as Date; out.push(<button key={d + m.id} className={s.ag} type="button" onClick={() => openDrawer('mission', m.id)}><span className={s.t}>{sameDay(a, d) ? fmtTime(a) : 'suite'}</span><span className={s.bar} style={{ background: m.statut === 'encours' ? 'var(--accent)' : m.statut === 'confirmee' ? 'var(--ok)' : 'var(--warn)' }} /><span style={{ minWidth: 0 }}><div className={s.ti}>{m.titre}</div><div className={s.meta}>{c?.nom || '—'} · {svcName(D.services, m.service)}{v ? ' · ' + v.nom : ''}{m.lieu ? ' · ' + m.lieu : ''}</div></span><span className={s.avh}><Av id={m.responsable} /></span><QA tel={c?.tel} wa={helloTxt(c)} lieu={m.lieu} who={c?.nom} keep /></button>); }); });
            return out.length ? out : <Empty>Aucune mission sur les trois prochains jours.</Empty>; })()}</div></div>
        <div className="panel pad"><div className="panel-h"><h2>Rentabilité de la flotte</h2><Link className="sub lnk" to="/flotte/rentabilite" style={{ color: 'var(--fg3)' }}>jours loués ce mois · trait = point mort</Link></div>
          {vs.length ? vs.map((v) => { const j = joursLoues(ms, v, now), se = seuil(v), max = Math.max(dim * .6, se * 1.6, j); const ok = j >= se; return <div key={v.id} className={s.fleetRow}><span className={s.nm}>{v.nom}</span><div className={s.track}><div className={`${s.fill} ${ok ? '' : s.low}`} style={{ width: `${Math.min(100, j / max * 100)}%` }} /><div className={s.be} style={{ left: `${Math.min(100, se / max * 100)}%` }} data-l={`seuil ${se.toFixed(1).replace('.', ',')} j`} /></div><span className={`${s.r} num`} style={{ color: ok ? 'var(--ok)' : 'var(--fg2)' }}>{j} j {ok ? '✓' : ''}</span></div>; }) : <Empty>Aucun véhicule. <button className="btn sm" type="button" onClick={() => openDrawer('vehicule')}>Ajouter un véhicule</button></Empty>}</div>
        <div className="panel pad"><div className="panel-h"><h2>Fil de l’équipe</h2><span className="sub">dernières modifications</span></div><Feed n={6} /></div>
      </div>
      <div className="stack">
        <div className="panel pad"><div className="panel-h"><h2>À faire</h2><span className="sub">par rôle</span></div><TodoList T={T} sel={sel} setSel={setSel} limit={7} /></div>
        <div className="panel pad"><div className="panel-h"><h2>Messages</h2><Link className="lnk" to="/messages">Tout voir</Link></div>{unread.length ? <div style={{ margin: '0 -22px' }}>{unread.map((cv) => <ConvRow key={cv.id} cv={cv} />)}</div> : <Empty arch={false}>Aucun message non lu.</Empty>}</div>
        <div className="panel pad"><div className="panel-h"><h2>La flotte maintenant</h2><span className="sub">{vs.filter((v) => nowState(ms, v).k === 'f').length} / {vs.length} libres</span></div>
          {vs.length ? vs.map((v) => { const st = nowState(ms, v); const [c, l] = ST_CHIP[st.k]; return <button key={v.id} className={s.nowRow} type="button" onClick={() => openDrawer('vehicule', v.id, 'dispo')}><Thumb v={v} /><span style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500 }}>{v.nom}</div><div className="sub-t">{nowLine(ms, v)}</div></span><Chip st={c}>{st.k === 'off' ? st.t : l}</Chip></button>; }) : <Empty arch={false}>Aucun véhicule.</Empty>}</div>
        <div className="panel pad"><div className="panel-h"><h2>Entonnoir</h2><span className="sub">toutes demandes</span></div><div className={s.funnel}>{counts.map((c, i) => <div key={i} style={{ height: `${8 + c / mxC * 92}%` }}><span>{c}</span></div>)}</div><div className={s.funnelL}>{['Nouvelles', 'Propos.', 'Confirm.', 'En cours', 'Termin.'].map((x) => <span key={x}>{x}</span>)}</div></div>
      </div>
    </div>
  </>;
}
export { overlapDays, fmtDT };
