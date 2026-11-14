// Page publique du devis (/d/:token) : le devis au gabarit A4 de la maison (@amane/shared/docs),
// suivi du statut et des boutons Accepter / Poser une question (masqués à l'impression).
import { fmtDate, docLang, devisDoc } from '@amane/shared';
import { shell, tt, esc } from './shell.js';

/** Page publique /d/:token. */
export function devisPage({ mission, client, token, waNumber, nowIso, maison }) {
  const L = docLang(client);
  const dv = mission.devis || {};
  const accepted = dv.statut === 'accepte';
  const ask = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(tt(L, 'doc.askText', { numero: dv.numero || '' }).replace(/&#39;/g, '’').replace(/&amp;/g, '&'))}` : '';
  const status = accepted
    ? `<div class="panel"><span class="chip">${tt(L, 'doc.acceptedAt', { date: fmtDate(dv.acceptedAt || nowIso, L, { day: 'numeric', month: 'long', year: 'numeric' }, 'Europe/Paris') })}</span><p class="ok">${tt(L, 'doc.accepted')}</p></div>`
    : '';
  const btns = accepted ? (ask ? `<div class="btns"><a class="btn ghost" href="${ask}" rel="noopener">${tt(L, 'doc.ask')}</a></div>` : '')
    : dv.statut === 'refuse' ? (ask ? `<div class="btns"><a class="btn ghost" href="${ask}" rel="noopener">${tt(L, 'doc.ask')}</a></div>` : '')
      : `<div class="btns"><form method="post" action="/d/${esc(token)}/accepter" style="display:contents"><button class="btn" type="submit" id="accept">${tt(L, 'doc.accept')}</button></form>${ask ? `<a class="btn ghost" href="${ask}" rel="noopener">${tt(L, 'doc.ask')}</a>` : ''}</div>`;
  const after = status + btns + `<p class="muted">${tt(L, 'doc.seeYou')}</p>`;
  return devisDoc({ mission, client, kind: 'devis', maison, after });
}

export function expiredPage(L = 'EN') {
  return shell({ lang: L, title: 'Amane', body: `<h1>Amane</h1><p class="muted">${tt(L, 'doc.expired')}</p>` });
}
