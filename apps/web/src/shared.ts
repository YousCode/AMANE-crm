/* Point d'entrée unique vers `@amane/shared` (packages/shared, lié par le workspace npm).
   Quelques types sont élargis ici pour les champs que le CRM actuel utilise et que `index.d.ts` ne liste pas encore
   (journal : desc/photo/traite ; véhicule : echeances ; programme : interne ; partenaire : photo ; rentabilité : partenaireId). */
export * from '@amane/shared';
import type * as S from '@amane/shared';

export type JournalEntry = S.JournalEntree & { desc?: string; photo?: string; traite?: boolean };
export type Vehicule = Omit<S.Vehicule, 'journal'> & { journal?: JournalEntry[]; echeances?: { assurance?: string; ct?: string; leasing?: string } };
export type EtapeProgramme = S.EtapeProgramme & { interne?: string };
export type Commission = Omit<S.Commission, 'statut'> & { statut?: 'attendue' | 'a_recevoir' | 'recue' | string };
export type Contrat = S.Contrat;
export type Mission = Omit<S.Mission, 'programme' | 'commissions' | 'statut' | 'responsable' | 'paiement' | 'devis'> & { programme?: EtapeProgramme[]; commissions?: Commission[]; statut: S.Statut | string; responsable?: S.TeamId | string; paiement?: S.PaiementStatut | string; devis?: Devis | null };
export type Client = Omit<S.Client, 'responsable' | 'statut' | 'langue'> & { responsable?: string; statut?: string; langue?: string; docs?: Record<string, boolean>; naissance?: string; nationalite?: string };
export type Partenaire = S.Partenaire & { photo?: string };
export type Conversation = Omit<S.Conversation, 'phone' | 'assigne'> & { phone?: string; assigne?: string };
export type Message = Omit<S.Message, 'text' | 'type' | 'status' | 'by' | 'media' | 'contacts'> & { text?: string; type?: string; status?: string; by?: string; media?: S.Media & { url?: string; duration?: number }; lang?: string; contacts?: { name?: string; nom?: string; phones?: string[]; tel?: string }[] };
export type Service = S.Service & { description?: string };
export type Reglages = S.Reglages & { [k: string]: unknown };
export type Devis = S.Devis & { lignes: S.Ligne[]; wantFacture?: boolean };
export type Tache = S.Tache & { resp: string; due: string };
export interface Rentabilite { vehiculeId: string; nom: string; loyer: number; charges: number; joursLoues: number; ca: number; couts: number; marge: number; occupation: number; /** prestataire propriétaire (coûts = prix d'achat × jours loués) */ partenaireId?: string }
/** Réponse de POST /api/partenaires/:id/portail et /valider (docs/prestataires.md). */
export interface PortailRes { token: string; url: string; created?: boolean; message?: string; waLink?: string }
/** Réponse de POST /api/missions/:id/dispo. */
export interface DispoRes { ok: boolean; canal: 'whatsapp' | 'lien' | string; url?: string; message?: string; waLink?: string }
export type VehicleState = Omit<S.VehicleState, 'm'> & { m?: Mission };
export type { Activity, User, Relance, Rappel, Ligne, Reglement, Entourage, DateImportante, TeamId, Statut, DispoDemande, DispoPeriode, DispoStatut } from '@amane/shared';

/* Règles du paquet, typées sur les types élargis ci-dessus (mêmes implémentations). */
import * as R from '@amane/shared';
export const clashes = (m: Mission, all: Mission[]): Mission[] => R.clashes(m as never, all as never) as unknown as Mission[];
export const chClashes = (m: Mission, all: Mission[]): Mission[] => R.chClashes(m as never, all as never) as unknown as Mission[];
export const paiementStatut = (m: Partial<Mission> | null | undefined): S.PaiementStatut => R.paiementStatut(m as never);
export const docLang = (c?: { langue?: string } | null): S.DocLang => R.docLang(c as never);
export const tplTasks = (m: { debut?: string; fin?: string; service?: string }): Tache[] => R.tplTasks(m as never) as Tache[];
export const freeVehicles = (v: Vehicule[], ms: Mission[], from: string | Date, to: string | Date, opts?: { excl?: string; strict?: boolean }): Vehicule[] => R.freeVehicles(v as never, ms as never, from, to, opts) as unknown as Vehicule[];
export const durDays = (m: { debut?: string; fin?: string }): number => R.durDays(m as never);
export const devisTotals = (dv?: Partial<Devis> | null): S.DevisTotals => R.devisTotals(dv as never);
export const vehicleOn = (v: Vehicule, ms: Mission[], a: string | Date, b?: string | Date, excl?: string): VehicleState => R.vehicleOn(v as never, ms as never, a, b, excl) as unknown as VehicleState;
