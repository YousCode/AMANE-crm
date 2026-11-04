// Horloge injectable : les tests la figent (nuit/jour, fenêtres de 24 h, limites de débit).
let override = null;

export function now() {
  return override ? override() : Date.now();
}

export function nowIso() {
  return new Date(now()).toISOString();
}

/** fn: () => millisecondes, ou null pour revenir à l'heure réelle. */
export function setClock(fn) {
  override = typeof fn === 'function' ? fn : null;
}
