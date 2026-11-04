// Tâches lancées après la réponse HTTP (réponse automatique, IA, alertes, médias…).
// `track()` les enregistre ; `drain()` attend qu'elles soient toutes finies (tests, arrêt propre).
const pending = new Set();

export function track(promise, label = 'tâche') {
  const p = Promise.resolve(promise).catch((e) => console.error(`[amane] ${label}`, e && (e.code || e.message)));
  pending.add(p);
  p.finally(() => pending.delete(p));
  return p;
}

export async function drain() {
  while (pending.size) await Promise.allSettled([...pending]);
}

export const pendingCount = () => pending.size;
