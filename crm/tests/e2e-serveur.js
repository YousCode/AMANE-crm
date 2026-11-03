// CRM en mode serveur (Vercel + API Amane), avec l'API simulée en mémoire (api-mock.js) :
// connexion par code, synchronisation, file hors ligne, numérotation, Messages WhatsApp, historique, réglages, téléphone.
// SHOTS=/chemin/dossier node crm/tests/e2e-serveur.js  → enregistre aussi les captures 390×844.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const {createApi}=require('./api-mock');
const html0=fs.readFileSync(process.env.CRM_FILE||path.join(__dirname,'..','index.html'),'utf8');
const HOOK="Object.defineProperty(window,'__S',{get:()=>S});Object.defineProperty(window,'__DR',{get:()=>DR});Object.defineProperty(window,'__db',{get:()=>db});";
if(!html0.includes('boot();\n})();'))throw new Error('ancre de test introuvable');// Comme site/make_vercel.py : la page servie hors claude.ai porte la balise viewport
const VP='<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
const html=(/name="viewport"/.test(html0.slice(0,html0.indexOf('<style')))?'':VP)+html0.replace('boot();\n})();','boot();\n'+HOOK+'\n})();');
const SHOTS=process.env.SHOTS||'';if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
const res=[];const ok=(n,c,info)=>{res.push((c?'PASS ':'FAIL ')+n+(info!==undefined&&info!==''&&!c?' — '+info:''))};
const Y=new Date().getFullYear();

(async()=>{const b=await chromium.launch();const errs=[];
const wire=async(ctx,api)=>{await ctx.route('**/*',r=>{const u=new URL(r.request().url());
  if(u.hostname==='amane.test'&&u.pathname.startsWith('/api/'))return api.handle(r);
  if(u.hostname==='amane.test')return r.fulfill({body:html,contentType:'text/html; charset=utf-8'});
  if(u.hostname.includes('fonts.g'))return r.fulfill({body:'',contentType:'text/css'});
  return r.abort()})};
const watch=p=>{p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console '+m.text())})};
const W=(p,ms)=>p.waitForTimeout(ms||350);
const until=async(p,fn,arg,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||6000)){if(await p.evaluate(fn,arg).catch(()=>false))return Date.now()-t0;await p.waitForTimeout(100)}return -1};
const typePin=async(p,pin)=>{for(const k of pin){await p.click(`#login [data-key="${k}"]`)}};
const shot=async(p,name,full)=>{if(SHOTS)await p.screenshot({path:path.join(SHOTS,name+'.png'),fullPage:!!full})};
// Débordement horizontal : un élément visible dépasse l'écran sans être dans un conteneur qui défile ou coupe
const overflow=p=>p.evaluate(()=>{const W=innerWidth;const bad=[];
  const clipped=el=>{for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(/(auto|scroll|hidden|clip)/.test(s.overflowX))return true}return false};
  document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height)return;const s=getComputedStyle(el);if(s.visibility==='hidden'||s.position==='fixed'&&el.closest('[hidden]'))return;
    if((r.right>W+1||r.left<-1)&&!clipped(el)&&!el.closest('.drawer:not(.on),.hero,[hidden],.toast,.ptr'))bad.push((el.id?'#'+el.id:el.tagName.toLowerCase()+'.'+[...el.classList].join('.'))+' '+Math.round(r.left)+'→'+Math.round(r.right))});
  return {sw:document.documentElement.scrollWidth,W,bad:bad.slice(0,6)}});
let p;
try{
/* ====== Bureau 1280×860 ====== */
const api=createApi();const ctx=await b.newContext({viewport:{width:1280,height:860}});await wire(ctx,api);p=await ctx.newPage();watch(p);
await p.goto('http://amane.test/crm/');await W(p,900);
ok('écran de connexion affiché (pas de session)',await p.isVisible('#login')&&(await p.$$('#login .tile')).length===3);
ok('pas de fenêtre « Qui êtes-vous ? » en mode serveur',!(await p.isVisible('#whoM')));
await p.click('#login [data-lgwho="amel"]');await W(p,200);
ok('choix de la personne → clavier du code',await p.isVisible('#lgPad')&&(await p.textContent('#lgBody')).includes('Amel'));
await typePin(p,'9999');await p.click('#login [data-key="ok"]');await W(p,400);
ok('mauvais code : message et secousse',(await p.textContent('#lgMsg')).includes('Code incorrect')&&await p.$eval('#lgDots',e=>e.classList.contains('shake')));
await p.keyboard.type('1234');await p.keyboard.press('Enter');await W(p,900);
ok('bon code (clavier physique) : application ouverte',!(await p.isVisible('#login')));
ok('utilisateur connecté = S.me',await p.evaluate(()=>__S.me)==='amel'&&(await p.textContent('#hello')).includes('Amel'));
ok('mode serveur et synchronisé',await p.evaluate(()=>__S.mode)==='server'&&(await p.textContent('#live')).includes('Synchronisé'),await p.textContent('#live'));
ok('dernière personne retenue sur l’appareil',await p.evaluate(()=>localStorage.getItem('amane.me'))==='amel');
ok('Messages et Réglages dans le rail',await p.isVisible('.rail [data-route="messages"]')&&await p.isVisible('.rail [data-route="reglages"]'));
ok('non lus sur l’entrée Messages',(await p.textContent('.rail [data-route="messages"] .dot'))==='4');
ok('Fil de l’équipe sur l’accueil',(await p.textContent('#view')).includes('Fil de l’équipe')&&(await p.$$('#view .act-i')).length>0);
// synchronisation : modification faite par un autre utilisateur
await p.evaluate(()=>location.hash='demandes');await W(p,400);
api.external('missions','mx',{titre:'Rolls-Royce — mariage samedi',clientId:'c1',service:'chauffeur',statut:'nouvelle',debut:'2030-06-01T14:00',responsable:'aziz'},'aziz');
const tSync=await until(p,()=>document.querySelector('#view').innerText.includes('Rolls-Royce — mariage samedi'),null,6000);
ok('modification d’Aziz visible en moins d’un cycle (4 s)',tSync>=0&&tSync<=4800,'ms='+tSync);
// carte supprimée ailleurs
api.st.cols.missions.mx={...api.st.cols.missions.mx,_deleted:true,updatedAt:new Date().toISOString()};
ok('suppression faite ailleurs appliquée',await until(p,()=>!document.querySelector('#view').innerText.includes('Rolls-Royce'),null,6000)>=0);
// file d'attente hors ligne
await ctx.setOffline(true);api.offline=true;
await p.evaluate(()=>location.hash='clients');await W(p,300);await p.click('.row.clients >> text=James Whitmore');await W(p,400);
await p.fill('#f_hotel','Hôtel de Crillon');await p.click('[data-act="save"]');await W(p,500);
await p.click('[data-act="close"]');await W(p,200);
await p.evaluate(()=>location.hash='planning');await W(p,200);await p.evaluate(()=>location.hash='clients');await W(p,300);
await p.click('.row.clients >> text=Elena Petrova');await W(p,300);await p.fill('#f_prefs','Préfère les salons privés.');await p.click('[data-act="save"]');await W(p,500);await p.click('[data-act="close"]');
const lv=await p.textContent('#live');ok('hors ligne : « 2 modifications en attente »',/Hors ligne — 2 modifications en attente/.test(lv),lv);
ok('modification visible tout de suite (optimiste)',(await p.textContent('#view')).includes('Hôtel de Crillon'));
ok('file enregistrée dans le navigateur',await p.evaluate(()=>JSON.parse(localStorage.getItem('amane.srv.queue')||'[]').length)===2);
ok('rien envoyé au serveur',api.st.cols.clients.c3.hotel==='Le Bristol');
api.offline=false;await ctx.setOffline(false);
const tq=await until(p,()=>!document.querySelector('#live').innerText.includes('attente')&&document.querySelector('#live').innerText.includes('Synchronisé'),null,8000);
ok('retour du réseau : file rejouée',tq>=0&&api.st.cols.clients.c3.hotel==='Hôtel de Crillon'&&api.st.cols.clients.c4.prefs==='Préfère les salons privés.',JSON.stringify([tq,api.st.cols.clients.c4,api.st.log.filter(x=>x[0]==='PUT').map(x=>x[1])]));
ok('file vidée',await p.evaluate(()=>JSON.parse(localStorage.getItem('amane.srv.queue')||'[]').length)===0);
// numérotation par /api/counter
await p.evaluate(()=>location.hash='demandes');await W(p,400);await p.click('.card[data-id="m3"]');await W(p,400);
await p.click('[data-tab="devis"]');await W(p,200);await p.click('[data-act="dv-new"]');await W(p,200);await p.click('[data-act="save"]');await W(p,900);
ok('devis numéroté par le serveur',(await p.textContent('#dvNum')).includes(`D-${Y}-0001`)&&api.st.counters['devis-'+Y]===1,await p.textContent('#dvNum'));
await p.click('[data-act="dv-facture"]');await W(p,900);
ok('facture numérotée par le serveur',(await p.textContent('#dvNum')).includes(`F-${Y}-0001`)&&api.st.counters['facture-'+Y]===1);
ok('devis enregistré sur le serveur',(api.st.cols.missions.m3.devis||{}).numero===`D-${Y}-0001`);
// historique
await p.click('[data-tab="act"]');await W(p,700);
const hist=await p.textContent('#drawer .dr-b');ok('onglet Historique : qui, quoi, quand',(await p.$$('#drawer .act-i')).length>=2&&hist.includes('Amel')&&/statut : Nouvelle → Proposition|devis modifié/.test(hist)&&/il y a|à l’instant/.test(hist),hist.slice(0,160));
await p.click('[data-act="close"]');await W(p,200);
// liens d'appel dans la fiche demande
await p.click('.card[data-id="m1"]');await W(p,400);
ok('fiche demande : Appeler le client',await p.getAttribute('#drawer [data-ct="tel"]','href')==='tel:+33612345678');
ok('fiche demande : WhatsApp prérempli',(await p.getAttribute('#drawer [data-ct="wa"]','href')).startsWith('https://wa.me/33612345678?text=Bonjour%20Mme%20Sophie%20Laurent'));
ok('fiche demande : Itinéraire vers le lieu',await p.getAttribute('#drawer [data-ct="maps"]','href')==='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('Hôtel Ritz, 15 place Vendôme, Paris'));
ok('fiche demande : appeler le chauffeur (06 → +33)',await p.getAttribute('#drawer [data-ct="tel-ch"]','href')==='tel:+33612000001');
ok('fiche demande : SMS et e-mail',await p.getAttribute('#drawer [data-ct="sms"]','href')==='sms:+33612345678'&&await p.getAttribute('#drawer [data-ct="mail"]','href')==='mailto:sophie.laurent@example.com');
ok('fiche demande : copier l’adresse',await p.isVisible('#drawer [data-act="copy"]'));
ok('fiche demande : lien vers la conversation',await p.isVisible('#drawer .dr-c [data-conv="33612345678"]'));
await p.click('[data-act="close"]');await W(p,200);
// Messages
await p.click('.rail [data-route="messages"]');await W(p,400);
ok('liste des conversations',(await p.$$('.cv')).length===5);
const cvTxt=await p.textContent('.cv-list');ok('aperçu, langue, non lus, fenêtre fermée',cvTxt.includes('Sophie Laurent')&&cvTxt.includes('AR')&&(await p.$$('.cv .ub')).length===3&&(await p.textContent('.cv[data-conv="447700900123"]')).includes('Fenêtre fermée'));
await p.fill('#cvQ','khalid');await W(p,200);ok('recherche dans les conversations',(await p.$$('.cv')).length===1);await p.fill('#cvQ','');await W(p,200);
await p.click('.cv[data-conv="33612345678"]');await W(p,500);
ok('ouverture : marquée lue',api.st.log.some(x=>x[1]==='/api/whatsapp/read'&&x[2]&&x[2].convId==='33612345678')&&api.st.cols.conversations['33612345678'].unread===0);
ok('fil : bulles entrantes et sortantes',(await p.$$('.th .bub.in')).length===3&&(await p.$$('.th .bub.out')).length===1);
ok('fil : séparateurs de jours et coches de lecture',(await p.$$('.th .dsep')).length>=2&&(await p.$$('.th .tk.read')).length===1);
ok('fil : en-tête Appeler / WhatsApp',await p.getAttribute('.th-a [data-ct="tel"]','href')==='tel:+33612345678'&&await p.getAttribute('.th-a [data-ct="wa"]','href')==='https://wa.me/33612345678');
ok('analyse IA affichée',(await p.textContent('.ai-card')).includes('G 63')&&(await p.textContent('.ai-card')).includes('Appliquer à la demande'));
await p.click('[data-qr="0"]');await W(p,100);
ok('réponse rapide en français, prénom inséré',(await p.inputValue('#cmpIn')).startsWith('Bonjour Mme Sophie Laurent, merci pour votre message.'));
await p.fill('#cmpIn','');const sentBefore=api.st.sent.length;
await p.click('[data-act="cv-draft"]');await W(p,200);
ok('brouillon IA inséré, jamais envoyé seul',(await p.inputValue('#cmpIn')).startsWith('Bonjour Madame Laurent, c’est tout à fait possible')&&api.st.sent.length===sentBefore);
await p.fill('#cmpIn','Avec plaisir, Karim vous attendra samedi à 19 h 30.');await p.click('[data-act="cv-send"]');await W(p,700);
ok('envoi : message au serveur',api.st.sent.some(x=>x.text==='Avec plaisir, Karim vous attendra samedi à 19 h 30.'&&x.convId==='33612345678'&&x.by==='amel'));
ok('envoi : bulle ajoutée, zone vidée',(await p.textContent('.th-s')).includes('Karim vous attendra samedi')&&(await p.inputValue('#cmpIn'))==='');
await p.click('.ai-card [data-act="cv-apply"]');await W(p,500);
ok('« Appliquer à la demande » ouvre la demande liée, champs proposés',await p.evaluate(()=>__DR.open&&__DR.id==='m1'&&__DR.draft.service==='chauffeur'&&__DR.draft.lieu==='Hôtel Plaza Athénée'));
await p.click('[data-act="close"]');await W(p,200);
// fenêtre de 24 h fermée
await p.click('.cv[data-conv="447700900123"]');await W(p,400);
ok('fenêtre fermée : explication affichée',(await p.textContent('.cmp .wbox')).includes('24 h'));
await p.fill('#cmpIn','Hello again');await p.click('[data-act="cv-send"]');await W(p,500);
ok('409 window_closed : texte gardé',(await p.inputValue('#cmpIn'))==='Hello again'&&!api.st.sent.some(x=>x.text==='Hello again'));
await p.click('[data-act="cv-tpl"]');await W(p,600);
const tpl=api.st.sent.find(x=>x.template);ok('modèle approuvé envoyé (langue du client)',!!tpl&&tpl.template.name==='amane_suivi'&&tpl.template.lang==='en'&&tpl.convId==='447700900123',JSON.stringify(tpl));
// arabe
await p.click('.cv[data-conv="971501234567"]');await W(p,400);
ok('arabe : bulles en dir="auto"',await p.$eval('.th .bub.in [dir="auto"]',e=>getComputedStyle(e).direction)==='rtl');
await p.click('[data-qr="1"]');await W(p,100);ok('réponse rapide en arabe',(await p.inputValue('#cmpIn')).includes('نتحقق'));
ok('conversation liée : bouton « Demande »',(await p.textContent('[data-act="cv-mission"]')).includes('Demande')&&!(await p.textContent('[data-act="cv-mission"]')).includes('Créer'));
// créer une demande depuis une conversation (prospect sans fiche)
await p.click('.cv[data-conv="33698765432"]');await W(p,400);
ok('prospect : « Créer la demande »',(await p.textContent('[data-act="cv-mission"]')).includes('Créer la demande'));
await p.click('[data-act="cv-mission"]');await W(p,900);
const dd=await p.evaluate(()=>({...__DR.draft}));
ok('demande préremplie depuis l’analyse',dd.vehiculeId==='urus'&&dd.service==='location'&&/Bristol/.test(dd.lieu)&&+dd.montant===3000&&dd.convId==='33698765432'&&/^WhatsApp — /.test(dd.titre),JSON.stringify({v:dd.vehiculeId,s:dd.service,l:dd.lieu,m:dd.montant}));
await p.click('[data-act="save"]');await W(p,900);
const nm=Object.values(api.st.cols.missions).find(m=>m.convId==='33698765432');const nc=Object.values(api.st.cols.clients).find(c=>c.telNorm==='33698765432');
ok('demande et fiche client créées sur le serveur',!!nm&&!!nc&&nm.clientId===Object.keys(api.st.cols.clients).find(k=>api.st.cols.clients[k]===nc)&&nc.nom==='Charles de Villiers');
await p.click('[data-act="close"]');await W(p,200);
// Réglages
await p.click('.rail [data-route="reglages"]');await W(p,400);
ok('réglages : valeurs par défaut affichées',(await p.inputValue('#rgDeb'))==='09:00'&&(await p.inputValue('#rgT_jour')).includes('{prenom}')&&(await p.textContent('#view')).includes('rien n’est encore enregistré'));
await p.click('.tog');await p.fill('#rgFin','22:30');await p.fill('#rgT_jour','Bonjour {prenom}, bienvenue chez Amane.');await W(p,100);
ok('aperçu en direct (prénom inséré)',(await p.textContent('#rgPrev')).includes('Bonjour Sophie, bienvenue chez Amane.')&&(await p.textContent('#rgPrev')).includes('désactivée'));
await p.click('[data-rglang="AR"]');await W(p,150);ok('textes par langue (AR)',(await p.inputValue('#rgT_nuit')).includes('{prenom}')&&(await p.$eval('#rgT_nuit',e=>getComputedStyle(e).direction))==='rtl');
await p.click('[data-act="rg-save"]');await W(p,900);
const rg=api.st.cols.reglages.general||{};ok('réglages enregistrés sur le serveur',rg.autoReply===false&&rg.horaires&&rg.horaires.fin==='22:30'&&rg.textes.FR.jour==='Bonjour {prenom}, bienvenue chez Amane.',JSON.stringify(rg).slice(0,140));
// photos
await p.evaluate(()=>location.hash='flotte');await W(p,400);await p.click('.vcard >> nth=0');await W(p,300);await p.click('[data-tab="photos"]');await W(p,200);
await p.setInputFiles('#phIn',[path.join(__dirname,'p.jpg')]);await W(p,1500);
const ph=(api.st.cols.vehicules.urus||{}).photos||[];ok('photo réduite puis envoyée au serveur',ph.length===1&&!!api.st.photos[ph[0]]);
ok('photo affichée depuis /api/photo',(await p.getAttribute('#drawer .gal img','src')||'').startsWith('/api/photo?id='));
await p.click('[data-act="close"]');await W(p,200);
// Majordome via /api/ai
await p.click('#mjBtn');await W(p,200);await p.fill('#mjIn','Salam, famille de 5 au George V, besoin d’un van avec chauffeur.');await p.click('[data-act="mj-run"]');await W(p,800);
ok('Majordome servi par /api/ai',await p.isVisible('[data-act="mj-create"]')&&api.st.log.some(x=>x[1]==='/api/ai'));
await p.click('[data-act="mj-close"]');
api.st.ia=false;await p.evaluate(()=>location.hash='demandes');await W(p,300);await p.click('.card[data-id="m4"]');await W(p,300);await p.click('[data-tab="ia"]');await W(p,200);await p.click('[data-act="ai-write"]');await W(p,700);
ok('IA coupée (503 ia_off) : bouton désactivé proprement',await p.$eval('[data-act="ai-write"]',e=>e.disabled&&/serveur/.test(e.title)));
await p.click('[data-act="close"]');await W(p,200);
// session expirée → reconnexion sans perdre la page
api.st.session=null;await p.evaluate(()=>__db.syncNow());await W(p,500);
ok('session expirée : écran de code',await p.isVisible('#lgPad'));
await typePin(p,'1234');await W(p,1700);ok('reconnexion automatique après 4 chiffres',!(await p.isVisible('#login'))&&api.st.session==='amel');
// déconnexion, 429, première connexion
await p.click('#meBtn');await W(p,200);await p.click('#plusM [data-act="logout"]');await W(p,1500);
ok('déconnexion : retour à l’écran de code, dernière personne proposée',await p.isVisible('#lgPad')&&(await p.textContent('#lgBody')).includes('Amel'));
ok('déconnexion : cache local effacé',await p.evaluate(()=>!localStorage.getItem('amane.srv.cache')&&!localStorage.getItem('amane.srv.queue')));
await p.click('#login [data-lgstep="who"]');await p.click('#login [data-lgwho="aziz"]');
for(let i=0;i<5;i++){await typePin(p,'0000');await p.click('#login [data-key="ok"]');await W(p,250)}
await typePin(p,'0000');await p.click('#login [data-key="ok"]');await W(p,300);
ok('429 : trop d’essais',(await p.textContent('#lgMsg')).includes('Trop d’essais'));
await p.click('#login [data-lgstep="who"]');await p.click('#login [data-lgwho="youssouf"]');await typePin(p,'2468');await p.click('#login [data-key="ok"]');await W(p,400);
ok('409 no_pin : invitation à la première connexion',(await p.textContent('#lgMsg')).includes('pas encore été créé')&&await p.isVisible('#lgMsg [data-lgstep="setup"]'));
await p.click('#lgMsg [data-lgstep="setup"]');await W(p,200);
await p.fill('#lgCode','FAUX');await p.fill('#lgP1','2468');await p.fill('#lgP2','2468');await p.click('#lgForm button[type="submit"]');await W(p,400);
ok('première connexion : mauvais code d’installation',(await p.textContent('#lgMsg')).includes('Code d’installation incorrect'));
await p.fill('#lgCode','AMANE-SETUP');await p.fill('#lgP1','2468');await p.fill('#lgP2','2469');await p.click('#lgForm button[type="submit"]');await W(p,200);
ok('première connexion : codes différents refusés',(await p.textContent('#lgMsg')).includes('ne correspondent pas'));
await p.fill('#lgP2','2468');await p.click('#lgForm button[type="submit"]');await W(p,1200);
ok('première connexion : code créé et connecté',!(await p.isVisible('#login'))&&await p.evaluate(()=>__S.me)==='youssouf'&&api.st.users.youssouf.pin==='2468');
const txt=await p.evaluate(()=>document.body.innerText);ok('aucun "undefined"/"NaN"',!/undefined|NaN|\[object/.test(txt),(txt.match(/.{0,30}(undefined|NaN|\[object).{0,30}/)||[''])[0]);
await ctx.close();

/* ====== Téléphone 390×844 ====== */
const api2=createApi();const mctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'});
await wire(mctx,api2);p=await mctx.newPage();watch(p);
await p.goto('http://amane.test/crm/');await W(p,900);await shot(p,'1-connexion');
await p.tap('#login [data-lgwho="amel"]');await W(p,250);await typePin(p,'12');await shot(p,'2-code');await typePin(p,'34');await p.tap('#login [data-key="ok"]');await W(p,1200);
ok('mobile : connecté',await p.evaluate(()=>__S.mode)==='server'&&!(await p.isVisible('#login')));
ok('mobile : barre d’onglets en bas, rail masqué',await p.isVisible('#tabbar')&&!(await p.isVisible('.rail'))&&(await p.$$('#tabbar .tb')).length===5);
const tb=await p.$eval('#tabbar',e=>{const r=e.getBoundingClientRect();return {b:Math.round(r.bottom),h:Math.round(r.height)}});ok('mobile : barre collée en bas',tb.b===844&&tb.h>=54,JSON.stringify(tb));
ok('mobile : Messages dans la barre (mode serveur) avec non lus',(await p.textContent('#tabbar [data-route="messages"]')).includes('4'));
ok('mobile : bouton + flottant',await p.isVisible('#fab'));
ok('Aujourd’hui : prochaine mission en tête',(await p.textContent('.hero')).includes('G 63 — dîner au Ritz')&&(await p.textContent('.hero')).includes('Karim B.'));
ok('Aujourd’hui : Appeler / WhatsApp / Itinéraire / Ouvrir',await p.getAttribute('.hero [data-ct="tel"]','href')==='tel:+33612345678'&&(await p.getAttribute('.hero [data-ct="wa"]','href')).startsWith('https://wa.me/33612345678')&&(await p.getAttribute('.hero [data-ct="maps"]','href')).includes('Ritz')&&await p.isVisible('.hero [data-open="mission:m1"]'));
const sal=await p.textContent('#view');ok('Aujourd’hui : frise du jour, à faire, messages, fil',sal.includes('À faire')&&sal.includes('Fil de l’équipe')&&(await p.$$('#view .tl-i')).length>=1&&(await p.$$('#view .cv.unread')).length>=1);
await shot(p,'3-aujourdhui',true);
// pas de débordement horizontal, toutes les routes, deux tailles
for(const [w,h] of [[390,844],[360,740]]){await p.setViewportSize({width:w,height:h});
  for(const r of ['salon','messages','demandes','planning','clients','carnet','flotte','contrats','finances','services','reglages','aide']){await p.evaluate(h=>location.hash=h,r);await W(p,350);const o=await overflow(p);if(o.bad.length||o.sw>o.W)ok(`pas de débordement · ${r} · ${w}px`,false,JSON.stringify(o))}
  ok(`pas de débordement horizontal · 12 écrans · ${w}×${h}`,true)}
await p.setViewportSize({width:390,height:844});
// Messages
await p.tap('#tabbar [data-route="messages"]');await W(p,400);await shot(p,'4-messages');
await p.tap('.cv[data-conv="33612345678"]');await W(p,600);
ok('mobile : conversation plein écran, barre masquée',await p.isVisible('.th')&&!(await p.isVisible('#tabbar'))&&await p.$eval('.th',e=>{const r=e.getBoundingClientRect();return r.top<=1&&r.width===390}));
let o=await overflow(p);ok('mobile : conversation sans débordement',!o.bad.length,JSON.stringify(o));
await shot(p,'5-conversation');
await p.tap('[data-act="cv-back"]');await W(p,400);ok('mobile : retour à la liste',!(await p.isVisible('.th'))&&await p.isVisible('#tabbar'));
await p.tap('.cv[data-conv="971501234567"]');await W(p,600);await shot(p,'6-conversation-arabe');
o=await overflow(p);ok('mobile : conversation arabe sans débordement',!o.bad.length,JSON.stringify(o));
await p.tap('[data-act="cv-back"]');await W(p,300);
// fiche plein écran
await p.evaluate(()=>location.hash='salon');await W(p,300);await p.tap('.hero [data-open="mission:m1"]');await W(p,600);
const dr=await p.$eval('#drawer',e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),t:Math.round(r.top)}});
ok('mobile : fiche plein écran',dr.w===390&&dr.h===844&&dr.t===0,JSON.stringify(dr));
const sv=async()=>p.$eval('#drawer [data-act="save"]',e=>{const r=e.getBoundingClientRect();return r.bottom<=844&&r.top>700&&r.height>=44});
ok('mobile : « Enregistrer » collé en bas',await sv());await p.$eval('#drawer .dr-b',e=>e.scrollTop=e.scrollHeight);await W(p,200);ok('mobile : « Enregistrer » reste visible au défilement',await sv());
ok('mobile : champs en 16 px (pas de zoom iOS)',await p.$eval('#f_titre',e=>parseFloat(getComputedStyle(e).fontSize)>=16));
const small=await p.$$eval('#drawer button:not([disabled]),#drawer a.ct,#drawer input,#drawer select,#tabbar button',els=>els.filter(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;if(e.type==='checkbox')return false;return r.height<40}).map(e=>(e.dataset.act||e.dataset.tab||e.id||e.className)+':'+Math.round(e.getBoundingClientRect().height)));
ok('mobile : cibles tactiles ≥ 40 px dans la fiche',small.length===0,small.join(', '));
await p.$eval('#drawer .dr-b',e=>e.scrollTop=0);await shot(p,'7-fiche-demande');
o=await overflow(p);ok('mobile : fiche sans débordement',!o.bad.length,JSON.stringify(o));
await p.tap('#drawer .dr-h [data-act="close"]');await W(p,400);
// balayage d'une demande
await p.evaluate(()=>location.hash='demandes');await W(p,400);
ok('mobile : demandes en liste par défaut',(await p.$$('.lcard')).length>0&&!(await p.$('.kanban')));
await shot(p,'8-demandes',true);
const cb=await p.$eval('.lcard[data-lid="m4"]',e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width*0.7,y:r.top+r.height/2}});
await p.mouse.move(cb.x,cb.y);await p.mouse.down();for(let i=1;i<=10;i++)await p.mouse.move(cb.x-i*18,cb.y+i*.5);await p.mouse.up();await W(p,1200);
ok('balayage à gauche : Nouvelle → Proposition',api2.st.cols.missions.m4.statut==='proposition',api2.st.cols.missions.m4.statut);
ok('balayage : la fiche ne s’ouvre pas',!(await p.evaluate(()=>__DR.open)));
const cb2=await p.$eval('.lcard[data-lid="m4"]',e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width*0.3,y:r.top+r.height/2}});
await p.mouse.move(cb2.x,cb2.y);await p.mouse.down();for(let i=1;i<=10;i++)await p.mouse.move(cb2.x+i*18,cb2.y);await p.mouse.up();await W(p,1200);
ok('balayage à droite : retour à Nouvelle',api2.st.cols.missions.m4.statut==='nouvelle');
await p.tap('.lcard[data-lid="m4"] [data-move$=":1"]');await W(p,800);ok('flèche › toujours disponible en liste',api2.st.cols.missions.m4.statut==='proposition');
// tirer pour actualiser
await p.evaluate(()=>{location.hash='salon';scrollTo(0,0)});await W(p,400);
const nSync=api2.st.log.filter(x=>x[1].startsWith('/api/sync')).length;const cdp=await mctx.newCDPSession(p);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:300}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:300+i*20}]});
await shot(p,'9-tirer');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await W(p,900);
ok('tirer vers le bas : synchronisation immédiate',api2.st.log.filter(x=>x[1].startsWith('/api/sync')).length>nSync);
// feuille « Plus »
await p.tap('#tabbar [data-act="plus"]');await W(p,400);ok('« Plus » : sections restantes et déconnexion',(await p.$$('#plusM .sh-it[data-route]')).length>=7&&await p.isVisible('#plusM [data-act="logout"]'));
await shot(p,'10-plus');await p.tap('#plusM [data-route="reglages"]');await W(p,400);ok('« Plus » → Réglages',await p.evaluate(()=>__S.route)==='reglages'&&!(await p.isVisible('#plusM')));
await shot(p,'11-reglages',true);
await mctx.close();
}catch(e){res.push('CRASH '+String(e.message).split('\n')[0])}
ok('0 erreur JS',errs.length===0,errs.slice(0,4).join(' | '));
await b.close();console.log(res.join('\n'));const f=res.filter(r=>!r.startsWith('PASS')).length;console.log(`${res.length-f}/${res.length} PASS`);process.exit(f?1:0)})();
