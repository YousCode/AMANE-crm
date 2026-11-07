// Formulaire du site : « Être rappelé » envoie la demande au CRM (/api/lead) quand le serveur répond.
// Les bibliothèques CDN sont servies depuis AMANE_LIBS (paquets npm décompressés) si ce dossier existe ; sinon elles viennent du CDN.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const R=path.join(__dirname,'..');const vj=JSON.parse(fs.readFileSync(path.join(R,'vercel.json')));
const L=process.env.AMANE_LIBS||'/tmp/claude-0/-home-user-amane/979b8a77-7793-5ee1-8298-b9ba228fd4c0/scratchpad/libs';
const LIB={'three.min.js':L+'/three-0.158.0/package/build/three.min.js','gsap.min.js':L+'/gsap-3.12.5/package/dist/gsap.min.js','ScrollTrigger.min.js':L+'/gsap-3.12.5/package/dist/ScrollTrigger.min.js','lenis.min.js':L+'/lenis-1.1.18/package/dist/lenis.min.js'};
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);for(const w of vj.rewrites)if(u===w.source)u=w.destination;const f=path.join(R,u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(8791);
const res=[];const ok=(n,c,i)=>res.push((c?'PASS ':'FAIL ')+n+(i?' — '+i:''));
async function open(b,api){const p=await b.newPage({viewport:{width:390,height:844},locale:'fr-FR'});const errs=[];p.on('pageerror',e=>errs.push(e.message));const leads=[];
  await p.route(/cdnjs|jsdelivr|fonts\.g/,r=>{const u=r.request().url();const k=Object.keys(LIB).find(k=>u.endsWith(k));if(k&&fs.existsSync(LIB[k]))return r.fulfill({path:LIB[k],contentType:'text/javascript'});if(u.includes('fonts.g'))return r.fulfill({body:'',contentType:'text/css'});return r.continue()});
  await p.route('**/api/**',r=>{const u=r.request().url();if(!api)return r.fulfill({status:404,body:'not found'});
    if(u.includes('/api/health'))return r.fulfill({json:{ok:true,db:true,whatsapp:false,ia:false}});
    if(u.includes('/api/lead')){leads.push(JSON.parse(r.request().postData()));return r.fulfill({json:{ok:true}})}return r.fulfill({status:404})});
  await p.goto('http://localhost:8791/');await p.waitForTimeout(2500);
  await p.evaluate(()=>document.getElementById('askform').scrollIntoView());await p.waitForTimeout(800);return {p,errs,leads}}
(async()=>{const b=await chromium.launch();
try{
  let {p,errs}=await open(b,false);
  ok('sans serveur : bouton « Être rappelé » caché',await p.isHidden('#callback'));
  ok('sans serveur : texte de confidentialité inchangé',(await p.textContent('.priv')).includes('Rien n'),await p.textContent('.priv'));
  ok('sans serveur : 0 erreur JS',errs.length===0,errs.join(' | '));await p.close();
  ({p,errs,leads}=await open(b,true));var leads;
  ok('avec serveur : bouton visible',await p.isVisible('#callback'));
  ok('avec serveur : champ téléphone visible',await p.isVisible('#f-tel'));
  ok('texte de confidentialité exact',(await p.textContent('.priv')).includes('votre nom et votre numéro'),await p.textContent('.priv'));
  await p.fill('#f-name','Mme Test');await p.fill('#f-msg','Urus pour samedi soir');
  await p.click('#callback');await p.waitForTimeout(400);
  ok('numéro manquant : message et rien envoyé',leads.length===0&&(await p.textContent('#toast')).includes('numéro'),await p.textContent('#toast'));
  await p.fill('#f-tel','06 12 34 56 78');await p.click('#callback');await p.waitForTimeout(600);
  const L0=leads[0]||{};
  ok('demande envoyée au CRM',leads.length===1&&L0.nom==='Mme Test'&&L0.tel==='06 12 34 56 78'&&L0.langue==='FR'&&L0.website===''&&/Urus pour samedi soir/.test(L0.message),JSON.stringify(L0).slice(0,200));
  ok('confirmation affichée',(await p.textContent('#toast')).includes('Merci'));
  await p.evaluate(()=>{const b=[...document.querySelectorAll('[data-lang="ar"]')][0];b&&b.click()});await p.waitForTimeout(800);
  ok('arabe : confidentialité traduite',(await p.textContent('.priv')).includes('أمان'),await p.textContent('.priv'));
  ok('arabe : bouton traduit',(await p.textContent('#callback')).includes('اتصلوا'));
  ok('avec serveur : 0 erreur JS',errs.length===0,errs.join(' | '));
}catch(e){ok('exécution',false,e.message)}
await b.close();srv.close();console.log(res.join('\n'));const f=res.filter(r=>r.startsWith('FAIL')).length;console.log(`${res.length-f}/${res.length} PASS`);process.exit(f?1:0)})();
