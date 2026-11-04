// Bus d'événements interne : les écritures (fiches, messages, conversations, rappels) sont annoncées ici ;
// le WebSocket, les notifications push et les alertes s'y abonnent. Jamais d'exception propagée à l'émetteur.
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emit(type, payload) {
  try { bus.emit(type, payload); } catch (e) { console.error('[amane] bus', type, e && e.message); }
  try { bus.emit('*', { type, ...payload }); } catch (e) { console.error('[amane] bus *', e && e.message); }
}
