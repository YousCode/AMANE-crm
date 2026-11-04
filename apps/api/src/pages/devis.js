// Page publique du devis (/d/:token) et rendu devis/facture pour l'espace client.
import { devisTotals, fmtMoney, fmtDate, docLang, labelOf, MOYENS } from '@amane/shared';
import { shell, esc, tt } from './shell.js';

function parseDay(s) { const d = s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : null; }

/** Corps HTML (sans coquille) d'un devis ou d'une facture. */
export function devisBody({ mission, client, kind = 'devis', L }) {
  const dv = mission.devis || {};
  const tot = devisTotals(dv);
  const fac = kind === 'facture';
  const num = fac ? dv.factureNumero || '' : dv.numero || '';
  const dt = parseDay(fac ? dv.factureDate : dv.date) || parseDay(mission.updatedAt) || new Date();
  const rows = (dv.lignes || []).map((l) => `<tr><td>${esc(l.d)}</td><td class="n num">${esc(l.q)}</td><td>${tt(L, 'doc.unit.' + (l.u || 'forfait'))}</td><td class="n num">${esc(fmtMoney(l.pu, L))}</td><td class="n num">${esc(fmtMoney((+l.q || 0) * (+l.pu || 0), L))}</td></tr>`).join('');
  const pays = fac && (dv.paiements || []).length ? `<h2>${tt(L, 'doc.payments')}</h2><table>${dv.paiements.map((q) => `<tr><td>${q.date ? esc(fmtDate(parseDay(q.date) || q.date, L, { day: 'numeric', month: 'long', year: 'numeric' })) : ''}</td><td>${esc(labelOf(MOYENS, q.moyen, ''))}</td><td class="n num">${esc(fmtMoney(q.montant, L))}</td></tr>`).join('')}</table>` : '';
  return `<span class="label">${tt(L, fac ? 'doc.invoice' : 'doc.quote')}</span>
<h1>${tt(L, fac ? 'doc.invoice' : 'doc.quote')} <em>${esc(num)}</em></h1>
<p class="muted">${tt(L, 'doc.date')} : ${esc(fmtDate(dt, L, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${tt(L, 'doc.ref')} : ${esc(mission.titre || '')}${fac && dv.numero ? ' · ' + tt(L, 'doc.quote') + ' ' + esc(dv.numero) : ''}</p>
<div class="panel"><span class="label">${tt(L, 'doc.client')}</span><p style="margin:6px 0 0">${esc(client.nom || '')}<br>${esc([client.hotel, client.pays].filter(Boolean).join(', '))}${client.hotel || client.pays ? '<br>' : ''}${esc([client.email].filter(Boolean).join(' · '))}</p></div>
<table><thead><tr><th>${tt(L, 'doc.desc')}</th><th class="n">${tt(L, 'doc.qty')}</th><th>${tt(L, 'doc.unit')}</th><th class="n">${tt(L, 'doc.pu')}</th><th class="n">${tt(L, 'doc.total')}</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tot"><tr><td>${tt(L, 'doc.total')}</td><td class="n num">${esc(fmtMoney(tot.ht, L))}</td></tr>${tot.rem ? `<tr><td>${tt(L, 'doc.discount')} ${esc(dv.remise)} %</td><td class="n num">−${esc(fmtMoney(tot.rem, L))}</td></tr>` : ''}<tr><td>${tt(L, 'doc.vat')} ${esc(tot.rate)} %</td><td class="n num">${esc(fmtMoney(tot.tva, L))}</td></tr><tr class="g"><td>${tt(L, 'doc.ttc')}</td><td class="n num">${esc(fmtMoney(tot.ttc, L))}</td></tr>${fac ? `<tr><td>${tt(L, 'doc.paid')}</td><td class="n num">${esc(fmtMoney(tot.paid, L))}</td></tr><tr class="g"><td>${tt(L, 'doc.due')}</td><td class="n num">${esc(fmtMoney(Math.max(0, tot.solde), L))}</td></tr>` : ''}</table>
${pays}
<h2 style="margin-top:26px">${tt(L, 'doc.terms')}</h2><p class="muted">${tt(L, 'doc.termsTxt')}</p>
<h2>${tt(L, 'doc.bank')}</h2><p class="muted">IBAN ${esc(process.env.BANK_IBAN || '—')} · BIC ${esc(process.env.BANK_BIC || '—')}</p>`;
}

/** Page publique /d/:token. */
export function devisPage({ mission, client, token, waNumber, nowIso }) {
  const L = docLang(client);
  const dv = mission.devis || {};
  const accepted = dv.statut === 'accepte';
  const refused = dv.statut === 'refuse';
  const ask = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(tt(L, 'doc.askText', { numero: dv.numero || '' }).replace(/&#39;/g, '’').replace(/&amp;/g, '&'))}` : '';
  const valid = parseDay(dv.date) ? new Date(parseDay(dv.date).getTime() + 15 * 86400000) : null;
  const status = accepted
    ? `<div class="panel"><span class="chip">${tt(L, 'doc.acceptedAt', { date: fmtDate(dv.acceptedAt || nowIso, L, { day: 'numeric', month: 'long', year: 'numeric' }, 'Europe/Paris') })}</span><p class="ok" style="margin:12px 0 0">${tt(L, 'doc.accepted')}</p></div>`
    : refused ? '' : valid ? `<p class="muted">${tt(L, 'doc.validUntil', { date: fmtDate(valid, L, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>` : '';
  const btns = accepted ? (ask ? `<div class="btns"><a class="btn ghost" href="${ask}" rel="noopener">${tt(L, 'doc.ask')}</a></div>` : '')
    : `<div class="btns"><form method="post" action="/d/${esc(token)}/accepter" style="display:contents"><button class="btn" type="submit" id="accept">${tt(L, 'doc.accept')}</button></form>${ask ? `<a class="btn ghost" href="${ask}" rel="noopener">${tt(L, 'doc.ask')}</a>` : ''}</div>`;
  const body = devisBody({ mission, client, kind: 'devis', L }) + status + btns + `<p class="muted" style="margin-top:18px">${tt(L, 'doc.seeYou')}</p>`;
  return shell({ lang: L, title: `${tt(L, 'doc.quote')} ${dv.numero || ''}`.trim(), body });
}

export function expiredPage(L = 'EN') {
  return shell({ lang: L, title: 'Amane', body: `<h1>Amane</h1><p class="muted">${tt(L, 'doc.expired')}</p>` });
}
