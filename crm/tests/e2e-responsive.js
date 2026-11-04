// Audit responsive du CRM : chaque écran / état, à chaque taille d'écran, en mode claude.ai (mock.js) et en mode serveur (api-mock.js).
// Vérifie : débordement horizontal, conteneurs qui défilent sans raison, éléments coupés ou qui se chevauchent, zones tactiles < 44 px,
// texte < 12 px, champs < 16 px sur téléphone, barres fixes qui masquent le contenu, tiroir (en-tête, corps, Enregistrer), kanban/planning
// sur mobile, chaînes longues et arabe, mode sombre (contraste), mouvement réduit, texte agrandi.
//   node crm/tests/e2e-responsive.js                      tout (≈ 6 min)
//   VPS=390x844,1920x1080 STATES=salon,drawer-mission-main MODE=mock SHOTS=0 node crm/tests/e2e-responsive.js
//   SHOTS=/dossier  → dossier des captures (défaut : scratchpad resp-crm) ; SHOTS=0 → aucune capture ; LIST=40 → nb de lignes par catégorie
'use strict';
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const {createApi}=require('./api-mock');
const html0=fs.readFileSync(process.env.CRM_FILE||path.join(__dirname,'..','index.html'),'utf8');
const mock=fs.readFileSync(path.join(__dirname,'mock.js'),'utf8');
const HOOK="Object.defineProperty(window,'__S',{get:()=>S});Object.defineProperty(window,'__DR',{get:()=>DR});window.__open=openDrawer;window.__close=closeDrawer;window.__render=render;window.__openWho=openWho;window.__openPlus=openPlus;";
if(!html0.includes('boot();\n})();'))throw new Error('ancre de test introuvable');
const hooked=html0.replace('boot();\n})();','boot();\n'+HOOK+'\n})();');
const VP='<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
// claude.ai : l'artefact est servi tel quel dans une page qui porte déjà la balise viewport ; Vercel : document complet (site/make_vercel.py)
const pageMock='<!doctype html><html lang="fr"><head><meta charset="utf-8">'+VP+'<script>'+mock+'</script>'+hooked.slice(0,hooked.indexOf('</style>')+8)+'</head><body>'+hooked.slice(hooked.indexOf('</style>')+8)+'</body></html>';
const j=hooked.indexOf('</style>')+8;
const pageSrv='<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'+VP+'\n'+hooked.slice(0,j)+'\n</head>\n<body>\n'+hooked.slice(j)+'\n</body>\n</html>\n';

const ALL_VPS=[[320,568],[360,740],[390,844],[414,896],[430,932],[768,1024],[1024,768],[1180,820],[1280,800],[1440,900],[1920,1080],[844,390]];
const VPS=process.env.VPS?process.env.VPS.split(',').map(s=>s.split('x').map(Number)):ALL_VPS;
const ONLY=process.env.STATES?process.env.STATES.split(','):null;
const MODES=process.env.MODE?[process.env.MODE]:['mock','server'];
const SHOTS=process.env.SHOTS==='0'?'':(process.env.SHOTS||path.join(process.env.CLAUDE_SCRATCHPAD||'/tmp/claude-0/-home-user-amane/979b8a77-7793-5ee1-8298-b9ba228fd4c0/scratchpad','resp-crm'));
if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
const LIST=+process.env.LIST||12;
const isPhone=(w,h)=>w<=430||h<=430;const isTouch=(w,h)=>w<=1180||h<=430;

/* ---------- données réalistes : la base du mock serveur + noms longs + arabe ---------- */
function seedData(){const api=createApi();const st=api.st;
  const put=(c,id,o)=>{st.cols[c][id]={...o,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:'amel'}};
  put('clients','c5',{nom:'Son Altesse Sheikha Maryam bint Mohammed Al-Maktoum Al-Nahyan',tel:'+971 55 987 6543',email:'bureau.de.son.altesse.sheikha.maryam@residence-royale-abudhabi.example.ae',langue:'AR',pays:'Émirats arabes unis',hotel:'Hôtel Plaza Athénée, suite Eiffel, 25 avenue Montaigne, 75008 Paris',canal:'WhatsApp',statut:'vip',responsable:'amel',tags:{vip:true,famille:true},prefs:'الحجز باسم المكتب الملكي؛ سائق يتحدث العربية؛ مياه معدنية باردة في السيارة دائماً.',notes:'Déplacements sans chauffeur masculin le vendredi. Facturation via le bureau de la famille (bon de commande obligatoire).'});
  const now=new Date();const at=(d,h)=>{const x=new Date(now);x.setDate(x.getDate()+d);x.setHours(h,0,0,0);return x.toISOString().slice(0,16)};
  put('missions','m6',{titre:'Ferrari 296 GTB — week-end Grand Prix de Monaco avec transferts aéroport, chauffeur arabophone et table au Louis XV',clientId:'c5',service:'location',vehiculeId:'f296',debut:at(2,9),fin:at(4,22),lieu:'Hôtel de Paris Monte-Carlo, place du Casino, 98000 Monaco (livraison par camion plateau depuis Paris)',montant:14800,acompte:5000,statut:'confirmee',responsable:'aziz',chauffeurId:'p1',chauffeur:'Karim B.',contrat:{statut:'envoye',caution:25000,cautionStatut:'aucune',pieces:{permis:true,passeport:false,domicile:false},edlDepart:{fait:false},edlRetour:{fait:false}},paiement:'acompte',notes:'ملاحظة: العميلة تفضل التواصل عبر واتساب فقط، بين الساعة العاشرة صباحاً والرابعة مساءً بتوقيت باريس.',
    taches:[{t:'Réserver le camion plateau Paris → Monaco (aller-retour, assurance tous risques, chauffeur habilité) et confirmer l’heure de livraison',resp:'youssouf',due:at(1,0).slice(0,10),fait:false},{t:'Table Louis XV',resp:'amel',due:at(1,0).slice(0,10),fait:true}],
    programme:[{dt:at(2,13),type:'restaurant',lieu:'Le Louis XV — Alain Ducasse, Hôtel de Paris',client:'Table pour quatre, salon privé, menu sans alcool'},{dt:at(3,10),type:'shopping',partenaireId:'p3',lieu:'Avenue des Beaux-Arts, Monte-Carlo',client:'Boutiques privatisées'}],
    devis:{lignes:[{d:'Location Ferrari 296 GTB — 3 jours, 300 km/jour inclus, assurance tous risques avec rachat partiel de franchise',q:3,pu:1300},{d:'Transfert plateau Paris → Monaco A/R',q:1,pu:2400},{d:'Chauffeur arabophone (12 h/jour)',q:3,pu:600}],remise:0,tva:20}});
  put('partenaires','p4',{nom:'Société Monégasque de Transport Automobile de Prestige et de Logistique Événementielle',type:'transport',contact:'Jean-Baptiste de La Rochefoucauld-Montbazon',tel:'+377 93 00 00 04',email:'logistique@smtap-monaco.example.mc',langues:'FR, EN, IT',adresse:'Quai Antoine 1er, 98000 Monaco',commission:5,actif:true});
  // Conversation arabe longue (serveur)
  api.inbound('971559876543','السلام عليكم ورحمة الله وبركاته، نرغب في حجز سيارة فيراري 296 مع سائق يتحدث العربية لعطلة نهاية الأسبوع في موناكو، مع نقل من مطار نيس إلى فندق دو باري، ونريد أيضاً حجز طاولة في مطعم لوي الخامس عشر يوم السبت. شكراً جزيلاً لكم.',{name:'Sheikha Maryam',lang:'AR'});
  api.inbound('971559876543','https://www.example.com/une-adresse-tres-longue-sans-espace/qui-ne-doit-pas-casser-la-mise-en-page/0123456789012345678901234567890123456789');
  st.cols.conversations['971559876543']={...st.cols.conversations['971559876543'],clientId:'c5',missionId:'m6',aiSummary:'Souhaite la Ferrari 296 avec chauffeur arabophone pour le week-end à Monaco, transfert depuis Nice et table au Louis XV samedi.',aiDraft:'وعليكم السلام ورحمة الله وبركاته، يسعدنا تلبية طلبكم: سيارة فيراري 296 مع سائق يتحدث العربية جاهزة لعطلة نهاية الأسبوع في موناكو. Amane'};
  return api}
const strip=cols=>{const o={};for(const c of ['clients','missions','vehicules','services','partenaires']){o[c]={};for(const [id,d] of Object.entries(cols[c])){if(d._deleted)continue;const x={...d};delete x.telNorm;o[c][id]=x}}return o};

/* ---------- vérifications dans la page ---------- */
const AUDIT=`(function(o){
  const W=innerWidth,H=innerHeight;const issues=[];const seen=new Set();
  const add=(cat,el,info)=>{const k=cat+'|'+sig(el)+'|'+(info||'');if(seen.has(k))return;seen.add(k);issues.push({cat,el:sig(el),info:info||''})};
  const sig=el=>{if(!el||!el.tagName)return String(el);let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;const cl=[...el.classList].filter(c=>!/^(on|lit|glass|over|today|unread|y|w)$/.test(c)).slice(0,3).join('.');if(cl)s+='.'+cl;for(const a of ['data-act','data-tab','data-route','data-k','data-ct','role','type'])if(el.getAttribute&&el.getAttribute(a))return s+'['+a+'='+el.getAttribute(a)+']';const p=el.parentElement;if(p&&p!==document.body&&!el.id){let ps=p.tagName.toLowerCase();const pc=[...p.classList].slice(0,2).join('.');if(pc)ps+='.'+pc;s=ps+'>'+s}return s};
  const root=document.querySelector(o.root)||document.body;
  const HID='[hidden],.drawer:not(.on),.toast:not(.on),.ptr,.ambient,.scrim,.login.out,.modal[hidden]';
  const inRoot=el=>root.contains(el);
  const visible=el=>{if(el.closest(HID))return false;if(!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
  const all=[...root.querySelectorAll('*')].filter(el=>!(el instanceof SVGElement)||el.tagName==='svg').filter(visible);
  const hasText=el=>[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  const cs=el=>getComputedStyle(el);
  // 1. Débordement horizontal de la page
  const de=document.documentElement;if(o.root==='body'&&(de.scrollWidth>W+1||document.body.scrollWidth>W+1))add('overflow-page',de,'scrollWidth='+Math.max(de.scrollWidth,document.body.scrollWidth)+' > '+W);
  // 2. Élément qui dépasse l'écran sans conteneur qui défile/coupe
  const clipped=el=>{for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const s=cs(a);if(/(auto|scroll|hidden|clip)/.test(s.overflowX)||/(auto|scroll|hidden|clip)/.test(s.overflow))return true}return false};
  all.forEach(el=>{const r=el.getBoundingClientRect();if((r.right>W+1||r.left<-1)&&!clipped(el))add('overflow-viewport',el,Math.round(r.left)+'→'+Math.round(r.right)+' (écran '+W+')')});
  // 3. Conteneurs qui défilent horizontalement sans le vouloir, éléments coupés
  const SCROLL_OK='.kanban,.plan-wrap,.tabs,.th-a,.qr,.dl-f,.ctc,.rail,.pal-list,.sheet,.dr-b,.cv-list,.th-s,.mj-b,.login,.mbox,.lg-in';
  const CLIP_OK='.vcard .win,.sw,.gal figure,.kpi,.hero,.mbox,.prog,.track,.strip,.thumb,.vcard,.msgs,.tog,.glass[style*="overflow"],.cv-side,.pic,.bar-m,.lanes,.plan-r,.ambient,.hero *';
  all.forEach(el=>{if(/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return;const s=cs(el);const sw=el.scrollWidth,cw=el.clientWidth;if(cw<=0||sw<=cw+2)return;
    if(/(auto|scroll)/.test(s.overflowX)){if(!el.matches(SCROLL_OK))add('scroll-container',el,sw+'>'+cw)}
    else if(/(hidden|clip)/.test(s.overflowX)){if(el.matches(CLIP_OK))return;const ell=s.textOverflow==='ellipsis'&&hasText(el);if(!ell)add('clipped',el,sw+'>'+cw)}
    else if(hasText(el)&&s.display!=='inline')add('text-overflow',el,'texte déborde de sa boîte '+sw+'>'+cw)});
  // 4. Texte qui déborde (chaînes longues / arabe) : enfants plus larges que leur parent bloc
  all.forEach(el=>{if(!hasText(el))return;const s=cs(el);if(s.display==='inline'||s.position==='absolute'||s.position==='fixed')return;const p=el.parentElement;if(!p)return;const pr=p.getBoundingClientRect(),r=el.getBoundingClientRect();const ps=cs(p);if(/(auto|scroll|hidden|clip)/.test(ps.overflowX))return;if(r.right>pr.right+2&&r.width>pr.width+2)add('text-overflow',el,'plus large que son parent '+Math.round(r.width)+'>'+Math.round(pr.width))});
  // 5. Zones tactiles
  if(o.touch){const T=[...root.querySelectorAll('button,a[href],input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea,[role=button],[role=tab],label.tog,.checks label,.ck-l,summary')].filter(visible);
    T.forEach(el=>{if(el.closest('.hero dl,.ai-card dl'))return;const r=el.getBoundingClientRect();const isField=/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);const w=Math.round(r.width),h=Math.round(r.height);
      if(h<44-0.5||(!isField&&w<44-0.5)){if(el.closest('label.tog,.tog'))return;add('tap-target',el,w+'×'+h)}})}
  // 6. Texte < 12 px
  all.forEach(el=>{if(!hasText(el))return;const fs=parseFloat(cs(el).fontSize);if(fs<11.95)add('text-small',el,fs.toFixed(1)+'px « '+el.textContent.trim().slice(0,18)+' »')});
  // 7. Champs < 16 px sur téléphone (zoom iOS)
  if(o.phone)[...root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')].filter(visible).forEach(el=>{const fs=parseFloat(cs(el).fontSize);if(fs<15.95)add('input-small',el,fs.toFixed(1)+'px')});
  // 8. Chevauchements entre textes / contrôles qui ne sont pas parents l'un de l'autre
  const visRect=el=>{const q=el.getBoundingClientRect();let L=q.left,T=q.top,R=q.right,B=q.bottom;for(let a=el.parentElement;a&&a!==document.documentElement;a=a.parentElement){const c=cs(a);if(/(auto|scroll|hidden|clip)/.test(c.overflowX+c.overflowY)){const r=a.getBoundingClientRect();L=Math.max(L,r.left);T=Math.max(T,r.top);R=Math.min(R,r.right);B=Math.min(B,r.bottom)}}return R>L&&B>T?{left:L,top:T,right:R,bottom:B,width:R-L,height:B-T}:null};
  const fixedish=el=>{for(let a=el;a&&a!==document.body;a=a.parentElement){const ps=cs(a).position;if(ps==='fixed'||ps==='sticky')return a}return null};
  const boxes=all.filter(el=>(hasText(el)||el.matches('button,a[href],input,select,textarea'))&&!el.closest('.track,.funnel,.gal,.vcard .win,.strip,.lanes,svg,.tog,.sw-bg,.dots')).map(el=>({el,r:visRect(el)})).filter(b=>b.r&&b.r.width>2&&b.r.height>2&&b.r.bottom>0&&b.r.top<H).slice(0,900);
  for(let i=0;i<boxes.length;i++)for(let k=i+1;k<boxes.length;k++){const a=boxes[i],b=boxes[k];if(a.el.contains(b.el)||b.el.contains(a.el))continue;const x=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),y=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);if(x<=2||y<=2)continue;const inter=x*y,small=Math.min(a.r.width*a.r.height,b.r.width*b.r.height);if(inter>small*.35){if(fixedish(a.el)!==fixedish(b.el))continue;add('overlap',a.el,'avec '+sig(b.el))}}
  // 9. Contrôles invisibles tant qu'on ne survole pas (pas d'équivalent tactile)
  if(o.touch)[...root.querySelectorAll('button,a[href]')].forEach(el=>{if(el.closest(HID))return;let op=1;for(let a=el;a&&a!==document.body;a=a.parentElement)op*=parseFloat(cs(a).opacity);if(op<.05&&!el.closest('[hidden]'))add('hover-only',el,'opacité 0')});
  // 10. Contraste texte / fond (approximatif : fond composé en remontant les parents)
  const lum=c=>{const f=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*f[0]+.7152*f[1]+.0722*f[2]};
  const rgba=s=>{const m=s.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(parseFloat);return [p[0],p[1],p[2],p.length>3?p[3]:1]};
  const bgOf=el=>{let acc=null;for(let a=el;a;a=a.parentElement){const c=rgba(cs(a).backgroundColor);if(c&&c[3]>0){if(!acc)acc=c;else if(acc[3]<1){const al=acc[3];acc=[acc[0]*al+c[0]*(1-al)*c[3]/(al+(1-al)*c[3]),acc[1]*al+c[1]*(1-al)*c[3]/(al+(1-al)*c[3]),acc[2]*al+c[2]*(1-al)*c[3]/(al+(1-al)*c[3]),al+(1-al)*c[3]]}if(acc[3]>=.999)return acc}if(a===document.body)break}const bb=rgba(cs(document.body).backgroundColor)||[255,255,255,1];if(!acc)return bb;const al=acc[3];return [acc[0]*al+bb[0]*(1-al),acc[1]*al+bb[1]*(1-al),acc[2]*al+bb[2]*(1-al),1]};
  all.forEach(el=>{if(!hasText(el))return;if(el.closest('[disabled]')||el.closest('.hero,.bub.out,.btn.primary,.btn.gold,.send,.key.ok,.ct.dark,.tb,.dl-f [aria-pressed=true],.gal .acts,.vcard .win,.ub,.dot,.tog,.av'))return;let fc=rgba(cs(el).color);if(!fc)return;let op=1;for(let a=el;a&&a!==document.body;a=a.parentElement)op*=parseFloat(cs(a).opacity);const bg=bgOf(el);const fa=fc[3]*op;const f=[fc[0]*fa+bg[0]*(1-fa),fc[1]*fa+bg[1]*(1-fa),fc[2]*fa+bg[2]*(1-fa)];const l1=lum(f),l2=lum(bg);const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);const fs=parseFloat(cs(el).fontSize);const min=fs>=18?3:3.4;if(ratio<min)add('contrast',el,ratio.toFixed(2)+':1 « '+el.textContent.trim().slice(0,16)+' »')});
  return issues})`;

/* ---------- états ---------- */
const W=(p,ms)=>p.waitForTimeout(ms||350);
const go=async(p,r)=>{await p.evaluate(r=>{location.hash=r},r);await W(p,420)};
const setF=async(p,k,v)=>{await p.evaluate(([k,v])=>{__S.filters[k]=v;__render()},[k,v]);await W(p,350)};
const open=async(p,k,id,tab)=>{await p.evaluate(([k,id,tab])=>{__open(k,id,tab)},[k,id,tab]);await W(p,500)};
const close=async p=>{await p.evaluate(()=>{__close();document.querySelectorAll('.modal').forEach(m=>m.hidden=true)});await W(p,250)};
const STATES=[
  {id:'salon',root:'body',modes:'both',go:p=>go(p,'salon')},
  {id:'demandes-kanban',root:'body',modes:'both',go:async p=>{await go(p,'demandes');await setF(p,'dview','kanban')}},
  {id:'demandes-liste',root:'body',modes:'mock',go:async p=>{await go(p,'demandes');await setF(p,'dview','liste')}},
  {id:'planning-grille',root:'body',modes:'mock',go:async p=>{await go(p,'planning');await setF(p,'pview','grille')}},
  {id:'planning-liste',root:'body',modes:'mock',go:async p=>{await go(p,'planning');await setF(p,'pview','liste')}},
  {id:'clients',root:'body',modes:'mock',go:p=>go(p,'clients')},
  {id:'carnet',root:'body',modes:'mock',go:p=>go(p,'carnet')},
  {id:'flotte',root:'body',modes:'mock',go:p=>go(p,'flotte')},
  {id:'contrats',root:'body',modes:'mock',go:p=>go(p,'contrats')},
  {id:'finances',root:'body',modes:'mock',go:p=>go(p,'finances')},
  {id:'services',root:'body',modes:'mock',go:p=>go(p,'services')},
  {id:'aide',root:'body',modes:'mock',go:p=>go(p,'aide')},
  {id:'who-modal',root:'#whoM',modes:'mock',go:async p=>{await go(p,'salon');await p.evaluate(()=>__openWho());await W(p,300)},end:close},
  {id:'palette',root:'#pal',modes:'mock',go:async p=>{await go(p,'salon');await p.click('#palBtn');await W(p,250);await p.fill('#palIn','ma');await W(p,250)},end:close},
  {id:'majordome',root:'#mj',modes:'mock',go:async p=>{await go(p,'salon');await p.click('#mjBtn');await W(p,250);await p.fill('#mjIn','Salam, je suis à Paris du 12 au 15 au Plaza avec ma famille, besoin d’un van avec chauffeur. Khalid +971501234567');await p.click('[data-act="mj-run"]');await W(p,600)},end:close},
  {id:'plus-sheet',root:'#plusM',modes:'both',phoneOnly:true,go:async p=>{await go(p,'salon');await p.evaluate(()=>__openPlus());await W(p,350)},end:close},
  ...['main','devis','prog','taches','contrat','ia'].map(t=>({id:'drawer-mission-'+t,root:'#drawer',modes:t==='main'?'both':'mock',go:async p=>{await go(p,'demandes');await open(p,'mission','m6',t)},end:close})),
  {id:'drawer-mission-act',root:'#drawer',modes:'server',go:async p=>{await go(p,'demandes');await open(p,'mission','m2','act');await W(p,500)},end:close},
  {id:'drawer-mission-new',root:'#drawer',modes:'mock',go:async p=>{await go(p,'demandes');await p.evaluate(()=>__open('mission'));await W(p,500)},end:close},
  {id:'drawer-client',root:'#drawer',modes:'both',go:async p=>{await go(p,'clients');await open(p,'client','c5')},end:close},
  ...['main','photos','dispo','journal'].map(t=>({id:'drawer-vehicule-'+t,root:'#drawer',modes:'mock',go:async p=>{await go(p,'flotte');await open(p,'vehicule','urus',t)},end:close})),
  {id:'drawer-partenaire',root:'#drawer',modes:'mock',go:async p=>{await go(p,'carnet');await open(p,'partenaire','p4')},end:close},
  {id:'drawer-service',root:'#drawer',modes:'mock',go:async p=>{await go(p,'services');await open(p,'service','location')},end:close},
  {id:'login-who',root:'#login',modes:'server',login:true},
  {id:'login-pin',root:'#login',modes:'server',login:true,go:async p=>{await p.click('#login [data-lgwho="amel"]');await W(p,250);await p.click('#login [data-key="1"]');await p.click('#login [data-key="2"]');await W(p,150)}},
  {id:'messages-liste',root:'body',modes:'server',go:async p=>{await p.evaluate(()=>{__S.convId=null});await go(p,'messages')}},
  {id:'messages-thread-ar',root:'body',modes:'server',go:async p=>{await go(p,'messages/971559876543');await W(p,400);await p.fill('#cmpIn','وعليكم السلام، بكل سرور. سنؤكد لكم الحجز خلال ساعة.').catch(()=>{})},end:async p=>{await p.fill('#cmpIn','').catch(()=>{})}},
  {id:'reglages',root:'body',modes:'server',go:p=>go(p,'reglages')},
];

/* ---------- pilotage ---------- */
(async()=>{const b=await chromium.launch();const t0=Date.now();const issues=[];const errs=[];let shots=0,visits=0;
const res=[];const ok=(n,c,info)=>{res.push((c?'PASS ':'FAIL ')+n+(info!==undefined&&!c?' — '+info:''))};
const seed=seedData();const seedCols=strip(seed.st.cols);
const wire=async(ctx,mode,api)=>{await ctx.route('**/*',r=>{const u=new URL(r.request().url());
  if(u.hostname==='amane.test'&&u.pathname.startsWith('/api/'))return api.handle(r);
  if(u.hostname==='amane.test')return r.fulfill({body:pageSrv,contentType:'text/html; charset=utf-8'});
  if(u.hostname==='crm.test')return r.fulfill({body:pageMock,contentType:'text/html; charset=utf-8'});
  if(u.hostname.includes('fonts.g'))return r.fulfill({body:'',contentType:'text/css'});
  return r.abort()})};
const watch=(p,tag)=>{p.on('pageerror',e=>errs.push(tag+' '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(tag+' console '+m.text())})};
const img=path.join(__dirname,'p.jpg');
async function boot(mode,w,h,extra){const api=mode==='server'?seedData():null;
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:isTouch(w,h),isMobile:isPhone(w,h),deviceScaleFactor:1,locale:'fr-FR',timezoneId:'Europe/Paris',...(extra||{})});
  await wire(ctx,mode,api);const p=await ctx.newPage();watch(p,mode+' '+w+'x'+h+(extra&&extra.colorScheme?' dark':''));
  if(mode==='server'){await p.goto('http://amane.test/crm/');await W(p,700)}
  else{await p.goto('http://crm.test/');await W(p,900);if(await p.isVisible('#whoM')){await p.click('[data-who="amel"]');await W(p,300)}
    await p.evaluate(async cols=>{const db=await window.claude.use('db');for(const [c,docs] of Object.entries(cols))for(const [id,d] of Object.entries(docs))await db.collection(c).doc(id).set(d)},seedCols);await W(p,600);
    await p.evaluate(()=>{location.hash='flotte'});await W(p,300);await p.evaluate(()=>__open('vehicule','urus','photos'));await W(p,300);await p.setInputFiles('#phIn',[img]);await W(p,1000);await close(p)}
  return {ctx,p,api}}
async function login(p){if(await p.isVisible('#login [data-lgwho="amel"]')){await p.click('#login [data-lgwho="amel"]');await W(p,200)}for(const k of '1234')await p.click(`#login [data-key="${k}"]`);await p.click('#login [data-key="ok"]');await W(p,900)}
async function run(mode,w,h,opts){opts=opts||{};const tag=(opts.dark?'dark-':'')+(opts.big?'big-':'')+w+'x'+h;
  const {ctx,p}=await boot(mode,w,h,opts.dark?{colorScheme:'dark'}:null);
  if(opts.big)await p.addStyleTag({content:':root{font-size:20px}'});
  const phone=isPhone(w,h),touch=isTouch(w,h);
  const states=STATES.filter(s=>(s.modes==='both'||s.modes===mode)&&(!ONLY||ONLY.includes(s.id))&&(!s.phoneOnly||w<=760)&&(!opts.only||opts.only.includes(s.id)));
  let logged=false;
  states.sort((x,y)=>(y.login?1:0)-(x.login?1:0));
  for(const s of states){
    if(mode==='server'&&!s.login&&!logged){await p.reload();await W(p,800);await login(p);logged=true}
    try{await p.evaluate(()=>document.getElementById('toast')&&document.getElementById('toast').classList.remove('on'));if(s.go)await s.go(p);
      if(opts.big)await p.evaluate(()=>{document.documentElement.style.fontSize='20px'});
      await p.evaluate(()=>document.getElementById('toast')&&document.getElementById('toast').classList.remove('on'));
      const found=await p.evaluate('('+AUDIT+')('+JSON.stringify({root:s.root,touch,phone,dark:!!opts.dark})+')');
      // Barres fixes, tiroir, fil, connexion, kanban, planning : vérifications propres à l'état
      const extra=await p.evaluate(({id,root,phone})=>{const out=[];window.scrollTo(0,0);const H=innerHeight,Wd=innerWidth;const q=s=>document.querySelector(s);const vis=el=>el&&el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
        const within=(el,lab)=>{const r=el.getBoundingClientRect();if(r.bottom>H+1||r.top<-1||r.right>Wd+1||r.left<-1)out.push({cat:'fixed-bars',el:lab,info:'hors écran '+Math.round(r.top)+'→'+Math.round(r.bottom)+' / '+H})};
        if(root==='#drawer'){const d=q('#drawer');const f=q('#drawer .dr-f'),hd=q('#drawer .dr-h'),bd=q('#drawer .dr-b'),sv=q('#drawer [data-act="save"]');
          if(!f||!vis(f))out.push({cat:'drawer',el:'.dr-f',info:'barre Enregistrer invisible'});else within(f,'.dr-f (Enregistrer)');
          if(sv&&vis(sv))within(sv,'[data-act=save]');
          if(hd)within(hd,'.dr-h');
          if(bd&&!/(auto|scroll)/.test(getComputedStyle(bd).overflowY))out.push({cat:'drawer',el:'.dr-b',info:'corps non défilant'});
          const dr=d.getBoundingClientRect();if(dr.height<H-2)out.push({cat:'drawer',el:'#drawer',info:'hauteur '+Math.round(dr.height)+' < '+H});
          const tb=q('.tabbar');if(tb&&vis(tb)&&f){const a=tb.getBoundingClientRect(),b=f.getBoundingClientRect();if(a.top<b.bottom&&a.bottom>b.top&&+getComputedStyle(tb).zIndex>=+getComputedStyle(d).zIndex)out.push({cat:'fixed-bars',el:'.tabbar',info:'couvre la barre Enregistrer'})}}
        if(root==='body'){const tb=q('.tabbar');const v=q('#view');
          if(tb&&vis(tb)&&v&&!document.body.classList.contains('has-thread')){window.scrollTo(0,1e9);const t=tb.getBoundingClientRect().top;let low=0;v.querySelectorAll('*').forEach(el=>{if(!vis(el))return;const r=el.getBoundingClientRect();if(r.height&&getComputedStyle(el).position!=='fixed')low=Math.max(low,r.bottom)});if(low>t+1)out.push({cat:'fixed-bars',el:'.tabbar',info:'couvre le bas du contenu ('+Math.round(low)+' > '+Math.round(t)+')'});window.scrollTo(0,0)}
          if(id==='demandes-kanban'){const k=q('.kanban');if(k){const cs=getComputedStyle(k);if(k.scrollWidth>k.clientWidth+2){if(!/(auto|scroll)/.test(cs.overflowX))out.push({cat:'kanban',el:'.kanban',info:'ne défile pas'});if(Wd<=760&&!/x/.test(cs.scrollSnapType))out.push({cat:'kanban',el:'.kanban',info:'pas d’accroche (snap)'})}
            const c=q('.kanban .col');if(c&&c.getBoundingClientRect().width>Wd-24)out.push({cat:'kanban',el:'.col',info:'colonne plus large que l’écran'})}}
          if(id==='planning-grille'){const pw=q('.plan-wrap');if(pw&&pw.scrollWidth>pw.clientWidth+2){if(!/(auto|scroll)/.test(getComputedStyle(pw).overflowX))out.push({cat:'planning',el:'.plan-wrap',info:'ne défile pas'});const rl=q('.plan-r .rl');if(rl&&getComputedStyle(rl).position!=='sticky')out.push({cat:'planning',el:'.plan-r .rl',info:'première colonne non collante'})}}
          if(id==='messages-thread-ar'){const c=q('.cmp'),sd=q('.send'),hh=q('.th-h');if(c&&vis(c))within(c,'.cmp (composer)');if(sd&&vis(sd))within(sd,'.send');if(hh)within(hh,'.th-h');
            const ar=[...document.querySelectorAll('.bub [dir="auto"]')].find(e=>/[\u0600-\u06FF]/.test(e.textContent));if(ar&&getComputedStyle(ar).direction!=='rtl')out.push({cat:'rtl',el:'.bub',info:'message arabe non affiché de droite à gauche'})}}
        if(root==='#login'){const lg=q('#login');const okk=q('#login .key.ok')||q('#login .tile:last-child');if(okk){lg.scrollTop=1e9;const r=okk.getBoundingClientRect();if(r.bottom>H+1)out.push({cat:'fixed-bars',el:'#login',info:'bas de l’écran de connexion inaccessible'});lg.scrollTop=0}}
        if(root==='#plusM'){const sh=q('#plusM .sheet');if(sh){const r=sh.getBoundingClientRect();if(r.bottom>H+1||r.top<0)out.push({cat:'fixed-bars',el:'.sheet',info:'feuille hors écran'})}}
        if(root==='#pal'||root==='#mj'||root==='#whoM'){const m=q(root+' .mbox');if(m){const r=m.getBoundingClientRect();if(r.bottom>H+1||r.right>Wd+1)out.push({cat:'fixed-bars',el:root+' .mbox',info:'fenêtre hors écran'})}}
        return out},{id:s.id,root:s.root,phone});
      for(const i of [...found,...extra])issues.push({...i,state:s.id,mode,vp:tag});
      visits++;
      if(SHOTS){await p.screenshot({path:path.join(SHOTS,`${s.id}-${tag}${mode==='server'?'-srv':''}.png`)});shots++}
      if(s.end)await s.end(p)}
    catch(e){issues.push({cat:'crash',el:s.id,info:String(e.message).split('\n')[0].slice(0,140),state:s.id,mode,vp:tag})}
  }
  await ctx.close()}

try{
for(const [w,h] of VPS){for(const mode of MODES)await run(mode,w,h)}
// Mode sombre : téléphone et bureau
if(!process.env.VPS||VPS.some(v=>v[0]===390)){for(const mode of MODES)await run(mode,390,844,{dark:true});}
if(!process.env.VPS||VPS.some(v=>v[0]===1280)){for(const mode of MODES)await run(mode,1280,800,{dark:true});}
// Texte agrandi (réglage système) : 390×844
if(!process.env.VPS||VPS.some(v=>v[0]===390)){for(const mode of MODES)await run(mode,390,844,{big:true,only:['salon','demandes-kanban','demandes-liste','clients','drawer-mission-main','drawer-client','messages-liste','messages-thread-ar','login-who','plus-sheet']})}
// Mouvement réduit
if(!process.env.VPS||VPS.some(v=>v[0]===390)){const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await wire(ctx,'mock',null);const p=await ctx.newPage();watch(p,'reduced');
  await p.goto('http://crm.test/');await W(p,900);if(await p.isVisible('#whoM')){await p.click('[data-who="amel"]');await W(p,300)}
  const rm=await p.evaluate(()=>{const g=s=>getComputedStyle(document.querySelector(s));return {live:g('#live i').animationName,drawer:g('#drawer').transitionDuration,orb:(document.querySelector('.mj-h .orb')?g('.mj-h .orb').animationName:'none')}});
  ok('mouvement réduit : aucune animation ni transition',(rm.live==='none')&&/^0s/.test(rm.drawer),JSON.stringify(rm));await ctx.close()}
}catch(e){res.push('CRASH '+String(e.message).split('\n').slice(0,6).join(' | '))}
await b.close();

/* ---------- rapport ---------- */
const byCat={};for(const i of issues)(byCat[i.cat]=byCat[i.cat]||[]).push(i);
const cats=Object.keys(byCat).sort();
console.log(`États visités : ${visits} · captures : ${shots} · ${((Date.now()-t0)/1000).toFixed(0)} s`);
for(const c of cats){const L=byCat[c];console.log(`\n== ${c} : ${L.length}`);
  const grp={};for(const i of L){const k=i.state+' · '+i.el+(i.info?' · '+i.info:'');(grp[k]=grp[k]||[]).push(i.vp+(i.mode==='server'?'(srv)':''))}
  Object.entries(grp).sort((a,b)=>b[1].length-a[1].length).slice(0,LIST).forEach(([k,v])=>console.log('  '+k+'  @ '+[...new Set(v)].slice(0,6).join(', ')+(v.length>6?' +'+(v.length-6):'')));
  if(Object.keys(grp).length>LIST)console.log('  … '+(Object.keys(grp).length-LIST)+' autres')}
for(const c of ['overflow-page','overflow-viewport','scroll-container','clipped','text-overflow','tap-target','text-small','input-small','fixed-bars','drawer','kanban','planning','overlap','hover-only','contrast','rtl','crash'])ok(c+' : 0 problème',!(byCat[c]||[]).length,(byCat[c]||[]).length+' problème(s)');
ok('0 erreur JS',errs.length===0,errs.slice(0,4).join(' | '));
console.log('\n'+res.join('\n'));const f=res.filter(r=>!r.startsWith('PASS')).length;console.log(`${res.length-f}/${res.length} PASS · ${issues.length} problème(s) responsive`);process.exit(f?1:0)})();
