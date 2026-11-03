// CRM hors de claude.ai (Vercel) : base enregistrée dans le navigateur.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const html=fs.readFileSync(process.env.CRM_FILE||path.join(__dirname,'..','index.html'),'utf8');
const res=[];const ok=(n,c,info)=>{res.push((c?'PASS ':'FAIL ')+n+(info?' — '+info:''))};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true});const errs=[];
const setup=async p=>{p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console '+m.text())});
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://amane.test/'))return r.fulfill({body:html,contentType:'text/html; charset=utf-8'});if(u.includes('fonts.g'))return r.fulfill({body:'',contentType:'text/css'});r.continue()})};
let p=await ctx.newPage();await setup(p);
try{
await p.goto('http://amane.test/crm/');await p.waitForTimeout(1200);
if(await p.isVisible('#whoM')){await p.click('[data-who="youssouf"]');await p.waitForTimeout(300)}
ok('indicateur « Sur cet appareil »',(await p.textContent('#live')).includes('Sur cet appareil'),await p.textContent('#live'));
ok('bandeau explicatif affiché',await p.isVisible('text=Données enregistrées sur cet appareil'));
ok('pas de bandeau « Mode local »',!(await p.isVisible('text=Mode local.')));
const seed=await p.evaluate(()=>JSON.parse(localStorage.getItem('amane.crm.v1')));
ok('flotte et services créés au 1er lancement',Object.keys(seed.vehicules||{}).length===5&&Object.keys(seed.services||{}).length===8);
await p.click('#newBtn');await p.waitForTimeout(400);
await p.fill('#f_titre','Urus — week-end Deauville');
await p.selectOption('#f_clientId','__new');await p.waitForTimeout(400);
await p.fill('#f_nom','Mme Locale');await p.fill('#f_tel','+33 6 00 00 00 01');
await p.click('[data-act="save"]');await p.waitForTimeout(500);
await p.selectOption('#f_vehiculeId','urus');await p.fill('#f_montant','2000');await p.selectOption('#f_statut','confirmee');
await p.click('[data-act="save"]');await p.waitForTimeout(500);await p.click('[data-act="close"]');await p.waitForTimeout(300);
let st=await p.evaluate(()=>JSON.parse(localStorage.getItem('amane.crm.v1')));
ok('client et demande enregistrés dans le navigateur',Object.keys(st.clients||{}).length===1&&Object.keys(st.missions||{}).length===1);
await p.reload();await p.waitForTimeout(1200);
await p.evaluate(()=>location.hash='demandes');await p.waitForTimeout(500);
ok('demande toujours là après rechargement',await p.isVisible('text=Urus — week-end Deauville'));
// glisser-déposer
await p.dragAndDrop('.card[data-id]','.col[data-col="encours"]');await p.waitForTimeout(500);
st=await p.evaluate(()=>JSON.parse(localStorage.getItem('amane.crm.v1')));
ok('glisser-déposer enregistré',Object.values(st.missions)[0].statut==='encours',Object.values(st.missions)[0].statut);
// devis : numérotation
await p.click('.card[data-id]');await p.waitForTimeout(400);
const tabs=await p.$$eval('[data-tab]',e=>e.map(x=>x.dataset.tab));
// deuxième onglet : synchro entre onglets
const p2=await ctx.newPage();await setup(p2);await p2.goto('http://amane.test/crm/#demandes');await p2.waitForTimeout(1200);
ok('2e onglet voit la même demande',await p2.isVisible('text=Urus — week-end Deauville'));
await p.click('[data-act="close"]').catch(()=>{});
// export JSON
await p.evaluate(()=>location.hash='aide');await p.waitForTimeout(500);
const btn=await p.$('[data-act="export-json"]');ok('sauvegarde JSON active',btn&&!(await btn.isDisabled()));
const [dlo]=await Promise.all([p.waitForEvent('download'),p.click('[data-act="export-json"]')]);
const fp=await dlo.path();const backup=JSON.parse(fs.readFileSync(fp,'utf8'));
ok('fichier de sauvegarde complet',backup.clients.length===1&&backup.missions.length===1&&backup.vehicules.length===5,dlo.suggestedFilename());
// effacer puis restaurer
await p.evaluate(()=>{localStorage.removeItem('amane.crm.v1')});await p.reload();await p.waitForTimeout(1200);
ok('navigateur vidé : exemples de nouveau',await p.isVisible('text=Vous regardez des exemples'));
await p.evaluate(()=>location.hash='aide');await p.waitForTimeout(500);
p.once('dialog',d=>d.accept());
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-act="import-json"]')]);await fc.setFiles(fp);await p.waitForTimeout(800);
st=await p.evaluate(()=>JSON.parse(localStorage.getItem('amane.crm.v1')));
ok('sauvegarde restaurée',Object.keys(st.clients).length===1&&Object.keys(st.missions).length===1&&Object.values(st.missions)[0].statut==='encours');
await p.evaluate(()=>location.hash='demandes');await p.waitForTimeout(500);
ok('demande restaurée visible',await p.isVisible('text=Urus — week-end Deauville'));
// autres téléchargements actifs
await p.evaluate(()=>location.hash='planning');await p.waitForTimeout(500);
const ics=await p.$('[data-act="ics"]');ok('export agenda actif',!!ics&&!(await ics.isDisabled()));
const txt=await p.evaluate(()=>document.body.innerText);ok('aucun "undefined"/"NaN"',!/undefined|NaN/.test(txt));
}catch(e){ok('exécution',false,e.message)}
ok('0 erreur JS',errs.length===0,errs.slice(0,3).join(' | '));
await b.close();console.log(res.join('\n'));const f=res.filter(r=>r.startsWith('FAIL')).length;console.log(`${res.length-f}/${res.length} PASS`);process.exit(f?1:0)})();
