/* Règles d'affichage dérivées des données (portées de crm/index.html) : à faire, disponibilité des véhicules, finances, exports. */
import { STATUTS, PART_TYPES, PROG_TYPES, MOYENS, SERVICES, clashes, chClashes, devisTotals, durDays, docLang, t as tr, LOCALES, type Mission, type Client, type Vehicule, type Partenaire, type Service, type Devis } from '../shared';
import { parse, sod, addD, fmtE, fmtDay, fmtDT, overlapDays, monthBounds, r2, esc, fmtL, pad } from './format';
import { LOGO_PATH } from '../components/Icon';

/* Libellé d'unité/type de document : « doc.type.x », repli « doc.type.autre » pour un type inconnu. */
const tl = (L: string, k: string) => { const v = tr(L, 'doc.' + k); return v === 'doc.' + k ? tr(L, 'doc.type.autre') : v; };
export const ACTIVE = ['confirmee', 'encours', 'terminee'];
export const BOOK = ['confirmee', 'encours'], OPT = ['nouvelle', 'proposition'];
export const OPEN_ST = ['nouvelle', 'proposition', 'confirmee', 'encours'];
export interface Data { missions: Mission[]; clients: Client[]; vehicules: Vehicule[]; partenaires: Partenaire[]; services: Service[] }
export const byId = <T extends { id: string }>(arr: T[], id?: string | null) => (id ? arr.find((x) => x.id === id) : undefined);
export const services = (s: Service[]): Service[] => [...(s.length ? s : (SERVICES as unknown as Service[]))].sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
export const svcName = (s: Service[], id?: string) => services(s).find((x) => x.id === id)?.nom || 'Service';
export const vehicles = (v: Vehicule[]) => [...v].sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
export const chauffeurs = (p: Partenaire[]) => p.filter((x) => x.type === 'chauffeur' && x.actif !== false);
export const isVan = (v: Vehicule) => /van|classe v/i.test((v.nom || '') + ' ' + (v.categorie || ''));
export const seuil = (v: Vehicule) => { const t = +(v.tarifJour || 0); return t ? ((+(v.loyerMois || 0)) + (+(v.chargesMois || 0))) / t : 0; };
export const caMois = (ms: Mission[], ref: Date) => { const [a, b] = monthBounds(ref); return ms.filter((m) => ACTIVE.includes(m.statut)).reduce((s, m) => { const d = durDays(m); const o = overlapDays(m, a, b); return s + (+(m.montant || 0)) * (d ? o / d : 0); }, 0); };
export const joursLoues = (ms: Mission[], v: Vehicule, ref: Date) => { const [a, b] = monthBounds(ref); return ms.filter((m) => m.vehiculeId === v.id && ACTIVE.includes(m.statut)).reduce((s, m) => s + overlapDays(m, a, b), 0); };
export function contratScore(m: Mission) { const k = m.contrat || ({} as Mission['contrat']); const p = k?.pieces || {}; const steps = [!!p.permis, !!p.passeport, !!p.domicile, k?.statut === 'signe', !!(k?.edlDepart && k.edlDepart.fait), !!(k?.edlRetour && k.edlRetour.fait)]; return { done: steps.filter(Boolean).length, total: steps.length }; }

export function vehMissions(ms: Mission[], v: Vehicule, excl?: string) { return ms.filter((m) => m.vehiculeId === v.id && m.id !== excl && [...BOOK, ...OPT].includes(m.statut) && parse(m.debut)); }
export type VehState = { k: 'f' | 'b' | 'o' | 'off'; m?: Mission; t?: string };
export function vehicleOn(ms: Mission[], v: Vehicule, a: Date | null, b: Date | null, excl?: string): VehState {
  if (v.statut && v.statut !== 'disponible') return { k: 'off', t: v.statut === 'entretien' ? 'En entretien' : 'Indisponible' };
  if (!a) return { k: 'f' }; b = b || a;
  const ov = vehMissions(ms, v, excl).filter((m) => (parse(m.debut) as Date) < (b as Date) && ((parse(m.fin) || parse(m.debut)) as Date) > a);
  const bk = ov.find((m) => BOOK.includes(m.statut)); if (bk) return { k: 'b', m: bk };
  const op = ov.find((m) => OPT.includes(m.statut)); return op ? { k: 'o', m: op } : { k: 'f' };
}
export function nowLine(ms: Mission[], v: Vehicule) {
  const now = new Date(); if (v.statut && v.statut !== 'disponible') return v.statut === 'entretien' ? 'En entretien' : 'Indisponible';
  const bk = vehMissions(ms, v).filter((m) => BOOK.includes(m.statut));
  const cur = bk.find((m) => (parse(m.debut) as Date) <= now && ((parse(m.fin) || parse(m.debut)) as Date) > now); if (cur) return 'En mission jusqu’au ' + fmtDT(parse(cur.fin));
  const nx = bk.filter((m) => (parse(m.debut) as Date) > now).sort((a, b) => +(parse(a.debut) as Date) - +(parse(b.debut) as Date))[0];
  return nx ? 'Libre jusqu’au ' + fmtDT(parse(nx.debut)) : 'Libre, aucune réservation à venir';
}
export const nowState = (ms: Mission[], v: Vehicule) => { const now = new Date(); return vehicleOn(ms, v, now, new Date(+now + 60000)); };
export const ST_CHIP: Record<string, [string, string]> = { f: ['confirmee', 'Libre'], b: ['perdue', 'Réservé'], o: ['proposition', 'Option'], off: ['proposition', 'Indisponible'] };
export function driverAt(ms: Mission[], vid: string, dt?: string) { const t = parse(dt); if (!t) return null; return ms.find((m) => m.vehiculeId === vid && ['confirmee', 'encours', 'terminee'].includes(m.statut) && parse(m.debut) && (parse(m.debut) as Date) <= t && ((parse(m.fin) || parse(m.debut)) as Date) >= t) || null; }

export type TodoKind = 'demande' | 'proposition' | 'contrat' | 'pieces' | 'caution' | 'attribuer' | 'prep' | 'solde' | 'conflit' | 'tache' | 'facture' | 'echeance' | 'pv' | 'entretien' | 'anniversaire';
/** `k` : nature de la tâche (classement dans le Salon) ; `at` : l'instant qui la rend urgente (départ, échéance) ; `days` : jours de retard ou d'attente. */
export interface Todo { sev: 'bad' | 'warn'; t: string; d: string; id?: string; tab?: string; vid?: string; vtab?: string; cid?: string; k?: TodoKind; at?: Date; days?: number }
export function todos(D: Data): Record<string, Todo[]> {
  const ms = D.missions, now = new Date(), out: Record<string, Todo[]> = { amel: [], youssouf: [], aziz: [] };
  const cl = (m: Mission) => byId(D.clients, m.clientId);
  ms.forEach((m) => {
    const c = cl(m), cn = c ? c.nom : 'Client'; const a = parse(m.debut); const k = m.contrat || ({} as NonNullable<Mission['contrat']>);
    if (m.statut === 'nouvelle') out.amel.push({ sev: 'bad', t: `Répondre à ${cn}`, d: m.titre, id: m.id, k: 'demande', at: a || undefined });
    if (m.statut === 'proposition' && a && +a - +now < 3 * 864e5 && a > now) out.amel.push({ sev: 'warn', t: `Relancer ${cn}`, d: `${m.titre} · ${fmtDay(a)}`, id: m.id, k: 'proposition', at: a });
    if (['confirmee', 'encours'].includes(m.statut)) {
      if (k.statut !== 'signe') out.aziz.push({ sev: a && +a - +now < 2 * 864e5 ? 'bad' : 'warn', t: `Contrat ${k.statut === 'envoye' ? 'à faire signer' : 'à rédiger'}`, d: `${cn} · ${fmtDay(a)}`, id: m.id, tab: 'contrat', k: 'contrat', at: a || undefined });
      const p = k.pieces || {}; if (m.vehiculeId && (!p.permis || !p.passeport)) out.aziz.push({ sev: 'warn', t: 'Pièces d’identité manquantes', d: `${cn} · ${m.titre}`, id: m.id, tab: 'contrat', k: 'pieces', at: a || undefined });
      if (m.vehiculeId && (+(k.caution || 0)) > 0 && k.cautionStatut === 'aucune') out.aziz.push({ sev: 'warn', t: `Caution ${fmtE(k.caution)} à pré-autoriser`, d: cn, id: m.id, tab: 'contrat', k: 'caution', at: a || undefined });
      if (!m.vehiculeId && ['location', 'van', 'chauffeur', 'transfert'].includes(m.service || '')) out.youssouf.push({ sev: 'warn', t: 'Véhicule à attribuer', d: `${m.titre} · ${fmtDay(a)}`, id: m.id, k: 'attribuer', at: a || undefined });
      if (m.vehiculeId && a && +a - +now < 1.5 * 864e5 && !(k.edlDepart && k.edlDepart.fait)) out.youssouf.push({ sev: 'warn', t: 'Préparer le véhicule et l’état des lieux', d: `${m.titre} · ${fmtDT(a)}`, id: m.id, tab: 'contrat', k: 'prep', at: a });
    }
    if (m.statut === 'terminee' && k.cautionStatut === 'preautorisee') out.aziz.push({ sev: 'warn', t: 'Caution à libérer', d: `${cn} · ${m.titre}`, id: m.id, tab: 'contrat', k: 'caution' });
    if (m.statut === 'terminee' && m.paiement !== 'solde') out.aziz.push({ sev: 'bad', t: 'Solde à encaisser', d: `${cn} · ${fmtE((+(m.montant || 0)) - (+(m.acompte || 0)))}`, id: m.id, tab: 'devis', k: 'solde', days: Math.max(0, Math.floor((+now - +(parse(m.fin) || now)) / 864e5)) });
    if (clashes(m, ms).length) out.youssouf.push({ sev: 'bad', t: 'Double réservation', d: m.titre, id: m.id, k: 'conflit', at: a || undefined });
    if (chClashes(m, ms).length) out.youssouf.push({ sev: 'bad', t: 'Chauffeur en double réservation', d: m.titre, id: m.id, k: 'conflit', at: a || undefined });
    if (m.statut !== 'perdue') (m.taches || []).forEach((x) => { if (x.fait || !x.resp || !out[x.resp] || !(x.t || '').trim()) return; const due = parse(x.due); out[x.resp].push({ sev: due && due < sod(now) ? 'bad' : 'warn', t: x.t, d: `${m.titre}${due ? ' · ' + fmtDay(due) : ''}`, id: m.id, tab: 'taches', k: 'tache', at: due || undefined }); });
    const dv = m.devis; if (dv && dv.factureNumero) { const tt = devisTotals(dv); const fd = parse(dv.factureDate); if (tt.solde > 0.005 && fd && +now - +fd > 7 * 864e5) out.aziz.push({ sev: 'bad', t: `Facture ${dv.factureNumero} en retard`, d: `${cn} · ${fmtE(tt.solde)}`, id: m.id, tab: 'devis', k: 'facture', days: Math.floor((+now - +fd) / 864e5) - 7 }); }
  });
  D.vehicules.forEach((v) => {
    const e = v.echeances || {}; ([['assurance', 'Assurance'], ['ct', 'Contrôle technique'], ['leasing', 'Fin de leasing']] as const).forEach(([k, l]) => { const d = parse(e[k]); if (d && +d - +now < 30 * 864e5) out.youssouf.push({ sev: +d - +now < 7 * 864e5 ? 'bad' : 'warn', t: `${l} ${v.nom}`, d: `Échéance ${fmtDay(d)}`, vid: v.id, k: 'echeance', at: d }); });
    (v.journal || []).forEach((j) => { if (j.type === 'pv' && !j.traite) { const m = driverAt(ms, v.id, j.dt); out.aziz.push({ sev: 'bad', t: `PV à désigner · ${v.nom}`, d: m ? `Conducteur : ${cl(m)?.nom || '?'}` : 'Date et heure à vérifier', vid: v.id, vtab: 'journal', k: 'pv', days: Math.max(0, Math.floor((+now - +(parse(j.dt) || now)) / 864e5)) }); } });
    const r = parse(v.revision); if (r && +r - +now < 30 * 864e5) out.youssouf.push({ sev: +r - +now < 7 * 864e5 ? 'bad' : 'warn', t: `Révision ${v.nom}`, d: `Prévue ${fmtDay(r)}`, vid: v.id, k: 'echeance', at: r });
    if (v.statut === 'entretien') out.youssouf.push({ sev: 'warn', t: `${v.nom} en entretien`, d: 'Indisponible à la location', vid: v.id, k: 'entretien' });
  });
  D.clients.forEach((c) => {
    const b = parse(c.naissance); const t0 = sod(now);
    const bd = (d: Date, l: string) => { let nx = new Date(t0.getFullYear(), d.getMonth(), d.getDate()); if (nx < t0) nx = new Date(t0.getFullYear() + 1, d.getMonth(), d.getDate()); const dd = Math.round((+nx - +t0) / 864e5); if (dd <= 7) out.amel.push({ sev: dd <= 1 ? 'bad' : 'warn', t: `${l} ${c.nom}`, d: dd === 0 ? 'Aujourd’hui' : `Dans ${dd} jour${dd > 1 ? 's' : ''} · ${fmtDay(nx)}`, cid: c.id, k: 'anniversaire', at: nx, days: dd }); };
    if (b) bd(b, 'Anniversaire de'); (c.datesImportantes || []).forEach((x) => { const d = parse(x.date); if (d) bd(d, x.label + ' ·'); });
  });
  return out;
}

export function dvDefaultLines(D: Data, d: Mission) {
  const v = byId(D.vehicules, d.vehiculeId), n = durDays(d) || 1, L: Devis['lignes'] = [];
  if (v) L.push({ d: `${svcName(D.services, d.service)} — ${v.nom}`, q: n, u: 'jour', pu: +(v.tarifJour || 0) });
  if (d.chauffeurId || d.service === 'chauffeur') { const ch = byId(D.partenaires, d.chauffeurId); L.push({ d: 'Chauffeur privé' + (ch ? ' — ' + ch.nom : ''), q: n, u: 'jour', pu: 0 }); }
  if (!L.length) L.push({ d: svcName(D.services, d.service) + (d.titre ? ' — ' + d.titre : ''), q: 1, u: 'forfait', pu: r2((+(d.montant || 0)) / 1.2) });
  return L;
}
export const progSteps = (m: Mission) => [...(m.programme || [])].filter((x) => x.dt).sort((a, b) => +(parse(a.dt) as Date) - +(parse(b.dt) as Date));
export function progText(D: Data, m: Mission) {
  const c = byId(D.clients, m.clientId) || ({} as Client), L = docLang(c), loc = LOCALES[L]; let day = '';
  const lines = [tr(L, String(c.nom || '').trim() ? 'doc.hello' : 'doc.helloAnon', { nom: String(c.nom || '').trim() }), '', tr(L, 'doc.progIntro'), ''];
  progSteps(m).forEach((x) => { const d = parse(x.dt) as Date; const dl = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }); if (dl !== day) { day = dl; lines.push('*' + dl.charAt(0).toUpperCase() + dl.slice(1) + '*'); } const p = byId(D.partenaires, x.partenaireId);
    lines.push(`${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false })} · ${tl(L, 'type.' + x.type)}${p ? ' — ' + p.nom : ''}${x.lieu ? ' — ' + x.lieu : ''}${x.client ? '\n    ' + x.client : ''}`); });
  if (!progSteps(m).length) lines.push('—'); lines.push('', tr(L, 'doc.sign')); return lines.join('\n');
}

/* Documents HTML (devis, facture, carnet, contrat) */
function docShell(title: string, L: string, body: string, legal: boolean) {
  const rtl = L === 'AR'; const a = `<svg width="26" viewBox="40 -60 940 1120"><path fill="#111" d="${LOGO_PATH}"/></svg>`;
  return `<!doctype html><html lang="${L.toLowerCase()}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:${rtl ? 'Tahoma,"Noto Naskh Arabic",' : ''}'Bodoni Moda',Georgia,"Times New Roman",serif;max-width:760px;margin:48px auto;padding:0 24px;color:#111;line-height:1.55;background:#fff}header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:1px solid #D9D3C9;padding-bottom:18px;margin-bottom:26px}.brand{display:flex;align-items:center;gap:12px;font-size:13px;letter-spacing:.32em;color:#111}h1{font-weight:400;font-size:30px;margin:0 0 4px}.muted{color:#6E675F;font-size:13px}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:8px 6px;border-bottom:1px solid #ECE6DC;text-align:${rtl ? 'right' : 'left'};vertical-align:top;font-size:14px}th{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6E675F;font-weight:400}td.n,th.n{text-align:${rtl ? 'left' : 'right'};white-space:nowrap}.tot{margin-${rtl ? 'right' : 'left'}:auto;width:min(360px,100%)}.tot td{border:0;padding:4px 6px}.tot tr.g td{border-top:1px solid #111;font-size:16px;padding-top:8px}.ph{background:#FFF3C4;padding:0 3px}h2{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#6E675F;font-weight:400;margin-top:28px}.day{margin-top:22px;font-size:17px;border-bottom:1px solid #ECE6DC;padding-bottom:6px}.st{display:grid;grid-template-columns:70px 1fr;gap:12px;padding:10px 0}.st b{font-weight:400;color:#8A6A3B}footer{margin-top:40px;font-size:11.5px;color:#6E675F;border-top:1px solid #D9D3C9;padding-top:12px}@media print{body{margin:0 auto}}</style></head><body><header><div class="brand">${a}<span>AMANE</span></div>${legal ? `<div class="muted" style="text-align:${rtl ? 'left' : 'right'}">Amane — <span class="ph">[Raison sociale]</span><br><span class="ph">[Adresse]</span><br>SIREN <span class="ph">[SIREN]</span> · TVA <span class="ph">[TVA intracom.]</span></div>` : ''}</header>${body}${legal ? `<footer>Amane · <span class="ph">[Raison sociale]</span> · SIREN <span class="ph">[SIREN]</span> · <span class="ph">[Adresse]</span> · TVA <span class="ph">[TVA intracom.]</span></footer>` : ''}</body></html>`;
}
export function devisHTML(D: Data, m: Mission, kind: 'devis' | 'facture') {
  const c = byId(D.clients, m.clientId) || ({} as Client), L = docLang(c), loc = LOCALES[L], dv = m.devis || { lignes: [] }, t = devisTotals(dv), fac = kind === 'facture';
  const T = (k: string) => tr(L, 'doc.' + k); const num = fac ? dv.factureNumero || '' : dv.numero || ''; const dt = parse(fac ? dv.factureDate : dv.date) || new Date();
  const rows = (dv.lignes || []).map((l) => `<tr><td>${esc(l.d)}</td><td class="n">${esc(l.q)}</td><td>${esc(tl(L, 'unit.' + l.u) || l.u)}</td><td class="n">${fmtL(l.pu, loc)}</td><td class="n">${fmtL((+l.q || 0) * (+l.pu || 0), loc)}</td></tr>`).join('');
  const pays = fac && (dv.paiements || []).length ? `<h2>${T('payments')}</h2><table>${(dv.paiements || []).map((q) => `<tr><td>${q.date ? esc((parse(q.date) as Date).toLocaleDateString(loc)) : ''}</td><td>${esc(MOYENS.find((x) => x.id === q.moyen)?.label || '')}</td><td class="n">${fmtL(q.montant, loc)}</td></tr>`).join('')}</table>` : '';
  const body = `<h1>${fac ? T('invoice') : T('quote')} ${esc(num)}</h1><p class="muted">${T('date')} : ${dt.toLocaleDateString(loc)} · ${T('ref')} : ${esc(m.titre || '')}${fac && dv.numero ? ' · ' + T('quote') + ' ' + esc(dv.numero) : ''}</p>
  <h2>${T('client')}</h2><p>${esc(c.nom || '')}<br>${esc([c.hotel, c.pays].filter(Boolean).join(', '))}<br>${esc([c.tel, c.email].filter(Boolean).join(' · '))}</p>
  <table><thead><tr><th>${T('desc')}</th><th class="n">${T('qty')}</th><th>${T('unit')}</th><th class="n">${T('pu')}</th><th class="n">${T('total')}</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="tot"><tr><td>${T('total')}</td><td class="n">${fmtL(t.ht, loc)}</td></tr>${t.rem ? `<tr><td>${T('discount')} ${esc(dv.remise)} %</td><td class="n">−${fmtL(t.rem, loc)}</td></tr>` : ''}<tr><td>${T('vat')} ${esc(t.rate)} %</td><td class="n">${fmtL(t.tva, loc)}</td></tr><tr class="g"><td>${T('ttc')}</td><td class="n">${fmtL(t.ttc, loc)}</td></tr>${fac ? `<tr><td>${T('paid')}</td><td class="n">${fmtL(t.paid, loc)}</td></tr><tr class="g"><td>${T('due')}</td><td class="n">${fmtL(Math.max(0, t.solde), loc)}</td></tr>` : ''}</table>${pays}
  <h2>${T('terms')}</h2><p>${T('termsTxt')}</p><h2>${T('bank')}</h2><p>IBAN <span class="ph">[IBAN]</span> · BIC <span class="ph">[BIC]</span></p>`;
  return docShell(`${fac ? T('invoice') : T('quote')} ${num}`, L, body, true);
}
export function carnetHTML(D: Data, m: Mission) {
  const c = byId(D.clients, m.clientId) || ({} as Client), L = docLang(c), loc = LOCALES[L]; let day = '', h = '';
  progSteps(m).forEach((x) => { const d = parse(x.dt) as Date; const dl = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }); if (dl !== day) { day = dl; h += `<div class="day">${esc(dl.charAt(0).toUpperCase() + dl.slice(1))}</div>`; } const p = byId(D.partenaires, x.partenaireId);
    h += `<div class="st"><b>${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false })}</b><div>${esc(tl(L, 'type.' + x.type))}${p ? ' — ' + esc(p.nom) : ''}${x.lieu || (p && p.adresse) ? `<div class="muted">${esc([x.lieu, p && p.adresse].filter(Boolean).join(' · '))}</div>` : ''}${x.client ? `<div>${esc(x.client)}</div>` : ''}</div></div>`; });
  const a = parse(m.debut), b = parse(m.fin);
  return docShell(tr(L, 'doc.prog'), L, `<h1>${tr(L, 'doc.prog')}</h1><p class="muted">${esc(c.nom || '')}${a ? ' · ' + a.toLocaleDateString(loc, { day: 'numeric', month: 'long' }) + (b ? ' — ' + b.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) : '') : ''}</p><p>${tr(L, 'doc.progIntro')}</p>${h || '<p>—</p>'}`, false);
}
export function contratHTML(D: Data, m: Mission) {
  const c = byId(D.clients, m.clientId) || ({} as Client), v = byId(D.vehicules, m.vehiculeId) || ({} as Vehicule), k = m.contrat || ({} as NonNullable<Mission['contrat']>); const a = parse(m.debut), b = parse(m.fin);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Contrat — ${esc(m.titre)}</title><style>body{font-family:'Bodoni Moda',Georgia,serif;max-width:720px;margin:48px auto;color:#111;line-height:1.6;padding:0 20px}h1{font-weight:400;font-size:28px;border-bottom:1px solid #B8955C;padding-bottom:10px}h2{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin-top:28px;font-weight:400}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #e5dccd;vertical-align:top}td:first-child{color:#6b5d55;width:40%}.sig{display:flex;gap:40px;margin-top:40px}.sig div{flex:1;border-top:1px solid #111;padding-top:8px;font-size:13px}.n{font-size:12px;color:#8a7a70;margin-top:40px}</style></head><body>
  <h1>Amane · Contrat de ${m.service === 'location' ? 'location de véhicule' : 'prestation'}</h1>
  <h2>Parties</h2><table><tr><td>Le prestataire</td><td>Amane — [Raison sociale, SIREN, adresse du siège]</td></tr><tr><td>Le client</td><td>${esc(c.nom || '[Nom]')}<br>${esc(c.tel || '')} ${esc(c.email || '')}<br>${esc([c.hotel, c.pays].filter(Boolean).join(', '))}</td></tr></table>
  <h2>Objet</h2><table><tr><td>Prestation</td><td>${esc(svcName(D.services, m.service))} — ${esc(m.titre)}</td></tr>${v.nom ? `<tr><td>Véhicule</td><td>${esc(v.nom)} ${esc(v.plaque || '[immatriculation]')} ${esc(v.couleur || '')}</td></tr>` : ''}<tr><td>Début</td><td>${a ? a.toLocaleString('fr-FR') : '[date]'}</td></tr><tr><td>Fin</td><td>${b ? b.toLocaleString('fr-FR') : '[date]'}</td></tr><tr><td>Lieu de remise</td><td>${esc(m.lieu || '[lieu]')}</td></tr>${m.chauffeur ? `<tr><td>Chauffeur</td><td>${esc(m.chauffeur)}</td></tr>` : ''}</table>
  <h2>Conditions financières</h2><table><tr><td>Montant total TTC</td><td>${fmtE(m.montant)}</td></tr><tr><td>Acompte versé</td><td>${fmtE(m.acompte)}</td></tr><tr><td>Solde dû</td><td>${fmtE((+(m.montant || 0)) - (+(m.acompte || 0)))}</td></tr>${(+(k.caution || 0)) ? `<tr><td>Dépôt de garantie</td><td>${fmtE(k.caution)}, par pré-autorisation bancaire</td></tr>` : ''}</table>
  ${v.nom ? `<h2>Conducteur et véhicule</h2><p>Le conducteur déclare être titulaire d’un permis de conduire valide depuis au moins [3] ans et avoir au moins [25] ans. Le véhicule est remis avec le niveau de carburant constaté à l’état des lieux de départ et doit être restitué dans le même état. Kilométrage inclus : [à préciser] km par jour ; au-delà : [à préciser] € par km. Toute infraction commise pendant la location est à la charge du client, qui sera désigné auprès de l’ANTAI.</p>
  <h2>État des lieux</h2><table><tr><td>Départ</td><td>${esc((k.edlDepart || {}).km || '[km]')} km · carburant ${esc((k.edlDepart || {}).carburant || '[ ]')}<br>${esc((k.edlDepart || {}).notes || '')}</td></tr><tr><td>Retour</td><td>${esc((k.edlRetour || {}).km || '[km]')} km · carburant ${esc((k.edlRetour || {}).carburant || '[ ]')}<br>${esc((k.edlRetour || {}).notes || '')}</td></tr></table>` : ''}
  <h2>Annulation</h2><p>[Conditions d’annulation et de remboursement de l’acompte à préciser.]</p>
  <div class="sig"><div>Pour Amane<br><br>Date et signature</div><div>Le client<br>« Lu et approuvé »<br>Date et signature</div></div>
  <p class="n">Modèle de travail généré depuis le CRM Amane le ${new Date().toLocaleDateString('fr-FR')}. À faire valider par l’avocat avant usage.</p></body></html>`;
}

/* Agenda ICS, finances, CSV, sauvegarde JSON */
const icsDate = (x?: string | Date) => { const d = parse(x); return d ? d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') : ''; };
const icsEsc = (x: unknown) => String(x || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
export function planningICS(D: Data) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Amane//CRM//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Amane'];
  D.missions.filter((m) => BOOK.includes(m.statut) && parse(m.debut)).forEach((m) => { const c = byId(D.clients, m.clientId) || ({} as Client), v = byId(D.vehicules, m.vehiculeId), ch = byId(D.partenaires, m.chauffeurId);
    L.push('BEGIN:VEVENT', 'UID:' + m.id + '@amane', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(m.debut), 'DTEND:' + icsDate(m.fin || m.debut), 'SUMMARY:' + icsEsc(m.titre), 'LOCATION:' + icsEsc(m.lieu), 'DESCRIPTION:' + icsEsc([c.nom, svcName(D.services, m.service), v && v.nom, ch ? 'Chauffeur : ' + ch.nom : m.chauffeur].filter(Boolean).join(' · ')), 'END:VEVENT'); });
  L.push('END:VCALENDAR'); return L.join('\r\n');
}
export function finData(D: Data, ref: Date) {
  const [a, b0] = monthBounds(ref); const b = addD(b0, 1); const inM = (x?: string) => { const d = parse(x); return !!d && d >= a && d < b; }; const ms = D.missions;
  let facture = 0, encaisse = 0; const factures: { m: Mission; t: ReturnType<typeof devisTotals>; date: Date | null }[] = [];
  ms.forEach((m) => { const dv = m.devis; if (!dv) return; const t = devisTotals(dv); if (dv.factureNumero) { if (inM(dv.factureDate)) facture += t.ttc; if (t.solde > 0.005) factures.push({ m, t, date: parse(dv.factureDate) }); } (dv.paiements || []).forEach((q) => { if (inM(q.date)) encaisse += +q.montant || 0; }); });
  let comR = 0, comA = 0; ms.forEach((m) => (m.commissions || []).forEach((c) => { const due = (+(c.base ?? 0)) * (+(c.pct ?? 0)) / 100; if (c.statut === 'recue') { if (inM(c.recueLe)) comR += due; } else comA += due; }));
  const vs = D.vehicules; const fixe = vs.reduce((x, v) => x + (+(v.loyerMois || 0)) + (+(v.chargesMois || 0)), 0); const journ = vs.reduce((x, v) => x + (v.journal || []).filter((j) => inM(j.dt)).reduce((y, j) => y + (+(j.cout || 0)), 0), 0);
  const signe = ms.filter((m) => ACTIVE.includes(m.statut) && inM(m.debut)); const bySvc: Record<string, number> = {}, byVeh: Record<string, number> = {};
  signe.forEach((m) => { const sv = m.service || ''; bySvc[sv] = (bySvc[sv] || 0) + (+(m.montant || 0)); if (m.vehiculeId) byVeh[m.vehiculeId] = (byVeh[m.vehiculeId] || 0) + (+(m.montant || 0)); });
  return { a, b: b0, facture: r2(facture), encaisse: r2(encaisse), factures: factures.sort((x, y) => (+(x.date || 0)) - (+(y.date || 0))), reste: r2(factures.reduce((x, f) => x + f.t.solde, 0)), comR: r2(comR), comA: r2(comA), fixe: r2(fixe), journ: r2(journ), res: r2(encaisse + comR - fixe - journ), bySvc, byVeh };
}
export function finCSV(D: Data, fd: ReturnType<typeof finData>) {
  const rows: (string | number)[][] = [['Facture', 'Devis', 'Client', 'Service', 'Véhicule', 'Chauffeur', 'Début', 'Fin', 'Statut', 'Total TTC', 'Réglé', 'Reste']];
  D.missions.filter((m) => { const d = parse(m.debut); return d && d >= fd.a && d < addD(fd.b, 1); }).forEach((m) => { const dv = m.devis, t = devisTotals(dv), c = byId(D.clients, m.clientId) || ({} as Client), v = byId(D.vehicules, m.vehiculeId) || ({} as Vehicule);
    rows.push([dv?.factureNumero || '', dv?.numero || '', c.nom || '', svcName(D.services, m.service), v.nom || '', m.chauffeur || '', m.debut || '', m.fin || '', STATUTS.find((s) => s.id === m.statut)?.label || '', dv ? t.ttc : +(m.montant || 0), dv ? t.paid : +(m.acompte || 0), dv ? t.solde : r2((+(m.montant || 0)) - (+(m.acompte || 0)))]); });
  return '\ufeff' + rows.map((r) => r.map((x) => { const y = typeof x === 'number' ? String(x).replace('.', ',') : String(x); const z = y.replace(/"/g, '""'); return /[;"\n]/.test(z) ? `"${z}"` : z; }).join(';')).join('\r\n');
}
export const exportJSON = (D: Data) => JSON.stringify({ exporte: new Date().toISOString(), clients: D.clients, missions: D.missions, vehicules: D.vehicules, services: D.services, partenaires: D.partenaires }, null, 2);
export const partLabel = (type?: string) => PART_TYPES.find((x) => x.id === type)?.label || '—';
export const progLabel = (type?: string) => PROG_TYPES.find((x) => x.id === type)?.label || 'Rendez-vous';
export const blank = (kind: string, me: string, p: Record<string, unknown> = {}): Record<string, unknown> => {
  const now = new Date(); now.setMinutes(0, 0, 0); const a = addD(now, 1); a.setHours(10); const b = new Date(a); b.setHours(19);
  const tl = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (kind === 'mission') return { titre: '', clientId: '', service: 'location', vehiculeId: '', debut: tl(a), fin: tl(b), lieu: '', montant: '', acompte: '', statut: 'nouvelle', responsable: me || 'amel', chauffeur: '', chauffeurId: '', programme: [], taches: [], commissions: [], devis: null, notes: '', paiement: 'non', contrat: { statut: 'a_rediger', caution: '', cautionStatut: 'aucune', pieces: { permis: false, passeport: false, domicile: false }, edlDepart: { fait: false, km: '', carburant: 'Plein', notes: '', photos: [] }, edlRetour: { fait: false, km: '', carburant: 'Plein', notes: '', photos: [] } }, ...p };
  if (kind === 'client') return { nom: '', tel: '', email: '', langue: 'FR', pays: '', hotel: '', canal: 'WhatsApp', statut: 'prospect', responsable: me || 'amel', prefs: '', notes: '', entourage: [], datesImportantes: [], allergies: '', marques: '', attentions: [], tags: {}, docs: {}, ...p };
  if (kind === 'vehicule') return { nom: '', categorie: '', plaque: '', couleur: '', tarifJour: '', loyerMois: '', chargesMois: 500, statut: 'disponible', km: '', revision: '', notes: '', photos: [], journal: [], echeances: {}, ...p };
  if (kind === 'partenaire') return { nom: '', type: 'chauffeur', contact: '', tel: '', email: '', langues: '', adresse: '', commission: '', notes: '', actif: true, ...p };
  return { id: '', nom: '', description: '', tarif: '', ordre: 9, ...p };
};
