// Pages des prestataires : portail par jeton (/p/:token) et inscription publique (/prestataires).
// Français, téléphone d'abord : cibles tactiles ≥ 44 px, champs ≥ 16 px, rien ne déborde à 390 px.
// Tout texte venant du prestataire ou d'une fiche passe par `esc` ; le script n'écrit que du texte (textContent).
import { fmtDate, tokens } from '@amane/shared';
import { shell, esc } from './shell.js';

const CSS = `
[hidden]{display:none!important}
h1,h2,p,li,label,summary,.panel{overflow-wrap:anywhere}
.fld{display:grid;gap:6px;min-width:0;margin:0}
.fld>span{font-size:14px;color:var(--fg2)}
.fld small{color:var(--fg3);font-size:13px}
input,textarea{font-family:inherit;font-size:16px;font-weight:400;line-height:1.3;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-height:48px;width:100%;min-width:0;max-width:100%;display:block;margin:0;-webkit-appearance:none;appearance:none}
textarea{min-height:104px;resize:vertical}
input:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--champagne);outline-offset:2px}
form.stack{display:grid;gap:14px;margin:14px 0 0}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:12px}
button.btn{font-size:16px;width:100%}
.btns button.btn{width:auto}
.dem{border-color:var(--champagne)}
.dem h2{margin-top:12px}
.dem .btns{margin:16px 0 0}
.sec{margin:26px 0 0}
.sub{display:block;margin:20px 0 0}
ul.list{list-style:none;margin:6px 0 0;padding:0}
ul.list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line2);min-height:48px}
ul.list li>div{min-width:0}
.x{flex:none;min-height:44px;min-width:44px;padding:8px 16px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--fg);font-family:inherit;font-size:14px;cursor:pointer}
.msg{margin:8px 0 0;font-size:14px;min-height:1.4em}
.msg.bad{color:var(--bad)}.msg.ok{color:var(--ok)}
.busy{opacity:.55;pointer-events:none}
.hp{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
form.add{display:none}.js form.add{display:grid}
details.panel>summary{display:flex;align-items:center;justify-content:space-between;min-height:44px;cursor:pointer;list-style:none;font-family:${tokens.fonts.display};font-size:22px}
details.panel>summary::-webkit-details-marker{display:none}
details.panel>summary::after{content:'+';color:var(--champagne);font-size:26px;line-height:1}
details.panel[open]>summary::after{content:'–'}
.rep-ok,.rep-non{flex:none;white-space:nowrap}.rep-ok{color:var(--ok)}.rep-non{color:var(--fg3)}
`;

// ---------- dates (les chaînes « AAAA-MM-JJ[THH:MM] » sont montrées telles que saisies, sans fuseau) ----------

function parts(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s || ''));
  return m ? { d: new Date(+m[1], +m[2] - 1, +m[3]), y: +m[1], h: m[4] ? `${+m[4]} h ${m[5]}` : '' } : null;
}
const jour = (p, year) => fmtDate(p.d, 'FR', { weekday: 'short', day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) });

/** « du jeu. 20 novembre à 10 h 00 au sam. 22 novembre 2026 à 18 h 00 » */
export function quand(du, au) {
  const a = parts(du); const b = parts(au) || a;
  if (!a) return 'Dates à préciser';
  const h = (p) => (p.h ? ` à ${p.h}` : '');
  if (a.d.getTime() === b.d.getTime()) return `le ${jour(a, true)}${h(a)}${b.h && b.h !== a.h ? ` → ${b.h}` : ''}`;
  return `du ${jour(a, a.y !== b.y)}${h(a)} au ${jour(b, true)}${h(b)}`;
}
/** Période déclarée (jours entiers) : « du 20 novembre au 25 novembre 2026 ». Même rendu que le script de la page. */
export function periode(p) {
  const a = parts(p.du); const b = parts(p.au);
  if (!a || !b) return '';
  const f = (x) => fmtDate(x.d, 'FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return p.du === p.au ? `le ${f(a)}` : `du ${f(a)} au ${f(b)}`;
}

const pour = (prenom) => (prenom ? `pour ${esc(prenom)}` : '');
const meta = (...xs) => xs.filter(Boolean).join(' · ');

// ---------- portail ----------

const SCRIPT = `(function(){
var root=document.getElementById('portail');if(!root||!window.fetch)return;
var api=root.getAttribute('data-api');root.className+=' js';
function post(path,body){return fetch(api+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.message||'Une erreur est survenue. Réessayez dans un instant.');return j})})}
function say(el,t,c){if(!el)return;el.textContent=t;el.className='msg'+(c?' '+c:'')}
function fmt(s){var p=s.split('-');return new Date(+p[0],p[1]-1,+p[2]).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
function each(sel,fn){Array.prototype.forEach.call(root.querySelectorAll(sel),fn)}
each('.veh',function(sec){
var id=sec.getAttribute('data-id'),list=[],ul=sec.querySelector('.per'),form=sec.querySelector('.add'),msg=sec.querySelector('.add .msg');
try{list=JSON.parse(sec.getAttribute('data-dispos')||'[]')}catch(e){list=[]}
function draw(){ul.textContent='';
if(!list.length){var e=document.createElement('li');e.className='muted';e.textContent='Aucun jour déclaré pour l’instant.';ul.appendChild(e);return}
list.forEach(function(p,i){var li=document.createElement('li'),s=document.createElement('div'),b=document.createElement('button');
s.textContent=p.du===p.au?'le '+fmt(p.du):'du '+fmt(p.du)+' au '+fmt(p.au);
b.type='button';b.className='x';b.textContent='Supprimer';b.setAttribute('aria-label','Supprimer la période '+s.textContent);
b.onclick=function(){save(list.filter(function(_,k){return k!==i}),'Période supprimée.')};
li.appendChild(s);li.appendChild(b);ul.appendChild(li)})}
function save(next,ok){sec.className+=' busy';
return post('/dispos',{vehiculeId:id,dispos:next}).then(function(j){list=j.dispos||[];draw();say(msg,ok,'ok');return true},function(e){say(msg,e.message,'bad');return false}).then(function(r){sec.className=sec.className.replace(/ busy/g,'');return r})}
form.addEventListener('submit',function(e){e.preventDefault();var du=form.elements.du.value,au=form.elements.au.value||du;
if(!du){say(msg,'Choisissez la première date.','bad');return}
if(au<du){var t=du;du=au;au=t}
save(list.concat([{du:du,au:au}]),'Période ajoutée.').then(function(r){if(r)form.reset()})});
form.elements.du.addEventListener('change',function(){form.elements.au.min=form.elements.du.value||form.elements.du.min});
draw()});
each('form.rep',function(f){f.addEventListener('submit',function(e){var b=e.submitter;if(!b||(b.value!=='oui'&&b.value!=='non'))return;
e.preventDefault();f.className+=' busy';
post(f.getAttribute('action').slice(api.length),{vehiculeId:f.elements.vehiculeId.value,reponse:b.value}).then(function(){location.reload()},function(er){f.className=f.className.replace(/ busy/g,'');say(f.querySelector('.msg'),er.message,'bad')})})});
each('form.prop',function(f){f.addEventListener('submit',function(e){e.preventDefault();f.className+=' busy';var el=f.elements;
post('/vehicules',{nom:el.nom.value,categorie:el.categorie.value,plaque:el.plaque.value,prixJour:el.prixJour.value,notes:el.notes.value}).then(function(){location.reload()},function(er){f.className=f.className.replace(/ busy/g,'');say(f.querySelector('.msg'),er.message,'bad')})})});
})();`;

/** Page du portail. `data` = portailData() ; `today`/`max` bornent les champs date ; `nonce` autorise le script (CSP). */
export function portailPage({ token, data, today, max, contact = '', nonce = '' }) {
  const api = `/api/portail/${token}`;
  const attente = data.demandes.filter((d) => d.statut === 'envoyee');
  const repondues = data.demandes.filter((d) => d.statut !== 'envoyee');
  const demandes = attente.map((d) => `<section class="panel dem">
<span class="chip">Demande en attente</span>
<h2>${esc(d.vehicule)}</h2>
<p>${esc(quand(d.du, d.au))}${d.lieu ? `<br><span class="muted">${esc(d.lieu)}</span>` : ''}${d.prenom ? `<br><span class="muted">${pour(d.prenom)}</span>` : ''}</p>
<p class="muted">Ce véhicule est-il disponible sur ces dates ?</p>
<form class="rep" method="post" action="${esc(api)}/demandes/${esc(d.missionId)}">
<input type="hidden" name="vehiculeId" value="${esc(d.vehiculeId)}">
<div class="btns"><button class="btn" type="submit" name="reponse" value="oui">Disponible</button><button class="btn ghost" type="submit" name="reponse" value="non">Pas disponible</button></div>
<p class="msg" role="status" aria-live="polite"></p>
</form>
</section>`).join('\n');

  const vehicules = data.vehicules.map((v) => `<section class="panel veh" data-id="${esc(v.id)}" data-dispos="${esc(JSON.stringify(v.dispos))}">
<h2>${esc(v.nom)}</h2>
<p class="muted">${meta(esc(v.categorie), esc(v.plaque)) || 'Véhicule confié à la maison'}${v.aValider ? ' <span class="chip">À valider</span>' : ''}</p>
${v.aValider ? '<p class="muted">Nous étudions ce véhicule : vous pouvez déjà déclarer ses jours disponibles.</p>' : ''}
<span class="label sub">Jours disponibles</span>
<ul class="list per">${v.dispos.length ? v.dispos.map((p) => `<li><div>${esc(periode(p))}</div></li>`).join('') : '<li class="muted">Aucun jour déclaré pour l’instant.</li>'}</ul>
<form class="stack add" novalidate>
<div class="two"><label class="fld"><span>Du</span><input type="date" name="du" required min="${esc(today)}" max="${esc(max)}"></label><label class="fld"><span>Au</span><input type="date" name="au" min="${esc(today)}" max="${esc(max)}"></label></div>
<button class="btn ghost" type="submit">Ajouter ces jours</button>
<p class="msg" role="status" aria-live="polite"></p>
</form>
<noscript><p class="muted">Pour modifier vos jours disponibles, activez JavaScript ou écrivez-nous.</p></noscript>
<span class="label sub">Réservations à venir</span>
<ul class="list">${v.reservations.length ? v.reservations.map((r) => `<li><div>${esc(quand(r.du, r.au))}<div class="muted">${meta(esc(r.titre), esc(r.lieu), pour(r.prenom))}</div></div></li>`).join('') : '<li class="muted">Aucune réservation à venir.</li>'}</ul>
</section>`).join('\n');

  const reponses = repondues.length ? `<div class="panel"><span class="label">Vos réponses</span><ul class="list">${repondues.map((d) => `<li><div>${esc(d.vehicule)}<div class="muted">${esc(quand(d.du, d.au))}</div></div><span class="${d.statut === 'oui' ? 'rep-ok' : 'rep-non'}">${d.statut === 'oui' ? 'Disponible' : 'Pas disponible'}</span></li>`).join('')}</ul></div>` : '';

  const body = `<div id="portail" data-api="${esc(api)}">
<span class="label">Espace prestataire</span>
<h1>Bonjour, <em>${esc(data.partenaire.nom)}</em></h1>
<p class="muted">Vos véhicules confiés à la maison Amane : déclarez leurs jours disponibles et répondez à nos demandes.</p>
${demandes}
<div class="sec"><span class="label">Vos véhicules</span></div>
${vehicules || '<div class="panel"><p class="muted" style="margin:0">Aucun véhicule pour l’instant. Proposez-en un ci-dessous : nous revenons vers vous après l’avoir étudié.</p></div>'}
<details class="panel"${data.vehicules.length ? '' : ' open'}>
<summary>Proposer un véhicule</summary>
<form class="stack prop" method="post" action="${esc(api)}/vehicules">
<label class="fld"><span>Modèle</span><input name="nom" required maxlength="80" autocomplete="off" placeholder="Ex. Mercedes Classe V"></label>
<div class="two"><label class="fld"><span>Catégorie</span><input name="categorie" maxlength="60" autocomplete="off" placeholder="Van, SUV, berline…"></label><label class="fld"><span>Immatriculation</span><input name="plaque" maxlength="20" autocomplete="off" autocapitalize="characters"></label></div>
<label class="fld"><span>Votre prix par jour (€)</span><input name="prixJour" inputmode="decimal" maxlength="10" autocomplete="off" pattern="[0-9]{1,7}([.,][0-9]{1,2})?"></label>
<label class="fld"><span>Précisions</span><textarea name="notes" maxlength="1000" rows="3" placeholder="Année, options, conditions…"></textarea></label>
<button class="btn" type="submit">Proposer ce véhicule</button>
<p class="msg" role="status" aria-live="polite"></p>
</form>
</details>
${reponses}
${contact ? `<div class="btns"><a class="btn ghost" href="${esc(contact)}" rel="noopener">Écrire à la maison</a></div>` : ''}
</div>`;
  return shell({ lang: 'FR', title: 'Espace prestataire', body, css: CSS, scripts: `<script${nonce ? ` nonce="${esc(nonce)}"` : ''}>${SCRIPT}</script>` });
}

/** 404 du portail : la même page pour un jeton inconnu, mal formé, révoqué, d'un partenaire à valider ou supprimé. */
export function lienPerime() {
  return shell({ lang: 'FR', title: 'Amane', body: '<h1>Amane</h1><p class="muted">Ce lien n’est plus valable. Écrivez-nous pour en recevoir un nouveau.</p>', css: CSS });
}

/** Message simple (erreur d'un envoi de formulaire sans JavaScript), avec un lien de retour. */
export function messagePage({ titre = 'Amane', message, retour = '', retourLabel = 'Revenir' }) {
  return shell({ lang: 'FR', title: 'Amane', css: CSS, body: `<h1>${esc(titre)}</h1><p>${esc(message)}</p>${retour ? `<div class="btns"><a class="btn ghost" href="${esc(retour)}">${esc(retourLabel)}</a></div>` : ''}` });
}

// ---------- inscription ----------

export const MERCI = 'Merci, nous revenons vers vous sous 48 h.';

const SCRIPT_INSCRIPTION = `(function(){
var f=document.getElementById('inscription');if(!f||!window.fetch)return;var msg=f.querySelector('.msg');
f.addEventListener('submit',function(e){e.preventDefault();var el=f.elements,b={};
['societe','nom','tel','email','siren','vehicules','message','website'].forEach(function(k){b[k]=el[k].value});
f.className+=' busy';msg.textContent='';msg.className='msg';
fetch(f.getAttribute('action'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.message||'Une erreur est survenue. Réessayez dans un instant.');return j})}).then(function(){
var ok=document.getElementById('merci');f.hidden=true;ok.hidden=false;ok.focus()},function(er){f.className=f.className.replace(/ busy/g,'');msg.textContent=er.message;msg.className='msg bad'})})})();`;

/** Page publique « Devenir prestataire ». Aucune promesse d'accès : l'équipe valide chaque inscription. */
export function inscriptionPage({ nonce = '' } = {}) {
  const body = `<span class="label">Prestataires</span>
<h1>Confiez-nous vos <em>véhicules</em></h1>
<p class="muted">Vous louez des voitures ou des vans à Paris ? Présentez-vous en deux minutes. Nous étudions chaque demande et revenons vers vous sous 48 h.</p>
<div class="panel" id="merci" hidden tabindex="-1"><h2>${esc(MERCI)}</h2><p class="muted" style="margin:0">Votre demande est bien arrivée. Un membre de la maison vous contactera au numéro indiqué.</p></div>
<form class="panel stack" id="inscription" method="post" action="/api/prestataires/inscription">
<label class="fld"><span>Société</span><input name="societe" maxlength="120" autocomplete="organization"></label>
<label class="fld"><span>Votre nom</span><input name="nom" required maxlength="120" autocomplete="name"></label>
<label class="fld"><span>Téléphone (WhatsApp de préférence)</span><input name="tel" type="tel" required maxlength="40" autocomplete="tel" inputmode="tel" placeholder="06 12 34 56 78"></label>
<label class="fld"><span>E-mail</span><input name="email" type="email" maxlength="200" autocomplete="email"></label>
<label class="fld"><span>SIREN <small>(facultatif)</small></span><input name="siren" maxlength="20" inputmode="numeric" autocomplete="off"></label>
<label class="fld"><span>Véhicules proposés</span><textarea name="vehicules" maxlength="1000" rows="3" placeholder="Ex. 2 Classe V, 1 Range Rover Sport"></textarea></label>
<label class="fld"><span>Message <small>(facultatif)</small></span><textarea name="message" maxlength="2000" rows="3"></textarea></label>
<div class="hp" aria-hidden="true"><label>Site web<input name="website" tabindex="-1" autocomplete="off"></label></div>
<button class="btn" type="submit">Envoyer ma demande</button>
<p class="msg" role="status" aria-live="polite"></p>
<p class="muted" style="margin:0">Vos coordonnées servent uniquement à vous recontacter.</p>
</form>`;
  return shell({ lang: 'FR', title: 'Devenir prestataire', description: 'Loueurs de voitures et de vans : confiez vos véhicules à la maison Amane.', body, css: CSS, scripts: `<script${nonce ? ` nonce="${esc(nonce)}"` : ''}>${SCRIPT_INSCRIPTION}</script>` });
}

/** Confirmation après un envoi sans JavaScript. */
export function merciPage() {
  return shell({ lang: 'FR', title: 'Devenir prestataire', css: CSS, body: `<span class="label">Prestataires</span><h1>${esc(MERCI)}</h1><p class="muted">Votre demande est bien arrivée. Un membre de la maison vous contactera au numéro indiqué.</p>` });
}
