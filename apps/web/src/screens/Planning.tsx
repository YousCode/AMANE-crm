/* Planning : semaine par véhicule et par chauffeur, conflits en rouge discret, « Qui est libre ? », export .ics. */
import { useState } from 'react';
import s from './Planning.module.css';
import { Icon } from '../components/Icon';
import { Chip, QA, Empty, helloTxt, label } from '../components/ui';
import { byId } from '../store/store';
import { useUI } from '../store/ui';
import { useData, useIsMobile, useCoarse } from '../lib/hooks';
import { chauffeurs, vehicles, planningICS, vehicleOn, ST_CHIP } from '../lib/rules';
import { parse, sod, addD, sameDay, fmtTime, toLocal, download, dayLabel } from '../lib/format';
import { STATUTS, clashes, chClashes, type Mission } from '../shared';
import t from './Today.module.css';

export function Planning() {
  const D = useData(); const mobile = useIsMobile(); const coarse = useCoarse(); const LANE = coarse ? 52 : 34; const { openDrawer, filters, setFilter } = useUI();
  const ms = D.missions.filter((m) => m.statut !== 'perdue'); const vs = vehicles(D.vehicules);
  const today = sod(new Date()); const mon = addD(today, -((new Date().getDay() + 6) % 7) + filters.week * 7); const sun = addD(mon, 7); const days = [...Array(7)].map((_, i) => addD(mon, i));
  const pv = filters.pview || (mobile ? 'liste' : 'grille');
  const [from, setFrom] = useState(filters.from || toLocal(new Date())); const [to, setTo] = useState(filters.to || toLocal(new Date(Date.now() + 864e5)));
  const a = parse(from), b = parse(to); const st = vs.map((v) => vehicleOn(ms, v, a, b)); const nf = st.filter((x) => x.k === 'f').length;
  const rows = [...vs.map((v) => ({ id: v.id, nom: v.nom, sub: v.categorie || '', ms: ms.filter((m) => m.vehiculeId === v.id), ch: false })), ...chauffeurs(D.partenaires).map((p) => ({ id: 'ch:' + p.id, nom: p.nom, sub: 'Chauffeur', ms: ms.filter((m) => m.chauffeurId === p.id), ch: true })), { id: '_none', nom: 'Sans véhicule', sub: 'chauffeur, shopping, conciergerie', ms: ms.filter((m) => !m.vehiculeId), ch: false }];
  const lbl = `${mon.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — ${addD(sun, -1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return <>
    <div className="view-h"><div><div className="label">Semaine</div><h2>{lbl}</h2></div><div className="tools">
      <button className="btn sm" type="button" aria-label="Semaine précédente" onClick={() => setFilter('week', filters.week - 1)}><Icon k="left" /></button><button className="btn sm" type="button" onClick={() => setFilter('week', 0)}>Cette semaine</button><button className="btn sm" type="button" aria-label="Semaine suivante" onClick={() => setFilter('week', filters.week + 1)}><Icon k="right" /></button>
      <div className="seg" role="group" aria-label="Affichage"><button type="button" aria-pressed={pv === 'liste'} onClick={() => setFilter('pview', 'liste')}>Jour par jour</button><button type="button" aria-pressed={pv === 'grille'} onClick={() => setFilter('pview', 'grille')}>Grille</button></div>
      <button className="btn sm" type="button" onClick={() => download('amane-planning.ics', planningICS(D))}><Icon k="down" />Agenda (.ics)</button></div></div>
    <div className={`panel ${s.free}`} style={{ boxShadow: 'none' }}><span className="label">Qui est libre ?</span><span className="pair"><label htmlFor="pFrom">Du</label><input className="field-inline" type="datetime-local" id="pFrom" value={from} onChange={(e) => { setFrom(e.target.value); setFilter('from', e.target.value); }} /></span><span className="pair"><label htmlFor="pTo">au</label><input className="field-inline" type="datetime-local" id="pTo" value={to} onChange={(e) => { setTo(e.target.value); setFilter('to', e.target.value); }} /></span><span style={{ marginLeft: 'auto', color: 'var(--fg2)' }}><b className="num" style={{ color: 'var(--ok)', fontWeight: 500 }}>{nf}</b> / {vs.length} libre{nf > 1 ? 's' : ''} sur la période</span>
      <div className={s.freeList}>{vs.map((v, i) => { const [c, l] = ST_CHIP[st[i].k]; return <button key={v.id} className="chip free-chip" type="button" style={{ cursor: 'pointer' }} onClick={() => openDrawer('vehicule', v.id, 'dispo')}><span className={`c-${c}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}><i style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor', flex: '0 0 auto' }} /><span className={s.fn}>{v.nom}</span></span><span className="muted" style={{ fontSize: '0.75rem', flex: '0 0 auto' }}>{st[i].k === 'off' ? st[i].t : l}</span></button>; })}</div></div>
    {pv === 'liste' ? <DayList days={days} ms={ms} D={D} /> : <div className={`panel ${s.wrap}`} data-plan="1"><div className={s.plan}>
      <div className={s.h}><div /> {days.map((d) => <div key={+d} className={sameDay(d, today) ? s.today : ''}>{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</div>)}</div>
      {rows.map((r) => { const inWeek = r.ms.filter((m) => { const a0 = parse(m.debut), b0 = parse(m.fin) || a0; return a0 && a0 < sun && b0! >= mon; }).sort((x, y) => +parse(x.debut)! - +parse(y.debut)!);
        const lanes: number[] = []; const placed = inWeek.map((m) => { const a0 = parse(m.debut) as Date, b0 = parse(m.fin) || a0; const st0 = Math.max(0, (+a0 - +mon) / 864e5), e = Math.min(7, Math.max(st0 + .6, (+b0 - +mon) / 864e5)); let l = lanes.findIndex((x) => x <= st0); if (l < 0) { l = lanes.length; lanes.push(e); } else lanes[l] = e; return { m, s: st0, e, l }; });
        const h = Math.max(1, lanes.length) * LANE + 16;
        return <div key={r.id} className={s.r} style={{ height: h }}><div className={s.rl} data-rowlabel="1">{r.nom}<small>{r.sub}</small></div>{days.map((d) => <div key={+d} className={`${s.cell} ${sameDay(d, today) ? s.today : ''}`} />)}<div className={s.lanes}>{placed.map((p) => { const c = byId(D.clients, p.m.clientId); const cl = (r.ch ? chClashes(p.m, D.missions) : clashes(p.m, D.missions)).length; return <button key={p.m.id} type="button" className={`${s.bar} ${s[p.m.statut] || ''} ${cl ? s.clash : ''}`} style={{ left: `calc(${p.s / 7 * 100}% + 3px)`, width: `calc(${(p.e - p.s) / 7 * 100}% - 6px)`, top: 8 + p.l * LANE, height: LANE - 6 }} onClick={() => openDrawer('mission', p.m.id)} title={p.m.titre} data-clash={cl ? '1' : undefined}><span className={s.bt} dir="auto">{c ? c.nom : p.m.titre} · {p.m.titre}</span></button>; })}</div></div>; })}
    </div></div>}
    <p className={s.legend}>Hachuré : proposition non confirmée. Contour rouge : véhicule ou chauffeur réservé deux fois au même moment. « Agenda (.ics) » s’importe dans Google Agenda ou Apple Calendrier.</p>
  </>;
}
function DayList({ days, ms, D }: { days: Date[]; ms: Mission[]; D: ReturnType<typeof useData> }) {
  const { openDrawer } = useUI();
  return <>{days.map((d) => { const e = addD(d, 1); const it = ms.filter((m) => parse(m.debut) && parse(m.debut)! < e && (parse(m.fin) || parse(m.debut))! >= d).sort((x, y) => +parse(x.debut)! - +parse(y.debut)!);
    return <div key={+d} className={s.day}><div className="day-sep">{dayLabel(d)}</div><div className={`panel ${t.mCard}`}><div className={t.tl}>{it.length ? it.map((m) => { const c = byId(D.clients, m.clientId), v = byId(D.vehicules, m.vehiculeId), ch = byId(D.partenaires, m.chauffeurId); const a = parse(m.debut) as Date, b = parse(m.fin);
      return <button key={m.id} className={t.tlI} type="button" onClick={() => openDrawer('mission', m.id)}><span className={t.t}>{sameDay(a, d) ? fmtTime(a) : b && sameDay(b, d) ? '→ ' + fmtTime(b) : 'suite'}</span><span style={{ minWidth: 0 }}><div className={t.ti} dir="auto">{m.titre}</div><div className={t.meta}>{[label(STATUTS, m.statut), c?.nom, v?.nom, ch ? ch.nom : m.chauffeur, m.lieu].filter(Boolean).join(' · ')}</div></span><QA tel={c?.tel} wa={helloTxt(c)} lieu={m.lieu} who={c?.nom} keep /></button>; }) : <Empty arch={false}>Libre.</Empty>}</div></div></div>; })}</>;
}
export { Chip };
