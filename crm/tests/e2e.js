const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const FILE=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(FILE,'utf8');const mock=fs.readFileSync(path.join(__dirname,'mock.js'),'utf8');
const res=[];const ok=(n,c,info)=>{res.push((c?'PASS ':'FAIL ')+n+(info?' — '+info:''))};
(async()=>{const b=await chromium.launch();let p;const errs=[];try{p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console '+m.text())});
await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://crm.test/'))return r.fulfill({body:'<!doctype html><meta charset=utf-8><script>'+mock+'</script>'+html,contentType:'text/html; charset=utf-8'});if(u.includes('fonts.g'))return r.abort();r.continue()});
await p.goto('http://crm.test/');await p.waitForTimeout(1200);
// who am I
const who=await p.isVisible('#whoM');ok('fenêtre Qui êtes-vous au 1er lancement',who);
if(who){await p.click('[data-who="amel"]');await p.waitForTimeout(300)}
ok('mode synchronisé',(await p.textContent('#live')).includes('Synchronisé'),await p.textContent('#live'));
ok('exemples affichés tant que base vide',await p.isVisible('text=Vous regardez des exemples'));
// create client via mission drawer -> new client flow
await p.click('#newBtn');await p.waitForTimeout(400);
await p.fill('#f_titre','G 63 — dîner au Ritz');
await p.selectOption('#f_clientId','__new');await p.waitForTimeout(400);
ok('tiroir client ouvert depuis la demande',(await p.textContent('#drTitle')).length>0&&await p.isVisible('#f_nom'));
await p.fill('#f_nom','M. Test Dupont');await p.fill('#f_tel','+33 6 11 22 33 44');
await p.click('[data-act="save"]');await p.waitForTimeout(600);
ok('retour à la demande avec client pré-rempli',await p.isVisible('#f_titre')&&await p.$eval('#f_clientId',e=>e.options[e.selectedIndex].text)==='M. Test Dupont',await p.$eval('#f_clientId',e=>e.options[e.selectedIndex]?.text));
const titre=await p.inputValue('#f_titre');ok('titre conservé après création du client',titre==='G 63 — dîner au Ritz',titre);
await p.selectOption('#f_vehiculeId','g63');await p.fill('#f_montant','1300');await p.selectOption('#f_statut','confirmee');
await p.click('[data-act="save"]');await p.waitForTimeout(600);
const ms=await p.evaluate(()=>Object.values(window.__store.missions||{}));ok('demande enregistrée en base',ms.length===1,JSON.stringify(ms[0]&&{t:ms[0].titre,c:!!ms[0].clientId,v:ms[0].vehiculeId,st:ms[0].statut}));
await p.click('[data-act="close"]');await p.waitForTimeout(300);
ok('exemples disparus après 1re fiche',!(await p.isVisible('text=Vous regardez des exemples')));
// kanban drag
await p.evaluate(()=>location.hash='demandes');await p.waitForTimeout(500);
const card=await p.$('.card[data-id]');ok('carte visible dans le pipeline',!!card);
if(card){await p.dragAndDrop('.card[data-id]','.col[data-col="encours"]');await p.waitForTimeout(500);
 const st=await p.evaluate(()=>Object.values(window.__store.missions)[0].statut);ok('glisser-déposer change le statut',st==='encours',st)}
// arrows fallback + demo-free move back
await p.hover('.card[data-id]');await p.click('.card[data-id] [data-move$=":1"]');await p.waitForTimeout(500);
const st3=await p.evaluate(()=>Object.values(window.__store.missions)[0].statut);ok('flèche › avance le statut',st3==='terminee',st3);
await p.hover('.card[data-id]');await p.click('.card[data-id] [data-move$=":-1"]');await p.waitForTimeout(500);
ok('flèche ‹ recule le statut',(await p.evaluate(()=>Object.values(window.__store.missions)[0].statut))==='encours');
ok('pas de fiche ouverte par les flèches',!(await p.evaluate(()=>document.getElementById('drawer').classList.contains('on'))));
// contract tab
await p.click('.card[data-id]',{timeout:5000});await p.waitForTimeout(400);await p.click('[data-tab="contrat"]');await p.waitForTimeout(300);
await p.check('[data-k="contrat.pieces.permis"]');await p.check('[data-k="contrat.pieces.passeport"]');await p.selectOption('#f_contrat_statut','signe');await p.fill('#f_contrat_caution','10000');
await p.click('[data-act="save"]');await p.waitForTimeout(500);
const k=await p.evaluate(()=>Object.values(window.__store.missions)[0].contrat);ok('contrat enregistré',k.statut==='signe'&&k.pieces.permis&&k.pieces.passeport&&+k.caution===10000,JSON.stringify(k).slice(0,120));
const dlb=await p.$('[data-act="dl-contrat"]');ok('bouton télécharger le contrat',!!dlb);
if(dlb){await dlb.click();await p.waitForTimeout(300);const s=await p.evaluate(()=>window.__log.filter(x=>x[0]==='save'));ok('contrat téléchargé',s.length===1&&s[0][2]>1500,JSON.stringify(s))}
// message client
await p.click('[data-tab="ia"]');await p.waitForTimeout(200);await p.click('[data-act="ai-write"]');await p.waitForTimeout(400);
ok('message client rédigé',(await p.inputValue('#aiOut')).includes('Amane'));
await p.click('[data-act="close"]');await p.waitForTimeout(300);
// majordome
await p.click('#mjBtn');await p.waitForTimeout(200);await p.fill('#mjIn','Salam, je suis à Paris du 12 au 15 au Plaza avec ma famille, besoin d\'un van avec chauffeur. Khalid +971501234567');
await p.click('[data-act="mj-run"]');await p.waitForTimeout(500);
ok('majordome analyse',await p.isVisible('[data-act="mj-create"]'));
await p.click('[data-act="mj-create"]');await p.waitForTimeout(800);
const st2=await p.evaluate(()=>({c:Object.values(window.__store.clients||{}).map(x=>x.nom),m:Object.values(window.__store.missions).map(x=>[x.titre,x.service,x.vehiculeId,x.debut])}));
ok('majordome crée client + demande',st2.c.includes('Khalid Al-Mansoori')&&st2.m.length===2,JSON.stringify(st2));
ok('véhicule reconnu (Classe V)',st2.m.some(x=>x[2]==='classev'),'');
ok('drawer de la demande ouvert après majordome',await p.isVisible('#f_titre'));
await p.click('[data-act="close"]');await p.waitForTimeout(300);
// majordome again same phone -> dedupe
await p.click('#mjBtn');await p.waitForTimeout(200);await p.fill('#mjIn','encore moi Khalid');await p.click('[data-act="mj-run"]');await p.waitForTimeout(400);await p.click('[data-act="mj-create"]');await p.waitForTimeout(700);
const nc=await p.evaluate(()=>Object.values(window.__store.clients).filter(x=>x.nom==='Khalid Al-Mansoori').length);ok('pas de doublon client (même téléphone)',nc===1,'clients Khalid='+nc);
await p.click('[data-act="close"]').catch(()=>{});await p.waitForTimeout(200);
// clash: G63 second mission overlapping confirmed
await p.evaluate(()=>location.hash='planning');await p.waitForTimeout(400);
await p.click('#newBtn');await p.waitForTimeout(300);await p.fill('#f_titre','Clash test');await p.selectOption('#f_vehiculeId','g63');
const d1=await p.evaluate(()=>Object.values(window.__store.missions).find(m=>m.vehiculeId==='g63'));
await p.fill('#f_debut',d1.debut);await p.fill('#f_fin',d1.fin);await p.dispatchEvent('#f_fin','change');await p.waitForTimeout(300);
ok('alerte double réservation dans la fiche',await p.isVisible('.warn-box'));
const sfx=await p.$eval('#f_vehiculeId',e=>e.options[e.selectedIndex].text);ok('véhicule marqué réservé dans la liste',/réservé/.test(sfx),sfx);
await p.click('[data-act="close"]');await p.waitForTimeout(200);
// fleet availability
await p.evaluate(()=>location.hash='flotte');await p.waitForTimeout(400);
ok('vue flotte : 5 véhicules',(await p.$$('.vcard')).length===5);
// photo upload
await p.click('.vcard >> nth=0');await p.waitForTimeout(300);await p.click('[data-tab="photos"]');await p.waitForTimeout(200);
const img=path.join(__dirname,'p.jpg');if(!fs.existsSync(img)){require('child_process').execSync(`convert -size 800x600 xc:'#776655' ${img}`)}
await p.setInputFiles('#phIn',[img]);await p.waitForTimeout(1200);
const ph=await p.evaluate(()=>window.__store.vehicules.urus.photos);ok('photo ajoutée au véhicule',Array.isArray(ph)&&ph.length===1,JSON.stringify(ph));
await p.click('[data-act="close"]');await p.waitForTimeout(200);
// services edit
await p.evaluate(()=>location.hash='services');await p.waitForTimeout(300);await p.click('.scard >> nth=1');await p.waitForTimeout(300);await p.fill('#f_tarif','120 €/h');await p.click('[data-act="save"]');await p.waitForTimeout(400);
ok('service modifié',(await p.evaluate(()=>window.__store.services.chauffeur.tarif))==='120 €/h');
await p.click('[data-act="close"]');
// delete
await p.evaluate(()=>location.hash='clients');await p.waitForTimeout(300);
const before=await p.evaluate(()=>Object.keys(window.__store.clients).length);
await p.click('.row.clients >> text=M. Test Dupont');await p.waitForTimeout(300);await p.click('[data-act="del"]');await p.click('[data-act="del-yes"]');await p.waitForTimeout(400);
ok('suppression client',(await p.evaluate(()=>Object.keys(window.__store.clients).length))===before-1);
// palette
await p.keyboard.press('Control+k');await p.waitForTimeout(200);await p.keyboard.type('Khalid');await p.waitForTimeout(200);
ok('recherche ⌘K trouve le client',(await p.textContent('#palList')).includes('Khalid'));await p.keyboard.press('Escape');
// salon todos
await p.evaluate(()=>location.hash='salon');await p.waitForTimeout(400);await p.click('[data-todo="aziz"]');await p.waitForTimeout(200);
ok('à faire Aziz non vide',(await p.$$('.todo')).length>0);
await p.screenshot({path:'salon.png',fullPage:true});
// orphan: mission whose client deleted
const orphan=await p.evaluate(()=>document.body.innerText.includes('undefined')||document.body.innerText.includes('NaN'));ok('aucun "undefined"/"NaN" affiché',!orphan);
for(const r of ['demandes','planning','clients','flotte','contrats','services','aide']){await p.evaluate(h=>location.hash=h,r);await p.waitForTimeout(250);const bad=await p.evaluate(()=>/undefined|NaN|\[object/.test(document.querySelector('#view').innerText));if(bad)ok('vue '+r+' propre',false)}
const e2=errs.filter(x=>!x.includes('Failed to load resource'));ok('0 erreur JS',e2.length===0,e2.join(' | '));
}catch(e){res.push('CRASH '+e.message.split('\n')[0]);res.push('ERRS '+errs.join(' | '))}console.log(res.join('\n'));await b.close()})();
