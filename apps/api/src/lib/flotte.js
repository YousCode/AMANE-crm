// Rentabilité de la flotte par mois : loyer, charges, jours loués, CA, coûts du journal, marge nette, taux d'occupation.
import { ACTIVE_STATUTS, devisTotals, overlapDays, round2 } from '@amane/shared';
import { now } from './clock.js';
import { parisDay } from './paris.js';

export function monthBounds(mois, nowMs = now()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mois || ''));
  const [y, mo] = m ? [Number(m[1]), Number(m[2])] : parisDay(nowMs).split('-').slice(0, 2).map(Number);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const z = (n) => String(n).padStart(2, '0');
  return { mois: `${y}-${z(mo)}`, from: `${y}-${z(mo)}-01`, to: `${y}-${z(mo)}-${z(days)}`, days };
}

export async function rentabilite(db, mois, nowMs = now()) {
  const b = monthBounds(mois, nowMs);
  const [vehicules, missions] = await Promise.all([
    db.collection('vehicules').find({ _deleted: { $ne: true } }, { sort: { ordre: 1 } }).toArray(),
    db.collection('missions').find({ _deleted: { $ne: true }, statut: { $in: [...ACTIVE_STATUTS] } }).toArray(),
  ]);
  const fromD = `${b.from}T00:00`; const toD = `${b.to}T23:59`;
  const lignes = vehicules.map((v) => {
    const ms = missions.filter((m) => m.vehiculeId === v._id && m.debut);
    let joursLoues = 0; let ca = 0; let nb = 0;
    for (const m of ms) {
      const d = overlapDays({ debut: m.debut, fin: m.fin }, fromD, toD);
      if (!d) continue;
      nb++;
      joursLoues += d;
      const total = m.devis && m.devis.lignes && m.devis.lignes.length ? devisTotals(m.devis).base : +m.montant || 0;
      const totalDays = Math.max(1, overlapDays({ debut: m.debut, fin: m.fin }, m.debut, m.fin || m.debut));
      ca += total * (d / totalDays); // part du CA au prorata des jours dans le mois
    }
    const loyer = +v.loyerMois || 0; const charges = +v.chargesMois || 0;
    const coutsJournal = (Array.isArray(v.journal) ? v.journal : []).filter((j) => j && String(j.dt || j.date || '').slice(0, 7) === b.mois).reduce((x, j) => x + (+j.cout || 0), 0);
    const marge = ca - loyer - charges - coutsJournal;
    return { id: v._id, nom: v.nom, categorie: v.categorie || '', loyer, charges, joursLoues, missions: nb, ca: round2(ca), coutsJournal: round2(coutsJournal), margeNette: round2(marge), tauxOccupation: round2(joursLoues / b.days), tarifJour: +v.tarifJour || 0 };
  });
  const total = lignes.reduce((x, l) => ({ loyer: x.loyer + l.loyer, charges: x.charges + l.charges, joursLoues: x.joursLoues + l.joursLoues, ca: round2(x.ca + l.ca), coutsJournal: round2(x.coutsJournal + l.coutsJournal), margeNette: round2(x.margeNette + l.margeNette) }), { loyer: 0, charges: 0, joursLoues: 0, ca: 0, coutsJournal: 0, margeNette: 0 });
  return { mois: b.mois, du: b.from, au: b.to, jours: b.days, vehicules: lignes, total: { ...total, tauxOccupation: lignes.length ? round2(total.joursLoues / (b.days * lignes.length)) : 0 } };
}
