import React from 'react';
import { Linking, Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Hero } from '@/components/Hero';
import { useStore } from '@/store';
import * as seed from '@/mocks/data';

const router = (globalThis as any).__routerMock;
const data = () => ({ clients: seed.clients, missions: seed.missions, vehicules: seed.vehicules, services: seed.services, partenaires: seed.partenaires, reglages: [], conversations: seed.conversations, messages: seed.messages } as any);

describe('carte héros « Prochaine mission »', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); useStore.setState({ data: data(), me: { id: 'amel', nom: 'Amel', role: 'Relation client' } }); });

  test('mission en cours : fin prévue, Appeler / WhatsApp / Itinéraire avec les URL exactes', async () => {
    const now = new Date(); now.setHours(12, 0, 0, 0);
    const ui = await render(<Hero now={now} />);
    // m_whitmore est en cours (10 h → J+2) : Ferrari 296 GTB
    expect(ui.getByTestId('hero-title')).toHaveTextContent('Ferrari 296 GTB — week-end');
    expect(ui.getByTestId('hero-time')).toHaveTextContent('19:00');
    expect(ui.getByText('En cours · fin prévue')).toBeTruthy();
    await fireEvent.press(ui.getByTestId('hero-tel'));
    expect(Linking.openURL).toHaveBeenLastCalledWith('tel:+447700900123');
    await fireEvent.press(ui.getByTestId('hero-wa'));
    expect(Linking.openURL).toHaveBeenLastCalledWith('https://wa.me/447700900123?text=' + encodeURIComponent('Dear James Whitmore, '));
    await fireEvent.press(ui.getByTestId('hero-maps'));
    const expected = Platform.OS === 'ios' ? 'https://maps.apple.com/?daddr=' + encodeURIComponent('Le Bristol, 112 rue du Faubourg Saint-Honoré, 75008 Paris') : 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('Le Bristol, 112 rue du Faubourg Saint-Honoré, 75008 Paris');
    expect(Linking.openURL).toHaveBeenLastCalledWith(expected);
    await fireEvent.press(ui.getByTestId('hero-open'));
    expect(router.push).toHaveBeenCalledWith('/mission/m_whitmore');
  });

  test('prochaine mission confirmée quand rien n’est en cours', async () => {
    const now = new Date(); now.setHours(23, 45, 0, 0);
    const d = data(); d.missions = d.missions.filter((m: any) => m.id !== 'm_whitmore'); useStore.setState({ data: d });
    const ui = await render(<Hero now={now} />);
    expect(ui.getByTestId('hero-title')).toHaveTextContent('G 63 — semaine');
    expect(ui.getByTestId('hero-time')).toHaveTextContent('10:00');
    await fireEvent.press(ui.getByTestId('hero-tel'));
    expect(Linking.openURL).toHaveBeenLastCalledWith('tel:+79161234567');
  });

  test('sans mission confirmée : état vide élégant', async () => {
    const d = data(); d.missions = []; useStore.setState({ data: d });
    const ui = await render(<Hero />);
    expect(ui.getByTestId('hero-none')).toBeTruthy();
    expect(ui.getByText('Aucune mission confirmée à venir.')).toBeTruthy();
  });

  test('sans numéro ni lieu : cellules désactivées', async () => {
    const d = data(); d.clients = d.clients.map((c: any) => ({ ...c, tel: '' })); d.missions = d.missions.map((m: any) => ({ ...m, lieu: '' })); useStore.setState({ data: d });
    const now = new Date(); now.setHours(12, 0, 0, 0);
    const ui = await render(<Hero now={now} />);
    expect(ui.getByTestId('hero-tel')).toBeDisabled(); expect(ui.getByTestId('hero-maps')).toBeDisabled();
  });
});
