/* Faux serveur en mémoire, conforme à docs/crm-serveur.md + docs/architecture-v2.md.
   Utilisé par msw (navigateur et Vitest). Pure fonction `handle()` + bus d'événements « WebSocket ». */
import { seed } from './seed';
import { STATUTS, CLIENT_STATUTS, devisTotals, telNorm, detectLang, t as tr, devisDoc } from '../shared';

export type Res = { status: number; body?: unknown; html?: string; headers?: Record<string, string> };
export type WsEvent = Record<string, unknown> & { type: string };
type Doc = Record<string, unknown> & { id: string; updatedAt?: string; _deleted?: boolean };

const DOC_COLS = ['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages', 'conversations'];
const TEAM: Record<string, { id: string; nom: string; role: string }> = { amel: { id: 'amel', nom: 'Amel', role: 'Relation client' }, youssouf: { id: 'youssouf', nom: 'Youssouf', role: 'Tech & flotte' }, aziz: { id: 'aziz', nom: 'Aziz', role: 'Contrats & conformité' } };
const SETUP_CODE = '0000';

export interface FakeState {
  db: Record<string, Map<string, Doc>>; activity: Doc[]; compteurs: Record<string, number>; pins: Record<string, string>; session: string | null;
  photos: Map<string, string>; shares: Map<string, string>; espaces: Map<string, string>; translations: Map<string, string>; outbox: Doc[]; fails: number;
  offline: boolean; windowClosed: Set<string>; iaOn: boolean; whatsappOn: boolean;
}
const listeners = new Set<(e: WsEvent) => void>();
export const bus = { on(f: (e: WsEvent) => void) { listeners.add(f); return () => { listeners.delete(f); }; }, emit(e: WsEvent) { listeners.forEach((f) => { try { f(e); } catch { /* ignore */ } }); } };

export let S: FakeState;
/* Persistance entre rechargements de page (Playwright navigue avec page.goto) : sessionStorage. */
const SS = 'amane.mock.state';
function persist() { try { if (typeof sessionStorage === 'undefined') return; const o: Record<string, unknown> = {}; (['db'] as const).forEach(() => { }); const db: Record<string, Doc[]> = {}; Object.entries(S.db).forEach(([c, m]) => { db[c] = [...m.values()]; }); o.db = db; o.activity = S.activity; o.compteurs = S.compteurs; o.pins = S.pins; o.session = S.session; o.shares = [...S.shares]; o.espaces = [...S.espaces]; o.outbox = S.outbox.slice(-50); o.offline = S.offline; o.windowClosed = [...S.windowClosed]; sessionStorage.setItem(SS, JSON.stringify(o)); } catch { /* ignore */ } }
function restore(): boolean { try { if (typeof sessionStorage === 'undefined') return false; const raw = sessionStorage.getItem(SS); if (!raw) return false; const o = JSON.parse(raw); Object.entries(o.db as Record<string, Doc[]>).forEach(([c, arr]) => { S.db[c] = new Map(arr.map((x) => [x.id, x])); }); S.activity = o.activity || []; S.compteurs = o.compteurs || {}; S.pins = o.pins || S.pins; S.session = o.session || null; S.shares = new Map(o.shares || []); S.espaces = new Map(o.espaces || []); S.outbox = o.outbox || []; S.offline = !!o.offline; S.windowClosed = new Set(o.windowClosed || []); return true; } catch { return false; } }
function fresh(): FakeState {
  const d = seed();
  const db: Record<string, Map<string, Doc>> = {};
  (['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages', 'conversations', 'messages'] as const).forEach((c) => { db[c] = new Map((d[c] as Doc[]).map((x) => [x.id, x])); });
  S = { db, activity: d.activity as Doc[], compteurs: { ...d.compteurs }, pins: { amel: '1234', youssouf: '1234', aziz: '1234' }, session: null, photos: new Map(), shares: new Map(), espaces: new Map(), translations: new Map(), outbox: [], fails: 0, offline: false, windowClosed: new Set(), iaOn: true, whatsappOn: true };
  return S;
}
/** Repart de l'état d'exemple (tests). */
export function reset(): FakeState { fresh(); try { sessionStorage.removeItem(SS); } catch { /* ignore */ } return S; }
fresh(); restore();
const now = () => new Date().toISOString();
const err = (status: number, error: string, message: string): Res => ({ status, body: { error, message } });
const ok = (body: unknown): Res => ({ status: 200, body });
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const label = (arr: readonly { id: string; label: string }[], id: unknown) => (arr.find((x) => x.id === id) || {}).label || String(id || '—');
const titleOf = (col: string, d: Doc) => String(d.titre || d.nom || d.id);

function act(user: string, col: string, docId: string, action: string, resume: string) {
  const a = { id: uid(), at: now(), user, col, docId, action, resume }; S.activity.unshift(a);
}
function diffResume(col: string, before: Doc | undefined, after: Doc): string {
  if (!before) return 'Création : ' + titleOf(col, after);
  const parts: string[] = [];
  if (before.statut !== after.statut) { const L = col === 'missions' ? STATUTS : CLIENT_STATUTS; parts.push(`statut : ${label(L, before.statut)} → ${label(L, after.statut)}`); }
  const changed = Object.keys({ ...before, ...after }).filter((k) => !['updatedAt', 'updatedBy', 'createdAt', 'telNorm', 'id', 'statut'].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const names = [...new Set(changed.map((k) => (k === 'debut' || k === 'fin' ? 'dates' : k)))];
  if (names.length) parts.push('modifié : ' + names.join(', '));
  return parts.join(' ; ');
}

/* Traduction simulée : dictionnaire pour les exemples, sinon marquage. */
const DICT: Record<string, string> = {
  'نريد سيارة أوروس مع سائق يوم السبت مساءً، من الفور سيزونز إلى الليدو': 'Nous voudrions un Urus avec chauffeur samedi soir, du Four Seasons au Lido.',
  'شكراً جزيلاً': 'Merci beaucoup.',
};
function translate(text: string, to: string, from?: string) {
  const key = (from || '') + '|' + to + '|' + text;
  if (S.translations.has(key)) return { text: S.translations.get(key)!, from: from || detectLang(text) || 'FR', cached: true };
  const src = from || detectLang(text) || 'FR';
  let out: string;
  if (DICT[text]) out = DICT[text];
  else if (to.toUpperCase() === src.toUpperCase()) out = text;
  else if (to.toUpperCase() === 'FR') out = '[FR] ' + text;
  else out = ({ AR: 'مرحباً، ', EN: 'Dear guest, ', ES: 'Estimado cliente, ', RU: 'Здравствуйте, ' }[to.toUpperCase()] || '') + text;
  S.translations.set(key, out); return { text: out, from: src, cached: false };
}

export function handle(method: string, rawUrl: string, body: unknown, opts?: { cookie?: string }): Res {
  const r = handle0(method, rawUrl, body, opts); if (method !== 'GET') persist(); return r;
}
function handle0(method: string, rawUrl: string, body: unknown, opts?: { cookie?: string }): Res {
  if (S.offline) throw new Error('offline');
  const u = new URL(rawUrl, 'http://amane.local'); const p = u.pathname.replace(/^\/app(?=\/)/, ''); const q = u.searchParams;
  const B = (body || {}) as Record<string, unknown>;
  const user = S.session ? TEAM[S.session] : null;
  const need = (): Res | null => (user ? null : err(401, 'non_connecte', 'Connectez-vous.'));

  /* Santé, auth */
  if (p === '/api/health') return ok({ ok: true, db: true, auth: true, whatsapp: S.whatsappOn, ia: S.iaOn, version: 'mock-2.0' });
  if (p === '/api/auth/setup' && method === 'POST') { if (B.code !== SETUP_CODE) return err(401, 'bad_code', 'Code d’installation incorrect.'); if (!TEAM[String(B.userId)]) return err(400, 'json_invalide', 'Utilisateur inconnu.'); if (!/^\d{4,8}$/.test(String(B.pin))) return err(400, 'json_invalide', 'PIN invalide.'); S.pins[String(B.userId)] = String(B.pin); return ok({ ok: true }); }
  if (p === '/api/auth/login' && method === 'POST') {
    const id = String(B.userId || ''); if (!TEAM[id]) return err(401, 'bad_pin', 'Code incorrect.');
    if (S.fails >= 5) return err(429, 'trop_de_tentatives', 'Trop d’essais. Réessayez dans un quart d’heure.');
    if (!S.pins[id]) return err(409, 'no_pin', 'Code jamais créé.');
    if (S.pins[id] !== String(B.pin)) { S.fails++; return err(401, 'bad_pin', 'Code incorrect.'); }
    S.fails = 0; S.session = id; try { sessionStorage.setItem('amane.mock.session', id); } catch { /* ignore */ }
    return { status: 200, body: { user: TEAM[id] }, headers: { 'set-cookie': `amane_s=${id}; Path=/; SameSite=Lax` } };
  }
  if (p === '/api/auth/logout' && method === 'POST') { S.session = null; try { sessionStorage.removeItem('amane.mock.session'); } catch { /* ignore */ } return ok({ ok: true }); }
  if (p === '/api/auth/me') { if (!S.session) { try { const s = sessionStorage.getItem('amane.mock.session'); if (s && TEAM[s]) S.session = s; } catch { /* ignore */ } } return S.session ? ok({ user: TEAM[S.session] }) : err(401, 'non_connecte', 'Non connecté.'); }
  if (p === '/api/lead' && method === 'POST') { if (B.website) return ok({ ok: true }); if (!B.tel && !B.email) return err(400, 'contact_requis', 'Téléphone ou e-mail requis.'); const cid = uid(); S.db.clients.set(cid, { id: cid, nom: String(B.nom || 'Visiteur'), tel: String(B.tel || ''), email: String(B.email || ''), canal: 'Site', statut: 'prospect', langue: String(B.langue || 'FR'), responsable: 'amel', createdAt: now(), updatedAt: now(), updatedBy: 'site' }); const mid = uid(); S.db.missions.set(mid, { id: mid, titre: 'Site — ' + String(B.nom || 'Visiteur'), clientId: cid, statut: 'nouvelle', source: 'site', canal: 'Site', responsable: 'amel', service: String(B.service || 'location'), debut: String(B.date || ''), fin: '', notes: String(B.message || ''), createdAt: now(), updatedAt: now(), updatedBy: 'site' }); act('site', 'missions', mid, 'lead', 'Demande reçue du site : ' + String(B.nom || 'Visiteur')); bus.emit({ type: 'change', col: 'missions', doc: S.db.missions.get(mid) }); return ok({ ok: true }); }

  /* Pages publiques */
  const md = p.match(/^\/d\/([A-Za-z0-9_-]+)(\/accepter)?$/);
  if (md) { const mid = S.shares.get(md[1]); const m = mid && S.db.missions.get(mid); if (!m) return { status: 404, html: '<h1>Lien expiré</h1>' };
    const dv = (m.devis || {}) as Record<string, unknown>; const c = (S.db.clients.get(String(m.clientId)) || {}) as Doc; const L = String(c.langue || 'EN').toUpperCase();
    if (md[2] && method === 'POST') { dv.statut = 'accepte'; dv.acceptedAt = now(); m.devis = dv; m.updatedAt = now(); m.updatedBy = 'client'; act('client', 'missions', m.id, 'update', `Devis ${dv.numero} accepté par le client via le lien`); bus.emit({ type: 'change', col: 'missions', doc: m }); bus.emit({ type: 'alerte', text: `Devis ${dv.numero} accepté par ${c.nom}` }); return ok({ ok: true }); }
    if (!dv.vuAt) { dv.vuAt = now(); m.devis = dv; m.updatedAt = now(); bus.emit({ type: 'change', col: 'missions', doc: m }); }
    const accepted = dv.statut === 'accepte'; const mz = S.db.reglages ? S.db.reglages.get('maison') : undefined;
    const after = accepted ? `<div class="panel"><p class="ok">${tr(L, 'doc.accepted')}</p></div>` : `<div class="btns"><form method="post" action="/d/${md[1]}/accepter" style="display:contents"><button class="btn" type="submit" id="accept">${tr(L, 'doc.accept')}</button></form></div>`;
    return { status: 200, html: devisDoc({ mission: m as never, client: c as never, kind: 'devis', maison: (mz || null) as never, after }) };
  }
  const me = p.match(/^\/api\/espace\/([A-Za-z0-9_-]+)$/);
  if (me) { const mid = S.espaces.get(me[1]); const m = mid && S.db.missions.get(mid); if (!m) return err(404, 'introuvable', 'Lien inconnu.'); const c = (S.db.clients.get(String(m.clientId)) || {}) as Doc; const ch = S.db.partenaires.get(String(m.chauffeurId)); return ok({ mission: { titre: m.titre, debut: m.debut, fin: m.fin, lieu: m.lieu }, client: { nom: c.nom, langue: c.langue }, programme: m.programme || [], chauffeur: ch ? { nom: ch.nom, tel: ch.tel, photo: ch.photo } : null, documents: m.devis ? [{ type: 'devis', numero: (m.devis as Record<string, unknown>).numero }] : [], solde: devisTotals(m.devis as never).solde }); }

  /* Session requise */
  const n = need(); if (n) return n;
  const uid0 = user!.id;

  if (p === '/api/sync') {
    const since = q.get('since') || ''; const changes: Record<string, Doc[]> = {}; const deleted: Record<string, string[]> = {}; const cutoff = since ? new Date(new Date(since).getTime() - 2000).toISOString() : '';
    const limit = new Date(Date.now() - 60 * 864e5).toISOString();
    Object.entries(S.db).forEach(([c, m]) => { changes[c] = []; deleted[c] = []; m.forEach((d) => { if (cutoff && String(d.updatedAt || '') < cutoff) return; if (d._deleted) { deleted[c].push(d.id); return; } if (!since && c === 'messages' && String(d.at || d.updatedAt) < limit) return; changes[c].push(d); }); });
    return ok({ now: now(), changes, deleted, compteurs: S.compteurs });
  }
  const mdoc = p.match(/^\/api\/doc\/([a-z]+)\/([^/]+)$/);
  if (mdoc) {
    const col = mdoc[1], id = decodeURIComponent(mdoc[2]); if (!DOC_COLS.includes(col)) return err(400, 'json_invalide', 'Collection inconnue.');
    const m = S.db[col]; const before = m.get(id);
    if (method === 'DELETE') { if (before) { const d = { ...before, _deleted: true, updatedAt: now(), updatedBy: uid0 }; m.set(id, d); act(uid0, col, id, 'delete', 'Suppression : ' + titleOf(col, before)); bus.emit({ type: 'deleted', col, id }); } return ok({ ok: true }); }
    if (method === 'PUT') {
      if (JSON.stringify(B).length > 512 * 1024) return err(413, 'trop_lourd', 'Fiche trop volumineuse.');
      const d: Doc = { ...B, id, updatedAt: now(), updatedBy: uid0, createdAt: (before && !before._deleted ? before.createdAt : B.createdAt) || now() } as Doc;
      delete d._deleted; if (col === 'clients' || col === 'partenaires') d.telNorm = telNorm(String(d.tel || ''));
      const resume = diffResume(col, before && !before._deleted ? before : undefined, d);
      m.set(id, d); if (resume) act(uid0, col, id, before && !before._deleted ? 'update' : 'create', resume);
      bus.emit({ type: 'change', col, doc: d });
      return ok({ id, updatedAt: d.updatedAt });
    }
  }
  if (p === '/api/counter' && method === 'POST') { const k = String(B.key || ''); if (!k) return err(400, 'json_invalide', 'Clé requise.'); S.compteurs[k] = (S.compteurs[k] || 0) + 1; return ok({ n: S.compteurs[k] }); }
  if (p === '/api/activity') { const docId = q.get('docId'); const lim = +(q.get('limit') || 50); return ok({ items: S.activity.filter((a) => !docId || a.docId === docId).slice(0, lim) }); }
  if (p === '/api/photo' && method === 'POST') { const du = String(B.dataUrl || ''); if (!/^data:image\/(jpeg|png|webp);base64,/.test(du)) return err(400, 'json_invalide', 'Image attendue.'); if (du.length > 820000) return err(413, 'trop_lourd', 'Image trop lourde (600 Ko max).'); const id = uid(); S.photos.set(id, du); return ok({ id, url: '/api/photo?id=' + id }); }
  if (p === '/api/photo' && method === 'GET') { const du = S.photos.get(q.get('id') || ''); return du ? { status: 200, html: du, headers: { 'content-type': 'image/jpeg', 'x-dataurl': '1' } } : err(404, 'introuvable', 'Photo inconnue.'); }
  if (p.startsWith('/api/media/')) return { status: 200, html: 'media', headers: { 'content-type': 'application/octet-stream' } };
  if (p === '/api/ai' && method === 'POST') {
    if (!S.iaOn) return err(503, 'ia_off', 'Majordome non activé.');
    const msgs = (B.messages as { content: string }[]) || []; const prompt = String(msgs[msgs.length - 1]?.content || '');
    if (/JSON/.test(prompt)) return ok({ text: JSON.stringify({ client: { nom: 'Khalid Al-Mansoori', tel: '+971 50 987 6543', email: '', langue: 'AR', pays: 'Émirats arabes unis', hotel: 'Plaza Athénée' }, mission: { titre: 'Van + chauffeur, 12 au 15', service: 'van', vehicule: 'Classe V', debut: '', fin: '', lieu: 'Plaza Athénée', budget: 3000, notes: 'Famille de 5' }, priorite: 'haute', reponse: 'مرحباً، شكراً لرسالتكم. يسعدنا تنظيم تنقلاتكم في باريس. Amane' }) });
    return ok({ text: 'Bonjour, nous avons le plaisir de vous confirmer votre réservation. Votre chauffeur vous attendra à l’heure convenue. Nous restons à votre disposition.\n\nAmane' });
  }
  if (p === '/api/translate' && method === 'POST') { if (!S.iaOn) return err(503, 'ia_off', 'Traduction indisponible.'); const text = String(B.text || ''); if (!text.trim()) return err(400, 'json_invalide', 'Texte requis.'); return ok(translate(text, String(B.to || 'FR'), B.from ? String(B.from) : undefined)); }
  if (p === '/api/transcribe' && method === 'POST') { const id = String(B.mediaId || ''); if (id === 'med_voice_chen') return ok({ text: 'Hello, I would like a personal shopper on Thursday for leather goods on rue du Faubourg Saint-Honoré, with an interpreter if possible.', lang: 'EN' }); return err(503, 'transcribe_off', 'Transcription indisponible.'); }
  if (p === '/api/whatsapp/read' && method === 'POST') { const cv = S.db.conversations.get(String(B.convId)); if (cv) { cv.unread = 0; cv.updatedAt = now(); bus.emit({ type: 'conversation', conversation: cv }); } return ok({ ok: true }); }
  if (p === '/api/whatsapp/assign' && method === 'POST') { const cv = S.db.conversations.get(String(B.convId)); if (!cv) return err(404, 'introuvable', 'Conversation inconnue.'); cv.assigne = String(B.assigne || ''); cv.updatedAt = now(); bus.emit({ type: 'conversation', conversation: cv }); return ok({ ok: true, assigne: cv.assigne }); }
  if ((p === '/api/whatsapp/send' || p === '/api/whatsapp/note') && method === 'POST') {
    if (!S.whatsappOn) return err(503, 'whatsapp_off', 'WhatsApp non configuré.');
    const cv = S.db.conversations.get(String(B.convId)); if (!cv) return err(404, 'introuvable', 'Conversation inconnue.');
    if (B.note) { B.text = B.note; } if (p === '/api/whatsapp/note' || B.noteOnly) { const id = 'note.' + uid(); const at = now(); const msg: Doc = { id, convId: cv.id, dir: 'note', type: 'note', text: String(B.text || ''), at, status: 'recu', by: uid0, createdAt: at, updatedAt: at }; S.db.messages.set(id, msg); if (B.assigne !== undefined) { cv.assigne = B.assigne; cv.updatedAt = at; bus.emit({ type: 'conversation', conversation: cv }); } bus.emit({ type: 'message', message: msg }); return ok({ id }); }
    const win = cv.windowUntil && new Date(String(cv.windowUntil)) > new Date() && !S.windowClosed.has(cv.id);
    if (!B.template && !win) return err(409, 'window_closed', 'Fenêtre de 24 h fermée : envoyez un modèle.');
    const id = 'out.' + uid(); const at = now(); let text = String(B.text || '');
    const tpl = B.template as { name: string; lang: string; params: string[] } | undefined; if (tpl) text = `[Modèle ${tpl.name}] ${(tpl.params || []).join(' · ')}`;
    const media = B.media as Record<string, unknown> | undefined; const loc = B.location as Record<string, unknown> | undefined; const contact = B.contact as { partenaireId: string } | undefined;
    const msg: Doc = { id, convId: cv.id, dir: 'out', type: tpl ? 'template' : media ? String(media.type) : loc ? 'location' : contact ? 'contacts' : 'text', text, at, status: 'envoye', by: uid0, createdAt: at, updatedAt: at };
    if (media) msg.media = { id: String(media.photoId || media.url || ''), mime: media.type === 'image' ? 'image/jpeg' : 'application/pdf', filename: media.filename, caption: media.caption };
    if (loc) msg.location = loc; if (contact) { const pt = S.db.partenaires.get(contact.partenaireId); msg.contacts = [{ name: String(pt?.nom || ''), phones: [String(pt?.tel || '')] }]; msg.text = 'Contact : ' + String(pt?.nom || ''); }
    if (tpl) msg.template = tpl; if (B.lang) msg.lang = B.lang; if (B.originalText) { msg.originalText = String(B.originalText); msg.translation = String(B.originalText); }
    S.db.messages.set(id, msg); S.outbox.push(msg); cv.lastAt = at; cv.lastText = text || (media ? '📎 ' + (media.filename || 'photo') : loc ? '📍 Position' : 'Contact'); cv.lastDir = 'out'; cv.unread = 0; cv.lastOutAt = at; cv.updatedAt = at;
    act(uid0, 'conversations', cv.id, 'whatsapp', 'Message envoyé à ' + String(cv.nom || cv.id));
    bus.emit({ type: 'message', message: msg }); bus.emit({ type: 'conversation', conversation: cv });
    setTimeout(() => { const m2 = S.db.messages.get(id); if (m2) { m2.status = 'distribue'; m2.updatedAt = now(); bus.emit({ type: 'message', message: m2 }); } }, 700);
    return ok({ id });
  }
  if (p === '/api/relances') {
    const items: unknown[] = []; const nowD = Date.now();
    S.db.missions.forEach((m) => {
      if (m._deleted) return; const c = (S.db.clients.get(String(m.clientId)) || {}) as Doc; const L = String(c.langue || 'FR');
      if (m.statut === 'proposition' && nowD - new Date(String(m.updatedAt)).getTime() > 48 * 36e5) items.push({ type: 'proposition', clientId: m.clientId, missionId: m.id, raison: `Proposition sans réponse depuis ${Math.round((nowD - new Date(String(m.updatedAt)).getTime()) / 864e5)} j`, messageSuggere: tr(L, 'relance.proposition', { prenom: String(c.nom || '').split(' ').pop(), objet: m.titre }), depuis: m.updatedAt });
      const dv = m.devis as Record<string, unknown> | undefined; if (dv && dv.factureNumero && devisTotals(dv as never).solde > 0 && nowD - new Date(String(dv.factureDate)).getTime() > 7 * 864e5) items.push({ type: 'facture', clientId: m.clientId, missionId: m.id, raison: `Facture ${dv.factureNumero} en retard`, messageSuggere: `Bonjour, sauf erreur de notre part, la facture ${dv.factureNumero} reste à régler. Amane`, depuis: dv.factureDate });
      const a = new Date(String(m.debut)).getTime(); if (['confirmee'].includes(String(m.statut)) && m.paiement === 'non' && a - nowD < 3 * 864e5 && a > nowD) items.push({ type: 'acompte', clientId: m.clientId, missionId: m.id, raison: 'Acompte non reçu à J-3', messageSuggere: 'Bonjour, afin de confirmer votre réservation, nous attendons votre acompte. Amane', depuis: m.updatedAt });
    });
    S.db.clients.forEach((c) => { if (c._deleted) return; const last = [...S.db.missions.values()].filter((m) => m.clientId === c.id).map((m) => new Date(String(m.debut)).getTime()).sort((a, b) => b - a)[0];
      if (c.statut === 'habitue' && last && nowD - last > 90 * 864e5) items.push({ type: 'habitue', clientId: c.id, raison: 'Habitué sans mission depuis plus de 90 jours', messageSuggere: tr(String(c.langue || 'FR'), 'relance.habitue', { prenom: String(c.nom || '').split(' ').pop() }), depuis: new Date(last).toISOString() });
      if (c.naissance) { const b = new Date(String(c.naissance)); const t0 = new Date(); let nx = new Date(t0.getFullYear(), b.getMonth(), b.getDate()); if (nx < t0) nx = new Date(t0.getFullYear() + 1, b.getMonth(), b.getDate()); const dd = Math.round((+nx - +t0) / 864e5); if (dd <= 21) items.push({ type: 'anniversaire', clientId: c.id, raison: `Anniversaire dans ${dd} jour${dd > 1 ? 's' : ''}`, messageSuggere: 'Toute la maison Amane vous souhaite un très bel anniversaire.', depuis: nx.toISOString() }); } });
    return ok({ items });
  }
  const msh = p.match(/^\/api\/devis\/([^/]+)\/share$/);
  if (msh) { const mid = decodeURIComponent(msh[1]); const m = S.db.missions.get(mid); if (!m || !m.devis) return err(404, 'introuvable', 'Devis introuvable.'); let token = [...S.shares.entries()].find(([, v]) => v === mid)?.[0]; if (!token) { token = uid() + uid() + uid(); token = token.slice(0, 24); S.shares.set(token, mid); (m.devis as Record<string, unknown>).shareToken = token; m.updatedAt = now(); bus.emit({ type: 'change', col: 'missions', doc: m }); } return ok({ token, url: `/d/${token}` }); }
  const mes = p.match(/^\/api\/missions\/([^/]+)\/espace$/);
  if (mes && method === 'POST') { const mid = decodeURIComponent(mes[1]); const m = S.db.missions.get(mid); if (!m) return err(404, 'introuvable', 'Mission introuvable.'); let token = String(m.espaceToken || ''); if (!token) { token = (uid() + uid() + uid()).slice(0, 24); m.espaceToken = token; S.espaces.set(token, mid); m.updatedAt = now(); bus.emit({ type: 'change', col: 'missions', doc: m }); } return ok({ token, url: `/espace/${token}` }); }
  if (p === '/api/flotte/rentabilite') {
    const mois = q.get('mois') || now().slice(0, 7); const [y, mo] = mois.split('-').map(Number); const a = new Date(y, mo - 1, 1), b = new Date(y, mo, 0); const days = b.getDate();
    const items = [...S.db.vehicules.values()].filter((v) => !v._deleted).map((v) => {
      let jours = 0, ca = 0; S.db.missions.forEach((m) => { if (m.vehiculeId !== v.id || !['confirmee', 'encours', 'terminee'].includes(String(m.statut))) return; const d0 = new Date(String(m.debut)), d1 = new Date(String(m.fin || m.debut)); const s = Math.max(+d0, +a), e = Math.min(+d1, +b + 864e5); if (e <= s) return; const o = Math.round((e - s) / 864e5) || 1; const tot = Math.max(1, Math.round((+d1 - +d0) / 864e5)); jours += o; ca += (+(m.montant as number) || 0) * Math.min(1, o / tot); });
      const couts = ((v.journal as { dt: string; cout: number }[]) || []).filter((j) => j.dt && j.dt.slice(0, 7) === mois).reduce((s, j) => s + (+j.cout || 0), 0);
      const loyer = +(v.loyerMois as number) || 0, charges = +(v.chargesMois as number) || 0;
      return { vehiculeId: v.id, nom: v.nom, loyer, charges, joursLoues: jours, ca: Math.round(ca), couts, marge: Math.round(ca - loyer - charges - couts), occupation: Math.round(jours / days * 100) };
    });
    return ok({ mois, items });
  }
  if (p === '/api/digest') return ok({ semaine: q.get('semaine') || '', texte: 'Bonne semaine à tous. Trois missions à venir, une facture en retard, deux clients à relancer.', json: { ca: 14500, missions: 3, revisions: 1, retards: 1 } });
  if (p === '/api/rappels/run' && method === 'POST') return ok({ ok: true, envoyes: 0 });
  return err(404, 'introuvable', 'Route inconnue : ' + method + ' ' + p);
}

/* Simulation : message entrant, accusé, hors ligne — exposés à window.__amaneMock pour les tests. */
export const sim = {
  inbound(from: string, text: string, opts: { name?: string; type?: string; translation?: string } = {}) {
    const id = 'wamid.' + uid(); const at = now(); let cv = S.db.conversations.get(from);
    const lang = detectLang(text) || 'FR';
    if (!cv) { cv = { id: from, phone: from, nom: opts.name || from, lang, unread: 0, createdAt: at, updatedAt: at }; S.db.conversations.set(from, cv); }
    const msg: Doc = { id, convId: from, dir: 'in', type: opts.type || 'text', text, at, status: 'recu', by: 'client', createdAt: at, updatedAt: at, translation: opts.translation || (lang !== 'FR' ? translate(text, 'FR', lang).text : undefined) };
    S.db.messages.set(id, msg); cv.lastAt = at; cv.lastText = text; cv.lastDir = 'in'; cv.unread = (+(cv.unread as number) || 0) + 1; cv.windowUntil = new Date(Date.now() + 864e5).toISOString(); cv.lastInAt = at; cv.updatedAt = at; S.windowClosed.delete(from);
    bus.emit({ type: 'message', message: msg }); bus.emit({ type: 'conversation', conversation: cv }); persist(); return id;
  },
  status(id: string, status: string) { const m = S.db.messages.get(id); if (m) { m.status = status; m.updatedAt = now(); bus.emit({ type: 'message', message: m }); } },
  closeWindow(convId: string) { persist(); S.windowClosed.add(convId); const cv = S.db.conversations.get(convId); if (cv) { cv.windowUntil = new Date(Date.now() - 1000).toISOString(); cv.updatedAt = now(); bus.emit({ type: 'conversation', conversation: cv }); } },
  setOffline(v: boolean) { S.offline = v; persist(); },
  change(col: string, doc: Doc) { S.db[col].set(doc.id, { ...doc, updatedAt: now() }); bus.emit({ type: 'change', col, doc: S.db[col].get(doc.id) }); persist(); },
  acceptShare(token: string) { return handle('POST', `/d/${token}/accepter`, {}); },
  state: () => S, reset, on: bus.on,
};
