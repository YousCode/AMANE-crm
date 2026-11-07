// Types d'Amane v2. Champs = ceux du CRM (crm/index.html, blank(kind)) + docs/crm-serveur.md + docs/architecture-v2.md.

export type TeamId = 'amel' | 'youssouf' | 'aziz';
export type Statut = 'nouvelle' | 'proposition' | 'confirmee' | 'encours' | 'terminee' | 'perdue';
export type ClientStatut = 'prospect' | 'client' | 'habitue' | 'vip';
export type Langue = 'FR' | 'EN' | 'AR' | 'RU' | 'ZH' | 'ES' | 'IT' | 'DE';
export type DocLang = 'FR' | 'EN' | 'ES' | 'AR';
export type WaLang = 'FR' | 'EN' | 'ES' | 'AR' | 'RU';
export type ServiceId = 'location' | 'chauffeur' | 'van' | 'transfert' | 'shopping' | 'sejour' | 'conciergerie' | 'clip';
export type Canal = 'WhatsApp' | 'Instagram' | 'Site' | 'Palace / hôtel' | 'Apporteur' | 'Bouche-à-oreille' | 'E-mail' | 'Autre';
export type ContratStatut = 'a_rediger' | 'envoye' | 'signe';
export type CautionStatut = 'aucune' | 'preautorisee' | 'encaissee' | 'restituee';
export type PaiementStatut = 'non' | 'acompte' | 'solde';
export type DevisStatut = 'brouillon' | 'envoye' | 'accepte' | 'refuse';
export type Unite = 'jour' | 'heure' | 'forfait';
export type Moyen = 'virement' | 'cb' | 'especes' | 'lien';
export type PartType = 'chauffeur' | 'restaurant' | 'hotel' | 'boutique' | 'garage' | 'assurance' | 'autre';
export type ProgType = 'transfert' | 'restaurant' | 'shopping' | 'visite' | 'hotel' | 'autre';
export type JournalType = 'entretien' | 'reparation' | 'dommage' | 'pv' | 'controle' | 'autre';
export type Priorite = 'haute' | 'normale' | 'basse';
export type VehiculeStatut = 'disponible' | 'entretien' | 'indisponible';
export type MessageDir = 'in' | 'out' | 'note';
export type MessageStatus = 'recu' | 'envoye' | 'distribue' | 'lu' | 'echec';
export type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'location' | 'contacts' | 'reaction' | 'template' | 'note' | 'button' | 'interactive';
export type RappelType = 'veille' | 'merci' | 'acompte';
export type RelanceType = 'proposition' | 'habitue' | 'anniversaire' | 'acompte' | 'facture';

export interface Labelled<T extends string = string> { id: T; label: string }

/** Champs posés par le serveur sur chaque fiche. */
export interface ServerFields {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Entourage { nom: string; lien?: string; tel?: string; notes?: string }
export interface DateImportante { date: string; label: string }

export interface Client extends ServerFields {
  nom: string;
  tel?: string;
  telNorm?: string;
  email?: string;
  langue?: Langue | '';
  pays?: string;
  hotel?: string;
  canal?: Canal | string;
  statut?: ClientStatut;
  responsable?: TeamId;
  prefs?: string;
  notes?: string;
  tags?: string[] | Record<string, boolean>;
  entourage?: Entourage[];
  datesImportantes?: DateImportante[];
  allergies?: string;
  marques?: string;
  attentions?: string[];
  _demo?: number;
}

export interface Ligne { d: string; q: number | string; u: Unite | string; pu: number | string }
export interface Reglement { date?: string; moyen?: Moyen | string; montant: number | string; note?: string }
export interface Devis {
  numero?: string;
  date?: string;
  statut?: DevisStatut;
  lignes?: Ligne[];
  remise?: number | string;
  tva?: number | string;
  paiements?: Reglement[];
  factureNumero?: string;
  factureDate?: string;
  notes?: string;
  shareToken?: string;
  vuAt?: string;
  acceptedAt?: string;
  sentAt?: string;
}
export interface EtapeProgramme { dt: string; type: ProgType | string; lieu?: string; partenaireId?: string; client?: string; notes?: string }
export interface Tache { t: string; resp?: TeamId | ''; due?: string; fait: boolean }
export interface Commission { partenaireId?: string; base?: number | string; pct?: number | string; statut?: 'attendue' | 'recue'; recueLe?: string }
export interface EtatDesLieux { fait: boolean; km?: number | string; carburant?: string; notes?: string; photos?: string[] }
export interface Contrat {
  statut?: ContratStatut;
  caution?: number | string;
  cautionStatut?: CautionStatut;
  pieces?: { permis?: boolean; passeport?: boolean; domicile?: boolean };
  edlDepart?: EtatDesLieux;
  edlRetour?: EtatDesLieux;
}

export interface Mission extends ServerFields {
  titre: string;
  clientId?: string;
  service?: ServiceId | string;
  vehiculeId?: string;
  debut?: string;
  fin?: string;
  lieu?: string;
  montant?: number | string;
  acompte?: number | string;
  statut: Statut;
  responsable?: TeamId;
  chauffeur?: string;
  chauffeurId?: string;
  programme?: EtapeProgramme[];
  taches?: Tache[];
  commissions?: Commission[];
  devis?: Devis | null;
  notes?: string;
  paiement?: PaiementStatut;
  contrat?: Contrat;
  passagers?: number;
  budget?: number;
  priorite?: Priorite;
  source?: 'whatsapp' | 'site' | 'crm' | string;
  canal?: Canal | string;
  convId?: string;
  espaceToken?: string;
  _demo?: number;
}

export interface JournalEntree { dt: string; type: JournalType | string; cout?: number | string; notes?: string; km?: number | string }
export interface Vehicule extends ServerFields {
  nom: string;
  categorie?: string;
  plaque?: string;
  couleur?: string;
  tarifJour?: number | string;
  loyerMois?: number | string;
  chargesMois?: number | string;
  statut?: VehiculeStatut | string;
  km?: number | string;
  revision?: string;
  notes?: string;
  ordre?: number;
  photos?: string[];
  journal?: JournalEntree[];
}

export interface Service extends ServerFields { nom: string; description?: string; tarif?: string; ordre?: number }

export interface Partenaire extends ServerFields {
  nom: string;
  type: PartType | string;
  contact?: string;
  tel?: string;
  telNorm?: string;
  email?: string;
  langues?: string;
  adresse?: string;
  commission?: number | string;
  notes?: string;
  actif?: boolean;
  photoId?: string;
}

export interface AiFields {
  service?: string; vehicule?: string; debut?: string; fin?: string; lieu?: string; passagers?: number; budget?: number;
  langue?: string; urgence?: Priorite; resume?: string; brouillon?: string;
}

export interface Conversation extends ServerFields {
  phone: string;
  nom?: string;
  profil?: string;
  clientId?: string;
  missionId?: string;
  lang?: WaLang | string;
  lastAt?: string;
  lastText?: string;
  lastDir?: MessageDir;
  lastInAt?: string;
  lastOutAt?: string;
  unread?: number;
  windowUntil?: string;
  aiSummary?: string;
  aiDraft?: string;
  aiFields?: AiFields;
  aiAt?: string;
  equipe?: TeamId;
  assigne?: TeamId | '';
}

export interface Media { id: string; mime: string; filename?: string; caption?: string; size?: number; photoId?: string; sha256?: string }
export interface Location { lat: number; lng: number; name?: string; address?: string }
export interface ContactCard { nom: string; tel?: string; email?: string; org?: string }
export interface TemplateRef { name: string; lang: string; params: string[] }

export interface Message extends ServerFields {
  convId: string;
  dir: MessageDir;
  type: MessageType | string;
  text: string;
  at: string;
  status: MessageStatus;
  by: 'client' | 'auto' | 'rappel' | TeamId | string;
  erreur?: string;
  erreurCode?: number;
  media?: Media;
  location?: Location;
  contacts?: ContactCard[];
  reactionTo?: string;
  emoji?: string;
  replyTo?: string;
  template?: TemplateRef;
  translation?: string;
  translationLang?: string;
  transcript?: string;
  transcriptLang?: string;
  sourceLang?: string;
  originalText?: string;
}

export interface Activity {
  id: string;
  at: string;
  user: string;
  col: string;
  docId: string;
  action: 'create' | 'update' | 'delete' | 'whatsapp' | 'lead' | 'devis' | 'rappel' | string;
  resume: string;
}

export interface ReglagesGeneral {
  autoReply?: boolean;
  horaires?: { debut: string; fin: string };
  fuseau?: string;
  textes?: Partial<Record<WaLang, { jour?: string; nuit?: string }>>;
}
export interface ReglagesRappels {
  actifs?: Partial<Record<RappelType, boolean>>;
  textes?: Partial<Record<WaLang, Partial<Record<RappelType, string>>>>;
}
export interface TemplateDef { name: string; label: string; vars: string[]; langs: string[]; body?: string }
export interface ReglagesTemplates { modeles?: TemplateDef[] }
export interface Reglages extends ServerFields, ReglagesGeneral, ReglagesRappels, ReglagesTemplates {}

export interface User { id: TeamId; nom: string; role: string }

export interface Rappel extends ServerFields {
  type: RappelType;
  missionId: string;
  clientId?: string;
  convId?: string;
  dueAt: string;
  sentAt?: string;
  messageId?: string;
  statut: 'envoye' | 'echec' | 'ignore';
  erreur?: string;
  lang?: string;
}

export interface Relance {
  type: RelanceType;
  clientId: string;
  missionId?: string;
  raison: string;
  messageSuggere: string;
  depuis: string;
  lang?: string;
}

export interface DevisTotals { ht: number; rem: number; base: number; tva: number; rate: number; ttc: number; paid: number; solde: number }
export interface VehicleState { k: 'f' | 'b' | 'o' | 'off'; m?: Mission; t?: string }
export interface ValidationResult { ok: boolean; errors: Record<string, string> }

export interface SyncResponse {
  now: string;
  changes: { clients: Client[]; missions: Mission[]; vehicules: Vehicule[]; services: Service[]; partenaires: Partenaire[]; reglages: Reglages[]; conversations: Conversation[]; messages: Message[] };
  deleted: Record<string, string[]>;
  compteurs: Record<string, number>;
}

export type WsEvent =
  | { type: 'change'; col: string; doc: Record<string, unknown> }
  | { type: 'deleted'; col: string; id: string }
  | { type: 'message'; message: Message }
  | { type: 'conversation'; conversation: Conversation }
  | { type: 'rappel'; rappel: Rappel }
  | { type: 'hello'; user: User; now: string }
  | { type: 'ping' };

// ---------- constantes ----------
export const TEAM: readonly { id: TeamId; nom: string; role: string }[];
export const TEAM_IDS: readonly TeamId[];
export const STATUTS: readonly Labelled<Statut>[];
export const OPEN_STATUTS: readonly Statut[];
export const BOOK_STATUTS: readonly Statut[];
export const OPT_STATUTS: readonly Statut[];
export const ACTIVE_STATUTS: readonly Statut[];
export const CLIENT_STATUTS: readonly Labelled<ClientStatut>[];
export const CLIENT_TAGS: readonly Labelled[];
export const LANGUES: readonly Langue[];
export const DOC_LANGS: readonly DocLang[];
export const WA_LANGS: readonly WaLang[];
export const CANAUX: readonly Canal[];
export const CONTRAT_ST: readonly Labelled<ContratStatut>[];
export const CAUTION_ST: readonly Labelled<CautionStatut>[];
export const PAIEMENT_ST: readonly Labelled<PaiementStatut>[];
export const DEVIS_ST: readonly Labelled<DevisStatut>[];
export const UNITES: readonly Labelled<Unite>[];
export const MOYENS: readonly Labelled<Moyen>[];
export const PART_TYPES: readonly Labelled<PartType>[];
export const PROG_TYPES: readonly Labelled<ProgType>[];
export const JOURNAL_T: readonly Labelled<JournalType>[];
export const CARBURANT: readonly string[];
export const PRIORITES: readonly Priorite[];
export const TASK_TPL: Readonly<Record<ServiceId, readonly (readonly [string, TeamId, number | string])[]>>;
export const SERVICES: readonly { id: ServiceId; nom: string; ordre: number; tarif?: string }[];
export const SERVICE_IDS: readonly ServiceId[];
export const SERVICES_DEFAUT: Readonly<Record<ServiceId, { nom: string; ordre: number; tarif?: string }>>;
export const VEHICULES_DEFAUT: Readonly<Record<'urus' | 'f296' | 'g63' | 'm5' | 'classev', { nom: string; categorie: string; tarifJour: number; loyerMois: number; chargesMois: number; statut: string; ordre: number }>>;
export const VEHICULE_STATUTS: readonly Labelled<VehiculeStatut>[];
export const WA_TEMPLATES: readonly TemplateDef[];
export const RAPPEL_TYPES: readonly Labelled<RappelType>[];
export const RELANCE_TYPES: readonly Labelled<RelanceType>[];
export const MESSAGE_TYPES: readonly MessageType[];
export const SLOGAN: string;
export function labelOf(list: readonly { id: string; label?: string; nom?: string }[], id: string, fallback?: string): string;

// ---------- règles ----------
export function pad2(n: number | string): string;
export function toLocal(d: Date): string;
export function parseDate(s: string | Date | null | undefined): Date | null;
export function startOfDay(d: Date | string | number): Date;
export function addDays(d: Date | string | number, n: number): Date;
export function durDays(m: Pick<Mission, 'debut' | 'fin'>): number;
export function overlapDays(m: Pick<Mission, 'debut' | 'fin'>, from: string | Date, to: string | Date): number;
export function clashes(m: Mission, all: Mission[]): Mission[];
export function chClashes(m: Mission, all: Mission[]): Mission[];
export function vehicleOn(v: Vehicule, missions: Mission[], a: string | Date, b?: string | Date, excl?: string): VehicleState;
export function freeVehicles(vehicules: Vehicule[], missions: Mission[], from: string | Date, to: string | Date, opts?: { excl?: string; strict?: boolean }): Vehicule[];
export function tplTasks(m: Pick<Mission, 'debut' | 'fin' | 'service'>): Tache[];
export function round2(n: number | string): number;
export function devisTotals(dv: Devis | null | undefined): DevisTotals;
export function numeroFormat(kind: 'devis' | 'facture', year: number | string, n: number): string;
export function numeroKey(kind: 'devis' | 'facture', year: number | string): string;
export function paiementStatut(m: Mission | null | undefined): PaiementStatut;
export function nextStatut(s: Statut | string): Statut | null;
export function prevStatut(s: Statut | string): Statut | null;
export function statutLabel(s: Statut | string): string;
export function telNorm(tel: unknown): string;
export function telPlus(tel: unknown): string;
export function telFmt(tel: unknown): string;
export function telHref(tel: unknown): string;
export function waLink(tel: unknown, text?: string): string;
export function mapsLink(lieu: string, opts?: { apple?: boolean }): string;
export function detectLang(text: string): 'AR' | 'RU' | 'FR' | 'EN' | 'ES' | null;
export function langFromPhone(digits: string): 'FR' | 'AR' | 'RU' | 'ES' | 'EN' | null;
export function docLang(client: Pick<Client, 'langue'> | null | undefined): DocLang;
export function isRtl(lang: string | null | undefined): boolean;
export function guessServiceOrNull(text: string): ServiceId | null;
export function guessService(text: string): ServiceId;
export function firstName(name: string): string;
export function fillVars(text: string, vars?: Record<string, unknown>): string;
export function windowOpen(conv: Pick<Conversation, 'windowUntil'> | null | undefined, nowMs?: number): boolean;

// ---------- i18n ----------
export const LOCALES: Readonly<Record<WaLang, string>>;
export const DICT: Readonly<Record<WaLang, Readonly<Record<string, string>>>>;
export const QUICK_REPLY_KEYS: readonly string[];
export const QUICK_REPLY_LABELS: Readonly<Record<string, string>>;
export function normLang(lang: string | null | undefined): WaLang | null;
export function t(lang: string | null | undefined, key: string, vars?: Record<string, unknown>): string;
export function hasT(lang: string | null | undefined, key: string): boolean;
export function fmtMoney(n: number | string, lang?: string, opts?: { decimals?: number }): string;
export function fmtDate(d: Date | string | number, lang?: string, opts?: Intl.DateTimeFormatOptions, timeZone?: string): string;
export function fmtTime(d: Date | string | number, lang?: string, timeZone?: string): string;

// ---------- jetons ----------
export interface ThemeColors {
  bg: string; bg2: string; panel: string; panel2: string; line: string; line2: string;
  fg: string; fg2: string; fg3: string; accent: string; accentInk: string; champagne: string; stone: string;
  ok: string; warn: string; bad: string; info: string; scrim: string;
}
export interface Tokens {
  colors: { light: ThemeColors; dark: ThemeColors };
  fonts: { display: string; ui: string; mono: string; arabic: string; weights: { light: number; regular: number; medium: number } };
  radius: number;
  rail: number;
  tracking: { label: string; labelSize: number; transform: string };
  space: readonly number[];
  touch: number;
  breakpoints: { mobile: number; tablet: number };
  googleFonts: string;
  logoPath: string;
  logoViewBox: string;
  slogan: string;
}
export const tokens: Readonly<Tokens>;
export function cssVars(theme?: 'light' | 'dark'): string;
export function cssTheme(): string;
export function logoSvg(opts?: { size?: number; title?: string }): string;

// ---------- validation ----------
export const validate: {
  client(obj: unknown): ValidationResult;
  mission(obj: unknown): ValidationResult;
  devis(obj: unknown): ValidationResult;
  vehicule(obj: unknown): ValidationResult;
  partenaire(obj: unknown): ValidationResult;
  service(obj: unknown): ValidationResult;
};
export function validateClient(obj: unknown): ValidationResult;
export function validateMission(obj: unknown): ValidationResult;
export function validateDevis(obj: unknown): ValidationResult;
export function validateVehicule(obj: unknown): ValidationResult;
export function validatePartenaire(obj: unknown): ValidationResult;
export function validateService(obj: unknown): ValidationResult;

// ---------- documents A4 (devis, facture, carnet de séjour) ----------
export type MaisonKey = 'raison' | 'adresse' | 'siren' | 'tva' | 'iban' | 'bic' | 'tel' | 'email' | 'site';
export type Maison = Record<MaisonKey, string>;
export const MAISON_FIELDS: readonly { k: MaisonKey; label: string; placeholder: string }[];
export const DOC_COLORS: Readonly<Record<string, string>>;
export function escHtml(s: unknown): string;
/** reglages/maison complété par des valeurs par défaut (ex. BANK_IBAN côté serveur). */
export function maisonInfo(raw?: Partial<Record<MaisonKey, unknown>> | null, defaults?: Partial<Record<MaisonKey, unknown>> | null): Maison;
/** Champs légaux manquants pour une facture conforme. */
export function maisonMissing(m?: Partial<Maison> | null): MaisonKey[];
export function docShell(o: { lang?: string; title?: string; body?: string; legal?: boolean; kind?: string; num?: string; meta?: string; maison?: Partial<Maison> | null; placeholders?: boolean; after?: string; extraHead?: string }): string;
export function devisDoc(o: { mission: Partial<Mission> & Record<string, any>; client?: Partial<Client> | null; kind?: 'devis' | 'facture'; maison?: Partial<Maison> | null; placeholders?: boolean; after?: string; lang?: string }): string;
export function programmeSteps<T extends { dt?: string }>(mission: { programme?: T[] } | null | undefined): T[];
export function carnetDoc(o: { mission: Partial<Mission> & Record<string, any>; client?: Partial<Client> | null; partenaires?: readonly { id?: string; _id?: string; nom?: string; adresse?: string }[]; maison?: Partial<Maison> | null; lang?: string }): string;
