/* Primitives : chips, avatars, boutons de contact, champs, toasts. */
import React from 'react';
import { Icon } from './Icon';
import { TEAM, STATUTS, waLink, mapsLink, telNorm, type Client } from '../shared';
import { useUI } from '../store/ui';
import { t as tr } from '../shared';

export const teamOf = (id?: string | null) => TEAM.find((x) => x.id === id);
export const label = (arr: readonly { id: string; label: string }[], id?: string | null) => arr.find((x) => x.id === id)?.label || '—';
export function Av({ id, lg, title }: { id?: string | null; lg?: boolean; title?: string }) {
  const t = teamOf(id);
  return t ? <span className={`av ${t.id}${lg ? ' lg' : ''}`} title={title || `${t.nom} · ${t.role}`}>{t.nom[0]}</span> : <span className={`av none${lg ? ' lg' : ''}`} title="Non attribué">·</span>;
}
export const SysAv = ({ u }: { u: string }) => <span className="av sys" title={whoName(u)}>{({ whatsapp: 'W', site: 'S', ia: '✦', client: 'C', auto: '✦' } as Record<string, string>)[u] || '·'}</span>;
export const whoName = (u?: string) => teamOf(u)?.nom || ({ whatsapp: 'WhatsApp', site: 'Site', ia: 'Majordome', auto: 'Réponse automatique', client: 'Client' } as Record<string, string>)[u || ''] || 'Système';
export const Chip = ({ st, children, cls }: { st?: string; children?: React.ReactNode; cls?: string }) => <span className={`chip${st ? ' c-' + st : ''}${cls ? ' ' + cls : ''}`}><i />{children ?? label(STATUTS, st)}</span>;
/** Étiquettes client : tableau d'ids (contrat) ou objet {id:true} (anciennes fiches). */
export const clientTags = (c: { tags?: string[] | Record<string, boolean> }): string[] => Array.isArray(c.tags) ? c.tags : Object.keys(c.tags || {}).filter((k) => (c.tags as Record<string, boolean>)[k]);

/** Salutation dans la langue du client (début d'un message WhatsApp). */
export function helloTxt(c?: Partial<Client> | null) { const nom = String(c?.nom || '').trim(); return tr(c?.langue || 'FR', nom ? 'doc.hello' : 'doc.helloAnon', { nom }) + ' '; }
export const telHref = (t?: string) => { const n = telNorm(t); return n ? 'tel:+' + n : ''; };
export const smsHref = (t?: string) => { const n = telNorm(t); return n ? 'sms:+' + n : ''; };

/** Boutons « Appeler, WhatsApp, SMS, E-mail, Itinéraire, Copier l'adresse ». */
export function ContactBtns({ tel, email, lieu, wa, telLabel, waLabel, noSms, children }: { tel?: string; email?: string; lieu?: string; wa?: string; telLabel?: string; waLabel?: string; noSms?: boolean; children?: React.ReactNode }) {
  const toast = useUI((s) => s.toast);
  const t = telHref(tel), w = telNorm(tel) ? waLink(tel, wa || '') : '', s = smsHref(tel), m = mapsLink(lieu || '');
  return (
    <div className="ctc" role="group" aria-label="Contacter">
      {t && <a className="ct dark" href={t}><Icon k="phone" />{telLabel || 'Appeler'}</a>}
      {w && <a className="ct" href={w} target="_blank" rel="noopener"><Icon k="wa" />{waLabel || 'WhatsApp'}</a>}
      {s && !noSms && <a className="ct" href={s}><Icon k="sms" />SMS</a>}
      {email && /@/.test(email) && <a className="ct" href={`mailto:${email.trim()}`}><Icon k="mail" />E-mail</a>}
      {m && <><a className="ct" href={m} target="_blank" rel="noopener"><Icon k="nav" />Itinéraire</a><button className="ct" type="button" onClick={() => navigator.clipboard?.writeText(lieu || '').then(() => toast('Adresse copiée')).catch(() => toast('Copie impossible'))}><Icon k="copy" />Copier l’adresse</button></>}
      {children}
    </div>
  );
}
/** Petites icônes rondes dans les listes : appeler, WhatsApp, itinéraire. */
export function QA({ tel, wa, lieu, who, noWa, keep }: { tel?: string; wa?: string; lieu?: string; who?: string; noWa?: boolean; keep?: boolean }) {
  const t = telHref(tel), w = telNorm(tel) ? waLink(tel, wa || '') : '', m = lieu ? mapsLink(lieu) : '';
  if (!t && !w && !m) return keep ? <span /> : null;
  return (
    <span className="qa" onClick={(e) => e.stopPropagation()}>
      {t && <a href={t} aria-label={`Appeler ${who || ''}`} title="Appeler"><Icon k="phone" /></a>}
      {w && !noWa && <a href={w} target="_blank" rel="noopener" aria-label={`WhatsApp ${who || ''}`} title="WhatsApp"><Icon k="wa" /></a>}
      {m && <a href={m} target="_blank" rel="noopener" aria-label={`Itinéraire vers ${lieu}`} title="Itinéraire"><Icon k="nav" /></a>}
    </span>
  );
}
export const Empty = ({ children, arch = true }: { children: React.ReactNode; arch?: boolean }) => <div className="empty">{arch && <div className="arch" />}{children}</div>;
export function Toasts() { const toasts = useUI((s) => s.toasts); return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast" role="status">{t.text}</div>)}</div>; }

/* Champs de formulaire contrôlés par chemin (« contrat.caution ») */
interface FieldProps { k: string; label: string; value: unknown; onChange: (k: string, v: unknown) => void; type?: string; full?: boolean; ph?: string; opts?: readonly { id: string; label: string }[] | readonly string[]; err?: string; dir?: string; rows?: number; disabled?: boolean; id?: string }
export function Field({ k, label, value, onChange, type = 'text', full, ph, opts, err, dir, rows, disabled, id }: FieldProps) {
  const fid = id || 'f_' + k.replace(/\./g, '_'); const v = value == null ? '' : String(value);
  return (
    <div className={`f${full ? ' full' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      {type === 'textarea' ? <textarea id={fid} value={v} dir={dir} rows={rows} disabled={disabled} onChange={(e) => onChange(k, e.target.value)} placeholder={ph} aria-invalid={!!err} />
        : type === 'select' ? <select id={fid} value={v} disabled={disabled} onChange={(e) => onChange(k, e.target.value)} aria-invalid={!!err}>{(opts || []).map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          : <input id={fid} type={type} value={v} disabled={disabled} placeholder={ph} dir={dir} inputMode={type === 'number' ? 'decimal' : undefined} step={type === 'number' ? 'any' : undefined} onChange={(e) => onChange(k, type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value)} aria-invalid={!!err} />}
      {err && <span className="err">{err}</span>}
    </div>
  );
}
export const Check = ({ k, label, checked, onChange }: { k: string; label: string; checked: boolean; onChange: (k: string, v: boolean) => void }) => <label><input type="checkbox" checked={!!checked} onChange={(e) => onChange(k, e.target.checked)} />{label}</label>;
export const Spark = ({ vals }: { vals: number[] }) => { const w = 90, h = 34, mx = Math.max(1, ...vals); const pts = vals.map((v, i) => [i * (w / (vals.length - 1 || 1)), h - 3 - (v / mx) * (h - 8)]); const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); const last = pts[pts.length - 1]; return <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path d={`${d} L${w} ${h} L0 ${h}Z`} fill="var(--panel2)" /><path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" /><circle cx={last[0]} cy={last[1]} r="2.6" fill="var(--accent)" /></svg>; };
export const Kpi = ({ label: l, v, h, col, spark }: { label: string; v: React.ReactNode; h?: React.ReactNode; col?: string; spark?: number[] }) => <div className="panel kpi"><div className="label">{l}</div><div className="v num" style={col ? { color: col } : undefined}>{v}</div>{h && <div className="h">{h}</div>}{spark && <Spark vals={spark} />}</div>;
