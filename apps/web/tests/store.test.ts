import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/store/store';
import { sim, reset } from '../src/mocks/node';
import { handleEvent } from '../src/lib/ws';
import { queue, cache } from '../src/lib/queue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fresh() { reset(); await queue.clear(); await cache.clear(); useStore.setState({ user: null, auth: 'boot', since: '', ready: false, offline: false, pending: 0, clients: [], missions: [], vehicules: [], services: [], partenaires: [], reglages: [], conversations: [], messages: [], feed: null, compteurs: {} }); }

describe('store : connexion, synchro, écritures optimistes, hors ligne', () => {
  beforeEach(fresh);
  it('boot sans session → écran de connexion ; login → données chargées', async () => {
    await useStore.getState().boot(); expect(useStore.getState().auth).toBe('login');
    await useStore.getState().login('amel', '1234'); expect(useStore.getState().user?.nom).toBe('Amel');
    await wait(80); const s = useStore.getState(); expect(s.ready).toBe(true); expect(s.missions.length).toBeGreaterThan(5); expect(s.vehicules.length).toBe(7); expect(s.conversations.length).toBe(4); expect(s.since).toBeTruthy();
  });
  it('mauvais PIN → 401 bad_pin', async () => { await expect(useStore.getState().login('amel', '9999')).rejects.toMatchObject({ status: 401, code: 'bad_pin' }); });
  it('put : visible aussitôt, envoyé au serveur, activité tracée', async () => {
    await useStore.getState().login('amel', '1234'); await wait(80);
    const id = await useStore.getState().put('missions', { titre: 'Test optimiste', clientId: 'c_laurent', service: 'location', debut: '2026-12-01T10:00', fin: '2026-12-02T10:00', statut: 'nouvelle' });
    expect(useStore.getState().missions.find((m) => m.id === id)?.titre).toBe('Test optimiste');
    await wait(80); expect(useStore.getState().pending).toBe(0); expect(sim.state().db.missions.get(id)?.titre).toBe('Test optimiste'); expect(sim.state().activity[0].resume).toBe('Création : Test optimiste');
    await useStore.getState().put('missions', { ...useStore.getState().missions.find((m) => m.id === id)!, statut: 'proposition' }); await wait(80);
    expect(sim.state().activity[0].resume).toBe('statut : Nouvelle → Proposition');
  });
  it('hors ligne : la modification attend dans la file puis part au retour du réseau', async () => {
    await useStore.getState().login('amel', '1234'); await wait(80);
    sim.setOffline(true);
    const id = await useStore.getState().put('clients', { nom: 'Client hors ligne', tel: '0611111111' }); await wait(60);
    expect(useStore.getState().pending).toBe(1); expect(useStore.getState().offline).toBe(true); expect(sim.state().db.clients.has(id)).toBe(false);
    expect((await queue.all()).length).toBe(1);
    sim.setOffline(false); await useStore.getState().sync(); await wait(60);
    expect(useStore.getState().pending).toBe(0); expect(useStore.getState().offline).toBe(false); expect(sim.state().db.clients.get(id)?.nom).toBe('Client hors ligne');
  });
  it('sync incrémentale : une modification côté serveur arrive au client, les suppressions aussi', async () => {
    await useStore.getState().login('amel', '1234'); await wait(80);
    sim.change('missions', { ...sim.state().db.missions.get('m_g63')!, titre: 'Modifié ailleurs' }); await useStore.getState().sync();
    expect(useStore.getState().missions.find((m) => m.id === 'm_g63')?.titre).toBe('Modifié ailleurs');
    const d = sim.state().db.missions.get('m_perdue')!; sim.state().db.missions.set('m_perdue', { ...d, _deleted: true, updatedAt: new Date().toISOString() }); await useStore.getState().sync();
    expect(useStore.getState().missions.find((m) => m.id === 'm_perdue')).toBeUndefined();
  });
  it('WebSocket : message entrant et conversation mis à jour en direct, sans écraser une écriture en attente', async () => {
    await useStore.getState().login('amel', '1234'); await wait(80); const off = sim.on(handleEvent as never);
    const mid = sim.inbound('971501234567', 'شكراً جزيلاً');
    const s = useStore.getState(); const cv = s.conversations.find((c) => c.id === '971501234567')!; expect(cv.unread).toBe(3);
    const last = s.messages.find((m) => m.id === mid)!; expect(last.translation).toBe('Merci beaucoup.');
    sim.setOffline(true); await useStore.getState().put('missions', { ...useStore.getState().missions.find((m) => m.id === 'm_g63')!, titre: 'Local' }); await wait(30);
    handleEvent({ type: 'change', col: 'missions', doc: { ...sim.state().db.missions.get('m_g63')!, titre: 'Serveur' } as never });
    expect(useStore.getState().missions.find((m) => m.id === 'm_g63')?.titre).toBe('Local'); sim.setOffline(false); off();
  });
  it('counter : numérotation atomique', async () => { await useStore.getState().login('amel', '1234'); const n1 = await useStore.getState().counter('devis-2026'); const n2 = await useStore.getState().counter('devis-2026'); expect(n2).toBe(n1 + 1); });
  it('logout vide tout', async () => { await useStore.getState().login('amel', '1234'); await wait(80); await useStore.getState().logout(); expect(useStore.getState().auth).toBe('login'); expect(useStore.getState().missions.length).toBe(0); });
});
