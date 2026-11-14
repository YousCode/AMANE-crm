/* Réglages injectés au build (variables VITE_*) ; vides = la page fonctionne quand même (WhatsApp sans numéro prérempli). */
const env = import.meta.env;
export const CONFIG = {
  /** Numéro WhatsApp de la maison, chiffres seulement (ex. 33612345678). */
  whatsapp: String(env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  email: String(env.VITE_CONTACT_EMAIL || ''),
  /** Adresse de l'API du CRM ; vide = même origine (le site est servi par l'API). */
  api: String(env.VITE_API_URL || '').replace(/\/$/, ''),
};
