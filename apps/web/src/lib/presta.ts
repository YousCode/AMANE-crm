/* Prestataires (loueurs) : les trois actions qui exigent le serveur — lien du portail, validation d'une inscription, demande de dispo
   (docs/prestataires.md). Pas de file d'attente : hors ligne, elles échouent et l'écran le dit. Leur effet est reporté tout de suite
   sur la fiche locale, puis la synchro ramène la version du serveur. */
import { api, API_BASE, isOffline, type ApiError } from './api';
import { useStore, type Col, type Doc } from '../store/store';
import { nowISO } from './format';
import { firstName, type Partenaire, type PortailRes, type DispoRes } from '../shared';

const base = () => API_BASE || (typeof location !== 'undefined' ? location.origin : '');
const abs = (u: string) => (/^https?:/.test(u) ? u : base() + u);
/** Lien du portail d'un prestataire (page « /p/<lien> » servie par l'API). */
export const portailUrl = (token?: string) => (token ? `${base()}/p/${token}` : '');
/** Message d'accompagnement du lien, quand le serveur n'en a pas fourni (fiche rouverte plus tard). */
export const portailMsg = (p: Pick<Partenaire, 'contact'>, url: string) => { const pr = firstName(String(p.contact || '')); return `Bonjour${pr ? ' ' + pr : ''}, voici votre espace prestataire Amane : vos véhicules, vos jours disponibles et nos demandes. ${url}`; };
/** Message d'erreur d'une action serveur : hors ligne d'abord, puis le message du serveur, sinon un repli. */
export const errMsg = (e: unknown, horsLigne: string, repli: string) => (isOffline(e) ? horsLigne : (e as ApiError).message || repli);

function patchLocal(col: Col, id: string, patch: Record<string, unknown>) {
  const s = useStore.getState(); const cur = (s[col] as Doc[]).find((x) => x.id === id);
  if (cur) { const n: Doc = { ...cur, ...patch }; Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete n[k]; }); s.local(col, id, n); }
  s.sync();
}

/** Crée (ou renvoie, ou régénère avec `reset`) le lien du portail ; `valider` valide d'abord l'inscription. */
export async function portailLien(id: string, o: { valider?: boolean; reset?: boolean } = {}): Promise<PortailRes> {
  const r = await api<PortailRes>('POST', `/api/partenaires/${encodeURIComponent(id)}/${o.valider ? 'valider' : 'portail'}`, o.reset ? { reset: true } : {});
  if (!r.token) throw { code: 'reponse_invalide', status: 500, message: '' } as ApiError;
  r.url = abs(r.url || '/p/' + r.token);
  patchLocal('partenaires', id, { portailToken: r.token, aValider: undefined, ...(r.created ? { portailAt: nowISO() } : {}) });
  return r;
}

/** Demande au prestataire si son véhicule est disponible pour la demande (WhatsApp si le serveur le peut, sinon message à envoyer soi-même). */
export async function demanderDispo(missionId: string, vehiculeId: string, partenaireId: string): Promise<DispoRes> {
  const r = await api<DispoRes>('POST', `/api/missions/${encodeURIComponent(missionId)}/dispo`, { vehiculeId });
  const s = useStore.getState(); const m = s.missions.find((x) => x.id === missionId);
  patchLocal('missions', missionId, { dispoDemandes: [...(m?.dispoDemandes || []).filter((x) => x.vehiculeId !== vehiculeId), { vehiculeId, partenaireId, statut: 'envoyee', envoyeAt: nowISO(), canal: r.canal, par: s.user?.id }] });
  return r;
}
