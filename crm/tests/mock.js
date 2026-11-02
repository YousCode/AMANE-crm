// Mock window.claude: db (in-memory, live snapshots), assets, sample, downloads
window.__log=[];
(function(){
  const store={};const subs={};
  const snap=c=>{const docs=Object.entries(store[c]||{}).map(([id,d])=>({id,exists:true,data:()=>JSON.parse(JSON.stringify(d)),metadata:{fromCache:false,hasPendingWrites:false}}));return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{}}};
  const emit=c=>setTimeout(()=>(subs[c]||[]).forEach(f=>f(snap(c))),15);
  const coll=c=>({path:c,
    doc:(id)=>{id=id||Math.random().toString(36).slice(2);return {id,path:c+'/'+id,
      get:async()=>({id,exists:!!(store[c]||{})[id],data:()=>(store[c]||{})[id]}),
      set:async(d)=>{const s=JSON.stringify(d);if(s.includes('"__undef'))throw{code:'invalid_argument'};JSON.parse(s);(store[c]=store[c]||{})[id]=JSON.parse(s);window.__log.push(['set',c,id]);emit(c)},
      update:async(d)=>{if(!(store[c]||{})[id])throw{code:'invalid_argument'};Object.assign(store[c][id],JSON.parse(JSON.stringify(d)));emit(c)},
      delete:async()=>{if(store[c])delete store[c][id];window.__log.push(['del',c,id]);emit(c)}}},
    onSnapshot:(f,e)=>{(subs[c]=subs[c]||[]).push(f);emit(c);return()=>{}},
    add:async(d)=>{const r=coll(c).doc();await r.set(d);return r}});
  window.__store=store;
  // seed fleet + services like production
  store.vehicules={urus:{nom:'Urus SE',categorie:'Super SUV',tarifJour:1000,loyerMois:2430,chargesMois:500,statut:'disponible',ordre:1},
    f296:{nom:'Ferrari 296 GTB',categorie:'Supercar',tarifJour:1300,loyerMois:2240,chargesMois:500,statut:'disponible',ordre:2},
    g63:{nom:'G 63',categorie:'SUV',tarifJour:650,loyerMois:1670,chargesMois:500,statut:'disponible',ordre:3},
    m5:{nom:'M5 Touring',categorie:'Break sport',tarifJour:450,loyerMois:1480,chargesMois:500,statut:'disponible',ordre:4},
    classev:{nom:'Classe V VIP',categorie:'Van 7-8 places',tarifJour:300,loyerMois:930,chargesMois:500,statut:'disponible',ordre:5}};
  store.services={location:{nom:"Voiture d’exception",ordre:1,tarif:'x'},chauffeur:{nom:'Chauffeur VIP',ordre:2},van:{nom:'Van VIP',ordre:3},transfert:{nom:'Transfert aéroport',ordre:4},shopping:{nom:'Personal shopping',ordre:5},sejour:{nom:'Séjour clé en main',ordre:6},conciergerie:{nom:'Conciergerie sur demande',ordre:7},clip:{nom:'Clip souvenir',ordre:8}};
  const db={collection:coll,doc:p=>{const [c,id]=p.split('/');return coll(c).doc(id)}};
  const blobs={};
  const assets={upload:async(b,o)=>{const id=Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');blobs[id]=URL.createObjectURL(b);window.__log.push(['upload',id,b.type,b.size]);return {id,url:blobs[id],sizeBytes:b.size,contentType:b.type}},delete:async id=>{window.__log.push(['adel',id])},list:async()=>({assets:[],usage:{}})};
  window.__blobs=blobs;
  const sample=async(input,opts)=>{window.__log.push(['sample',String(input).slice(0,60)]);const t='Bonjour Monsieur, nous avons le plaisir de vous confirmer votre demande. Amane';if(opts&&opts.onText){opts.onText({text:t.slice(0,20),delta:t.slice(0,20)})}return {text:t,truncated:false}};
  sample.json=async(input)=>{window.__log.push(['samplejson']);return {client:{nom:'Khalid Al-Mansoori',tel:'+971 50 123 4567',email:'',langue:'AR',pays:'Émirats arabes unis',hotel:'Plaza Athénée'},mission:{titre:'Van + chauffeur, 12 au 15',service:'van',vehicule:'Classe V',debut:'2026-11-12T10:00',fin:'2026-11-15T20:00',lieu:'Plaza Athénée',budget:3000,notes:'Famille de 5'},priorite:'haute',reponse:'مرحباً، شكراً لرسالتكم. Amane'}};
  sample.limits=async()=>({images:false});
  const downloads={save:async r=>{window.__log.push(['save',r.filename,String(r.data).length]);return {}}};
  const map={db,assets,sample,downloads};
  window.claude={use:async n=>map[n]||null};
})();
