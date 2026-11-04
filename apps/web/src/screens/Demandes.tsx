/* Demandes : kanban glisser-déposer (souris, stylet, doigt avec appui long) + liste balayable + flèches ‹ ›. */
import { useEffect, useMemo, useRef, useState } from 'react';
import s from './Demandes.module.css';
import { Icon, SVC_ICON } from '../components/Icon';
import { Av, Chip, QA, Empty, helloTxt, label } from '../components/ui';
import { useStore, byId } from '../store/store';
import { useUI } from '../store/ui';
import { useData, useIsMobile } from '../lib/hooks';
import { contratScore, svcName, services, OPEN_ST } from '../lib/rules';
import { parse, fmtDT, fmtE, fmtK, clone } from '../lib/format';
import { STATUTS, clashes, nextStatut, prevStatut, type Mission } from '../shared';

export function useMoveMission() {
  const put = useStore((x) => x.put); const toast = useUI((x) => x.toast); const missions = useStore((x) => x.missions);
  return async (id: string, statut: string) => { const m = byId(missions, id); if (!m || m.statut === statut) return; await put('missions', { ...clone(m), statut }); toast(`${m.titre} → ${label(STATUTS, statut)}`); };
}

function Card({ m, D, onOpen, move, dragging }: { m: Mission; D: ReturnType<typeof useData>; onOpen: () => void; move: (id: string, st: string) => void; dragging: boolean }) {
  const c = byId(D.clients, m.clientId), v = byId(D.vehicules, m.vehiculeId), k = contratScore(m), cl = clashes(m, D.missions).length; const prev = prevStatut(m.statut), next = nextStatut(m.statut);
  return (
    <div className={`${s.card} ${dragging ? s.dragging : ''}`} data-id={m.id} data-testid={`card-${m.id}`} tabIndex={0} role="button" onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <div className={s.ct} dir="auto">{m.titre}</div>
      <div className={s.cm}><Icon k="user" /><span>{c ? c.nom : 'Client à préciser'}</span></div>
      <div className={s.cm}><Icon k={SVC_ICON[m.service || ''] || 'spark'} /><span>{svcName(D.services, m.service)}{v ? ' · ' + v.nom : ''}</span></div>
      <div className={s.cm}><Icon k="clock" /><span>{fmtDT(parse(m.debut))}</span></div>
      {cl ? <div className={s.cm} style={{ color: 'var(--bad)' }}><Icon k="alert" /><span>Véhicule déjà réservé</span></div> : null}
      <div className={s.cf}><Av id={m.responsable} />{['confirmee', 'encours'].includes(m.statut) && <span className={`ck ${k.done === k.total ? 'y' : 'w'}`}><b>{k.done === k.total ? '✓' : k.done}</b>dossier</span>}<span className={s.amt}>{m.montant ? fmtE(m.montant) : '—'}</span></div>
      <div className={s.mv} onClick={(e) => e.stopPropagation()}><button type="button" aria-label="Étape précédente" disabled={!prev} onClick={() => prev && move(m.id, prev)}>‹</button><span>Déplacer</span><button type="button" aria-label="Étape suivante" disabled={!next} onClick={() => next && move(m.id, next)}>›</button></div>
    </div>
  );
}

/* Glisser-déposer maison : pointer events, fantôme cloné, appui long au doigt. */
function useKanbanDrag(onDrop: (id: string, col: string) => void) {
  const st = useRef<{ el: HTMLElement | null; id: string; pid: number; sx: number; sy: number; ox: number; oy: number; started: boolean; touch: boolean; timer: number; ghost: HTMLElement | null; over: HTMLElement | null }>({ el: null, id: '', pid: -1, sx: 0, sy: 0, ox: 0, oy: 0, started: false, touch: false, timer: 0, ghost: null, over: null });
  const [draggingId, setDragging] = useState('');
  useEffect(() => {
    const D = st.current;
    const start = (x: number, y: number) => { const c = D.el; if (!c || !document.body.contains(c)) { D.el = null; return; } D.started = true; const r = c.getBoundingClientRect(); D.ox = x - r.left; D.oy = y - r.top; const g = c.cloneNode(true) as HTMLElement; g.classList.add(s.ghost); g.style.width = r.width + 'px'; document.body.appendChild(g); D.ghost = g; setDragging(D.id); document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; try { c.setPointerCapture(D.pid); } catch { /* ignore */ } if (D.touch && navigator.vibrate) try { navigator.vibrate(12); } catch { /* ignore */ } move(x, y); };
    const move = (x: number, y: number) => { if (D.ghost) D.ghost.style.transform = `translate(${x - D.ox}px,${y - D.oy}px) rotate(1.5deg)`; const el = document.elementFromPoint(x, y); const col = el && (el as HTMLElement).closest ? (el as HTMLElement).closest('[data-col]') as HTMLElement | null : null; if (col !== D.over) { D.over?.classList.remove(s.over); D.over = col; col?.classList.add(s.over); } const k = document.querySelector('[data-kanban]') as HTMLElement | null; if (k) { const kr = k.getBoundingClientRect(); if (x < kr.left + 50) k.scrollLeft -= 14; else if (x > kr.right - 50) k.scrollLeft += 14; } if (y < 70) window.scrollBy(0, -12); else if (y > innerHeight - 70) window.scrollBy(0, 12); };
    const end = () => { D.ghost?.remove(); D.ghost = null; D.over?.classList.remove(s.over); document.body.style.cursor = ''; document.body.style.userSelect = ''; const col = D.over, id = D.id, was = D.started; D.over = null; D.el = null; D.started = false; clearTimeout(D.timer); setDragging(''); return was ? { col, id } : null; };
    const down = (e: PointerEvent) => { if (e.button > 0) return; const t = e.target as HTMLElement; const c = t.closest && (t.closest('[data-id]') as HTMLElement | null); if (!c || !c.classList.contains(s.card) || t.closest('button,a,input,select,textarea')) return; D.el = c; D.id = c.dataset.id || ''; D.pid = e.pointerId; D.sx = e.clientX; D.sy = e.clientY; D.started = false; D.touch = e.pointerType === 'touch'; clearTimeout(D.timer); if (D.touch) { const x = e.clientX, y = e.clientY; D.timer = window.setTimeout(() => { if (D.el && !D.started) start(x, y); }, 300); } };
    const pm = (e: PointerEvent) => { if (!D.el || e.pointerId !== D.pid) return; if (!D.started) { const d = Math.hypot(e.clientX - D.sx, e.clientY - D.sy); if (D.touch) { if (d > 10) { clearTimeout(D.timer); D.el = null; } return; } if (d < 6) return; start(e.clientX, e.clientY); return; } move(e.clientX, e.clientY); };
    const up = (e: PointerEvent) => { if (!D.el || e.pointerId !== D.pid) return; const r = end(); if (r) { suppress.current = true; setTimeout(() => { suppress.current = false; }, 80); if (r.col && r.col.dataset.col) onDrop(r.id, r.col.dataset.col); } };
    const cancel = () => { if (D.el) end(); };
    const tm = (e: TouchEvent) => { if (D.started) e.preventDefault(); };
    const cm = (e: Event) => { if (D.el && D.touch) e.preventDefault(); };
    document.addEventListener('pointerdown', down); document.addEventListener('pointermove', pm); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel); document.addEventListener('touchmove', tm, { passive: false }); document.addEventListener('contextmenu', cm);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', pm); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); document.removeEventListener('touchmove', tm); document.removeEventListener('contextmenu', cm); };
  }, [onDrop]);
  const suppress = useRef(false);
  return { draggingId, suppress };
}

export function Demandes() {
  const D = useData(); const user = useStore((x) => x.user); const mobile = useIsMobile(); const { openDrawer, filters, setFilter } = useUI(); const move = useMoveMission();
  const dv = filters.dview || (mobile && !(typeof window !== 'undefined' && window.matchMedia('(min-width:700px)').matches) ? 'liste' : 'kanban');
  let ms = D.missions; if (filters.mine && user) ms = ms.filter((m) => m.responsable === user.id); if (filters.svc) ms = ms.filter((m) => m.service === filters.svc);
  const { draggingId, suppress } = useKanbanDrag(useMemo(() => (id: string, col: string) => move(id, col), [move]));
  const open = (id: string) => { if (suppress.current) return; openDrawer('mission', id); };
  return <>
    <div className="view-h"><div><div className="label">Pipeline</div><h2>Demandes</h2></div><div className="tools tools-dem">
      <div className="seg" role="group" aria-label="Filtre"><button type="button" aria-pressed={!filters.mine} onClick={() => setFilter('mine', false)}>Toutes</button><button type="button" aria-pressed={filters.mine} onClick={() => setFilter('mine', true)}>Les miennes</button></div>
      <select className="field-inline" aria-label="Service" value={filters.svc} onChange={(e) => setFilter('svc', e.target.value)}><option value="">Tous les services</option>{services(D.services).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>
      <div className="seg" role="group" aria-label="Affichage"><button type="button" aria-pressed={dv === 'kanban'} onClick={() => setFilter('dview', 'kanban')}>Colonnes</button><button type="button" aria-pressed={dv === 'liste'} onClick={() => setFilter('dview', 'liste')}>Liste</button></div>
      <button className="btn sm primary" type="button" onClick={() => openDrawer('mission')}><Icon k="plus" />Demande</button></div></div>
    {dv === 'liste' ? <ListView ms={ms} D={D} move={move} /> : <>
      <p className={s.hint}>Glissez une carte d’une colonne à l’autre (au doigt : appui long), ou utilisez les flèches ‹ › de la carte.</p>
      <div className={s.kanban} data-kanban="1">{STATUTS.map((st) => { const it = ms.filter((m) => m.statut === st.id).sort((a, b) => +(parse(a.debut) || 0) - +(parse(b.debut) || 0)); const tot = it.reduce((x, m) => x + (+(m.montant || 0)), 0);
        return <div key={st.id} className={s.col} data-col={st.id} data-testid={`col-${st.id}`}><div className={s.colH}><Chip st={st.id} /><span className={s.s}>{it.length} · {fmtK(tot)}</span></div>{it.map((m) => <Card key={m.id} m={m} D={D} onOpen={() => open(m.id)} move={move} dragging={draggingId === m.id} />)}</div>; })}</div>
    </>}
  </>;
}

function ListView({ ms, D, move }: { ms: Mission[]; D: ReturnType<typeof useData>; move: (id: string, st: string) => void }) {
  const { openDrawer, filters, setFilter } = useUI(); const f = filters.lst || 'open';
  const cnt = (id: string) => ms.filter((m) => m.statut === id).length;
  const sw = useRef<{ el: HTMLElement | null; id: string; pid: number; x0: number; y0: number; dx: number; on: boolean }>({ el: null, id: '', pid: -1, x0: 0, y0: 0, dx: 0, on: false }); const suppress = useRef(false);
  const reset = (el: HTMLElement | null) => { if (!el) return; el.classList.remove(s.dragx); el.style.transform = ''; el.parentElement?.classList.remove(s.toNext, s.toPrev, s.go); };
  const onDown = (e: React.PointerEvent, m: Mission) => { if (e.button > 0 || (e.target as HTMLElement).closest('a,button,input,select,textarea')) return; Object.assign(sw.current, { el: e.currentTarget as HTMLElement, id: m.id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, on: false }); };
  const onMove = (e: React.PointerEvent, m: Mission) => { const S = sw.current; if (!S.el || e.pointerId !== S.pid) return; const dx = e.clientX - S.x0, dy = e.clientY - S.y0; if (!S.on) { if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { S.el = null; return; } if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return; S.on = true; S.el.classList.add(s.dragx); try { S.el.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    const can = dx < 0 ? !!nextStatut(m.statut) : !!prevStatut(m.statut); S.dx = can ? dx : dx * .22; S.el.style.transform = `translateX(${S.dx}px)`; const w = S.el.parentElement!; w.classList.toggle(s.toNext, dx < 0 && can); w.classList.toggle(s.toPrev, dx > 0 && can); w.classList.toggle(s.go, can && Math.abs(dx) > 90); };
  const onUp = (e: React.PointerEvent, m: Mission) => { const S = sw.current; if (!S.el || e.pointerId !== S.pid) return; const el = S.el, dx = S.dx, on = S.on; S.el = null; if (!on) return; suppress.current = true; setTimeout(() => { suppress.current = false; }, 150); el.classList.remove(s.dragx);
    const to = dx < 0 ? nextStatut(m.statut) : prevStatut(m.statut); if (Math.abs(dx) > 90 && to) { el.style.transform = `translateX(${dx < 0 ? -115 : 115}%)`; if (navigator.vibrate) try { navigator.vibrate(10); } catch { /* ignore */ } setTimeout(() => { move(m.id, to); setTimeout(() => reset(el), 400); }, 200); } else reset(el); };
  const body = STATUTS.filter((st) => (f === 'open' ? OPEN_ST.includes(st.id) : st.id === f)).map((st) => { const it = ms.filter((m) => m.statut === st.id).sort((a, b) => +(parse(a.debut) || 0) - +(parse(b.debut) || 0)); if (!it.length) return null; const tot = it.reduce((x, m) => x + (+(m.montant || 0)), 0);
    return <section key={st.id} className={s.lgrp}><div className={s.lgrpH}><Chip st={st.id} /><span className={s.s}>{it.length} · {fmtK(tot)}</span></div>{it.map((m) => { const c = byId(D.clients, m.clientId), v = byId(D.vehicules, m.vehiculeId); const prev = prevStatut(m.statut), next = nextStatut(m.statut); const cl = clashes(m, D.missions).length;
      return <div key={m.id} className={s.sw}><div className={s.swBg} aria-hidden="true"><span className={s.p}>{prev ? '‹ ' + label(STATUTS, prev) : ''}</span><span className={s.n}>{next ? label(STATUTS, next) + ' ›' : ''}</span></div>
        <div className={s.lcard} role="button" tabIndex={0} data-testid={`lcard-${m.id}`} onClick={() => { if (!suppress.current) openDrawer('mission', m.id); }} onPointerDown={(e) => onDown(e, m)} onPointerMove={(e) => onMove(e, m)} onPointerUp={(e) => onUp(e, m)} onPointerCancel={() => { reset(sw.current.el); sw.current.el = null; }}>
          <div className={s.top}><span className={s.ct2} dir="auto">{m.titre}</span></div>
          <div className={s.cm}><Icon k="user" /><span>{c ? c.nom : 'Client à préciser'}</span></div><div className={s.cm}><Icon k={SVC_ICON[m.service || ''] || 'spark'} /><span>{svcName(D.services, m.service)}{v ? ' · ' + v.nom : ''}</span></div><div className={s.cm}><Icon k="clock" /><span>{fmtDT(parse(m.debut))}</span></div>{cl ? <div className={s.cm} style={{ color: 'var(--bad)' }}><Icon k="alert" /><span>Véhicule déjà réservé</span></div> : null}
          <div className={s.bt}><Av id={m.responsable} /><span className={s.amt}>{m.montant ? fmtE(m.montant) : '—'}</span><QA tel={c?.tel} wa={helloTxt(c)} lieu={m.lieu} who={c?.nom} /></div>
          <div className={s.mv} onClick={(e) => e.stopPropagation()}><button type="button" aria-label="Étape précédente" disabled={!prev} onClick={() => prev && move(m.id, prev)}>‹</button><span>{prev || next ? 'Balayer ou' : ''} déplacer</span><button type="button" aria-label="Étape suivante" disabled={!next} onClick={() => next && move(m.id, next)}>›</button></div>
        </div></div>; })}</section>; });
  return <>
    <div className="pills" role="group" aria-label="Statut" style={{ marginBottom: 14 }}><button type="button" aria-pressed={f === 'open'} onClick={() => setFilter('lst', 'open')}>Ouvertes<span className="n">{ms.filter((m) => OPEN_ST.includes(m.statut)).length}</span></button>{STATUTS.map((st) => <button key={st.id} type="button" aria-pressed={f === st.id} onClick={() => setFilter('lst', st.id)}>{st.label}<span className="n">{cnt(st.id)}</span></button>)}</div>
    <p className={s.hint} style={{ margin: '0 0 14px' }}>Balayez une demande vers la gauche pour l’avancer d’une étape, vers la droite pour la reculer.</p>
    {body.some(Boolean) ? body : <div className="panel"><Empty>Aucune demande ici.</Empty></div>}
  </>;
}
