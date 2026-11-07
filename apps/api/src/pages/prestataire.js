// Page publique de l'espace prestataire (/api/prestataire/:token) : missions confiées et disponibilités de la flotte.
// Lecture seule, en français ; seul geste possible : confirmer une mission (formulaire, fonctionne sans JavaScript).
import { fmtDate, fmtTime } from '@amane/shared';
import { shell, esc } from './shell.js';

const ETAT = { libre: 'Libre', reserve: 'Réservé', option: 'En option', indisponible: 'Indisponible' };

function parseDt(s) { const d = s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : null; }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const STYLES = `
h1 em{color:var(--accent)}
.sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.sec-h h2{margin:0}
.flash{border:1px solid var(--accent);color:var(--fg);background:var(--panel);border-radius:var(--radius);padding:14px 18px;margin:16px 0 0}
.mi{display:grid;grid-template-columns:76px 1fr;gap:14px;padding:16px 0;border-bottom:1px solid var(--line2);scroll-margin-top:16px}
.mi:last-child{border-bottom:0}
.mi .h{font-family:'IBM Plex Mono',monospace;color:var(--accent);font-size:15px;line-height:1.35}
.mi .h span{display:block;color:var(--fg3);font-size:12px}
.mi .t{font-family:'Bodoni Moda',Georgia,serif;font-size:20px;line-height:1.2}
.mi .meta{color:var(--fg2);font-size:14px;margin-top:4px}
.mi .meta b{font-weight:500;color:var(--fg)}
.mi ul{list-style:none;margin:8px 0 0;padding:0;font-size:14px;color:var(--fg2)}
.mi li{padding:3px 0}
.mi form{margin:12px 0 0}
.mi .btn{flex:0 0 auto;min-height:44px;padding:10px 20px;font-size:14px}
.ok-l{display:inline-flex;align-items:center;gap:8px;margin-top:12px;color:var(--ok);font-size:14px}
.ok-l::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
.soon{margin-left:8px;vertical-align:middle;font-size:10px;padding:2px 8px}
.dispo-w{overflow-x:auto;margin:14px -20px 0;padding:0 20px;-webkit-overflow-scrolling:touch}
table.dispo{border-collapse:separate;border-spacing:3px;width:auto;min-width:100%;margin:0}
table.dispo th,table.dispo td{border:0;padding:0;font-size:12px;text-align:center;vertical-align:middle}
table.dispo thead th{color:var(--fg3);font-weight:400;letter-spacing:.04em;text-transform:none;font-size:11px;line-height:1.25;padding:0 0 4px;min-width:30px}
table.dispo thead th.we{color:var(--fg2)}
table.dispo thead th b{display:block;font-family:'IBM Plex Mono',monospace;font-weight:400;font-size:13px;color:var(--fg)}
table.dispo tbody th{position:sticky;left:0;z-index:1;background:var(--panel);text-align:left;padding:0 12px 0 0;min-width:120px;font-size:14px;font-weight:400;white-space:nowrap}
table.dispo tbody th span{display:block;font-size:11px;color:var(--fg3);letter-spacing:.04em}
table.dispo td{height:34px;border-radius:6px}
.s-libre{box-shadow:inset 0 0 0 1px var(--line)}
.s-reserve{background:var(--fg)}
.s-option{background:repeating-linear-gradient(135deg,var(--accent) 0 2px,transparent 2px 6px);box-shadow:inset 0 0 0 1px var(--accent)}
.s-indisponible{background:var(--stone);box-shadow:inset 0 0 0 1px var(--line2)}
.legend{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;font-size:13px;color:var(--fg3)}
.legend i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:7px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fine{font-size:13px;color:var(--fg3);margin-top:18px}
@media (max-width:520px){.mi{grid-template-columns:62px 1fr;gap:10px}.mi .t{font-size:18px}}
`;

function missionHtml(m, data) {
  const a = parseDt(m.debut); const b = parseDt(m.fin);
  const sameDay = b && a && m.fin.slice(0, 10) === m.debut.slice(0, 10);
  const fin = b ? (sameDay ? fmtTime(b, 'FR') : fmtDate(b, 'FR', { day: 'numeric', month: 'short' })) : '';
  const meta = [m.vehicule && `<b>${esc(m.vehicule)}</b>`, m.client && `Client : ${esc(m.client)}`].filter(Boolean).join(' · ');
  const etapes = m.etapes.length ? `<ul>${m.etapes.map((e) => { const d = parseDt(e.dt); return `<li><span class="num">${d ? esc(fmtTime(d, 'FR')) : ''}</span> · ${esc(e.typeLabel)}${e.lieu ? ` — ${esc(e.lieu)}${e.itineraire ? ` · <a href="${esc(e.itineraire)}" rel="noopener">Itinéraire</a>` : ''}` : ''}</li>`; }).join('')}</ul>` : '';
  const conf = m.confirmee
    ? `<div class="ok-l">Confirmée${m.confirmeeAt ? ' le ' + esc(fmtDate(new Date(m.confirmeeAt), 'FR', { day: 'numeric', month: 'long' }, 'Europe/Paris')) : ''}</div>`
    : `<form method="post" action="/api/prestataire/${esc(data.token)}/missions/${esc(m.id)}/confirmer"><button class="btn" type="submit">Je confirme cette mission</button></form>`;
  return `<article class="mi" id="m-${esc(m.id)}"><div class="h">${a ? esc(fmtTime(a, 'FR')) : ''}${fin ? `<span>→ ${esc(fin)}</span>` : ''}</div><div>
<div class="t">${esc(m.service)}${m.bientot && !m.confirmee ? '<span class="chip soon">À confirmer</span>' : ''}</div>
<div class="meta">${esc(m.role)}${meta ? ' · ' + meta : ''}</div>
${m.lieu ? `<div class="meta">${esc(m.lieu)}${m.itineraire ? ` · <a href="${esc(m.itineraire)}" rel="noopener">Itinéraire</a>` : ''}</div>` : ''}
${etapes}${conf}</div></article>`;
}

export function prestatairePage(data, { flash = '' } = {}) {
  let day = ''; let list = '';
  for (const m of data.missions) {
    const a = parseDt(m.debut);
    const dl = a ? cap(fmtDate(a, 'FR', { weekday: 'long', day: 'numeric', month: 'long' })) : '';
    if (dl !== day) { day = dl; list += `<div class="day">${esc(dl)}</div>`; }
    list += missionHtml(m, data);
  }
  const n = data.missions.length;
  const D = data.disponibilites;
  const head = D.jours.map((d) => { const x = new Date(d + 'T12:00'); const wd = x.getDay(); return `<th scope="col" class="${wd === 0 || wd === 6 ? 'we' : ''}">${esc(fmtDate(x, 'FR', { weekday: 'short' }).replace('.', ''))}<b>${x.getDate()}</b></th>`; }).join('');
  const rows = D.vehicules.map((v) => `<tr><th scope="row">${esc(v.nom)}${v.categorie ? `<span>${esc(v.categorie)}</span>` : ''}</th>${v.jours.map((s, i) => `<td class="s-${s}" title="${esc(fmtDate(new Date(D.jours[i] + 'T12:00'), 'FR', { weekday: 'long', day: 'numeric', month: 'long' }))} : ${ETAT[s]}"><span class="sr">${ETAT[s]}</span></td>`).join('')}</tr>`).join('');
  const contact = data.contact.whatsapp || data.contact.tel ? `<div class="btns">${data.contact.whatsapp ? `<a class="btn" href="${esc(data.contact.whatsapp)}" rel="noopener">Écrire à la maison</a>` : ''}${data.contact.tel ? `<a class="btn ghost" href="tel:${esc(data.contact.tel)}">Appeler</a>` : ''}</div>` : '';
  const body = `<span class="label">Espace prestataire · ${esc(data.partenaire.typeLabel)}</span>
<h1>Bonjour <em>${esc(data.partenaire.prenom)}</em></h1>
<p class="muted">Les missions que la maison Amane vous confie et les disponibilités de notre flotte, à jour à chaque ouverture de la page.</p>
${flash ? `<div class="flash" role="status">${esc(flash)}</div>` : ''}
<section class="panel" aria-labelledby="t-missions"><div class="sec-h"><h2 id="t-missions">Vos missions</h2><span class="label">${n ? `${n} à venir` : 'Aucune à venir'}</span></div>
${list || '<p class="muted">Aucune mission ne vous est confiée pour le moment. Nous vous écrirons dès qu’une mission se présente.</p>'}</section>
<section class="panel" aria-labelledby="t-dispo"><div class="sec-h"><h2 id="t-dispo">Disponibilités de la flotte</h2><span class="label">${D.jours.length} prochains jours</span></div>
<div class="dispo-w"><table class="dispo"><thead><tr><th scope="col"><span class="sr">Véhicule</span></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
<div class="legend"><span><i class="s-libre"></i>Libre</span><span><i class="s-reserve"></i>Réservé</span><span><i class="s-option"></i>En option</span><span><i class="s-indisponible"></i>Indisponible</span></div></section>
${contact}
<p class="fine">Ce lien vous est personnel : merci de ne pas le transférer. Il peut être renouvelé ou retiré à tout moment par la maison.</p>`;
  return shell({ lang: 'FR', title: 'Espace prestataire', body, styles: STYLES });
}
