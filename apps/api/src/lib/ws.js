// WebSocket /ws : après authentification par cookie, le serveur pousse les changements en temps réel.
// Le client garde /api/sync pour le rattrapage.
import { WebSocketServer } from 'ws';
import { getSession } from './auth.js';
import { bus } from './bus.js';
import { nowIso } from './clock.js';

export function attachWs(server, { path = '/ws', getDb } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const clients = new Set();

  server.on('upgrade', async (req, socket, head) => {
    let pathname = '';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { pathname = ''; }
    if (pathname !== path) { socket.destroy(); return; }
    let user = null;
    try { user = await getSession(req, await getDb()); } catch { user = null; }
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{"error":"non_connecte","message":"Connexion requise."}');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = user;
      ws.isAlive = true;
      clients.add(ws);
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
      ws.on('message', (data) => {
        let m = null;
        try { m = JSON.parse(String(data).slice(0, 4096)); } catch { m = null; }
        if (m && m.type === 'ping') send(ws, { type: 'pong', now: nowIso() });
      });
      send(ws, { type: 'hello', user, now: nowIso() });
    });
  });

  function send(ws, obj) {
    if (ws.readyState === ws.OPEN) { try { ws.send(JSON.stringify(obj)); } catch { /* fermé */ } }
  }
  function broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const ws of clients) if (ws.readyState === ws.OPEN) { try { ws.send(s); } catch { /* fermé */ } }
  }

  const onChange = ({ col, doc }) => broadcast({ type: 'change', col, doc });
  const onDeleted = ({ col, id }) => broadcast({ type: 'deleted', col, id });
  const onMessage = ({ message }) => broadcast({ type: 'message', message });
  const onConversation = ({ conversation }) => broadcast({ type: 'conversation', conversation });
  const onRappel = ({ rappel }) => broadcast({ type: 'rappel', rappel });
  bus.on('change', onChange); bus.on('deleted', onDeleted); bus.on('message', onMessage); bus.on('conversation', onConversation); bus.on('rappel', onRappel);

  const timer = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) { try { ws.terminate(); } catch { /* déjà fermé */ } clients.delete(ws); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* fermé */ }
    }
  }, 30000);
  timer.unref();

  return {
    wss,
    broadcast,
    get size() { return clients.size; },
    close() {
      clearInterval(timer);
      bus.off('change', onChange); bus.off('deleted', onDeleted); bus.off('message', onMessage); bus.off('conversation', onConversation); bus.off('rappel', onRappel);
      for (const ws of clients) { try { ws.terminate(); } catch { /* ignoré */ } }
      clients.clear();
      wss.close();
    },
  };
}
