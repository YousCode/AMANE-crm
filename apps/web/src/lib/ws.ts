/* WebSocket /ws : changements poussés par le serveur ; /api/sync sert de rattrapage à chaque (re)connexion.
   En mode msw (pas de vrai serveur), le faux serveur expose window.__amaneMock.on(…) : on s'y abonne à la place. */
import { API_BASE } from './api';
import { useStore, type Col } from '../store/store';

type WsEvent = { type: 'change'; col: Col; doc: { id: string } } | { type: 'deleted'; col: Col; id: string } | { type: 'message'; message: { id: string } } | { type: 'conversation'; conversation: { id: string } } | { type: 'rappel'; rappel: unknown } | { type: 'alerte'; text?: string };
declare global { interface Window { __amaneMock?: { on: (f: (e: WsEvent) => void) => () => void } } }

let ws: WebSocket | null = null, timer: ReturnType<typeof setTimeout> | undefined, tries = 0, stopped = false, pollT: ReturnType<typeof setInterval> | undefined;

export function handleEvent(e: WsEvent) {
  const s = useStore.getState();
  if (e.type === 'change' && e.doc) s.applyChange(e.col, e.doc as { id: string });
  else if (e.type === 'deleted') s.applyDeleted(e.col, e.id);
  else if (e.type === 'message' && e.message) s.applyChange('messages', e.message);
  else if (e.type === 'conversation' && e.conversation) s.applyChange('conversations', e.conversation);
}
function url() {
  const base = API_BASE || (typeof location !== 'undefined' ? location.origin : '');
  return base.replace(/^http/, 'ws') + '/ws';
}
export function startLive() {
  stopped = false;
  const s = useStore.getState();
  if (typeof window !== 'undefined' && window.__amaneMock) { window.__amaneMock.on(handleEvent); s.setWs(true); }
  else connect();
  // Rattrapage périodique (sécurité) + au retour de l'onglet / du réseau.
  clearInterval(pollT); pollT = setInterval(() => { if (!document.hidden) useStore.getState().sync(); }, useStore.getState().wsOn ? 45000 : 8000);
  const kick = () => useStore.getState().sync();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { kick(); if (!ws && !window.__amaneMock) connect(); } });
  window.addEventListener('online', () => { kick(); if (!ws && !window.__amaneMock) connect(); });
  window.addEventListener('offline', () => useStore.setState({ offline: true }));
}
function connect() {
  if (stopped || typeof WebSocket === 'undefined') return;
  try { ws = new WebSocket(url()); } catch { schedule(); return; }
  ws.onopen = () => { tries = 0; useStore.getState().setWs(true); useStore.getState().sync(); clearInterval(pollT); pollT = setInterval(() => { if (!document.hidden) useStore.getState().sync(); }, 45000); };
  ws.onmessage = (ev) => { try { handleEvent(JSON.parse(ev.data)); } catch { /* ignore */ } };
  ws.onclose = () => { ws = null; useStore.getState().setWs(false); clearInterval(pollT); pollT = setInterval(() => { if (!document.hidden) useStore.getState().sync(); }, 8000); schedule(); };
  ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
}
function schedule() { if (stopped) return; clearTimeout(timer); tries++; timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(tries, 5))); }
export function stopLive() { stopped = true; clearTimeout(timer); clearInterval(pollT); try { ws?.close(); } catch { /* ignore */ } ws = null; }
