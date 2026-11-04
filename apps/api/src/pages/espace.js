// Espace client par séjour (/api/espace/:token) : programme, chauffeur, documents, solde, contact.
import { devisTotals, fmtMoney, fmtDate, fmtTime, docLang, labelOf, SERVICES, paiementStatut, mapsLink, telPlus } from '@amane/shared';
import { shell, esc, tt } from './shell.js';

function parseDt(s) { const d = s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : null; }

/** Données JSON de l'espace (pour l'appli cliente). */
export function espaceData({ mission, client, vehicule, chauffeur, token, partenaires = [] }) {
  const L = docLang(client);
  const dv = mission.devis || {};
  const hasDevis = Array.isArray(dv.lignes) && dv.lignes.length > 0;
  const tot = hasDevis ? devisTotals(dv) : null;
  const total = hasDevis ? tot.ttc : +mission.montant || 0;
  const paid = hasDevis ? tot.paid : +mission.acompte || 0;
  const programme = (Array.isArray(mission.programme) ? mission.programme : []).filter((x) => x && x.dt).sort((a, b) => String(a.dt).localeCompare(String(b.dt))).map((x) => {
    const p = partenaires.find((q) => q._id === x.partenaireId);
    return { dt: x.dt, type: x.type || 'autre', typeLabel: tt(L, 'doc.type.' + (x.type || 'autre')), lieu: x.lieu || (p && p.adresse) || '', partenaire: p ? p.nom : '', client: x.client || '', itineraire: x.lieu || (p && p.adresse) ? mapsLink(x.lieu || p.adresse) : '' };
  });
  return {
    token, lang: L, rtl: L === 'AR',
    client: { nom: client.nom || '' },
    sejour: { titre: mission.titre || '', service: labelOf(SERVICES, mission.service, mission.service || ''), debut: mission.debut || '', fin: mission.fin || '', lieu: mission.lieu || '', statut: mission.statut, vehicule: vehicule ? { nom: vehicule.nom, categorie: vehicule.categorie || '' } : null },
    chauffeur: chauffeur ? { nom: chauffeur.nom, tel: telPlus(chauffeur.tel), photo: chauffeur.photoId ? `/api/espace/${token}/photo/${chauffeur.photoId}` : '' } : null,
    programme,
    documents: { devis: hasDevis && dv.numero ? { numero: dv.numero, url: `/api/espace/${token}/devis`, statut: dv.statut || 'envoye' } : null, facture: hasDevis && dv.factureNumero ? { numero: dv.factureNumero, url: `/api/espace/${token}/facture` } : null },
    solde: { total, paye: paid, reste: Math.max(0, Math.round((total - paid) * 100) / 100), statut: paiementStatut(mission), devise: 'EUR' },
    contact: { whatsapp: process.env.WHATSAPP_PUBLIC_NUMBER ? `https://wa.me/${String(process.env.WHATSAPP_PUBLIC_NUMBER).replace(/\D/g, '')}` : '', tel: process.env.PUBLIC_PHONE ? telPlus(process.env.PUBLIC_PHONE) : '' },
  };
}

export function espacePage(data) {
  const L = data.lang;
  const s = data.sejour;
  const deb = parseDt(s.debut); const fin = parseDt(s.fin);
  const dates = deb ? fmtDate(deb, L, { weekday: 'long', day: 'numeric', month: 'long' }) + (fin ? ' — ' + fmtDate(fin, L, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '') : '';
  let day = ''; let prog = '';
  for (const x of data.programme) {
    const d = parseDt(x.dt);
    const dl = d ? fmtDate(d, L, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    if (dl !== day) { day = dl; prog += `<div class="day">${esc(dl.charAt(0).toUpperCase() + dl.slice(1))}</div>`; }
    prog += `<div class="st"><b>${d ? esc(fmtTime(d, L)) : ''}</b><div>${esc(x.typeLabel)}${x.partenaire ? ' — ' + esc(x.partenaire) : ''}${x.lieu ? `<div class="muted">${esc(x.lieu)}${x.itineraire ? ` · <a href="${esc(x.itineraire)}" rel="noopener">${tt(L, 'doc.route')}</a>` : ''}</div>` : ''}${x.client ? `<div>${esc(x.client)}</div>` : ''}</div></div>`;
  }
  const ch = data.chauffeur ? `<div class="panel"><span class="label">${tt(L, 'doc.driver')}</span><div class="person" style="margin-top:12px">${data.chauffeur.photo ? `<img src="${esc(data.chauffeur.photo)}" alt="">` : `<span class="ph">${esc((data.chauffeur.nom || '?').charAt(0))}</span>`}<div><div class="display" style="font-size:22px">${esc(data.chauffeur.nom)}</div>${data.chauffeur.tel ? `<div class="muted num">${esc(data.chauffeur.tel)}</div>` : ''}</div></div>${data.chauffeur.tel ? `<div class="btns"><a class="btn ghost" href="tel:${esc(data.chauffeur.tel)}">${tt(L, 'doc.call')}</a><a class="btn ghost" href="https://wa.me/${esc(data.chauffeur.tel.replace(/\D/g, ''))}" rel="noopener">WhatsApp</a></div>` : ''}</div>` : '';
  const docs = data.documents.devis || data.documents.facture ? `<div class="panel"><span class="label">${tt(L, 'doc.documents')}</span><div class="links" style="margin-top:8px">${data.documents.devis ? `<a href="${esc(data.documents.devis.url)}">${tt(L, 'doc.quote')} <span class="num">${esc(data.documents.devis.numero)}</span></a>` : ''}${data.documents.facture ? `<a href="${esc(data.documents.facture.url)}">${tt(L, 'doc.invoice')} <span class="num">${esc(data.documents.facture.numero)}</span></a>` : ''}</div></div>` : '';
  const solde = data.solde.total ? `<div class="panel"><span class="label">${tt(L, 'doc.balance')}</span><table class="tot" style="margin-${L === 'AR' ? 'right' : 'left'}:0"><tr><td>${tt(L, 'doc.ttc')}</td><td class="n num">${esc(fmtMoney(data.solde.total, L))}</td></tr><tr><td>${tt(L, 'doc.paid')}</td><td class="n num">${esc(fmtMoney(data.solde.paye, L))}</td></tr><tr class="g"><td>${data.solde.reste > 0 ? tt(L, 'doc.balanceDue') : tt(L, 'doc.balancePaid')}</td><td class="n num">${esc(fmtMoney(data.solde.reste, L))}</td></tr></table></div>` : '';
  const contact = data.contact.whatsapp || data.contact.tel ? `<div class="btns">${data.contact.whatsapp ? `<a class="btn" href="${esc(data.contact.whatsapp)}" rel="noopener">${tt(L, 'doc.contact')}</a>` : ''}${data.contact.tel ? `<a class="btn ghost" href="tel:${esc(data.contact.tel)}">${tt(L, 'doc.call')}</a>` : ''}</div>` : '';
  const body = `<span class="label">${tt(L, 'doc.espace')}</span>
<h1>${esc(data.client.nom ? tt(L, 'doc.hello', { nom: data.client.nom }).replace(/[,:،]$/, '') : s.titre)}</h1>
<p class="muted">${esc(s.service)}${s.vehicule ? ' · ' + esc(s.vehicule.nom) : ''}${dates ? '<br>' + esc(dates) : ''}${s.lieu ? '<br>' + esc(s.lieu) + ` · <a href="${esc(mapsLink(s.lieu))}" rel="noopener">${tt(L, 'doc.route')}</a>` : ''}</p>
${ch}
<div class="panel"><span class="label">${tt(L, 'doc.prog')}</span><p class="muted" style="margin:6px 0 0">${tt(L, 'doc.progIntro')}</p>${prog || `<p class="muted">${tt(L, 'doc.nothingYet')}</p>`}</div>
${docs}${solde}${contact}`;
  return shell({ lang: L, title: tt(L, 'doc.espace'), body });
}
