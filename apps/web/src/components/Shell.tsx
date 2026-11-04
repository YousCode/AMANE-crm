/* Coque de l'application : rail, en-tête, barre d'onglets mobile, feuille « Plus », tiroir, palette, majordome. */
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import s from './Shell.module.css';
import { Icon, Logo } from './Icon';
import { Av, teamOf, Toasts } from './ui';
import { useStore, unreadTotal } from '../store/store';
import { useUI } from '../store/ui';
import { todos, ACTIVE } from '../lib/rules';
import { overlapDays } from '../lib/format';
import { Drawer } from '../drawers/Drawer';
import { Palette } from './Palette';
import { Majordome } from './Majordome';
import { useIsMobile } from '../lib/hooks';
import { useShallow } from 'zustand/react/shallow';

export const ROUTES: [string, string, string][] = [['/', 'Aujourd’hui', 'salon'], ['/messages', 'Messages', 'messages'], ['/demandes', 'Demandes', 'demandes'], ['/planning', 'Planning', 'planning'], ['/clients', 'Clients', 'clients'], ['/carnet', 'Carnet', 'carnet'], ['/flotte', 'Flotte', 'flotte'], ['/finances', 'Finances', 'finances'], ['/relances', 'Relances', 'relances'], ['/contrats', 'Contrats', 'contrats'], ['/services', 'Services', 'services'], ['/reglages', 'Réglages', 'reglages'], ['/aide', 'Aide', 'aide']];
const TABS = ['/', '/messages', '/demandes', '/planning'];

function useClock() { const [t, setT] = useState(''); useEffect(() => { const f = () => setT('Paris · ' + new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit' })); f(); const i = setInterval(f, 20000); return () => clearInterval(i); }, []); return t; }

export function Live() {
  const { offline, pending, syncing, ready, wsOn } = useStore(useShallow((x) => ({ offline: x.offline, pending: x.pending, syncing: x.syncing, ready: x.ready, wsOn: x.wsOn })));
  let cls = s.live, txt: string; const m = pending > 1 ? 's' : '';
  if (offline) { cls += ' ' + s.off; txt = pending ? `Hors ligne — ${pending} modification${m} en attente` : 'Hors ligne'; }
  else if (pending) { cls += ' ' + s.sync; txt = `Envoi de ${pending} modification${m}…`; }
  else if (!ready) txt = syncing ? 'Synchronisation…' : 'Connexion…';
  else { cls += ' ' + s.on; txt = wsOn ? 'Synchronisé · en direct' : 'Synchronisé'; }
  return <span className={cls} data-testid="live"><i /><span>{txt}</span></span>;
}

export function Shell() {
  const loc = useLocation(); const nav = useNavigate(); const mobile = useIsMobile(); const clock = useClock();
  const user = useStore((x) => x.user); const missions = useStore((x) => x.missions); const clients = useStore((x) => x.clients); const vehicules = useStore((x) => x.vehicules); const partenaires = useStore((x) => x.partenaires); const services = useStore((x) => x.services); const convs = useStore((x) => x.conversations);
  const { openDrawer, setPal, setMj, plus, setPlus, drawer } = useUI();
  const T = useMemo(() => todos({ missions, clients, vehicules, partenaires, services }), [missions, clients, vehicules, partenaires, services]);
  const nNew = missions.filter((m) => m.statut === 'nouvelle').length, nU = unreadTotal(convs), nK = T.aziz.length;
  const badge = (k: string) => (k === 'demandes' ? nNew : k === 'messages' ? nU : k === 'contrats' ? nK : 0);
  const home = loc.pathname === '/'; const hasThread = /^\/messages\/.+/.test(loc.pathname) && mobile; const noFab = /^\/(messages|reglages|aide)/.test(loc.pathname);
  const h = new Date().getHours(); const g = h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir'; const me = teamOf(user?.id);
  const today = missions.filter((m) => ACTIVE.includes(m.statut) && overlapDays(m, new Date(), new Date())).length;
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(!useUI.getState().pal); } if (e.key === 'Escape') { const u = useUI.getState(); if (u.plus) u.setPlus(false); else if (u.pal) u.setPal(false); else if (u.mj) u.setMj(false); else if (u.drawer) u.closeDrawer(); } }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [setPal]);
  useEffect(() => { document.body.classList.toggle('has-drawer', !!drawer); }, [drawer]);
  const inTabs = TABS.includes(loc.pathname) || (loc.pathname.startsWith('/messages'));
  return (
    <div className={`${home ? s.home : s.notHome} ${hasThread ? s.hasThread : ''} ${noFab ? s.noFab : ''}`}>
      <nav className={s.rail} aria-label="Navigation">
        <div className={s.brand} title="Amane"><Logo arch size={40} /></div>
        {ROUTES.map(([to, l, k]) => { const n = badge(k); return <NavLink key={to} to={to} end={to === '/'} className={s.navBtn} aria-label={l}>{({ isActive }) => <><Icon k={k} /><span>{l}</span>{n ? <span className={s.dot}>{n}</span> : null}{isActive && <span hidden />}</>}</NavLink>; })}
        <div className={s.spacer} />
        <button className={`${s.meBtn} ${me ? s[me.id] : ''}`} type="button" aria-label="Mon compte" title={me ? `${me.nom} · ${me.role}` : ''} onClick={() => setPlus(true)}>{me ? me.nom[0] : '?'}</button>
      </nav>
      <main className={s.main}>
        <header className={s.topbar}>
          <div className={s.greet}>
            <div className={s.eyebrow}><span className="num">{clock}</span><Live /></div>
            <h1 className={s.hello}>{g}{me ? <>, <em>{me.nom}</em></> : null}.</h1>
            <p className={s.stats}>{today ? `${today} mission${today > 1 ? 's' : ''} aujourd’hui` : 'Aucune mission aujourd’hui'}{nNew ? ` · ${nNew} demande${nNew > 1 ? 's' : ''} à traiter` : ''}{nU ? ` · ${nU} message${nU > 1 ? 's' : ''} non lu${nU > 1 ? 's' : ''}` : ''}.</p>
          </div>
          <button className={s.searchBtn} type="button" onClick={() => setPal(true)} aria-label="Rechercher"><Icon k="search" /><span>Chercher un client, une demande…</span><kbd>⌘K</kbd></button>
          <button className={`btn ${s.mjBtn}`} type="button" onClick={() => setMj(true)}><Icon k="spark" /><span>Majordome</span></button>
          <NavLink className={s.helpBtn} to="/aide" aria-label="Aide et prise en main" title="Aide">?</NavLink>
          <button className={`btn primary ${s.newBtn}`} type="button" onClick={() => openDrawer('mission')}><Icon k="plus" w={1.8} /><span>Nouvelle demande</span></button>
        </header>
        <Outlet />
      </main>
      <nav className={s.tabbar} aria-label="Navigation principale">
        {TABS.map((to) => { const r = ROUTES.find((x) => x[0] === to)!; const n = badge(r[2]); return <NavLink key={to} to={to} end={to === '/'} className={s.tb} aria-label={r[1] + (n ? ` (${n})` : '')}><Icon k={r[2]} /><span>{r[1]}</span>{n ? <span className={s.dot}>{n}</span> : null}</NavLink>; })}
        <button className={s.tb} type="button" aria-label="Plus" aria-current={inTabs ? undefined : 'page'} onClick={() => setPlus(true)}><Icon k="more" w={2.6} /><span>Plus</span>{!inTabs && nK ? <span className={s.dot}>{nK}</span> : null}</button>
      </nav>
      <button className={s.fab} type="button" aria-label="Nouvelle demande" onClick={() => openDrawer('mission')}><Icon k="plus" w={1.8} /></button>
      {plus && <PlusSheet onClose={() => setPlus(false)} badge={badge} nav={nav} />}
      <Drawer />
      <Palette />
      <Majordome />
      <div className={s.toasts}><Toasts /></div>
    </div>
  );
}

function PlusSheet({ onClose, badge, nav }: { onClose: () => void; badge: (k: string) => number; nav: (to: string) => void }) {
  const user = useStore((x) => x.user); const logout = useStore((x) => x.logout); const pending = useStore((x) => x.pending);
  const { openDrawer, setPal, setMj, theme, setTheme } = useUI(); const me = teamOf(user?.id); const loc = useLocation(); const mobile = useIsMobile();
  const rest = ROUTES.filter(([to]) => !mobile || !TABS.includes(to));
  const go = (to: string) => { onClose(); nav(to); };
  const out = async () => { if (pending && !confirm(`${pending} modification${pending > 1 ? 's' : ''} n’${pending > 1 ? 'ont' : 'a'} pas encore été envoyée${pending > 1 ? 's' : ''}. Se déconnecter quand même ?`)) return; await logout(); onClose(); };
  return (
    <div className={s.sheetM} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Plus">
        <div className={s.grab} aria-hidden="true" />
        <div className={s.shUser}><Av id={me?.id} lg /><span><b>{me?.nom}</b><span className="r">{me?.role} · connecté</span></span><button className="btn sm" type="button" onClick={out}><Icon k="logout" />Se déconnecter</button></div>
        <div className={s.shGrid}>{rest.map(([to, l, k]) => { const n = badge(k); return <button key={to} className={s.shIt} type="button" aria-current={loc.pathname === to ? 'page' : undefined} onClick={() => go(to)}><Icon k={k} /><span>{l}</span>{n ? <span className={`${s.dot}`} style={{ position: 'absolute' }}>{n}</span> : null}</button>; })}</div>
        <div className={s.shT}>Outils</div>
        <div className={s.shGrid}>
          <button className={s.shIt} type="button" onClick={() => { onClose(); setPal(true); }}><Icon k="search" /><span>Rechercher</span></button>
          <button className={s.shIt} type="button" onClick={() => { onClose(); setMj(true); }}><Icon k="spark" /><span>Majordome</span></button>
          <button className={s.shIt} type="button" onClick={() => { onClose(); openDrawer('client'); }}><Icon k="user" /><span>Nouveau client</span></button>
          <button className={s.shIt} type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}><Icon k={theme === 'dark' ? 'moon' : 'sun'} /><span>Thème : {theme === 'auto' ? 'auto' : theme === 'dark' ? 'sombre' : 'clair'}</span></button>
        </div>
      </div>
    </div>
  );
}
