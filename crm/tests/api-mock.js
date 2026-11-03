// API du serveur Amane simulée en mémoire (contrat : docs/crm-serveur.md), pour les tests Playwright du CRM.
// Usage :
//   const {createApi}=require('./api-mock');const api=createApi();
//   await page.route('**/*',r=>new URL(r.request().url()).pathname.startsWith('/api/')?api.handle(r):…);
//   api.external('missions','m9',{titre:'…'},'aziz')   écriture faite « par un autre utilisateur »
//   api.inbound('33612345678','Bonjour…')              message WhatsApp entrant
//   api.offline=true                                    le réseau ne répond plus (requêtes abandonnées)
//   api.st                                              état complet (collections, compteurs, sessions, journal)
'use strict';
const STATUTS={nouvelle:'Nouvelle',proposition:'Proposition',confirmee:'Confirmée',encours:'En cours',terminee:'Terminée',perdue:'Perdue'};
const WRITABLE=['clients','missions','vehicules','services','partenaires','reglages'];
const SYNCED=['clients','missions','vehicules','services','partenaires','reglages','conversations','messages'];
const pad=n=>String(n).padStart(2,'0');
const local=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const telNorm=t=>{let s=String(t||'').replace(/[^\d+]/g,'');if(s.startsWith('00'))s='+'+s.slice(2);if(/^0\d{9}$/.test(s))s='33'+s.slice(1);return s.replace(/\D/g,'')};

function createApi(opts={}){
  let last=0;const stamp=()=>{const t=Math.max(Date.now(),last+1);last=t;return new Date(t).toISOString()};
  const st={cols:{},activity:[],counters:{},photos:{},fails:{},session:null,log:[],sent:[],
    users:{amel:{id:'amel',nom:'Amel',role:'Relation client',pin:'1234'},youssouf:{id:'youssouf',nom:'Youssouf',role:'Tech & flotte',pin:null},aziz:{id:'aziz',nom:'Aziz',role:'Contrats & conformité',pin:'5678'}},
    setupCode:'AMANE-SETUP',ia:true,whatsapp:true};
  SYNCED.forEach(c=>st.cols[c]={});
  const api={st,offline:false,delayMs:0};
  const put=(col,id,fields,user,act)=>{const prev=st.cols[col][id];const at=stamp();const doc={...(prev&&!prev._deleted?prev:{}),...fields,updatedAt:at,updatedBy:user||'site'};
    if(!prev||prev._deleted)doc.createdAt=fields.createdAt||at;if(col==='clients'||col==='partenaires')doc.telNorm=telNorm(doc.tel);delete doc.id;st.cols[col][id]=doc;
    if(act!==false){let resume=!prev||prev._deleted?'création':'fiche modifiée';
      if(prev&&col==='missions'&&prev.statut!==doc.statut)resume=`statut : ${STATUTS[prev.statut]||prev.statut} → ${STATUTS[doc.statut]||doc.statut}`;
      else if(prev&&col==='missions'&&JSON.stringify(prev.devis||null)!==JSON.stringify(doc.devis||null))resume='devis modifié';
      else if(prev&&+prev.montant!==+doc.montant&&col==='missions')resume='montant modifié';
      st.activity.unshift({id:'a'+st.activity.length,at,user:user||'site',col,docId:id,action:!prev||prev._deleted?'create':'update',resume})}
    return doc};
  api.external=(col,id,fields,user)=>put(col,id,fields,user||'aziz');
  api.doc=(col,id)=>st.cols[col][id];
  api.inbound=(convId,text,o={})=>{const at=stamp();const id='wamid.'+Math.random().toString(36).slice(2);
    st.cols.messages[id]={convId,dir:'in',type:'text',text,at,status:'recu',createdAt:at,updatedAt:at,updatedBy:'whatsapp'};
    const cv=st.cols.conversations[convId]||{phone:convId,nom:o.name||'',lang:o.lang||'FR',unread:0,createdAt:at};
    st.cols.conversations[convId]={...cv,lastAt:at,lastText:text,lastDir:'in',unread:(+cv.unread||0)+1,windowUntil:new Date(Date.now()+864e5).toISOString(),updatedAt:at,updatedBy:'whatsapp'};
    st.activity.unshift({id:'a'+st.activity.length,at,user:'whatsapp',col:'conversations',docId:convId,action:'whatsapp',resume:'nouveau message WhatsApp'});return id};

  api.handle=async route=>{
    const req=route.request();const url=new URL(req.url());const p=url.pathname;const m=req.method();
    let body=null;try{body=req.postDataJSON()}catch(e){}
    st.log.push([m,p+url.search,body]);
    if(api.offline)return route.abort('internetdisconnected');
    if(api.delayMs)await new Promise(r=>setTimeout(r,api.delayMs));
    const send=(status,obj)=>route.fulfill({status,contentType:'application/json; charset=utf-8',headers:{'cache-control':'no-store'},body:JSON.stringify(obj)});
    const err=(status,error,message)=>send(status,{error,message});
    const user=st.session&&st.users[st.session];
    const pub={id:user&&user.id,nom:user&&user.nom,role:user&&user.role};
    if(p==='/api/health')return send(200,{ok:true,db:true,whatsapp:st.whatsapp,ia:st.ia,version:'test'});
    if(p==='/api/auth/login'&&m==='POST'){const u=st.users[body&&body.userId];if(!u)return err(400,'utilisateur_inconnu','Utilisateur inconnu.');
      if((st.fails[u.id]||0)>=5)return err(429,'trop_de_tentatives','Trop de tentatives. Réessayez dans 15 minutes.');
      if(!u.pin)return err(409,'no_pin','Code PIN pas encore créé.');
      if(String(body.pin)!==u.pin){st.fails[u.id]=(st.fails[u.id]||0)+1;return err(401,'bad_pin','Code incorrect.')}
      st.fails[u.id]=0;st.session=u.id;return send(200,{user:{id:u.id,nom:u.nom,role:u.role}})}
    if(p==='/api/auth/setup'&&m==='POST'){const u=st.users[body&&body.userId];if(!u)return err(400,'utilisateur_inconnu','Utilisateur inconnu.');
      if(body.code!==st.setupCode)return err(401,'bad_code','Code d’installation incorrect.');if(!/^\d{4,8}$/.test(String(body.pin||'')))return err(400,'pin_invalide','4 à 8 chiffres.');
      u.pin=String(body.pin);st.fails[u.id]=0;return send(200,{ok:true})}
    if(p==='/api/auth/me')return user?send(200,{user:pub}):err(401,'non_connecte','Session absente.');
    if(p==='/api/auth/logout'){st.session=null;return send(200,{ok:true})}
    if(!user)return err(401,'non_connecte','Session absente ou expirée.');
    if(p==='/api/sync'&&m==='GET'){const since=url.searchParams.get('since');const from=since?new Date(Date.parse(since)-2000).toISOString():null;const now=stamp();
      const changes={},deleted={};SYNCED.forEach(c=>{changes[c]=[];Object.entries(st.cols[c]).forEach(([id,d])=>{if(from&&!(d.updatedAt>from))return;if(d._deleted){if(from)(deleted[c]=deleted[c]||[]).push(id);return}changes[c].push({id,...d})})});
      return send(200,{now,changes,deleted,compteurs:{...st.counters}})}
    let mm=p.match(/^\/api\/doc\/([^/]+)\/([^/]+)$/);
    if(mm){const col=decodeURIComponent(mm[1]),id=decodeURIComponent(mm[2]);if(!WRITABLE.includes(col))return err(400,'collection_refusee','Collection non permise.');
      if(m==='PUT'){if(JSON.stringify(body||{}).length>512*1024)return err(413,'trop_gros','Fiche trop volumineuse.');const f={...(body||{})};delete f.updatedAt;delete f.updatedBy;const d=put(col,id,f,user.id);return send(200,{id,updatedAt:d.updatedAt})}
      if(m==='DELETE'){const at=stamp();st.cols[col][id]={...(st.cols[col][id]||{}),_deleted:true,updatedAt:at,updatedBy:user.id};st.activity.unshift({id:'a'+st.activity.length,at,user:user.id,col,docId:id,action:'delete',resume:'suppression'});return send(200,{ok:true})}}
    if(p==='/api/counter'&&m==='POST'){const k=String(body&&body.key||'');if(!k)return err(400,'cle','Clé manquante.');st.counters[k]=(st.counters[k]||0)+1;return send(200,{n:st.counters[k]})}
    if(p==='/api/activity'){const docId=url.searchParams.get('docId');const lim=+url.searchParams.get('limit')||50;return send(200,{items:st.activity.filter(a=>!docId||a.docId===docId).slice(0,lim)})}
    if(p==='/api/photo'&&m==='POST'){const du=String(body&&body.dataUrl||'');const mt=du.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);if(!mt)return err(400,'image_invalide','Image invalide.');const buf=Buffer.from(mt[2],'base64');if(buf.length>600*1024)return err(413,'trop_gros','Image trop lourde.');
      const id='ph'+(Object.keys(st.photos).length+1)+Math.random().toString(36).slice(2,6);st.photos[id]={type:'image/'+mt[1],buf};return send(200,{id,url:'/api/photo?id='+id})}
    if(p==='/api/photo'&&m==='GET'){const ph=st.photos[url.searchParams.get('id')];if(!ph)return err(404,'introuvable','Photo introuvable.');return route.fulfill({status:200,contentType:ph.type,body:ph.buf})}
    if(p==='/api/ai'&&m==='POST'){if(!st.ia)return err(503,'ia_off','IA non configurée.');const prompt=String(((body&&body.messages)||[]).map(x=>x.content).join('\n'));
      if(/JSON/.test(prompt))return send(200,{text:JSON.stringify({client:{nom:'Khalid Al-Mansoori',tel:'+971 50 123 4567',langue:'AR',pays:'Émirats arabes unis',hotel:'Four Seasons George V'},mission:{titre:'Van + chauffeur, famille',service:'van',vehicule:'Classe V',debut:'',fin:'',lieu:'Four Seasons George V',budget:3000,notes:'Famille de 5'},priorite:'haute',reponse:'مرحباً، شكراً لرسالتكم. Amane'})});
      return send(200,{text:'Bonjour, nous avons le plaisir de vous confirmer votre réservation. Amane'})}
    if(p==='/api/whatsapp/send'&&m==='POST'){if(!st.whatsapp)return err(503,'whatsapp_off','WhatsApp non configuré.');const cv=st.cols.conversations[body&&body.convId];if(!cv)return err(404,'introuvable','Conversation introuvable.');
      let text,type='text';if(body.template){type='template';text=`[Modèle ${body.template.name}]${(body.template.params||[]).length?' '+body.template.params.join(' · '):''}`}
      else{text=String(body.text||'').trim();if(!text)return err(400,'texte_vide','Message vide.');if(!cv.windowUntil||Date.parse(cv.windowUntil)<=Date.now())return err(409,'window_closed','Plus de 24 h depuis le dernier message du client : utilisez un modèle approuvé.')}
      const at=stamp();const id='wamid.out'+st.sent.length;st.sent.push({convId:body.convId,text:body.text,template:body.template||null,by:user.id});
      st.cols.messages[id]={convId:body.convId,dir:'out',type,text,at,status:'envoye',by:user.id,createdAt:at,updatedAt:at,updatedBy:user.id,...(body.template?{template:body.template}:{})};
      st.cols.conversations[body.convId]={...cv,lastAt:at,lastText:text,lastDir:'out',unread:0,updatedAt:at,updatedBy:user.id};return send(200,{id})}
    if(p==='/api/whatsapp/read'&&m==='POST'){const cv=st.cols.conversations[body&&body.convId];if(cv){const at=stamp();st.cols.conversations[body.convId]={...cv,unread:0,updatedAt:at,updatedBy:user.id}}return send(200,{ok:true})}
    return err(404,'introuvable','Route inconnue.')};

  if(opts.seed!==false)seed(st,put,stamp);
  return api;
}

function seed(st,put,stamp){
  const now=new Date();const at=(d,h,mi)=>{const x=new Date(now);x.setDate(x.getDate()+d);x.setHours(h,mi||0,0,0);return local(x)};
  const iso=ms=>new Date(Date.now()+ms).toISOString();const H=36e5,D=864e5;
  const soon=new Date(Date.now()+100*60e3);soon.setMinutes(soon.getMinutes()<30?30:60,0,0);const sat=new Date(now);sat.setDate(sat.getDate()+((6-sat.getDay()+7)%7||7));
  const W=(c,id,o)=>put(c,id,o,'amel',false);
  [['urus','Urus SE','Super SUV',1000,2430,1],['f296','Ferrari 296 GTB','Supercar',1300,2240,2],['g63','G 63','SUV',650,1670,3],['m5','M5 Touring','Break sport',450,1480,4],['classev','Classe V VIP','Van 7-8 places',300,930,5]]
    .forEach(([id,nom,categorie,tarifJour,loyerMois,ordre])=>W('vehicules',id,{nom,categorie,tarifJour,loyerMois,chargesMois:500,statut:'disponible',ordre}));
  [['location','Voiture d’exception'],['chauffeur','Chauffeur VIP'],['van','Van VIP'],['transfert','Transfert aéroport'],['shopping','Personal shopping'],['sejour','Séjour clé en main'],['conciergerie','Conciergerie sur demande'],['clip','Clip souvenir']]
    .forEach(([id,nom],i)=>W('services',id,{nom,ordre:i+1}));
  W('partenaires','p1',{nom:'Karim B.',type:'chauffeur',contact:'Karim',tel:'06 12 00 00 01',langues:'FR, AR, EN',actif:true,notes:'Carte VTC, arabophone.'});
  W('partenaires','p2',{nom:'Sofiane M.',type:'chauffeur',tel:'+33 7 61 00 00 02',langues:'FR, EN',actif:true});
  W('partenaires','p3',{nom:'Maison de maroquinerie',type:'boutique',contact:'Salon privé',tel:'01 42 00 00 03',adresse:'22 rue du Faubourg Saint-Honoré, 75008 Paris',commission:8,actif:true});
  W('clients','c1',{nom:'Mme Sophie Laurent',tel:'+33 6 12 34 56 78',email:'sophie.laurent@example.com',langue:'FR',pays:'France',hotel:'Hôtel Plaza Athénée, 25 avenue Montaigne',canal:'WhatsApp',statut:'vip',responsable:'amel',tags:{vip:true}});
  W('clients','c2',{nom:'Khalid Al-Mansoori',tel:'+971 50 123 4567',langue:'AR',pays:'Émirats arabes unis',hotel:'Four Seasons George V',canal:'WhatsApp',statut:'client',responsable:'amel',tags:{famille:true}});
  W('clients','c3',{nom:'James Whitmore',tel:'+44 7700 900123',email:'j.whitmore@example.co.uk',langue:'EN',pays:'Royaume-Uni',hotel:'Le Bristol',canal:'Instagram',statut:'habitue',responsable:'amel'});
  W('clients','c4',{nom:'Elena Petrova',tel:'+7 916 123 45 67',langue:'RU',pays:'Russie',hotel:'Cheval Blanc Paris',canal:'Palace / hôtel',statut:'prospect',responsable:'amel'});
  const K=o=>({statut:'a_rediger',caution:0,cautionStatut:'aucune',pieces:{permis:false,passeport:false,domicile:false},edlDepart:{fait:false},edlRetour:{fait:false},...o});
  W('missions','m1',{titre:'G 63 — dîner au Ritz',clientId:'c1',service:'chauffeur',vehiculeId:'g63',debut:local(soon),fin:local(new Date(+soon+4*H)),lieu:'Hôtel Ritz, 15 place Vendôme',montant:1300,acompte:400,statut:'confirmee',responsable:'amel',chauffeurId:'p1',chauffeur:'Karim B.',contrat:K({statut:'signe'}),paiement:'acompte',
    taches:[{t:'Confirmer la table au Ritz',resp:'amel',due:at(0,0).slice(0,10),fait:false}]});
  W('missions','m2',{titre:'Van + chauffeur — séjour en famille',clientId:'c2',service:'van',vehiculeId:'classev',debut:at(-1,10),fin:at(3,20),lieu:'Four Seasons George V, 31 avenue George V',montant:5400,acompte:2000,statut:'encours',responsable:'amel',chauffeurId:'p2',chauffeur:'Sofiane M.',convId:'971501234567',contrat:K({statut:'signe'}),paiement:'acompte',
    programme:[{dt:at(0,13,0),type:'restaurant',lieu:'Le Cinq, avenue George V',client:'Table pour cinq'},{dt:at(0,16,30),type:'shopping',partenaireId:'p3',lieu:'Faubourg Saint-Honoré',client:'Salon privé réservé'}]});
  W('missions','m3',{titre:'Urus — week-end Deauville',clientId:'c3',service:'location',vehiculeId:'urus',debut:at(3,9),fin:at(5,19),lieu:'Le Bristol, 112 rue du Faubourg Saint-Honoré',montant:3000,statut:'proposition',responsable:'amel',contrat:K({}),paiement:'non'});
  W('missions','m4',{titre:'Shopping Faubourg Saint-Honoré',clientId:'c4',service:'shopping',debut:at(1,11),fin:at(1,18),lieu:'Cheval Blanc Paris, 8 quai du Louvre',montant:1800,statut:'nouvelle',responsable:'amel',contrat:K({}),paiement:'non'});
  W('missions','m5',{titre:'Transfert CDG → Le Bristol',clientId:'c3',service:'transfert',vehiculeId:'classev',debut:at(-7,15),fin:at(-7,17),lieu:'Aéroport CDG, terminal 2E',montant:250,statut:'terminee',responsable:'amel',contrat:K({statut:'signe'}),paiement:'solde'});
  const conv=(id,o)=>{const t=stamp();st.cols.conversations[id]={phone:id,...o,createdAt:t,updatedAt:t,updatedBy:'whatsapp'}};
  const msg=(convId,dir,text,ms,o={})=>{const t=stamp();const a=iso(-ms);st.cols.messages['wamid.'+convId+'.'+Math.round(ms/1000)]={convId,dir,type:'text',text,at:a,status:dir==='out'?(o.status||'lu'):'recu',by:dir==='out'?(o.by||'amel'):undefined,createdAt:t,updatedAt:t,updatedBy:dir==='out'?'amel':'whatsapp'}};
  // Sophie (FR) : fenêtre ouverte, 2 non lus, brouillon IA
  msg('33612345678','in','Bonjour, je serai à Paris ce week-end avec mon mari. Auriez-vous un G 63 disponible samedi ?',26*H);
  msg('33612345678','out','Bonjour Madame Laurent, avec plaisir. Le G 63 est disponible samedi ; souhaitez-vous qu’il vous soit livré à l’hôtel ?',25.5*H);
  msg('33612345678','in','Oui, au Plaza Athénée vers 19 h.',40*60e3);
  msg('33612345678','in','Parfait, et serait-il possible d’avoir aussi un chauffeur samedi soir ?',5*60e3);
  const sat19=new Date(sat);sat19.setHours(19,30,0,0);const sat23=new Date(sat);sat23.setHours(23,30,0,0);
  conv('33612345678',{nom:'Sophie Laurent',clientId:'c1',lang:'FR',lastAt:iso(-5*60e3),lastText:'Parfait, et serait-il possible d’avoir aussi un chauffeur samedi soir ?',lastDir:'in',unread:2,windowUntil:iso(24*H-5*60e3),
    aiSummary:'Souhaite un G 63 avec chauffeur samedi soir pour un dîner à deux, départ du Plaza Athénée.',aiDraft:'Bonjour Madame Laurent, c’est tout à fait possible : Karim, notre chauffeur, sera au Plaza Athénée samedi à 19 h 30 avec le G 63. Souhaitez-vous que nous réservions également votre table ? Amane',
    aiFields:{service:'chauffeur',vehicule:'G 63',debut:local(sat19),fin:local(sat23),lieu:'Hôtel Plaza Athénée',passagers:2,budget:900,urgence:'normale',langue:'FR'}});
  // Khalid (AR)
  msg('971501234567','in','السلام عليكم، نحن عائلة من خمسة أشخاص ونحتاج إلى سيارة فان مع سائق لمدة ثلاثة أيام.',30*H);
  msg('971501234567','out','وعليكم السلام، أهلاً وسهلاً بكم في باريس. سيارة Classe V مع سائق يتحدث العربية جاهزة لكم ابتداءً من الغد.',29*H);
  msg('971501234567','in','ممتاز، شكراً جزيلاً. هل يمكن أن يكون السائق في الفندق الساعة العاشرة صباحاً؟',18*60e3);
  conv('971501234567',{nom:'Khalid',clientId:'c2',missionId:'m2',lang:'AR',lastAt:iso(-18*60e3),lastText:'ممتاز، شكراً جزيلاً. هل يمكن أن يكون السائق في الفندق الساعة العاشرة صباحاً؟',lastDir:'in',unread:1,windowUntil:iso(24*H-18*60e3),
    aiSummary:'Demande que le chauffeur soit à l’hôtel à 10 h.',aiDraft:'بكل سرور، سيكون السائق في انتظاركم في بهو الفندق الساعة العاشرة صباحاً. Amane'});
  // James (EN) : fenêtre fermée
  msg('447700900123','in','Hi, could you send me the price for the Urus for next weekend?',60*H);
  msg('447700900123','out','Good afternoon Mr Whitmore, the Urus is available. I will send you our proposal shortly.',58*H,{status:'distribue'});
  conv('447700900123',{nom:'James',clientId:'c3',lang:'EN',lastAt:iso(-58*H),lastText:'Good afternoon Mr Whitmore, the Urus is available. I will send you our proposal shortly.',lastDir:'out',unread:0,windowUntil:iso(-34*H)});
  // Elena (RU)
  msg('79161234567','in','Здравствуйте! Можно ли организовать шопинг на улице Фобур-Сент-Оноре завтра?',3*H);
  msg('79161234567','out','Здравствуйте, Елена! Конечно, мы забронируем для вас частный салон. Amane',2.5*H,{status:'lu'});
  conv('79161234567',{nom:'Elena',clientId:'c4',lang:'RU',lastAt:iso(-2.5*H),lastText:'Здравствуйте, Елена! Конечно, мы забронируем для вас частный салон. Amane',lastDir:'out',unread:0,windowUntil:iso(21*H)});
  // Nouveau prospect (FR), sans fiche
  const ws=new Date(sat);ws.setDate(ws.getDate()+7);ws.setHours(10,0,0,0);const we=new Date(ws);we.setDate(we.getDate()+1);we.setHours(19,0,0,0);
  msg('33698765432','in','Bonjour, je souhaiterais louer l’Urus le week-end prochain, livré au Bristol. Budget autour de 3 000 €.',12*60e3);
  conv('33698765432',{nom:'Charles de Villiers',lang:'FR',lastAt:iso(-12*60e3),lastText:'Bonjour, je souhaiterais louer l’Urus le week-end prochain, livré au Bristol. Budget autour de 3 000 €.',lastDir:'in',unread:1,windowUntil:iso(24*H-12*60e3),
    aiSummary:'Location de l’Urus le week-end prochain, livraison au Bristol, budget 3 000 €.',aiDraft:'Bonjour Monsieur de Villiers, merci pour votre message. L’Urus est disponible le week-end prochain ; nous pouvons le livrer au Bristol samedi matin. Amane',
    aiFields:{service:'location',vehicule:'Urus',debut:local(ws),fin:local(we),lieu:'Le Bristol, 112 rue du Faubourg Saint-Honoré',budget:3000,urgence:'normale',langue:'FR'}});
  const A=(user,col,docId,action,resume,ago)=>st.activity.push({id:'s'+st.activity.length,at:iso(-ago),user,col,docId,action,resume});
  A('whatsapp','conversations','33698765432','whatsapp','nouveau message WhatsApp',12*60e3);
  A('aziz','missions','m1','update','contrat signé',50*60e3);
  A('youssouf','vehicules','g63','update','révision planifiée',2*H);
  A('amel','missions','m3','update','statut : Nouvelle → Proposition',5*H);
  A('ia','missions','m4','update','IA : complété dates, lieu',26*H);
  A('site','missions','m4','create','création',26*H);
  st.activity.sort((a,b)=>b.at.localeCompare(a.at));
}

module.exports={createApi};
