import type { Client, Mission, Vehicule, Partenaire, Conversation, Message, EtapeProgramme } from '@amane/shared';
import { contratOf } from '@/types';
import { parseDate, clashes, t, docLang } from '@amane/shared';
import { fmtDay, fmtDT, fmtE, sod, addD, sameDay } from '@/lib/format';
import type { Data } from './index';

/* Sélecteurs purs (copiés du CRM) : à utiliser dans les écrans avec les données du store. */
export const byId = <T extends { id: string }>(arr: T[] | undefined, id: unknown): T | null => (id ? (arr || []).find((x) => x.id === id) || null : null);
export const label = (arr: readonly { id: string; label?: string; nom?: string }[], id: unknown) => (arr.find((x) => x.id === id) || {} as any).label || (arr.find((x) => x.id === id) || {} as any).nom || String(id || '');

export const OPEN_ST = ['nouvelle', 'proposition', 'confirmee', 'encours'];
export const clientOf = (d: Data, m: Mission | null | undefined): Client | null => (m ? byId(d.clients, m.clientId) : null);
export const vehicleOf = (d: Data, m: Mission | null | undefined): Vehicule | null => (m ? byId(d.vehicules, m.vehiculeId) : null);
export const chauffeurOf = (d: Data, m: Mission | null | undefined): Partenaire | null => (m ? byId(d.partenaires, m.chauffeurId) : null);
export const svcName = (d: Data, id: string | undefined) => (byId(d.services, id) || {} as any).nom || id;
export const chauffeurs = (d: Data) => d.partenaires.filter((p) => p.type === 'chauffeur' && p.actif !== false);
export const vehiclesSorted = (d: Data) => [...d.vehicules].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

export const telDigits = (tel: unknown) => String(tel || '').replace(/\D/g, '').replace(/^0(?=[1-9]\d{8}$)/, '33');
export function convClient(d: Data, cv: Conversation | null | undefined): Client | null {
  if (!cv) return null;
  return byId(d.clients, cv.clientId) || d.clients.find((c) => (c.telNorm && String(c.telNorm) === String(cv.id)) || telDigits(c.tel) === String(cv.id)) || null;
}
export function convName(d: Data, cv: Conversation): string {
  const c = convClient(d, cv);
  return (c && c.nom) || cv.nom || cv.profil || '+' + String(cv.phone || cv.id);
}
const byNew = (a: { createdAt?: string }, b: { createdAt?: string }) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
export function convMission(d: Data, cv: Conversation | null): Mission | null {
  if (!cv) return null;
  const c = convClient(d, cv);
  return byId(d.missions, cv.missionId) || d.missions.filter((m) => m.convId === cv.id).sort(byNew)[0] || (c ? d.missions.filter((m) => m.clientId === c.id && OPEN_ST.includes(m.statut)).sort(byNew)[0] : null) || null;
}
export const convLang = (d: Data, cv: Conversation | null) => String((cv && cv.lang) || (convClient(d, cv) || {}).langue || 'FR').toUpperCase().slice(0, 2);
export const winOpen = (cv: Conversation | null, now = new Date()) => { const w = parseDate(cv && cv.windowUntil); return !!w && w > now; };
export const convMsgs = (d: Data, id: string): Message[] => d.messages.filter((m) => m.convId === id).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
export const convsSorted = (d: Data) => [...d.conversations].sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
export const unreadTotal = (d: Data) => d.conversations.reduce((n, c) => n + (c.unread || 0), 0);
export const convByClient = (d: Data, c: Client | null) => (c ? d.conversations.find((cv) => cv.clientId === c.id || (c.telNorm && String(cv.id) === String(c.telNorm)) || telDigits(c.tel) === String(cv.id)) || null : null);
export const qrName = (d: Data, cv: Conversation) => { const n = convName(d, cv); return /^\+?[\d\s]+$/.test(n) ? '' : n.split(' ')[0]; };
export const helloTxt = (c: Client | null) => { const nom = String(c?.nom || '').trim(); return t(docLang(c), nom ? 'doc.hello' : 'doc.helloAnon', { nom }) + ' '; };

/** Prochaine mission : en cours maintenant, sinon la première confirmée à venir. */
export function nextMission(d: Data, now = new Date()): { m: Mission; cur: boolean } | null {
  const ms = d.missions.filter((m) => ['confirmee', 'encours'].includes(m.statut) && parseDate(m.debut));
  const cur = ms.filter((m) => (parseDate(m.debut) as Date) <= now && (parseDate(m.fin) || parseDate(m.debut)) as Date >= now).sort((a, b) => +(parseDate(a.fin) as Date) - +(parseDate(b.fin) as Date))[0];
  if (cur) return { m: cur, cur: true };
  const nx = ms.filter((m) => (parseDate(m.debut) as Date) > now).sort((a, b) => +(parseDate(a.debut) as Date) - +(parseDate(b.debut) as Date))[0];
  return nx ? { m: nx, cur: false } : null;
}
export function whenLabel(m: Mission, cur: boolean, now = new Date()): string {
  const a = parseDate(m.debut) as Date;
  if (cur) return 'En cours · fin prévue';
  if (sameDay(a, now)) return 'Aujourd’hui';
  if (sameDay(a, addD(now, 1))) return 'Demain';
  return fmtDay(a);
}

export type TimelineItem = { t: Date | null; m: Mission; p?: EtapeProgramme };
export function todayItems(d: Data, now = new Date()): TimelineItem[] {
  const t0 = sod(now), t1 = addD(t0, 1); const items: TimelineItem[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  d.missions.filter((m) => m.statut !== 'perdue' && parseDate(m.debut) && (parseDate(m.debut) as Date) < t1 && ((parseDate(m.fin) || parseDate(m.debut)) as Date) >= t0).forEach((m) => {
    const a = parseDate(m.debut) as Date; items.push({ t: a >= t0 ? a : null, m });
    (m.programme || []).forEach((p) => { const x = parseDate(p.dt); if (x && x >= t0 && x < t1) items.push({ t: x, m, p }); });
  });
  return items.sort((x, y) => (x.t ? +x.t : 0) - (y.t ? +y.t : 0));
}

export type Todo = { sev: 'bad' | 'warn'; t: string; d: string; id: string };
export function todos(d: Data, now = new Date()): Record<string, Todo[]> {
  const out: Record<string, Todo[]> = { amel: [], youssouf: [], aziz: [] };
  d.missions.forEach((m) => {
    const c = clientOf(d, m); const cn = c ? c.nom : 'Client'; const a = parseDate(m.debut); const k = contratOf(m);
    if (m.statut === 'nouvelle') out.amel.push({ sev: 'bad', t: `Répondre à ${cn}`, d: m.titre, id: m.id });
    if (m.statut === 'proposition' && a && +a - +now < 3 * 864e5 && a > now) out.amel.push({ sev: 'warn', t: `Relancer ${cn}`, d: `${m.titre} · ${fmtDay(a)}`, id: m.id });
    if (['confirmee', 'encours'].includes(m.statut)) {
      if (k.statut !== 'signe') out.aziz.push({ sev: a && +a - +now < 2 * 864e5 ? 'bad' : 'warn', t: `Contrat ${k.statut === 'envoye' ? 'à faire signer' : 'à rédiger'}`, d: `${cn} · ${fmtDay(a)}`, id: m.id });
      const p = k.pieces; if (m.vehiculeId && (!p.permis || !p.passeport)) out.aziz.push({ sev: 'warn', t: 'Pièces d’identité manquantes', d: `${cn} · ${m.titre}`, id: m.id });
      if (m.vehiculeId && +(k.caution || 0) > 0 && k.cautionStatut === 'aucune') out.aziz.push({ sev: 'warn', t: `Caution ${fmtE(k.caution)} à pré-autoriser`, d: cn, id: m.id });
      if (!m.vehiculeId && ['location', 'van', 'chauffeur', 'transfert'].includes(String(m.service))) out.youssouf.push({ sev: 'warn', t: 'Véhicule à attribuer', d: `${m.titre} · ${fmtDay(a)}`, id: m.id });
      if (m.vehiculeId && a && +a - +now < 1.5 * 864e5 && !(k.edlDepart && k.edlDepart.fait)) out.youssouf.push({ sev: 'warn', t: 'Préparer le véhicule et l’état des lieux', d: `${m.titre} · ${fmtDT(a)}`, id: m.id });
      (m.taches || []).filter((x) => !x.fait && x.resp === 'youssouf').forEach((x) => out.youssouf.push({ sev: 'warn', t: x.t, d: `${m.titre} · ${fmtDay(x.due)}`, id: m.id }));
      (m.taches || []).filter((x) => !x.fait && x.resp === 'amel').forEach((x) => out.amel.push({ sev: 'warn', t: x.t, d: `${m.titre} · ${fmtDay(x.due)}`, id: m.id }));
    }
    if (m.statut === 'terminee' && k.cautionStatut === 'preautorisee') out.aziz.push({ sev: 'warn', t: 'Caution à libérer', d: `${cn} · ${m.titre}`, id: m.id });
    if (m.statut === 'terminee' && m.paiement !== 'solde') out.aziz.push({ sev: 'bad', t: 'Solde à encaisser', d: `${cn} · ${fmtE((+(m.montant || 0)) - (+(m.acompte || 0)))}`, id: m.id });
    if (clashes(m, d.missions).length) out.youssouf.push({ sev: 'bad', t: 'Double réservation', d: m.titre, id: m.id });
  });
  return out;
}

export function caMois(d: Data, ref = new Date()): number {
  const y = ref.getFullYear(), mo = ref.getMonth();
  return d.missions.filter((m) => ['confirmee', 'encours', 'terminee'].includes(m.statut) && parseDate(m.debut) && (parseDate(m.debut) as Date).getFullYear() === y && (parseDate(m.debut) as Date).getMonth() === mo).reduce((s, m) => s + (+(m.montant || 0)), 0);
}
export const pipeline = (d: Data) => d.missions.filter((m) => ['nouvelle', 'proposition'].includes(m.statut)).reduce((s, m) => s + (+(m.montant || 0)), 0);
