import { Platform } from 'react-native';
import { API_URL } from './api';
import { session } from './session';

/* WebSocket /ws : {type:'change',col,doc} / {type:'deleted',col,id} / {type:'message',message} / {type:'conversation',conversation} / {type:'rappel',rappel}. */
export type WsEvent =
  | { type: 'change'; col: string; doc: any }
  | { type: 'deleted'; col: string; id: string }
  | { type: 'message'; message: any }
  | { type: 'conversation'; conversation: any }
  | { type: 'rappel'; rappel: any };

type Handlers = { onEvent: (e: WsEvent) => void; onOpen: () => void; onClose: () => void };

export function connectWs(h: Handlers): () => void {
  let ws: WebSocket | null = null; let stopped = false; let delay = 1500; let timer: ReturnType<typeof setTimeout> | null = null;
  const url = API_URL.replace(/^http/, 'ws') + '/ws';
  const start = async () => {
    if (stopped) return;
    const headers: Record<string, string> = {};
    if (Platform.OS !== 'web') { const ck = await session.getCookie(); if (ck) headers.Cookie = ck; }
    try {
      // React Native accepte un troisième argument { headers } ; le web ignore l'en-tête et utilise le cookie du navigateur.
      ws = Platform.OS === 'web' ? new WebSocket(url) : new (WebSocket as any)(url, undefined, { headers });
    } catch { schedule(); return; }
    if (!ws) return;
    ws.onopen = () => { delay = 1500; h.onOpen(); };
    ws.onmessage = (ev) => { try { h.onEvent(JSON.parse(String(ev.data))); } catch { /* trame illisible */ } };
    ws.onerror = () => { /* onclose suit */ };
    ws.onclose = () => { h.onClose(); schedule(); };
  };
  const schedule = () => { if (stopped) return; if (timer) clearTimeout(timer); timer = setTimeout(start, delay); delay = Math.min(delay * 2, 30000); };
  start();
  return () => { stopped = true; if (timer) clearTimeout(timer); try { ws?.close(); } catch { /* ignore */ } };
}
