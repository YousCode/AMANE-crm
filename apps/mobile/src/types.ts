/* Extensions locales des types partagés (champs que l'appli gère et que le serveur accepte tels quels). */
import type { Media, JournalEntree, Mission, Contrat } from '@amane/shared';

/** Média WhatsApp : durée d'un vocal en secondes (posée par l'API quand elle est connue). */
export type MediaX = Media & { duration?: number };
/** Entrée du journal d'un véhicule : id, photos (ids /api/photo) et auteur en plus du contrat. */
export type JournalEntry = JournalEntree & { id?: string; photos?: string[]; par?: string };
/** Contrat complet avec valeurs par défaut. */
export const blankContrat = (): Required<Pick<Contrat, 'statut' | 'caution' | 'cautionStatut'>> & { pieces: { permis: boolean; passeport: boolean; domicile: boolean }; edlDepart: { fait: boolean; km: string; carburant: string; notes: string; photos?: string[] }; edlRetour: { fait: boolean; km: string; carburant: string; notes: string; photos?: string[] } } =>
  ({ statut: 'a_rediger', caution: '', cautionStatut: 'aucune', pieces: { permis: false, passeport: false, domicile: false }, edlDepart: { fait: false, km: '', carburant: 'Plein', notes: '' }, edlRetour: { fait: false, km: '', carburant: 'Plein', notes: '' } });
export const contratOf = (m: Pick<Mission, 'contrat'>) => ({ ...blankContrat(), ...(m.contrat || {}) , pieces: { ...blankContrat().pieces, ...(m.contrat?.pieces || {}) } });
