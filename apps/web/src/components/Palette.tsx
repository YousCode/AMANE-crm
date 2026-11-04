/* Palette ⌘K : actions, clients, demandes, carnet, flotte. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './Modal.module.css';
import { Icon, SVC_ICON } from './Icon';
import { useUI } from '../store/ui';
import { useStore } from '../store/store';
import { ROUTES } from './Shell';
import { STATUTS, CLIENT_STATUTS, PART_TYPES } from '../shared';
import { label } from './ui';

type Item = { g: string; l: string; ic: string; k: string; go: () => void };
export function Palette() {
  const { pal, setPal, openDrawer, setMj } = useUI(); const nav = useNavigate();
  const clients = useStore((x) => x.clients), missions = useStore((x) => x.missions), partenaires = useStore((x) => x.partenaires), vehicules = useStore((x) => x.vehicules), logout = useStore((x) => x.logout);
  const [q, setQ] = useState(''); const [i, setI] = useState(0); const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (pal) { setQ(''); setI(0); setTimeout(() => inp.current?.focus(), 30); } }, [pal]);
  const items = useMemo<Item[]>(() => {
    const ql = q.toLowerCase().trim(); const it: Item[] = []; const close = () => setPal(false);
    const acts: Item[] = [
      { g: 'Actions', l: 'Nouvelle demande', ic: 'plus', k: '', go: () => { close(); openDrawer('mission'); } },
      { g: 'Actions', l: 'Ouvrir le majordome', ic: 'spark', k: '', go: () => { close(); setMj(true); } },
      { g: 'Actions', l: 'Nouveau client', ic: 'user', k: '', go: () => { close(); openDrawer('client'); } },
      { g: 'Actions', l: 'Nouveau partenaire', ic: 'carnet', k: '', go: () => { close(); openDrawer('partenaire'); } },
      { g: 'Actions', l: 'Ajouter un véhicule', ic: 'flotte', k: '', go: () => { close(); openDrawer('vehicule'); } },
      ...ROUTES.map(([to, l, k]) => ({ g: 'Actions', l: 'Aller à ' + l, ic: k, k: '', go: () => { close(); nav(to); } })),
      { g: 'Actions', l: 'Se déconnecter', ic: 'logout', k: '', go: () => { close(); logout(); } },
    ];
    acts.forEach((a) => { if (!ql || a.l.toLowerCase().includes(ql)) it.push(a); });
    if (ql) {
      clients.filter((c) => [c.nom, c.tel, c.email, c.hotel].join(' ').toLowerCase().includes(ql)).slice(0, 6).forEach((c) => it.push({ g: 'Clients', l: c.nom, ic: 'user', k: label(CLIENT_STATUTS, c.statut), go: () => { close(); openDrawer('client', c.id); } }));
      missions.filter((m) => [m.titre, m.lieu, clients.find((c) => c.id === m.clientId)?.nom].join(' ').toLowerCase().includes(ql)).slice(0, 6).forEach((m) => it.push({ g: 'Demandes', l: m.titre, ic: SVC_ICON[m.service || ''] || 'spark', k: label(STATUTS, m.statut), go: () => { close(); openDrawer('mission', m.id); } }));
      partenaires.filter((p) => [p.nom, p.contact, p.tel, p.langues].join(' ').toLowerCase().includes(ql)).slice(0, 6).forEach((p) => it.push({ g: 'Carnet', l: p.nom, ic: 'carnet', k: label(PART_TYPES, p.type), go: () => { close(); openDrawer('partenaire', p.id); } }));
      vehicules.filter((v) => [v.nom, v.plaque].join(' ').toLowerCase().includes(ql)).forEach((v) => it.push({ g: 'Flotte', l: v.nom, ic: 'flotte', k: v.statut || '', go: () => { close(); openDrawer('vehicule', v.id); } }));
    }
    return it;
  }, [q, clients, missions, partenaires, vehicules, nav, openDrawer, setMj, setPal, logout]);
  if (!pal) return null;
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } else if (e.key === 'Enter') { e.preventDefault(); items[i]?.go(); } };
  let g = '';
  return (
    <div className={s.modal} onClick={(e) => { if (e.target === e.currentTarget) setPal(false); }}>
      <div className={s.box} role="dialog" aria-modal="true" aria-label="Recherche">
        <div className={s.palIn}><Icon k="search" /><input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={onKey} autoComplete="off" placeholder="Client, demande, véhicule, action…" aria-label="Rechercher" /></div>
        <div className={s.list} role="listbox">
          {items.length ? items.map((x, j) => { const h = x.g !== g ? <div className={s.g}>{x.g}</div> : null; g = x.g; return <div key={j}>{h}<button className={s.it} type="button" role="option" aria-selected={j === i} onClick={x.go}><Icon k={x.ic} /><span>{x.l}</span><span className={s.k}>{x.k}</span></button></div>; }) : <div className="empty">Aucun résultat.</div>}
        </div>
      </div>
    </div>
  );
}
