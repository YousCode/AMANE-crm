import { describe, it, expect } from 'vitest';
import { clashes, chClashes, freeVehicles, durDays, tplTasks, devisTotals, numeroFormat, paiementStatut, nextStatut, prevStatut, telNorm, waLink, mapsLink, detectLang, docLang, t, validate, cssVars, type Mission, type Vehicule } from '../src/shared';
import { todos, finData, finCSV, planningICS, devisHTML, progText, vehicleOn } from '../src/lib/rules';
import { seed } from '../src/mocks/seed';

const M = (o: Partial<Mission>): Mission => ({ id: 'x', titre: 't', clientId: 'c', service: 'location', debut: '2026-11-10T10:00', fin: '2026-11-12T18:00', statut: 'confirmee', ...o });

describe('règles métier', () => {
  it('clashes : même véhicule, créneaux qui se chevauchent, statuts confirmés seulement', () => {
    const a = M({ id: 'a', vehiculeId: 'v1' }); const b = M({ id: 'b', vehiculeId: 'v1', debut: '2026-11-11T09:00', fin: '2026-11-11T20:00' }); const c = M({ id: 'c', vehiculeId: 'v1', debut: '2026-11-13T09:00', fin: '2026-11-14T20:00' }); const d = M({ id: 'd', vehiculeId: 'v1', statut: 'perdue', debut: '2026-11-11T09:00', fin: '2026-11-11T20:00' });
    expect(clashes(a, [a, b, c, d]).map((x) => x.id)).toEqual(['b']);
    expect(clashes(M({ id: 'e', statut: 'terminee', vehiculeId: 'v1' }), [a])).toEqual([]);
  });
  it('chClashes : même chauffeur', () => { const a = M({ id: 'a', chauffeurId: 'p1' }); const b = M({ id: 'b', chauffeurId: 'p1', debut: '2026-11-11T09:00', fin: '2026-11-11T20:00' }); expect(chClashes(a, [a, b]).length).toBe(1); });
  it('freeVehicles : écarte réservés et en entretien', () => {
    const vs: Vehicule[] = [{ id: 'v1', nom: 'A' }, { id: 'v2', nom: 'B' }, { id: 'v3', nom: 'C', statut: 'entretien' }];
    const ms = [M({ id: 'a', vehiculeId: 'v1' })];
    expect(freeVehicles(vs, ms, '2026-11-11T09:00', '2026-11-11T20:00').map((v) => v.id)).toEqual(['v2']);
    expect(freeVehicles(vs, ms, '2026-11-20T09:00', '2026-11-21T20:00').map((v) => v.id)).toEqual(['v1', 'v2']);
  });
  it('durDays : jours calendaires, 1 minimum', () => { expect(durDays({ debut: '2026-11-10T10:00', fin: '2026-11-12T18:00' })).toBe(3); expect(durDays({ debut: '2026-11-10T10:00', fin: '2026-11-10T18:00' })).toBe(1); expect(durDays({ debut: '', fin: '' })).toBe(0); });
  it('tplTasks : modèle location, échéances relatives au début et à la fin', () => {
    const ts = tplTasks({ debut: '2026-11-10T10:00', fin: '2026-11-12T18:00', service: 'location' });
    expect(ts.length).toBe(7); expect(ts[0]).toEqual({ t: 'Préparation et lavage du véhicule', resp: 'youssouf', due: '2026-11-09', fait: false });
    expect(ts.find((x) => x.t === 'Restitution de la caution')?.due).toBe('2026-11-14');
    expect(tplTasks({ debut: '', fin: '', service: 'inconnu' })).toEqual([]);
  });
  it('devisTotals : HT, remise, TVA 20 %, TTC, réglé, reste', () => {
    const t0 = devisTotals({ lignes: [{ d: 'a', q: 2, u: 'jour', pu: 100 }, { d: 'b', q: 1, u: 'forfait', pu: 50 }], remise: 10, tva: 20, paiements: [{ date: '2026-11-01', montant: 100, moyen: 'cb' }] });
    expect(t0).toEqual({ ht: 250, rem: 25, base: 225, tva: 45, rate: 20, ttc: 270, paid: 100, solde: 170 });
    expect(devisTotals(null).ttc).toBe(0); expect(devisTotals({ lignes: [{ d: 'a', q: 1, u: 'jour', pu: 100 }], tva: '' }).tva).toBe(20);
  });
  it('numeroFormat', () => { expect(numeroFormat('devis', 2026, 1)).toBe('D-2026-0001'); expect(numeroFormat('facture', 2026, 123)).toBe('F-2026-0123'); });
  it('paiementStatut', () => {
    expect(paiementStatut({ montant: 1000, acompte: 0 })).toBe('non'); expect(paiementStatut({ montant: 1000, acompte: 300 })).toBe('acompte'); expect(paiementStatut({ montant: 1000, acompte: 1000 })).toBe('solde');
    expect(paiementStatut({ devis: { lignes: [{ d: 'a', q: 1, u: 'jour', pu: 100 }], tva: 20, paiements: [{ date: '', montant: 120, moyen: 'cb' }] } })).toBe('solde');
  });
  it('nextStatut / prevStatut', () => { expect(nextStatut('nouvelle')).toBe('proposition'); expect(nextStatut('perdue')).toBeNull(); expect(prevStatut('nouvelle')).toBeNull(); expect(prevStatut('encours')).toBe('confirmee'); });
  it('telNorm / waLink / mapsLink', () => {
    expect(telNorm('06 12 34 56 78')).toBe('33612345678'); expect(telNorm('+974 5512 3456')).toBe('97455123456'); expect(telNorm('0044 7700 900123')).toBe('447700900123'); expect(telNorm('12')).toBe('');
    expect(waLink('06 12 34 56 78', 'Bonjour')).toBe('https://wa.me/33612345678?text=Bonjour'); expect(mapsLink('Avenue Montaigne')).toContain('Avenue%20Montaigne%2C%20Paris'); expect(mapsLink('')).toBe('');
  });
  it('detectLang / docLang', () => { expect(detectLang('نريد سيارة')).toBe('AR'); expect(detectLang('Здравствуйте')).toBe('RU'); expect(detectLang('Hello, I would like a car')).toBe('EN'); expect(detectLang('Hola, gracias')).toBe('ES'); expect(detectLang('Bonjour, merci')).toBe('FR'); expect(docLang({ langue: 'ZH' })).toBe('EN'); expect(docLang({ langue: 'ar' })).toBe('AR'); });
  it('i18n t() : variables, repli, langues', () => {
    expect(t('FR', 'quick.accuse', { prenom: 'Sophie' })).toMatch(/^Bonjour Sophie, merci pour votre message/);
    expect(t('EN', 'quick.accuse', { prenom: '' })).toMatch(/^Hello, thank you/); expect(t('AR', 'doc.quote')).toBe('عرض سعر'); expect(t('RU', 'doc.quote')).toBe('Quotation'); expect(t('FR', 'doc.unit.jour')).toBe('jour');
  });
  it('validate', () => { expect(validate.client({ nom: '' }).ok).toBe(false); expect(validate.client({ nom: 'X', email: 'nope' }).errors.email).toBeTruthy(); expect(validate.mission({ titre: 'x', service: 'location', statut: 'nouvelle', debut: '2026-11-12T10:00', fin: '2026-11-10T10:00' }).errors.fin).toBeTruthy(); expect(validate.mission({ titre: 'x', service: 'location', statut: 'nouvelle' }).ok).toBe(true); expect(validate.mission({ service: 'location', statut: 'nouvelle' }).ok).toBe(false); });
  it('cssVars rend les jetons', () => { expect(cssVars('light')).toContain('--bg:#FAF8F4'); expect(cssVars('dark')).toContain('--accent:#C9A56A'); });
});

describe('règles dérivées (à faire, finances, exports)', () => {
  const S = seed(); const D = { missions: S.missions as never, clients: S.clients as never, vehicules: S.vehicules as never, partenaires: S.partenaires as never, services: S.services as never };
  it('todos : chacun voit ses tâches', () => { const T = todos(D); expect(T.amel.some((x) => x.t.startsWith('Répondre à'))).toBe(true); expect(T.aziz.some((x) => x.t.startsWith('PV à désigner'))).toBe(true); expect(T.youssouf.some((x) => /Révision/.test(x.t))).toBe(true); });
  it('finData et CSV', () => { const fd = finData(D, new Date()); expect(fd.facture).toBeGreaterThan(0); expect(fd.factures.length).toBeGreaterThanOrEqual(1); const csv = finCSV(D, fd); expect(csv.startsWith('﻿Facture;Devis;Client')).toBe(true); });
  it('ICS', () => { const ics = planningICS(D); expect(ics).toContain('BEGIN:VCALENDAR'); expect(ics).toContain('SUMMARY:Séjour Al-Rashid — semaine shopping'); });
  it('devisHTML en arabe est RTL, programme dans la langue du client', () => { const m = S.missions[0] as never as Mission; const h = devisHTML(D, m, 'facture'); expect(h).toContain('dir="rtl"'); expect(h).toContain('F-2026-0007'); expect(progText(D, m)).toContain('Amane'); });
  it('vehicleOn', () => { const v = S.vehicules.find((x) => x.id === 'classev') as never as Vehicule; const m = S.missions[0]; expect(vehicleOn(D.missions, v, new Date(m.debut), new Date(m.fin)).k).toBe('b'); });
});
