// Modèles WhatsApp approuvés (Meta) : corps exacts à créer dans le gestionnaire WhatsApp, variables {{1}}…
import { WA_TEMPLATES } from '@amane/shared';

export const DEFAULT_TEMPLATE_BODIES = {
  amane_relance: 'Bonjour {{1}}, Amel de la maison Amane. Je reviens vers vous au sujet de : {{2}}. Répondez à ce message pour reprendre la conversation.',
  amane_rappel: 'Bonjour {{1}}, nous vous attendons pour votre {{2}} le {{3}} à {{4}}, {{5}}. Toute la maison Amane se réjouit de vous accueillir.',
  amane_devis: 'Bonjour {{1}}, votre devis {{2}} est prêt : {{3}}. Vous pouvez l’accepter en un geste ou nous poser une question en répondant ici.',
  amane_alerte: 'Amane — nouvelle demande de {{1}} : « {{2}} ». Ouvrez le CRM pour répondre.',
  amane_dispo: 'Bonjour {{1}}, Amane a une demande pour votre {{2}}, {{3}}. Est-il disponible ? Répondez OUI ou NON, ou ouvrez votre espace : {{4}}',
};

/** reglages/templates (ou null) → liste effective, défauts complétés. */
export function effectiveTemplates(doc) {
  const custom = doc && Array.isArray(doc.modeles) ? doc.modeles : [];
  const out = [];
  for (const d of WA_TEMPLATES) {
    const c = custom.find((x) => x && x.name === d.name) || {};
    out.push({ name: d.name, label: c.label || d.label, vars: Array.isArray(c.vars) && c.vars.length ? c.vars : [...d.vars], langs: Array.isArray(c.langs) && c.langs.length ? c.langs : [...d.langs], body: typeof c.body === 'string' && c.body ? c.body : DEFAULT_TEMPLATE_BODIES[d.name] });
  }
  for (const c of custom) {
    if (c && typeof c.name === 'string' && /^[a-z0-9_]{1,512}$/.test(c.name) && !out.some((x) => x.name === c.name)) {
      out.push({ name: c.name, label: c.label || c.name, vars: Array.isArray(c.vars) ? c.vars : [], langs: Array.isArray(c.langs) ? c.langs : ['fr'], body: c.body || '' });
    }
  }
  return out;
}
