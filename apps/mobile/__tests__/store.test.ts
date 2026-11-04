import { installMockFetch, resetMock, mockState } from '@/mocks/server';
import { useStore } from '@/store';
import { ApiError } from '@/lib/api';

beforeAll(() => installMockFetch());
beforeEach(async () => { resetMock(); useStore.getState().stopLive(); await useStore.getState().logout(); });
afterAll(() => useStore.getState().stopLive());

describe('store : connexion, synchro, écritures optimistes, file hors ligne', () => {
  test('login : 401 bad_pin, 409 no_pin, 429 trop de tentatives, puis succès', async () => {
    const s = useStore.getState();
    await expect(s.login('amel', '0000')).rejects.toMatchObject({ status: 401, code: 'bad_pin' });
    mockState().pins.aziz = null;
    await expect(s.login('aziz', '1234')).rejects.toMatchObject({ status: 409, code: 'no_pin' });
    mockState().fails.youssouf = 5;
    const e429 = await s.login('youssouf', '1234').catch((e) => e);
    expect(e429).toBeInstanceOf(ApiError); expect(e429.status).toBe(429); expect(e429.message).toMatch(/quinze minutes/);
    await s.login('amel', '1234');
    expect(useStore.getState().me).toMatchObject({ id: 'amel', nom: 'Amel' });
    useStore.getState().stopLive();
  });

  test('setup : code d’installation puis PIN', async () => {
    const s = useStore.getState(); mockState().pins.aziz = null;
    await expect(s.setup('FAUX', 'aziz', '2468')).rejects.toMatchObject({ code: 'bad_code' });
    await s.setup('SETUP-AMANE', 'aziz', '2468'); await s.login('aziz', '2468');
    expect(useStore.getState().me?.id).toBe('aziz'); useStore.getState().stopLive();
  });

  test('sync complète puis incrémentale', async () => {
    await useStore.getState().login('amel', '1234'); useStore.getState().stopLive();
    await useStore.getState().syncNow(true);
    const st = useStore.getState();
    expect(st.sync).toBe('online'); expect(st.data.missions.length).toBeGreaterThan(3); expect(st.data.conversations.length).toBe(5); expect(st.since).toBeTruthy();
    // une modification côté serveur arrive par la synchro incrémentale
    const m = mockState().cols.missions.find((x) => x.id === 'm_dupont')!; m.statut = 'confirmee'; m.updatedAt = new Date(Date.now() + 10).toISOString();
    await useStore.getState().syncNow();
    expect(useStore.getState().data.missions.find((x) => x.id === 'm_dupont')?.statut).toBe('confirmee');
  });

  test('save : optimiste + PUT /api/doc ; hors ligne → file rejouée au retour', async () => {
    await useStore.getState().login('amel', '1234'); useStore.getState().stopLive(); await useStore.getState().syncNow(true);
    const m = useStore.getState().data.missions.find((x) => x.id === 'm_garcia')!;
    await useStore.getState().save('missions', { ...m, statut: 'proposition' });
    expect(useStore.getState().data.missions.find((x) => x.id === 'm_garcia')?.statut).toBe('proposition');
    expect(mockState().cols.missions.find((x) => x.id === 'm_garcia')?.statut).toBe('proposition');
    mockState().offline = true;
    await useStore.getState().save('missions', { ...m, statut: 'confirmee' }, 'Confirmer');
    expect(useStore.getState().data.missions.find((x) => x.id === 'm_garcia')?.statut).toBe('confirmee');
    expect(useStore.getState().pending).toHaveLength(1); expect(useStore.getState().sync).toBe('offline');
    expect(mockState().cols.missions.find((x) => x.id === 'm_garcia')?.statut).toBe('proposition');
    mockState().offline = false;
    await useStore.getState().flush();
    expect(useStore.getState().pending).toHaveLength(0); expect(useStore.getState().sync).toBe('online');
    expect(mockState().cols.missions.find((x) => x.id === 'm_garcia')?.statut).toBe('confirmee');
  });

  test('sendMessage : optimiste, envoyé, puis 409 window_closed sans modèle', async () => {
    await useStore.getState().login('amel', '1234'); useStore.getState().stopLive(); await useStore.getState().syncNow(true);
    const id = await useStore.getState().sendMessage('971501234567', { text: 'مرحباً' }, { type: 'text', text: 'مرحباً' });
    const msg = useStore.getState().data.messages.find((x) => x.id === id);
    expect(msg).toMatchObject({ dir: 'out', status: 'envoye', by: 'amel', text: 'مرحباً' });
    expect(mockState().outbox[0]).toMatchObject({ convId: '971501234567', text: 'مرحباً' });
    expect(useStore.getState().data.conversations.find((c) => c.id === '971501234567')?.lastDir).toBe('out');
    await expect(useStore.getState().sendMessage('33612345678', { text: 'Bonjour' }, { type: 'text', text: 'Bonjour' })).rejects.toMatchObject({ status: 409, code: 'window_closed' });
    expect(useStore.getState().data.messages.some((x) => x.text === 'Bonjour' && x.convId === '33612345678')).toBe(false);
    const tid = await useStore.getState().sendMessage('33612345678', { template: { name: 'amane_relance', lang: 'fr', params: ['Claire'] } }, { type: 'template', text: '[Modèle amane_relance] Claire' });
    expect(useStore.getState().data.messages.find((x) => x.id === tid)?.type).toBe('template');
  });

  test('markRead et notes internes', async () => {
    await useStore.getState().login('amel', '1234'); useStore.getState().stopLive(); await useStore.getState().syncNow(true);
    await useStore.getState().markRead('971501234567');
    expect(useStore.getState().data.conversations.find((c) => c.id === '971501234567')?.unread).toBe(0);
    expect(mockState().cols.conversations.find((c) => c.id === '971501234567')?.unread).toBe(0);
    await useStore.getState().addNote('971501234567', 'Siège enfant à prévoir');
    expect(useStore.getState().data.messages.filter((x) => x.dir === 'note' && x.convId === '971501234567').length).toBe(2);
    expect(mockState().cols.messages.filter((x) => x.dir === 'note').length).toBe(2);
  });

  test('applyEvent (WebSocket) met à jour les données', () => {
    useStore.getState().applyEvent({ type: 'message', message: { id: 'ws1', convId: '971501234567', dir: 'in', type: 'text', text: 'ok', at: new Date().toISOString(), status: 'recu', by: 'client' } });
    expect(useStore.getState().data.messages.find((x) => x.id === 'ws1')).toBeTruthy();
    useStore.getState().applyEvent({ type: 'deleted', col: 'messages', id: 'ws1' });
    expect(useStore.getState().data.messages.find((x) => x.id === 'ws1')).toBeFalsy();
  });
});

describe('store : identités serveur après rejeu hors ligne', () => {
  test('note et message envoyés hors ligne prennent l’id du serveur au rejeu (pas de doublon)', async () => {
    await useStore.getState().login('amel', '1234'); useStore.getState().stopLive(); await useStore.getState().syncNow(true);
    mockState().offline = true;
    await useStore.getState().addNote('971501234567', 'Hors ligne : note');
    await useStore.getState().sendMessage('971501234567', { text: 'Hors ligne : message' }, { type: 'text', text: 'Hors ligne : message' });
    expect(useStore.getState().pending).toHaveLength(2);
    expect(useStore.getState().data.messages.filter((x) => String(x.status) === 'sending')).toHaveLength(1);
    mockState().offline = false;
    await useStore.getState().flush();
    await useStore.getState().syncNow();
    const notes = useStore.getState().data.messages.filter((x) => x.text === 'Hors ligne : note');
    const msgs = useStore.getState().data.messages.filter((x) => x.text === 'Hors ligne : message');
    expect(notes).toHaveLength(1); expect(notes[0].id).toMatch(/^note_/); expect(mockState().cols.messages.some((x) => x.id === notes[0].id)).toBe(true);
    expect(msgs).toHaveLength(1); expect(msgs[0].status).toBe('envoye'); expect(msgs[0].id).toMatch(/^out_/);
    // en ligne : la note prend tout de suite l'id du serveur
    await useStore.getState().addNote('971501234567', 'En ligne : note');
    const n2 = useStore.getState().data.messages.filter((x) => x.text === 'En ligne : note');
    expect(n2).toHaveLength(1); expect(mockState().cols.messages.some((x) => x.id === n2[0].id)).toBe(true);
  });
});
