import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { todos, vehicleOn, dispoEtat, depuis, margeLignes, loueurs, inscriptions, nowLine, seuil } from '../src/lib/rules';
import { portailLien, demanderDispo, portailUrl } from '../src/lib/presta';
import { handleEvent } from '../src/lib/ws';
import { queue, cache } from '../src/lib/queue';
import { useStore } from '../src/store/store';
import { useUI } from '../src/store/ui';
import { Drawer } from '../src/drawers/Drawer';
import { Toasts } from '../src/components/ui';
import { Carnet } from '../src/screens/Carnet';
import { Flotte } from '../src/screens/Flotte';
import { sim, reset } from '../src/mocks/node';
import { handle } from '../src/mocks/fakeApi';
import { seed } from '../src/mocks/seed';
import type { Mission, Vehicule, Partenaire } from '../src/shared';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/* Intl sépare les milliers et le symbole € par des espaces insécables. */
const sp = <T extends Record<string, unknown>>(o: T | null) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/[\u202f\u00a0]/g, ' ') : v]));
const NOW = new Date('2026-11-11T12:00:00');
const hAgo = (h: number) => new Date(+NOW - h * 36e5).toISOString();
const M = (o: Partial<Mission> = {}): Mission => ({ id: 'm1', titre: 'Navette', clientId: 'c', service: 'van', vehiculeId: 'van', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00', montant: 2400, statut: 'proposition', ...o });
const VAN: Vehicule = { id: 'van', nom: 'Classe V', statut: 'disponible', tarifJour: 650, partenaireId: 'p1', prixAchatJour: 350, dispos: [] };
const LOUEUR: Partenaire = { id: 'p1', nom: 'Loueur Test Rivoli', type: 'loueur', tel: '+33 6 39 98 00 01' };

describe('prestataires : règles d’affichage', () => {
  it('vehicleOn : libellés « Dispo à demander » et « À valider », flotte de la maison inchangée', () => {
    const a = new Date('2026-11-20T10:00'), b = new Date('2026-11-22T18:00');
    expect(vehicleOn([], VAN, a, b)).toMatchObject({ k: 'off', t: 'Dispo à demander', ask: true });
    expect(vehicleOn([], { ...VAN, dispos: [{ du: '2026-11-20', au: '2026-11-22' }] }, a, b).k).toBe('f');
    expect(vehicleOn([], { ...VAN, aValider: true }, a, b)).toEqual({ k: 'off', t: 'À valider' });
    expect(vehicleOn([M({ id: 'autre', statut: 'confirmee' })], VAN, a, b).k).toBe('b');
    expect(vehicleOn([], { id: 'urus', nom: 'Urus' }, a, b).k).toBe('f');
    expect(nowLine([], { ...VAN, aValider: true })).toMatch(/à valider/); expect(nowLine([], VAN)).toBe('Dispo à demander au prestataire');
  });
  it('dispoEtat : non demandée, en attente depuis…, disponible, pas disponible', () => {
    expect(dispoEtat([], M(), VAN, NOW)).toMatchObject({ k: 'a_demander', label: 'Non demandée' });
    const att = dispoEtat([], M({ dispoDemandes: [{ vehiculeId: 'van', partenaireId: 'p1', statut: 'envoyee', envoyeAt: hAgo(3) }] }), VAN, NOW);
    expect(att).toMatchObject({ k: 'attente', label: 'En attente depuis 3 h', st: 'warn' });
    const oui = M({ dispoDemandes: [{ vehiculeId: 'van', partenaireId: 'p1', statut: 'oui', envoyeAt: hAgo(5), reponduAt: hAgo(1), canal: 'portail' }] });
    /* Sur « oui », le serveur ajoute la période aux jours déclarés du véhicule. */
    const couvert = { ...VAN, dispos: [{ du: '2026-11-20', au: '2026-11-22' }] };
    expect(dispoEtat([], oui, couvert, NOW)).toMatchObject({ k: 'oui', label: 'Disponible', st: 'ok' }); expect(dispoEtat([], oui, couvert, NOW).d).toMatch(/sur son portail/);
    expect(dispoEtat([], M({ dispoDemandes: [{ vehiculeId: 'van', partenaireId: 'p1', statut: 'non', reponduAt: hAgo(1), canal: 'whatsapp' }] }), VAN, NOW)).toMatchObject({ k: 'non', label: 'Pas disponible', st: 'bad' });
    /* Jours déclarés sans demande : disponible ; dates changées après un « oui » : à redemander ; véhicule pas encore validé : rien à demander. */
    expect(dispoEtat([], M(), couvert, NOW)).toMatchObject({ k: 'oui', label: 'Disponible' });
    expect(dispoEtat([], { ...oui, fin: '2026-11-25T18:00' }, couvert, NOW)).toMatchObject({ k: 'a_demander' });
    expect(dispoEtat([], M(), { ...VAN, aValider: true }, NOW)).toMatchObject({ k: 'bloque', label: 'À valider' });
    expect(dispoEtat([], M({ debut: '', fin: '' }), VAN, NOW).d).toMatch(/dates/);
    /* La demande d'un autre véhicule ne compte pas. */
    expect(dispoEtat([], M({ dispoDemandes: [{ vehiculeId: 'autre', partenaireId: 'p1', statut: 'oui' }] }), VAN, NOW).k).toBe('a_demander');
  });
  it('depuis : minutes, heures, jours', () => { expect(depuis(hAgo(0.5), NOW)).toBe('30 min'); expect(depuis(hAgo(26), NOW)).toBe('26 h'); expect(depuis(hAgo(72), NOW)).toBe('3 j'); expect(depuis('', NOW)).toBe(''); });
  it('marge : coût d’achat × jours, marge en euros et en %', () => {
    expect(sp(margeLignes(M(), VAN))).toEqual({ cout: '1 050 €', coutD: '3 jours × 350 €', marge: '1 350 €', taux: '56 %', neg: false });
    expect(sp(margeLignes(M({ montant: 900 }), VAN))).toMatchObject({ marge: '-150 €', neg: true });
    expect(margeLignes(M({ montant: '' }), VAN)).toMatchObject({ marge: '—', taux: '', neg: false });
    expect(margeLignes(M(), { id: 'urus', nom: 'Urus', prixAchatJour: 350 })).toBeNull(); expect(margeLignes(M(), { ...VAN, prixAchatJour: '' })).toBeNull();
    expect(seuil({ ...VAN, loyerMois: 3000, chargesMois: 500 })).toBe(0);
  });
  it('todos : inscription, véhicule proposé, prestataire sans réponse depuis 24 h — pour Youssouf, sur la bonne fiche', () => {
    const now = Date.now(); const ago = (h: number) => new Date(now - h * 36e5).toISOString();
    const dd = (h: number, statut: 'envoyee' | 'oui' = 'envoyee') => [{ vehiculeId: 'van', partenaireId: 'p1', statut, envoyeAt: ago(h) }];
    const D = { clients: [], services: [], partenaires: [LOUEUR, { id: 'p2', nom: 'Loueur Test Marais', type: 'loueur', aValider: true, societe: 'Loueur Test Marais SARL', inscription: { at: ago(30), vehicules: 'Un van' } }], vehicules: [VAN, { id: 'prop', nom: 'Range Rover', partenaireId: 'p1', aValider: true }],
      missions: [M({ id: 'tard', dispoDemandes: dd(30) }), M({ id: 'recent', dispoDemandes: dd(2) }), M({ id: 'repondu', dispoDemandes: dd(30, 'oui') }), M({ id: 'perdue', statut: 'perdue', dispoDemandes: dd(30) }), M({ id: 'autre', vehiculeId: 'urus', dispoDemandes: dd(30) })] };
    const T = todos(D); const y = (t: string) => T.youssouf.filter((x) => x.t === t);
    expect(y('Inscription prestataire à valider')).toMatchObject([{ pid: 'p2', sev: 'warn', d: 'Loueur Test Marais SARL · Un van', days: 1 }]);
    expect(y('Véhicule proposé à valider')).toMatchObject([{ vid: 'prop', d: 'Range Rover · Loueur Test Rivoli' }]);
    expect(y('Prestataire sans réponse depuis 24 h')).toMatchObject([{ id: 'tard', sev: 'bad', d: 'Loueur Test Rivoli · Classe V · Navette', days: 1 }]);
    expect([...T.amel, ...T.aziz].some((x) => /prestataire|Véhicule proposé/i.test(x.t))).toBe(false);
  });
  it('jeu de données : un loueur validé (berline et van), une inscription à valider, une demande sur son van', () => {
    const S = seed(); const ps = S.partenaires as unknown as Partenaire[]; const vs = S.vehicules as unknown as Vehicule[];
    expect(loueurs(ps).map((p) => p.id)).toEqual(['p_rivoli']); expect(inscriptions(ps).map((p) => p.id)).toEqual(['p_marais']);
    const mine = vs.filter((v) => v.partenaireId === 'p_rivoli'); expect(mine.map((v) => v.categorie).sort()).toEqual(['Berline', 'Van']); expect(mine.filter((v) => (v.dispos || []).length).length).toBe(1);
    const m = S.missions.find((x) => x.id === 'm_seminaire') as unknown as Mission; expect(dispoEtat(S.missions as never, m, vs.find((v) => v.id === m.vehiculeId)!).k).toBe('a_demander');
  });
});

describe('prestataires : faux serveur (mêmes routes et réponses que docs/prestataires.md)', () => {
  beforeEach(() => { reset(); handle('POST', '/api/auth/login', { userId: 'youssouf', pin: '1234' }); });
  const db = () => sim.state().db;
  it('valider une inscription : retire aValider et crée le lien ; portail : 409 avant validation et hors loueur, régénération', () => {
    expect(handle('POST', '/api/partenaires/p_marais/portail', {})).toMatchObject({ status: 409, body: { error: 'a_valider' } });
    expect(handle('POST', '/api/partenaires/p_karim/portail', {})).toMatchObject({ status: 409, body: { error: 'pas_loueur' } });
    expect(handle('POST', '/api/partenaires/inconnu/valider', {}).status).toBe(404);
    const r = handle('POST', '/api/partenaires/p_marais/valider', {}).body as { token: string; url: string; created: boolean; message: string; waLink: string };
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{24}$/); expect(r.url.endsWith('/p/' + r.token)).toBe(true); expect(r.created).toBe(true); expect(r.message).toContain(r.url); expect(r.waLink.startsWith('https://wa.me/33639980002?text=')).toBe(true);
    expect(db().partenaires.get('p_marais')!.aValider).toBeUndefined(); expect(db().partenaires.get('p_marais')!.portailToken).toBe(r.token);
    const again = handle('POST', '/api/partenaires/p_marais/portail', {}).body as { token: string; created: boolean }; expect(again).toMatchObject({ token: r.token, created: false });
    const neuf = handle('POST', '/api/partenaires/p_marais/portail', { reset: true }).body as { token: string; created: boolean }; expect(neuf.created).toBe(true); expect(neuf.token).not.toBe(r.token);
    expect(handle('GET', '/api/portail/' + r.token, undefined).status).toBe(404); expect(handle('GET', '/api/portail/' + neuf.token, undefined).status).toBe(200);
  });
  it('le lien ne se crée ni ne se change par un PUT de la fiche', () => {
    const t = (handle('POST', '/api/partenaires/p_rivoli/portail', {}).body as { token: string }).token;
    handle('PUT', '/api/doc/partenaires/p_rivoli', { ...db().partenaires.get('p_rivoli'), nom: 'Loueur Test Rivoli (modifié)', portailToken: 'x'.repeat(24) });
    expect(db().partenaires.get('p_rivoli')).toMatchObject({ nom: 'Loueur Test Rivoli (modifié)', portailToken: t });
    handle('PUT', '/api/doc/partenaires/p_neuf', { nom: 'Loueur Test Neuf', type: 'loueur', portailToken: 'y'.repeat(24) }); expect(db().partenaires.get('p_neuf')!.portailToken).toBeUndefined();
  });
  it('demande de dispo : canal WhatsApp ou lien, entrée « envoyee », portail du prestataire, réponse « oui »', () => {
    expect(handle('POST', '/api/missions/m_g63/dispo', { vehiculeId: 'g63' })).toMatchObject({ status: 409, body: { error: 'pas_prestataire' } });
    const w = handle('POST', '/api/missions/m_seminaire/dispo', { vehiculeId: 'v_rivoli_v' }).body as { ok: boolean; canal: string; url: string; message: string; waLink: string };
    expect(w).toMatchObject({ ok: true, canal: 'whatsapp' }); expect(w.message).toMatch(/^Bonjour Camille, Amane a une demande pour votre Classe V 300 d, du .+ au .+\. Est-il disponible \?/); expect(w.message).toContain(w.url);
    sim.state().whatsappOn = false;
    const l = handle('POST', '/api/missions/m_seminaire/dispo', { vehiculeId: 'v_rivoli_v' }).body as { canal: string; waLink: string }; expect(l.canal).toBe('lien'); expect(l.waLink).toContain('wa.me/33639980001');
    const dds = db().missions.get('m_seminaire')!.dispoDemandes as { vehiculeId: string; partenaireId: string; statut: string; canal: string; par: string; envoyeAt: string }[];
    expect(dds).toHaveLength(1); expect(dds[0]).toMatchObject({ vehiculeId: 'v_rivoli_v', partenaireId: 'p_rivoli', statut: 'envoyee', canal: 'lien', par: 'youssouf' });
    /* Portail : ni prix, ni téléphone, ni nom complet du client. */
    const token = String(db().partenaires.get('p_rivoli')!.portailToken); handle('POST', '/api/auth/logout', {});
    const P = handle('GET', '/api/portail/' + token, undefined); const j = P.body as { partenaire: { nom: string }; vehicules: { id: string; dispos: unknown[]; reservations: unknown[] }[]; demandes: Record<string, unknown>[] };
    expect(P.status).toBe(200); expect(j.partenaire).toEqual({ nom: 'Loueur Test Rivoli' }); expect(j.vehicules.map((v) => v.id).sort()).toEqual(['v_rivoli_s', 'v_rivoli_v']);
    expect(j.demandes).toHaveLength(1); expect(Object.keys(j.demandes[0]).sort()).toEqual(['au', 'du', 'lieu', 'missionId', 'prenom', 'statut', 'vehicule', 'vehiculeId']); expect(j.demandes[0]).toMatchObject({ missionId: 'm_seminaire', vehicule: 'Classe V 300 d', statut: 'envoyee', prenom: 'Studio' });
    expect(JSON.stringify(j)).not.toMatch(/2400|montant|tarifJour|prixAchat|\+33 1 42|nova\.example|Nova Prod/);
    expect(handle('POST', `/api/portail/${token}/demandes/m_seminaire`, { vehiculeId: 'v_rivoli_v', reponse: 'peut-être' }).status).toBe(400);
    expect(handle('POST', `/api/portail/${token}/demandes/m_seminaire`, { vehiculeId: 'v_rivoli_v', reponse: 'oui' })).toMatchObject({ status: 200, body: { ok: true, statut: 'oui', deja: false } });
    const m = db().missions.get('m_seminaire') as unknown as Mission; const v = db().vehicules.get('v_rivoli_v') as unknown as Vehicule;
    expect(m.dispoDemandes![0]).toMatchObject({ statut: 'oui', canal: 'portail' }); expect(m.dispoDemandes![0].reponduAt).toBeTruthy(); expect(dispoEtat([m], m, v)).toMatchObject({ k: 'oui', label: 'Disponible' });
    const n = sim.state().activity.length; handle('POST', `/api/portail/${token}/demandes/m_seminaire`, { vehiculeId: 'v_rivoli_v', reponse: 'oui' }); expect(sim.state().activity.length).toBe(n);
  });
  it('portail : jours déclarés remplacés (les siens seulement), véhicule proposé « à valider », lien inconnu → 404', () => {
    const token = (handle('POST', '/api/partenaires/p_rivoli/portail', {}).body as { token: string }).token; handle('POST', '/api/auth/logout', {});
    expect(handle('POST', `/api/portail/${token}/dispos`, { vehiculeId: 'v_rivoli_v', dispos: [{ du: '2026-12-03', au: '2026-12-01' }, { du: '2026-12-04', au: '2026-12-05' }] }).body).toEqual({ ok: true, dispos: [{ du: '2026-12-01', au: '2026-12-05' }] });
    expect(handle('POST', `/api/portail/${token}/dispos`, { vehiculeId: 'urus', dispos: [] }).status).toBe(404);
    expect(handle('POST', `/api/portail/${token}/dispos`, { vehiculeId: 'v_rivoli_v', dispos: [{ du: 'demain', au: '2026-12-05' }] }).status).toBe(400);
    expect(handle('POST', `/api/portail/${token}/dispos`, { vehiculeId: 'v_rivoli_v', dispos: [{ du: '2031-01-01', au: '2031-01-02' }] }).status).toBe(400);
    const r = handle('POST', `/api/portail/${token}/vehicules`, { nom: 'Range Rover Sport', categorie: 'SUV', prixJour: 480 }).body as { ok: boolean; id: string };
    expect(db().vehicules.get(r.id)).toMatchObject({ nom: 'Range Rover Sport', partenaireId: 'p_rivoli', aValider: true, prixAchatJour: 480 });
    expect(handle('GET', '/api/portail/' + 'z'.repeat(24), undefined)).toMatchObject({ status: 404, body: { error: 'introuvable' } }); expect(handle('GET', '/api/portail/court', undefined).status).toBe(404);
  });
  it('inscription publique : téléphone obligatoire, champ piège, pas de doublon, aucun accès avant validation', () => {
    handle('POST', '/api/auth/logout', {}); const n = db().partenaires.size;
    expect(handle('POST', '/api/prestataires/inscription', { societe: 'Loueur Test Bastille', nom: 'Alex', tel: '12' })).toMatchObject({ status: 400, body: { error: 'tel_invalide' } }); expect(handle('POST', '/api/prestataires/inscription', { societe: 'Loueur Test Bastille' })).toMatchObject({ status: 400, body: { error: 'tel_requis' } });
    expect(handle('POST', '/api/prestataires/inscription', { societe: 'Robot', tel: '+33 6 39 98 00 09', website: 'http://spam.example' }).body).toEqual({ ok: true }); expect(db().partenaires.size).toBe(n);
    expect(handle('POST', '/api/prestataires/inscription', { societe: 'Loueur Test Bastille', nom: 'Alex', tel: '+33 6 39 98 00 09', email: 'alex@loueur-bastille.example', siren: '000 000 034', vehicules: 'Deux berlines', message: 'Bonjour' }).body).toEqual({ ok: true });
    const p = [...db().partenaires.values()].find((x) => x.telNorm === '33639980009')!; expect(p).toMatchObject({ nom: 'Loueur Test Bastille', type: 'loueur', aValider: true, contact: 'Alex', societe: 'Loueur Test Bastille', siren: '000 000 034', inscription: { vehicules: 'Deux berlines', message: 'Bonjour' } }); expect(p.portailToken).toBeUndefined();
    expect(handle('POST', '/api/prestataires/inscription', { societe: 'Encore', tel: '06 39 98 00 09' }).body).toEqual({ ok: true }); expect(db().partenaires.size).toBe(n + 1);
    expect(handle('POST', '/api/prestataires/inscription', { societe: 'Déjà connu', tel: '+33 6 39 98 00 01' }).body).toEqual({ ok: true }); expect(db().partenaires.size).toBe(n + 1);
  });
  it('rentabilité : véhicule de prestataire sans loyer ni charges, coûts = prix d’achat × jours loués', () => {
    const now = new Date(); const d = (h: number) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15T${String(h).padStart(2, '0')}:00`;
    sim.change('missions', { ...db().missions.get('m_seminaire')!, statut: 'confirmee', debut: d(8), fin: d(19) });
    const it0 = (handle('GET', '/api/flotte/rentabilite', undefined).body as { items: { vehiculeId: string; partenaireId?: string; loyer: number; charges: number; joursLoues: number; couts: number; ca: number; marge: number }[] }).items.find((i) => i.vehiculeId === 'v_rivoli_v')!;
    expect(it0).toMatchObject({ partenaireId: 'p_rivoli', loyer: 0, charges: 0, joursLoues: 1, couts: 350, ca: 2400, marge: 2050 });
  });
});

describe('prestataires : écrans (Carnet, Flotte, fiches)', () => {
  /* Le store garde l'horodatage de ses écritures confirmées d'un test à l'autre : les fiches d'exemple repartent « à l'instant » pour ne pas être prises pour de vieilles versions. */
  async function fresh() { cleanup(); reset(); const t = new Date().toISOString(); (['partenaires', 'vehicules', 'missions'] as const).forEach((c) => sim.state().db[c].forEach((d) => { d.updatedAt = t; })); await queue.clear(); await cache.clear(); useUI.setState({ drawer: null, toasts: [], filters: { mine: false, svc: '', q: '', week: 0, todo: '', fm: 0 } }); useStore.setState({ user: null, auth: 'boot', since: '', ready: false, offline: false, pending: 0, clients: [], missions: [], vehicules: [], services: [], partenaires: [], reglages: [], conversations: [], messages: [], feed: null, compteurs: {} }); await useStore.getState().login('youssouf', '1234'); await wait(80); }
  beforeEach(fresh);
  const ui = (el: React.ReactElement) => render(<MemoryRouter>{el}<Drawer /><Toasts /></MemoryRouter>);
  it('actions serveur : le lien et la demande se reportent tout de suite sur la fiche locale ; hors ligne, erreur claire', async () => {
    const r = await portailLien('p_rivoli'); expect(r.url).toBe(portailUrl(r.token)); expect(useStore.getState().partenaires.find((p) => p.id === 'p_rivoli')?.portailToken).toBe(r.token);
    const d = await demanderDispo('m_seminaire', 'v_rivoli_v', 'p_rivoli'); expect(d.canal).toBe('whatsapp'); expect(useStore.getState().missions.find((m) => m.id === 'm_seminaire')?.dispoDemandes?.[0]).toMatchObject({ vehiculeId: 'v_rivoli_v', statut: 'envoyee', par: 'youssouf' });
    sim.setOffline(true); await expect(portailLien('p_rivoli', { reset: true })).rejects.toMatchObject({ code: 'offline' }); await expect(demanderDispo('m_seminaire', 'v_rivoli_v', 'p_rivoli')).rejects.toMatchObject({ code: 'offline' }); sim.setOffline(false);
  });
  it('Carnet : inscriptions à valider en tête ; Valider ouvre la fiche avec le lien ; Refuser demande confirmation', async () => {
    ui(<Carnet />);
    const box = screen.getByTestId('inscriptions'); expect(box).toHaveTextContent('Loueur Test Marais'); expect(box).toHaveTextContent('Un Classe V 2023 et un Range Rover Sport'); expect(screen.getByTestId('part-p_rivoli')).toHaveTextContent('2 véhicules'); expect(screen.queryByTestId('part-p_marais')).toBeNull();
    fireEvent.click(screen.getByTestId('insc-refus-p_marais')); expect(screen.getByText('Refuser et supprimer ?')).toBeInTheDocument(); fireEvent.click(screen.getByText('Annuler'));
    fireEvent.click(screen.getByTestId('insc-ok-p_marais'));
    await waitFor(() => expect(screen.getByTestId('portail-url').textContent).toMatch(/\/p\/[A-Za-z0-9_-]{24}$/), { timeout: 4000 });
    expect(screen.queryByTestId('inscriptions')).toBeNull(); expect(screen.getByTestId('part-p_marais')).toBeInTheDocument(); expect(sim.state().db.partenaires.get('p_marais')!.aValider).toBeUndefined();
    expect(screen.getByText('Envoyer sur WhatsApp').closest('a')!.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/33639980002\?text=Bonjour%20Sacha/);
    /* Enregistrer la fiche ne touche ni au lien ni à la validation. */
    const t = sim.state().db.partenaires.get('p_marais')!.portailToken; fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Rappeler lundi' } }); fireEvent.click(screen.getByTestId('save')); await wait(120);
    expect(sim.state().db.partenaires.get('p_marais')).toMatchObject({ notes: 'Rappeler lundi', portailToken: t }); expect(sim.state().db.partenaires.get('p_marais')!.aValider).toBeUndefined();
  });
  it('Carnet : refuser une inscription la supprime', async () => {
    ui(<Carnet />); fireEvent.click(screen.getByTestId('insc-refus-p_marais')); fireEvent.click(screen.getByTestId('insc-refus-oui-p_marais'));
    await waitFor(() => expect(sim.state().db.partenaires.get('p_marais')?._deleted).toBe(true)); expect(screen.queryByTestId('inscriptions')).toBeNull();
  });
  it('fiche loueur : créer le lien, le régénérer avec confirmation, ses véhicules', async () => {
    ui(<></>); useUI.getState().openDrawer('partenaire', 'p_rivoli');
    await waitFor(() => expect(screen.getByTestId('portail')).toBeInTheDocument()); expect(screen.getByLabelText('Société')).toHaveValue('Loueur Test Rivoli SAS'); expect(screen.getByLabelText('SIREN')).toHaveValue('000 000 018');
    expect(screen.getByTestId('pv-v_rivoli_s')).toHaveTextContent('Classe S 580'); expect(screen.getByTestId('pv-v_rivoli_v')).toHaveTextContent('Dispo à demander');
    fireEvent.click(screen.getByTestId('portail-btn')); await waitFor(() => expect(screen.getByTestId('portail-url')).toBeInTheDocument()); const u1 = screen.getByTestId('portail-url').textContent;
    fireEvent.click(screen.getByTestId('portail-reset')); expect(screen.getByText(/L’ancien lien cessera de marcher/)).toBeInTheDocument(); fireEvent.click(screen.getByTestId('portail-reset-oui'));
    await waitFor(() => expect(screen.getByTestId('portail-url').textContent).not.toBe(u1)); expect(screen.getByTestId('portail-url').textContent).toMatch(/\/p\/[A-Za-z0-9_-]{24}$/);
  });
  it('Flotte : pastille du propriétaire, véhicule proposé en tête avec « Valider », fiche sans loyer ni charges', async () => {
    sim.change('vehicules', { id: 'v_prop', nom: 'Range Rover Sport', categorie: 'SUV', statut: 'disponible', partenaireId: 'p_rivoli', prixAchatJour: 480, aValider: true }); await useStore.getState().sync();
    ui(<Flotte />);
    expect(screen.getByTestId('own-v_rivoli_s')).toHaveTextContent('Loueur Test Rivoli'); expect(screen.queryByTestId('own-urus')).toBeNull(); expect(screen.getByTestId('veh-v_rivoli_v')).toHaveTextContent('Dispo à demander');
    expect(screen.getByTestId('aval-v_prop')).toHaveTextContent('Proposé par Loueur Test Rivoli'); expect(screen.queryByTestId('veh-v_prop')).toBeNull();
    fireEvent.click(screen.getByTestId('aval-ok-v_prop')); await waitFor(() => expect(screen.getByTestId('veh-v_prop')).toBeInTheDocument()); await wait(80);
    expect(sim.state().db.vehicules.get('v_prop')!.aValider).toBeUndefined(); expect(screen.queryByTestId('veh-a-valider')).toBeNull();
    fireEvent.click(screen.getByTestId('veh-v_rivoli_s')); await waitFor(() => expect(screen.getByLabelText('Appartient à')).toHaveValue('p_rivoli'));
    expect(screen.getByLabelText('Prix d’achat / jour (€)')).toHaveValue(520); expect(screen.queryByLabelText('Loyer leasing / mois (€)')).toBeNull(); expect(screen.queryByLabelText('Assurance + entretien / mois (€)')).toBeNull();
    fireEvent.change(screen.getByLabelText('Appartient à'), { target: { value: '' } }); expect(screen.queryByLabelText('Prix d’achat / jour (€)')).toBeNull(); expect(screen.getByLabelText('Loyer leasing / mois (€)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Appartient à'), { target: { value: 'p_rivoli' } });
    /* Jours déclarés : ajout par deux dates (fusion des périodes qui se touchent), retrait, enregistrement. */
    fireEvent.click(screen.getByTestId('tab-dispo')); const n0 = screen.getByTestId('jours').children.length; expect(n0).toBe(2);
    const dr = within(screen.getByTestId('drawer')); fireEvent.change(dr.getByLabelText('Du'), { target: { value: '2030-01-10' } }); fireEvent.change(dr.getByLabelText('Au'), { target: { value: '2030-01-12' } }); fireEvent.click(screen.getByTestId('jours-add'));
    expect(screen.getByTestId('jours').children.length).toBe(3); expect(screen.getByTestId('jours')).toHaveTextContent('3 jours');
    fireEvent.click(screen.getAllByLabelText('Retirer la période')[0]); fireEvent.click(screen.getByTestId('save')); await wait(120);
    const ds = sim.state().db.vehicules.get('v_rivoli_s')!.dispos as { du: string; au: string }[]; expect(ds).toHaveLength(2); expect(ds[1]).toEqual({ du: '2030-01-10', au: '2030-01-12' });
  });
  it('fiche demande : non demandée → message et WhatsApp (canal lien) → réponse « oui » → Disponible ; marge affichée', async () => {
    const off = sim.on(handleEvent as never); sim.state().whatsappOn = false;
    ui(<></>); useUI.getState().openDrawer('mission', 'm_seminaire');
    await waitFor(() => expect(screen.getByTestId('dispo')).toBeInTheDocument());
    expect(screen.getByTestId('dispo-etat')).toHaveTextContent('Non demandée'); expect(screen.getByTestId('dispo')).toHaveTextContent('Loueur Test Rivoli · Classe V 300 d');
    expect(screen.getByTestId('marge')).toHaveTextContent('3 jours × 350 €'); expect(screen.getByTestId('marge')).toHaveTextContent('1 350 € · 56 %');
    /* Garde-fou : véhicule ou dates modifiés sans enregistrer. */
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2031-01-01T10:00' } }); fireEvent.click(screen.getByTestId('dispo-btn'));
    await waitFor(() => expect(screen.getByText(/Enregistrez d’abord la demande/)).toBeInTheDocument()); expect(sim.state().db.missions.get('m_seminaire')!.dispoDemandes).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: String(sim.state().db.missions.get('m_seminaire')!.fin) } });
    fireEvent.click(screen.getByTestId('dispo-btn'));
    await waitFor(() => expect(screen.getByTestId('dispo-etat')).toHaveTextContent(/En attente depuis/), { timeout: 4000 });
    expect(screen.getByTestId('dispo-msg')).toHaveTextContent(/Amane a une demande pour votre Classe V 300 d/); expect(screen.getByTestId('dispo-wa').getAttribute('href')).toContain('wa.me/33639980001'); expect(screen.getByTestId('dispo-btn')).toHaveTextContent('Relancer');
    sim.dispoReponse('m_seminaire', 'v_rivoli_v', 'oui');
    await waitFor(() => expect(screen.getByTestId('dispo-etat')).toHaveTextContent('Disponible')); expect(screen.queryByTestId('dispo-btn')).toBeNull(); expect(screen.queryByTestId('dispo-msg')).toBeNull();
    /* Enregistrer la demande garde la réponse du prestataire (le brouillon ne l'écrase pas). */
    fireEvent.change(screen.getByLabelText('Lieu de remise'), { target: { value: 'Gare de Lyon, hall 1' } }); fireEvent.click(screen.getByTestId('save')); await wait(120);
    expect(sim.state().db.missions.get('m_seminaire')).toMatchObject({ lieu: 'Gare de Lyon, hall 1' }); expect((sim.state().db.missions.get('m_seminaire')!.dispoDemandes as { statut: string }[])[0].statut).toBe('oui');
    off();
  });
  it('fiche demande : canal WhatsApp → simple « Demande envoyée » ; hors ligne → message clair ; demande non enregistrée → bouton inactif', async () => {
    ui(<></>); useUI.getState().openDrawer('mission', 'm_seminaire'); await waitFor(() => expect(screen.getByTestId('dispo')).toBeInTheDocument());
    sim.setOffline(true); fireEvent.click(screen.getByTestId('dispo-btn')); await waitFor(() => expect(screen.getByText(/Hors ligne : la dispo se demande/)).toBeInTheDocument()); sim.setOffline(false);
    fireEvent.click(screen.getByTestId('dispo-btn')); await waitFor(() => expect(screen.getByTestId('dispo-envoyee')).toHaveTextContent('Demande envoyée')); expect(screen.queryByTestId('dispo-msg')).toBeNull();
    cleanup(); ui(<></>); useUI.getState().openDrawer('mission', null, 'main', { vehiculeId: 'v_rivoli_v' }); await waitFor(() => expect(screen.getByTestId('dispo-btn')).toBeDisabled()); expect(screen.getByTestId('dispo-btn')).toHaveTextContent('Enregistrez d’abord la demande');
  });
});
