/*
 * Simulation du serveur (contrat docs/crm-serveur.md + docs/architecture-v2.md) en interceptant `fetch`.
 * Sert aux tests Jest et au rendu web sans serveur (EXPO_PUBLIC_API_URL vide). PIN 1234 pour les trois.
 */
import * as seed from './data';
import { RELANCE_TYPES, firstName, telNorm, t as tr } from '@amane/shared';

type Doc = { id: string; [k: string]: any };
type Cols = Record<string, any[]>;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const PINS: Record<string, string> = { amel: '1234', youssouf: '1234', aziz: '1234' };
const SETUP_CODE = 'SETUP-AMANE';
const TEAM: Record<string, { id: string; nom: string; role: string }> = {
  amel: { id: 'amel', nom: 'Amel', role: 'Relation client' },
  youssouf: { id: 'youssouf', nom: 'Youssouf', role: 'Tech & flotte' },
  aziz: { id: 'aziz', nom: 'Aziz', role: 'Contrats & conformité' },
};

export type MockState = {
  cols: Cols; deleted: Record<string, string[]>; sessions: Record<string, string>; fails: Record<string, number>;
  pins: Record<string, string | null>; outbox: any[]; pushTokens: any[]; photos: Record<string, string>; counters: Record<string, number>; log: { method: string; path: string; body: any }[];
  whatsappOff: boolean; iaOff: boolean; offline: boolean; windowClosedFor: Set<string>;
  relances: any[]; acces: Record<string, any>; confirmations: Record<string, any>;
};

export function freshState(): MockState {
  return {
    cols: {
      clients: clone(seed.clients), missions: clone(seed.missions), vehicules: clone(seed.vehicules), services: clone(seed.services),
      partenaires: clone(seed.partenaires), reglages: clone(seed.reglages), conversations: clone(seed.conversations), messages: clone(seed.messages), activity: clone(seed.activity),
    },
    deleted: {}, sessions: {}, fails: {}, pins: { ...PINS }, outbox: [], pushTokens: [], photos: {}, counters: {}, log: [],
    whatsappOff: false, iaOff: false, offline: false, windowClosedFor: new Set(),
    relances: [], acces: {}, confirmations: {},
  };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const err = (status: number, code: string, message: string) => json(status, { error: code, message });

let st: MockState = freshState();
export const mockState = () => st;
export const resetMock = () => { st = freshState(); };

function userOf(req: Request): string | null {
  const ck = req.headers.get('cookie') || req.headers.get('Cookie') || '';
  const m = /amane_s=([^;]+)/.exec(ck);
  if (m && st.sessions[m[1]]) return st.sessions[m[1]];
  return webUser(); // web : le navigateur ne nous laisse pas lire le cookie, on le simule (persistant au rechargement)
}
let currentWebUser: string | null = null;
function webUser(): string | null {
  if (currentWebUser) return currentWebUser;
  try { if (typeof localStorage !== 'undefined') currentWebUser = localStorage.getItem('amane.mock.user'); } catch { /* ignore */ }
  return currentWebUser;
}
function setWebUser(id: string | null) {
  currentWebUser = id;
  try { if (typeof localStorage !== 'undefined') { if (id) localStorage.setItem('amane.mock.user', id); else localStorage.removeItem('amane.mock.user'); } } catch { /* ignore */ }
}

function sinceFilter(rows: Doc[], since: string | null) {
  if (!since) return rows;
  const s = new Date(+new Date(since) - 2000).toISOString();
  return rows.filter((r) => String(r.updatedAt || r.createdAt || '') > s);
}

/* Missions fermes à venir confiées au partenaire (chauffeur ou étape du programme). */
function confiees(pid: string): Doc[] {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return st.cols.missions.filter((x) => ['confirmee', 'encours'].includes(x.statut) && (x.chauffeurId === pid || (x.programme || []).some((e: any) => e.partenaireId === pid)) && new Date(x.fin || x.debut) >= t0).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
}
/* « À relancer » (forme du serveur) : devis sans réponse et confirmations de prestataires, avec blocage pendant le délai. */
function relances(): any[] {
  const out: any[] = []; const now = Date.now(); const D = 864e5;
  const conv = (tel: string) => st.cols.conversations.find((c) => c.id === telNorm(tel));
  const open = (tel: string) => { const c = conv(tel); return !!(c && c.windowUntil && +new Date(c.windowUntil) > now && !st.windowClosedFor.has(c.id)); };
  for (const x of st.cols.missions) {
    const c = st.cols.clients.find((k) => k.id === x.clientId) || {};
    if (x.statut === 'proposition') out.push({ key: `proposition:${x.id}`, type: 'proposition', cible: 'client', clientId: x.clientId, missionId: x.id, nom: c.nom, tel: c.tel, lang: 'FR', fenetre: open(c.tel), raison: `Proposition « ${x.titre} » sans réponse`, messageSuggere: tr(c.langue || 'FR', 'relance.proposition', { prenom: firstName(c.nom), objet: x.titre }), depuis: x.updatedAt });
    const a = +new Date(x.debut);
    if (['confirmee', 'encours'].includes(x.statut) && a - now < 7 * D && a > now - D) {
      for (const pid of [x.chauffeurId, ...(x.programme || []).map((e: any) => e.partenaireId)].filter((v: any, i: number, arr: any[]) => v && arr.indexOf(v) === i)) {
        const pt = st.cols.partenaires.find((k) => k.id === pid); const cf = st.confirmations[`${x.id}:${pid}`];
        if (!pt || pt.actif === false || (cf && cf.debut === x.debut)) continue;
        out.push({ key: `prestataire:${x.id}:${pid}`, type: 'prestataire', cible: 'prestataire', clientId: x.clientId, missionId: x.id, partenaireId: pid, nom: pt.nom, tel: pt.tel, lang: 'FR', fenetre: open(pt.tel), raison: `${x.chauffeurId === pid ? 'Chauffeur non confirmé' : 'Prestation non confirmée'} — ${x.titre}`, messageSuggere: tr('FR', 'relance.prestataire', { prenom: firstName(pt.contact || pt.nom), date: new Date(a).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), objet: x.titre }), depuis: x.debut });
      }
    }
  }
  for (const x of out) {
    const d = st.relances.filter((r) => r.key === x.key).slice(-1)[0] || null; x.derniere = d;
    const delai = RELANCE_TYPES.find((t) => t.id === x.type)?.delai || 1;
    if (d && +new Date(d.at) + delai * D > now) x.bloqueeJusqua = new Date(+new Date(d.at) + delai * D).toISOString();
  }
  return out;
}

export async function handle(req: Request): Promise<Response> {
  const u = new URL(req.url, 'http://mock.local');
  const path = u.pathname; const method = req.method.toUpperCase();
  let body: any = {};
  if (method !== 'GET') { try { const t = await req.text(); body = t ? JSON.parse(t) : {}; } catch { return err(400, 'json_invalide', 'Corps JSON invalide.'); } }
  st.log.push({ method, path, body });
  if (st.offline) throw new TypeError('Network request failed');

  if (path === '/api/health') return json(200, { ok: true, db: true, auth: true, whatsapp: !st.whatsappOff, ia: !st.iaOff, version: 'mock' });

  // ----- Auth -----
  if (path === '/api/auth/setup' && method === 'POST') {
    if (body.code !== SETUP_CODE) return err(401, 'bad_code', 'Code d’installation incorrect.');
    if (!TEAM[body.userId] || !/^\d{4,8}$/.test(String(body.pin || ''))) return err(400, 'pin_invalide', 'Le code doit comporter 4 à 8 chiffres.');
    st.pins[body.userId] = String(body.pin); return json(200, { ok: true });
  }
  if (path === '/api/auth/login' && method === 'POST') {
    const id = String(body.userId || ''); const user = TEAM[id];
    if (!user) return err(401, 'bad_pin', 'Code incorrect.');
    if ((st.fails[id] || 0) >= 5) return err(429, 'trop_de_tentatives', 'Trop de tentatives. Patientez quinze minutes.');
    if (st.pins[id] == null) return err(409, 'no_pin', 'Aucun code n’a encore été créé pour cette personne.');
    if (String(body.pin) !== st.pins[id]) { st.fails[id] = (st.fails[id] || 0) + 1; return err(401, 'bad_pin', 'Code incorrect.'); }
    st.fails[id] = 0; const tok = `${id}.${Date.now()}.sig`; st.sessions[tok] = id; setWebUser(id);
    return json(200, { user }, { 'Set-Cookie': `amane_s=${tok}; Path=/; HttpOnly; SameSite=Lax` });
  }
  if (path === '/api/auth/logout' && method === 'POST') { setWebUser(null); return json(200, { ok: true }); }

  const me = userOf(req);
  if (!me) return err(401, 'non_connecte', 'Vous n’êtes plus connecté.');
  if (path === '/api/auth/me') return json(200, { user: TEAM[me] });

  // ----- Sync -----
  if (path === '/api/sync') {
    const since = u.searchParams.get('since');
    const changes: Record<string, Doc[]> = {};
    for (const c of ['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages', 'conversations', 'messages']) changes[c] = sinceFilter(st.cols[c], since).map(clone);
    const deleted: Record<string, string[]> = since ? st.deleted : {};
    const unread = st.cols.conversations.reduce((n, c) => n + (+c.unread || 0), 0);
    return json(200, { now: new Date().toISOString(), changes, deleted, compteurs: { nonLus: unread } });
  }

  // ----- Documents -----
  let m = /^\/api\/doc\/(\w+)\/([\w.-]+)$/.exec(path);
  if (m) {
    const [, col, id] = m;
    if (!['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages'].includes(col)) return err(404, 'introuvable', 'Collection inconnue.');
    const rows = st.cols[col]; const i = rows.findIndex((r) => r.id === id); const now = new Date().toISOString();
    if (method === 'PUT') {
      const prev = i >= 0 ? rows[i] : null;
      const doc: Doc = { ...body, id, createdAt: prev?.createdAt || now, updatedAt: now, updatedBy: me };
      delete doc._id; if (col === 'clients' || col === 'partenaires') doc.telNorm = String(doc.tel || '').replace(/\D/g, '').replace(/^0/, '33');
      if (i >= 0) rows[i] = doc; else rows.push(doc);
      st.deleted[col] = (st.deleted[col] || []).filter((x) => x !== id);
      return json(200, { id, updatedAt: now });
    }
    if (method === 'DELETE') { if (i >= 0) rows.splice(i, 1); (st.deleted[col] = st.deleted[col] || []).push(id); return json(200, { ok: true }); }
  }
  if (path === '/api/counter' && method === 'POST') { const k = String(body.key || ''); st.counters[k] = (st.counters[k] || 0) + 1; return json(200, { n: st.counters[k] }); }
  if (path === '/api/activity') { const d = u.searchParams.get('docId'); const items = st.cols.activity.filter((a) => !d || a.docId === d).slice(0, 50); return json(200, { items }); }

  // ----- Photos & médias -----
  if (path === '/api/photo' && method === 'POST') {
    const du = String(body.dataUrl || ''); if (!/^data:image\/(jpeg|png|webp);base64,/.test(du)) return err(400, 'format', 'Image JPEG, PNG ou WebP attendue.');
    if (du.length > 600 * 1024 * 1.37) return err(413, 'trop_lourd', 'Image trop lourde (600 Ko max).');
    const id = 'ph_' + Math.random().toString(36).slice(2, 10); st.photos[id] = du; return json(200, { id, url: `/api/photo?id=${id}` });
  }
  if (path === '/api/photo' && method === 'GET') { const id = u.searchParams.get('id') || ''; const du = st.photos[id]; return du ? new Response(du, { status: 200 }) : err(404, 'introuvable', 'Photo inconnue.'); }
  if (path.startsWith('/api/media/')) return new Response(new Uint8Array([0]), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });

  // ----- WhatsApp -----
  if (path === '/api/whatsapp/send' && method === 'POST') {
    if (st.whatsappOff) return err(503, 'whatsapp_off', 'WhatsApp n’est pas encore relié au serveur.');
    const cv = st.cols.conversations.find((c) => c.id === body.convId); if (!cv) return err(404, 'introuvable', 'Conversation inconnue.');
    const open = cv.windowUntil && new Date(cv.windowUntil) > new Date() && !st.windowClosedFor.has(cv.id);
    if (!open && !body.template) return err(409, 'window_closed', 'Fenêtre de 24 h fermée : envoyez le modèle approuvé.');
    const id = 'out_' + Math.random().toString(36).slice(2, 10); const at = new Date().toISOString();
    let text = body.text || ''; let type = 'text';
    if (body.template) { type = 'template'; text = `[Modèle ${body.template.name}] ${(body.template.params || []).join(' · ')}`; }
    else if (body.media) { type = body.media.type || 'image'; text = body.media.caption || ''; }
    else if (body.location) { type = 'location'; text = body.location.name || body.location.address || ''; }
    else if (body.contact) { type = 'contacts'; const p = st.cols.partenaires.find((x) => x.id === body.contact.partenaireId); text = p ? p.nom : 'Contact'; }
    const msg: Doc = { id, convId: cv.id, dir: 'out', type, text, at, status: 'envoye', by: me, createdAt: at, updatedAt: at };
    if (body.media) msg.media = { id: body.media.photoId || body.media.url || 'x', mime: type === 'document' ? 'application/pdf' : 'image/jpeg', filename: body.media.filename, caption: body.media.caption };
    if (body.location) msg.location = body.location; if (body.template) msg.template = body.template;
    st.cols.messages.push(msg); st.outbox.push({ ...body, id });
    Object.assign(cv, { lastAt: at, lastText: text, lastDir: 'out', unread: 0, lastOutAt: at, updatedAt: at });
    return json(200, { id });
  }
  if ((path === '/api/whatsapp/note' || path === '/api/whatsapp/assign') && method === 'POST') {
    // note interne (dir:'note', jamais envoyée au client) et « qui s'en occupe », comme apps/api
    const cv = st.cols.conversations.find((c) => c.id === body.convId); if (!cv) return err(404, 'introuvable', 'Conversation inconnue.');
    const at = new Date().toISOString(); let id = '';
    const text = typeof (path.endsWith('note') ? body.text : body.note) === 'string' ? String(path.endsWith('note') ? body.text : body.note).trim() : '';
    if (path.endsWith('note') && !text) return err(400, 'texte_vide', 'Note vide.');
    if (text) { id = 'note_' + Math.random().toString(36).slice(2, 10); st.cols.messages.push({ id, convId: cv.id, dir: 'note', type: 'note', text, at, status: 'recu', by: me, createdAt: at, updatedAt: at }); }
    if (body.assigne !== undefined) { const who = body.assigne ? String(body.assigne).toLowerCase() : ''; if (who && !TEAM[who]) return err(400, 'utilisateur_inconnu', 'Prénom inconnu.'); cv.assigne = who; cv.updatedAt = at; }
    return path.endsWith('note') ? json(200, { id }) : json(200, { ok: true, assigne: cv.assigne || '' });
  }
  if (path === '/api/whatsapp/read' && method === 'POST') { const cv = st.cols.conversations.find((c) => c.id === body.convId); if (cv) { cv.unread = 0; cv.updatedAt = new Date().toISOString(); } return json(200, { ok: true }); }

  // ----- IA -----
  if (path === '/api/translate' && method === 'POST') {
    if (st.iaOff) return err(503, 'ia_off', 'L’IA n’est pas activée sur le serveur.');
    const to = String(body.to || 'EN').toUpperCase(); const text = String(body.text || '');
    const pre: Record<string, string> = { EN: '[EN] ', AR: '[AR] ', ES: '[ES] ', RU: '[RU] ', FR: '', IT: '[IT] ', DE: '[DE] ', ZH: '[ZH] ' };
    return json(200, { text: (pre[to] ?? `[${to}] `) + text, from: body.from || 'FR', cached: false });
  }
  if (path === '/api/transcribe' && method === 'POST') {
    const msg = st.cols.messages.find((x) => x.media && x.media.id === body.mediaId);
    return json(200, { text: msg?.transcript || 'Transcription simulée.', lang: 'AR' });
  }
  if (path === '/api/ai' && method === 'POST') return st.iaOff ? err(503, 'ia_off', 'L’IA n’est pas activée.') : json(200, { text: 'Bonjour, nous avons le plaisir de vous confirmer votre demande. Amane' });
  if (path === '/api/relances') return json(200, { items: relances() });
  if ((path === '/api/relances/envoyer' || path === '/api/relances/marquer') && method === 'POST') {
    const manuel = path.endsWith('marquer'); if (!manuel && st.whatsappOff) return err(503, 'whatsapp_off', 'WhatsApp n’est pas configuré sur ce serveur.');
    const it = relances().find((x) => x.key === body.key); if (!it) return err(404, 'introuvable', 'Plus rien à relancer ici.');
    if (it.bloqueeJusqua) return err(409, 'deja_relance', `Déjà relancé par ${TEAM[it.derniere.by]?.nom || 'l’équipe'}. Attendez la réponse avant de relancer.`);
    const at = new Date().toISOString(); const canal = manuel ? 'manuel' : it.fenetre ? 'texte' : 'modele';
    const r = { id: `${it.key}#${st.relances.filter((x) => x.key === it.key).length + 1}`, key: it.key, type: it.type, cible: it.cible, clientId: it.clientId, missionId: it.missionId, partenaireId: it.partenaireId, statut: manuel ? 'manuel' : 'envoye', canal, texte: manuel ? '' : String(body.texte || it.messageSuggere), by: me, at };
    st.relances.push(r); if (!manuel) st.outbox.push({ to: telNorm(it.tel), type: canal === 'modele' ? 'template' : 'text', text: r.texte, relance: it.type });
    return json(200, { ok: true, relance: r, canal });
  }
  if (path === '/api/relances/historique') { const k = ['clientId', 'missionId', 'partenaireId'].find((x) => u.searchParams.get(x)); if (!k) return err(400, 'fiche_invalide', 'Indiquez la fiche.'); return json(200, { items: st.relances.filter((r) => r[k] === u.searchParams.get(k)).reverse() }); }
  m = /^\/api\/partenaires\/([\w-]+)\/espace$/.exec(path);
  if (m) {
    const pid = m[1]; const pt = st.cols.partenaires.find((x) => x.id === pid); if (!pt) return err(404, 'introuvable', 'Partenaire introuvable.');
    const url = (tk: string) => `https://amane.paris/api/prestataire/${tk}`;
    if (method === 'DELETE') { const had = !!st.acces[pid]; delete st.acces[pid]; return json(200, { ok: true, revoked: had }); }
    if (method === 'POST') { const created = !st.acces[pid] || body.renouveler === true; if (created) st.acces[pid] = { token: ('tk' + pid + Date.now().toString(36) + 'xxxxxxxxxxxxxxxxxxxxxxxx').slice(0, 24), createdAt: new Date().toISOString(), createdBy: me, vues: 0 }; return json(200, { token: st.acces[pid].token, url: url(st.acces[pid].token), created }); }
    const a = st.acces[pid]; const ms = confiees(pid).map((x) => { const c = st.confirmations[`${x.id}:${pid}`]; return { id: x.id, debut: x.debut, titre: x.titre, ...(c && c.debut === x.debut ? { confirmeeAt: c.at } : {}) }; });
    return json(200, a ? { actif: true, url: url(a.token), createdAt: a.createdAt, createdBy: a.createdBy, vues: a.vues, missions: ms } : { actif: false, missions: ms });
  }
  m = /^\/api\/missions\/([\w-]+)\/confirmation$/.exec(path);
  if (m && method === 'POST') { const ms = confiees(String(body.partenaireId || '')).find((x) => x.id === m![1]); if (!ms) return err(409, 'non_confiee', 'Cette mission n’est pas confiée à ce prestataire.'); const k = `${ms.id}:${body.partenaireId}`; if (body.confirme === false) delete st.confirmations[k]; else st.confirmations[k] = { at: new Date().toISOString(), debut: ms.debut }; return json(200, { ok: true, confirme: body.confirme !== false }); }

  // ----- Push, espace client, devis -----
  if (path === '/api/push/register' && method === 'POST') { st.pushTokens.push(body); return json(200, { ok: true }); }
  m = /^\/api\/espace\/([\w-]+)$/.exec(path);
  if (m) {
    const ms = st.cols.missions.find((x) => x.espaceToken === m![1] || x.id === 'm_haddad');
    if (!ms) return err(404, 'introuvable', 'Séjour introuvable.');
    const c = st.cols.clients.find((x) => x.id === ms.clientId); const ch = st.cols.partenaires.find((x) => x.id === ms.chauffeurId);
    return json(200, { mission: { titre: ms.titre, debut: ms.debut, fin: ms.fin, lieu: ms.lieu, programme: ms.programme }, client: { nom: c?.nom, langue: c?.langue }, chauffeur: ch ? { nom: ch.nom, tel: ch.tel, photo: ch.photo } : null, documents: [{ type: 'devis', numero: ms.devis?.numero, url: '/d/mock' }], solde: 1260, contact: { tel: '+33600000000' } });
  }
  m = /^\/api\/missions\/([\w-]+)\/espace$/.exec(path);
  if (m && method === 'POST') { const ms = st.cols.missions.find((x) => x.id === m![1]); if (!ms) return err(404, 'introuvable', 'Demande inconnue.'); ms.espaceToken = ms.espaceToken || 'tok_' + ms.id; return json(200, { token: ms.espaceToken, url: `/espace/${ms.espaceToken}` }); }
  m = /^\/api\/devis\/([\w-]+)\/share$/.exec(path);
  if (m) { return json(200, { token: 'dv_' + m[1], url: `/d/dv_${m[1]}` }); }
  if (path === '/api/flotte/rentabilite') return json(200, { items: st.cols.vehicules.map((v) => ({ vehiculeId: v.id, nom: v.nom, loyer: +v.loyerMois || 0, charges: +v.chargesMois || 0, joursLoues: 6, ca: (+v.tarifJour || 0) * 6, couts: 300, marge: (+v.tarifJour || 0) * 6 - (+v.loyerMois || 0) - (+v.chargesMois || 0) - 300, occupation: 20 })) });

  return err(404, 'introuvable', 'Route inconnue.');
}

let installed = false; let realFetch: typeof fetch | null = null;
/** Remplace `fetch` pour les chemins `/api/*` (et `http://mock.local/api/*`). Les autres URL passent au vrai fetch. */
export function installMockFetch(): void {
  if (installed) return; installed = true;
  realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isApi = /^(https?:\/\/[^/]+)?\/api\//.test(url) || /^\/api\//.test(url);
    if (!isApi) return realFetch ? realFetch(input as any, init) : Promise.reject(new TypeError('fetch indisponible'));
    const abs = /^https?:/.test(url) ? url : 'http://mock.local' + url;
    return handle(new Request(abs, init));
  }) as typeof fetch;
}
export function uninstallMockFetch(): void { if (installed && realFetch) { globalThis.fetch = realFetch; installed = false; } }
