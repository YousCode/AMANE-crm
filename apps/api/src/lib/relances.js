// « À relancer » : liste calculée, jamais envoyée seule (le message suggéré est inséré d'un geste).
import { t, fmtMoney, fmtDate, labelOf, SERVICES, paiementStatut, devisTotals, ACTIVE_STATUTS, firstName } from '@amane/shared';
import { now } from './clock.js';
import { wallToMs, parisDay } from './paris.js';

const DAY = 86400000;
const docL = (c) => { const l = String((c && c.langue) || '').toUpperCase(); return ['FR', 'EN', 'ES', 'AR', 'RU'].includes(l) ? l : 'EN'; };

export async function computeRelances(db, nowMs = now()) {
  const [clients, missions] = await Promise.all([
    db.collection('clients').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('missions').find({ _deleted: { $ne: true } }).toArray(),
  ]);
  const byClient = new Map(clients.map((c) => [c._id, c]));
  const out = [];
  const push = (type, c, m, raison, key, vars, depuis) => {
    if (!c) return;
    const L = docL(c);
    out.push({ type, clientId: c._id, missionId: m ? m._id : undefined, nom: c.nom, tel: c.tel || '', convId: c.telNorm || undefined, lang: L, raison, messageSuggere: t(L, key, { prenom: firstName(c.nom), ...vars }), depuis });
  };
  const today = parisDay(nowMs);
  // 1. Propositions sans réponse > 48 h.
  for (const m of missions) {
    if (m.statut !== 'proposition') continue;
    const ref = Date.parse(m.updatedAt || m.createdAt || '') || 0;
    if (!ref || nowMs - ref < 48 * 3600000) continue;
    const c = byClient.get(m.clientId);
    const jours = Math.floor((nowMs - ref) / DAY);
    push('proposition', c, m, `Proposition « ${m.titre || ''} » sans réponse depuis ${jours} j`, 'relance.proposition', { objet: m.titre || labelOf(SERVICES, m.service, '') }, new Date(ref).toISOString());
  }
  // 2. Habitués / VIP sans mission depuis 90 j.
  for (const c of clients) {
    if (!['habitue', 'vip'].includes(c.statut)) continue;
    const last = missions.filter((m) => m.clientId === c._id && ACTIVE_STATUTS.includes(m.statut) && m.debut).map((m) => wallToMs(m.debut) || 0).sort((a, b) => b - a)[0] || 0;
    if (last && nowMs - last < 90 * DAY) continue;
    if (missions.some((m) => m.clientId === c._id && ['nouvelle', 'proposition', 'confirmee', 'encours'].includes(m.statut) && (wallToMs(m.debut) || 0) > nowMs)) continue;
    const jours = last ? Math.floor((nowMs - last) / DAY) : null;
    push('habitue', c, null, jours ? `Habitué sans mission depuis ${jours} j` : 'Habitué sans mission enregistrée', 'relance.habitue', {}, last ? new Date(last).toISOString() : c.createdAt || '');
  }
  // 3. Dates importantes sous 21 j.
  for (const c of clients) {
    for (const d of Array.isArray(c.datesImportantes) ? c.datesImportantes : []) {
      const md = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(d && d.date || ''));
      if (!md) continue;
      const y = +today.slice(0, 4);
      let next = Date.UTC(y, +md[1] - 1, +md[2]);
      const todayMs = Date.UTC(y, +today.slice(5, 7) - 1, +today.slice(8, 10));
      if (next < todayMs) next = Date.UTC(y + 1, +md[1] - 1, +md[2]);
      const dans = Math.round((next - todayMs) / DAY);
      if (dans > 21) continue;
      push('anniversaire', c, null, `${d.label || 'Date importante'} dans ${dans} j (${md[2]}/${md[1]})`, 'relance.anniversaire', { objet: d.label || '' }, new Date(next).toISOString());
    }
  }
  // 4. Acomptes non reçus à J-3.
  for (const m of missions) {
    if (!['proposition', 'confirmee'].includes(m.statut) || paiementStatut(m) !== 'non') continue;
    const d = wallToMs(m.debut);
    if (!d || d < nowMs || d - nowMs > 3 * DAY) continue;
    const c = byClient.get(m.clientId);
    const total = m.devis && m.devis.lignes && m.devis.lignes.length ? devisTotals(m.devis).ttc : +m.montant || 0;
    if (!total) continue;
    const L = docL(c);
    push('acompte', c, m, `Acompte non reçu, mission dans ${Math.ceil((d - nowMs) / DAY)} j`, 'relance.acompte', { date: fmtDate(d, L, { day: 'numeric', month: 'long' }, 'Europe/Paris'), montant: fmtMoney(Math.round(total * 0.3), L) }, new Date(d).toISOString());
  }
  // 5. Factures en retard (> 30 j, solde > 0).
  for (const m of missions) {
    const dv = m.devis;
    if (!dv || !dv.factureNumero) continue;
    const tot = devisTotals(dv);
    if (tot.solde <= 0.005) continue;
    const fd = wallToMs(dv.factureDate) || Date.parse(m.updatedAt || '') || 0;
    if (!fd || nowMs - fd < 30 * DAY) continue;
    const c = byClient.get(m.clientId);
    const L = docL(c);
    push('facture', c, m, `Facture ${dv.factureNumero} en retard de ${Math.floor((nowMs - fd) / DAY) - 30} j (${fmtMoney(tot.solde, 'FR')} restants)`, 'relance.facture', { numero: dv.factureNumero, montant: fmtMoney(tot.solde, L) }, new Date(fd).toISOString());
  }
  return out.sort((a, b) => String(a.depuis).localeCompare(String(b.depuis)));
}
