// Parcours conciergerie : carnet, chauffeur, devis → facture → règlements, commissions, programme,
// tâches, journal / PV, échéances, finances, exports CSV / ICS / JSON, anniversaire.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const html0=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
// Accès de test aux fonctions internes (le script de la page est dans une IIFE)
const HOOK="Object.defineProperty(window,'DR',{get:()=>DR});Object.assign(window,{S,todos,openDrawer,act,save,nextNumero,finData,monthOf,dvTotals,fmtE2});";
if(!html0.includes('boot();\n})();'))throw new Error('ancre de test introuvable');const html=html0.replace('boot();\n})();','boot();\n'+HOOK+'\n})();');const mock=fs.readFileSync(path.join(__dirname,'mock.js'),'utf8');
const res=[];const ok=(n,c,info)=>{res.push((c?'PASS ':'FAIL ')+n+(info!==undefined&&info!==''?' — '+info:''))};
const pad=n=>String(n).padStart(2,'0');const dstr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};const T=new Date();const Y=T.getFullYear();
(async()=>{const b=await chromium.launch();const errs=[];let p;try{p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console '+m.text())});
await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://crm.test/'))return r.fulfill({body:'<!doctype html><meta charset=utf-8><script>'+mock+'</script>'+html,contentType:'text/html; charset=utf-8'});if(u.includes('fonts.g'))return r.abort();r.continue()});
await p.goto('http://crm.test/');await p.waitForTimeout(1200);
if(await p.isVisible('#whoM')){await p.click('[data-who="amel"]');await p.waitForTimeout(300)}
const W=ms=>p.waitForTimeout(ms||350);const go=async h=>{await p.evaluate(h=>location.hash=h,h);await W(450)};
const store=c=>p.evaluate(c=>Object.entries(window.__store[c]||{}).map(([id,d])=>({id,...d})),c);
const save=async()=>{await p.click('[data-act="save"]');await W(700)};const close=async()=>{await p.click('[data-act="close"]');await W(300)};
const chg=async(sel,v)=>{await p.fill(sel,v);await p.$eval(sel,e=>e.dispatchEvent(new Event('change',{bubbles:true})));await W(150)};

// 1. Exemples cohérents tant que la base est vide
await go('carnet');ok('carnet d’exemple : 5 partenaires marqués exemple',(await p.$$('.row.partners')).length===5&&(await p.textContent('#view')).toLowerCase().includes('exemple'));
await go('finances');const fx=await p.$('[data-open="mission:dm1:devis"]');ok('finances d’exemple : facture F-EXEMPLE-01 à encaisser',!!fx);
if(fx){await fx.click();await W(500);ok('clic facture → onglet Devis & facture',(await p.textContent('#dvNum')).includes('F-EXEMPLE-01'));
  ok('exemple : programme, tâches, commission présents',await p.evaluate(()=>{const d=DR.draft;return d.programme.length===3&&d.taches.length===3&&d.commissions.length===1}));await close()}

// 2. Carnet
await go('carnet');await p.click('[data-act="new-partenaire"]');await W();
await p.fill('#f_nom','Karim Test');await p.fill('#f_tel','+33 6 00 00 00 01');await p.fill('#f_langues','FR, AR');await save();await close();
await p.click('[data-act="new-partenaire"]');await W();await p.fill('#f_nom','Maison Test');await p.selectOption('#f_type','boutique');await p.fill('#f_commission','8');await save();await close();
let parts=await store('partenaires');const karim=parts.find(x=>x.nom==='Karim Test'),maison=parts.find(x=>x.nom==='Maison Test');
ok('2 partenaires enregistrés (chauffeur + boutique 8 %)',parts.length===2&&karim&&karim.type==='chauffeur'&&maison&&maison.type==='boutique'&&+maison.commission===8,JSON.stringify(parts.map(x=>[x.nom,x.type,x.commission])));
ok('carnet affiche les vrais partenaires (plus les exemples)',(await p.$$('.row.partners')).length===2);
await p.click('[data-pt="chauffeur"]');await W();ok('filtre par type',(await p.$$('.row.partners')).length===1);
await p.click('[data-pt=""]');await W();await p.fill('#fPQ','Maison');await W();ok('recherche dans le carnet',(await p.$$('.row.partners')).length===1&&(await p.textContent('.row.partners')).includes('Maison Test'));
await p.fill('#fPQ','');await W();

// 3. Client anglophone (anniversaire dans 3 jours, VIP)
await go('clients');await p.evaluate(()=>act('new-client'));await W();
const bd=addD(T,3);await p.fill('#f_nom','Mr John Test');await p.fill('#f_tel','+44 7700 900123');await p.selectOption('#f_langue','EN');
await p.fill('#f_naissance',`1980-${pad(bd.getMonth()+1)}-${pad(bd.getDate())}`);await p.check('[data-k="tags.vip"]');await p.check('[data-k="docs.passeport"]');await save();await close();
const cl=(await store('clients'))[0];ok('client : naissance, étiquette VIP, pièces',cl&&cl.naissance&&cl.tags&&cl.tags.vip&&cl.docs&&cl.docs.passeport,JSON.stringify(cl&&{n:cl.naissance,t:cl.tags,d:cl.docs}));
ok('étiquette VIP visible dans la liste clients',(await p.textContent('#view')).includes('VIP'));

// 4. Demandes avec chauffeur du carnet + conflit chauffeur
const d0=dstr(T),d2=dstr(addD(T,2));
const newMission=async(titre,veh,svc)=>{await p.click('#newBtn');await W();await p.fill('#f_titre',titre);await p.selectOption('#f_clientId',cl.id);await p.selectOption('#f_service',svc);await W(150);
  await chg('#f_debut',d0+'T10:00');await chg('#f_fin',d2+'T20:00');await p.selectOption('#f_vehiculeId',veh);await p.selectOption('#f_statut','confirmee');await p.selectOption('#f_chauffeurId',karim.id);await W(250)};
await newMission('Séjour Test','classev','sejour');await save();
let ms=await store('missions');const A=ms.find(m=>m.titre==='Séjour Test');ok('chauffeur du carnet attribué',A&&A.chauffeurId===karim.id&&A.chauffeur==='Karim Test',JSON.stringify(A&&[A.chauffeurId,A.chauffeur]));await close();
await newMission('G 63 Test','g63','location');
ok('alerte : chauffeur déjà pris sur ce créneau',(await p.textContent('#drHints')).includes('chauffeur est déjà pris'));
ok('liste des chauffeurs signale le conflit',(await p.$eval('#f_chauffeurId',e=>e.options[e.selectedIndex].text)).includes('déjà pris'));
await save();ms=await store('missions');const B=ms.find(m=>m.titre==='G 63 Test');await close();
ok('À faire Youssouf : chauffeur en double réservation',await p.evaluate(()=>todos().youssouf.some(x=>x.t==='Chauffeur en double réservation')));
await go('planning');const chRow=await p.$$eval('.plan-r',rs=>rs.filter(r=>r.querySelector('.rl').textContent.includes('Karim Test')).map(r=>({n:r.querySelectorAll('.bar-m').length,c:r.querySelectorAll('.bar-m.clash').length})));
ok('planning : ligne chauffeur avec ses 2 missions en rouge',chRow.length===1&&chRow[0].n===2&&chRow[0].c===2,JSON.stringify(chRow));

// 5. Devis → numéro → règlements → facture → soldé
await p.evaluate(id=>openDrawer('mission',id,'devis'),A.id);await W();await p.click('[data-act="dv-new"]');await W();
const nL=await p.$$eval('#drawer .ln[class="ln"]',x=>x.length);ok('devis pré-rempli (véhicule + chauffeur)',nL===2&&(await p.inputValue('[data-k="devis.lignes.0.d"]')).includes('Classe V')&&+(await p.inputValue('[data-k="devis.lignes.0.pu"]'))===300,String(nL));
const q=+(await p.inputValue('[data-k="devis.lignes.0.q"]'));
await chg('[data-k="devis.lignes.1.pu"]','400');await p.click('[data-act="dv-add"]');await W();
await p.fill('[data-k="devis.lignes.2.d"]','Réservations et conciergerie');await chg('[data-k="devis.lignes.2.pu"]','500');await chg('#f_devis_remise','10');
const ht=q*300+q*400+500,ttc=Math.round(ht*0.9*1.2*100)/100;
const totTxt=await p.textContent('#dvTot');ok('totaux HT / remise / TVA / TTC en direct',await p.evaluate(([t,v])=>t.includes(fmtE2(v)),[totTxt,ttc]),totTxt.replace(/\s+/g,' ').slice(0,140));
await save();ms=await store('missions');let a=ms.find(m=>m.id===A.id);
ok('numéro de devis attribué à l’enregistrement',a.devis.numero===`D-${Y}-0001`,a.devis.numero);
ok('montant de la demande = TTC du devis',Math.abs(+a.montant-ttc)<0.01,`${a.montant} / ${ttc}`);
ok('compteur protégé par bail (acquire)',await p.evaluate(()=>window.__log.some(x=>x[0]==='acquire'&&x[1]==='meta/compteurs')));
await close();await p.evaluate(id=>openDrawer('mission',id,'devis'),B.id);await W();await p.click('[data-act="dv-new"]');await W();await save();
ms=await store('missions');ok('deuxième devis : numéro suivant',ms.find(m=>m.id===B.id).devis.numero===`D-${Y}-0002`,ms.find(m=>m.id===B.id).devis.numero);await close();
const nums=await p.evaluate(()=>Promise.all([nextNumero('devis'),nextNumero('devis'),nextNumero('devis')]));
ok('numérotation unique sous appels simultanés',new Set(nums).size===3&&nums.every(n=>/^D-\d{4}-000[345]$/.test(n)),nums.join(','));
await p.evaluate(()=>{window.__leases['meta/compteurs']={holder:'autre-poste',until:Date.now()+1200}});
const n6=await p.evaluate(()=>nextNumero('devis'));ok('attend le bail d’un autre poste puis numérote',n6===`D-${Y}-0006`,n6);
await p.evaluate(id=>openDrawer('mission',id,'devis'),A.id);await W();
await p.click('[data-act="pay-add"]');await W();ok('règlement pré-rempli avec le reste dû',Math.abs(+(await p.inputValue('[data-k="devis.paiements.0.montant"]'))-ttc)<0.01);
await chg('[data-k="devis.paiements.0.montant"]','1000');await save();a=(await store('missions')).find(m=>m.id===A.id);
ok('acompte : statut de paiement suit',a.paiement==='acompte'&&+a.acompte===1000,`${a.paiement} ${a.acompte}`);
await p.click('[data-act="dv-facture"]');await W(800);a=(await store('missions')).find(m=>m.id===A.id);
ok('transformé en facture F-…-0001, devis accepté',a.devis.factureNumero===`F-${Y}-0001`&&a.devis.statut==='accepte'&&a.devis.factureDate===d0,JSON.stringify([a.devis.factureNumero,a.devis.statut,a.devis.factureDate]));
await p.click('[data-act="pay-add"]');await W();await p.selectOption('[data-k="devis.paiements.1.moyen"]','cb');await save();a=(await store('missions')).find(m=>m.id===A.id);
ok('solde réglé → paiement « soldé »',a.paiement==='solde'&&Math.abs(+a.acompte-ttc)<0.01&&a.devis.paiements.length===2,`${a.paiement} ${a.acompte}`);
await p.click('[data-act="dv-dl"][data-doc="facture"]');await W();
const fac=await p.evaluate(n=>window.__saved[n]||'',`facture-F-${Y}-0001.html`);
ok('facture téléchargée en anglais (langue du client)',fac.includes('Invoice F-')&&fac.includes('Balance due')&&fac.includes('lang="en"')&&fac.includes('[IBAN]')&&fac.includes('[SIREN]'),String(fac.length));
await p.click('[data-act="dv-dl"][data-doc="devis"]');await W();ok('devis téléchargé',(await p.evaluate(n=>window.__saved[n]||'',`devis-D-${Y}-0001.html`)).includes('Quotation'));

// 6. Commission partenaire
await p.click('[data-act="com-add"]');await W();await p.selectOption('[data-k="commissions.0.partenaireId"]',maison.id);await W(200);
ok('commission : % repris du carnet',(await p.inputValue('[data-k="commissions.0.pct"]'))==='8');
await chg('[data-k="commissions.0.base"]','6000');ok('commission due calculée',(await p.textContent('#drawer .ln.com .due')).replace(/\s/g,'').includes('480,00'));
await save();a=(await store('missions')).find(m=>m.id===A.id);ok('commission enregistrée',a.commissions.length===1&&+a.commissions[0].pct===8&&a.commissions[0].statut==='a_recevoir');

// 7. Programme du séjour
await p.click('[data-tab="prog"]');await W();await p.click('[data-act="pr-add"]');await W();await p.click('[data-act="pr-add"]');await W();
await chg('[data-k="programme.0.dt"]',d0+'T13:00');await p.selectOption('[data-k="programme.0.type"]','restaurant');await p.fill('[data-k="programme.0.lieu"]','Paris 8e');await p.fill('[data-k="programme.0.client"]','Table for four');await p.fill('[data-k="programme.0.interne"]','SECRET-INTERNE');
await chg('[data-k="programme.1.dt"]',d0+'T10:00');await p.selectOption('[data-k="programme.1.type"]','transfert');await p.selectOption('[data-k="programme.1.partenaireId"]',karim.id);
await p.click('[data-act="pr-text"]');await W();const txt=await p.inputValue('#prOut');
ok('message programme dans la langue du client, trié, sans note interne',txt.startsWith('Dear Mr John Test')&&txt.indexOf('Transfer')<txt.indexOf('Restaurant')&&txt.includes('Table for four')&&!txt.includes('SECRET'),txt.split('\n').slice(0,6).join(' | '));
const wa=await p.getAttribute('#prWa','href');ok('lien WhatsApp vers le numéro du client',wa.startsWith('https://wa.me/447700900123?text=Dear'),wa.slice(0,50));
await p.click('[data-act="pr-dl"]');await W();ok('carnet de séjour téléchargé',(await p.evaluate(()=>window.__saved['carnet-sejour-mr-john-test.html']||'')).includes('Your stay programme'));
await p.click('[data-act="pr-ai"]');await W(500);ok('Majordome rédige le message',(await p.inputValue('#prOut')).includes('Amane'));
await save();a=(await store('missions')).find(m=>m.id===A.id);ok('programme enregistré (2 étapes)',a.programme.length===2&&a.programme.some(x=>x.interne==='SECRET-INTERNE'));

// 8. Tâches
await p.click('[data-tab="taches"]');await W();await p.click('[data-act="tk-tpl"]');await W();const nt=(await p.$$('#drawer .ln.tk')).length;await save();
ok('modèle de tâches « séjour » ajouté',nt===4,String(nt));
ok('tâches dans À faire du responsable',await p.evaluate(()=>todos().amel.some(x=>x.t==='Envoyer le programme au client')&&todos().aziz.some(x=>x.t==='Facture et solde')));
await p.check('[data-k="taches.0.fait"]');await W(700);a=(await store('missions')).find(m=>m.id===A.id);
ok('cocher une tâche l’enregistre aussitôt et la retire d’À faire',a.taches[0].fait===true&&!(await p.evaluate(t=>todos().amel.concat(todos().youssouf,todos().aziz).some(x=>x.t===t),a.taches[0].t)));
await close();

// 9. Journal flotte, PV, échéances
await p.evaluate(()=>openDrawer('vehicule','classev','journal'));await W();
await p.click('[data-act="jr-add"]');await W();await chg('[data-k="journal.0.cout"]','250');
await p.click('[data-act="jr-add"]');await W();await p.selectOption('[data-k="journal.0.type"]','pv');await W(150);await chg('[data-k="journal.0.dt"]',d0+'T15:30');
const pv=await p.textContent('#pv0');ok('PV : conducteur à désigner retrouvé',pv.includes('Mr John Test')&&pv.includes('Séjour Test'),pv.slice(0,90));
await save();let v=(await store('vehicules')).find(x=>x.id==='classev');ok('journal enregistré',v.journal.length===2&&v.journal.some(j=>j.type==='pv')&&v.journal.some(j=>+j.cout===250));
ok('À faire Aziz : PV avec le nom du conducteur',await p.evaluate(()=>todos().aziz.some(x=>x.t.startsWith('PV à désigner')&&x.d.includes('Mr John Test'))));
await p.click('[data-tab="main"]');await W();await p.fill('#f_echeances_assurance',dstr(addD(T,5)));await save();
ok('échéance assurance à J-5 en rouge chez Youssouf',await p.evaluate(()=>todos().youssouf.some(x=>x.t==='Assurance Classe V VIP'&&x.sev==='bad')));await close();

// 10. Finances
const late=dstr(addD(T,-10));await p.evaluate(([id,dt])=>{const m=S.missions.find(x=>x.id===id);return save('missions',{...m,devis:{...m.devis,factureNumero:'F-TEST-RETARD',factureDate:dt}})},[B.id,late]);await W(400);
const fd=await p.evaluate(()=>{const f=finData(monthOf(0));return {facture:f.facture,encaisse:f.encaisse,reste:f.reste,comA:f.comA,fixe:f.fixe,journ:f.journ,res:f.res,n:f.factures.length}});
const bTtc=await p.evaluate(id=>dvTotals(S.missions.find(x=>x.id===id).devis).ttc,B.id);const sameMonth=late.slice(0,7)===d0.slice(0,7);
ok('finances : facturé, encaissé, reste, commissions, coûts, résultat cohérents',Math.abs(fd.facture-(ttc+(sameMonth?bTtc:0)))<0.01&&Math.abs(fd.encaisse-ttc)<0.01&&Math.abs(fd.reste-bTtc)<0.01&&fd.comA===480&&fd.fixe===11250&&fd.journ===250&&Math.abs(fd.res-(ttc-11500))<0.01,JSON.stringify(fd));
ok('À faire Aziz : facture en retard',await p.evaluate(()=>todos().aziz.some(x=>x.t==='Facture F-TEST-RETARD en retard')));
await go('finances');const lr=await p.$('[data-open="mission:'+B.id+':devis"]');ok('facture en retard cliquable dans Finances',!!lr&&(await lr.textContent()).includes('F-TEST-RETARD'));
await p.click('[data-act="fin-csv"]');await W();const csv=await p.evaluate(()=>{const k=Object.keys(window.__saved).find(x=>x.endsWith('.csv'));return k?window.__saved[k]:''});
ok('export CSV (séparateur ;, BOM, factures)',csv.charCodeAt(0)===0xfeff&&csv.includes('Facture;Devis;Client')&&csv.includes(`F-${Y}-0001`),csv.split('\r\n')[1]);

// 11. ICS + JSON + anniversaire
await go('planning');await p.click('[data-act="ics"]');await W();const ics=await p.evaluate(()=>window.__saved['amane-planning.ics']||'');
ok('export ICS du planning (2 demandes confirmées)',ics.startsWith('BEGIN:VCALENDAR')&&(ics.match(/BEGIN:VEVENT/g)||[]).length===2&&ics.includes('SUMMARY:Séjour Test'),String((ics.match(/BEGIN:VEVENT/g)||[]).length));
await go('aide');await p.click('[data-act="export-json"]');await W();const js=await p.evaluate(()=>{const k=Object.keys(window.__saved).find(x=>x.endsWith('.json'));return k?window.__saved[k]:'{}'});
let J={};try{J=JSON.parse(js)}catch(e){}ok('export JSON complet',J.partenaires&&J.partenaires.length===2&&J.missions.length===2&&J.clients.length===1&&J.vehicules.length===5);
ok('anniversaire client à J-3 chez Amel',await p.evaluate(()=>todos().amel.some(x=>x.t==='Anniversaire de Mr John Test')));
for(const r of ['salon','carnet','finances','planning','clients','aide']){await go(r);const bt=await p.textContent('#view');const mm=bt.match(/.{0,40}(undefined|NaN).{0,40}/);ok('aucun "undefined"/"NaN" affiché · '+r,!mm,mm&&mm[0])}
}catch(e){ok('exception',false,e.message.split('\n')[0])}
ok('0 erreur JS',errs.length===0,errs.slice(0,3).join(' | '));
console.log(res.join('\n'));console.log(`${res.filter(x=>x.startsWith('PASS')).length}/${res.length} PASS`);await b.close();process.exit(res.some(x=>x.startsWith('FAIL'))?1:0)})();
