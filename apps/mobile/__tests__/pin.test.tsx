import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import Login from '@/app/login';
import { useStore } from '@/store';
import { installMockFetch, resetMock, mockState } from '@/mocks/server';

const router = (globalThis as any).__routerMock;
beforeAll(() => installMockFetch());
beforeEach(async () => { resetMock(); jest.clearAllMocks(); useStore.getState().stopLive(); await useStore.getState().logout(); });
afterAll(() => useStore.getState().stopLive());

const typePin = async (ui: Awaited<ReturnType<typeof render>>, pin: string) => { for (const k of pin) await fireEvent.press(ui.getByTestId(`key-${k}`)); };

describe('écran Connexion', () => {
  test('trois tuiles, pavé, connexion réussie', async () => {
    const ui = await render(<Login />);
    expect(ui.getByTestId('tile-amel')).toBeTruthy(); expect(ui.getByTestId('tile-youssouf')).toBeTruthy(); expect(ui.getByTestId('tile-aziz')).toBeTruthy();
    expect(ui.getByTestId('slogan')).toHaveTextContent('Arrive as a Guest. Leave with a Story.');
    await fireEvent.press(ui.getByTestId('tile-amel'));
    expect(ui.getByText('Votre code')).toBeTruthy();
    await typePin(ui, '1234');
    await act(async () => { await fireEvent.press(ui.getByTestId('key-ok')); });
    await waitFor(() => expect(useStore.getState().me?.id).toBe('amel'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    useStore.getState().stopLive();
  });

  test('code faux → « Code incorrect. » puis 429 après cinq échecs', async () => {
    const ui = await render(<Login />);
    await fireEvent.press(ui.getByTestId('tile-youssouf'));
    await typePin(ui, '9999');
    await act(async () => { await fireEvent.press(ui.getByTestId('key-ok')); });
    await waitFor(() => expect(ui.getByTestId('login-error')).toHaveTextContent('Code incorrect.'));
    expect(useStore.getState().me).toBeNull();
    mockState().fails.youssouf = 5;
    await typePin(ui, '1234');
    await act(async () => { await fireEvent.press(ui.getByTestId('key-ok')); });
    await waitFor(() => expect(ui.getByTestId('login-error')).toHaveTextContent('Trop de tentatives. Patientez quinze minutes.'));
  });

  test('première connexion (409 no_pin) → code d’installation → choix et confirmation du PIN', async () => {
    mockState().pins.aziz = null;
    const ui = await render(<Login />);
    await fireEvent.press(ui.getByTestId('tile-aziz'));
    await typePin(ui, '1234');
    await act(async () => { await fireEvent.press(ui.getByTestId('key-ok')); });
    await waitFor(() => expect(ui.getByTestId('setup-code')).toBeTruthy());
    await fireEvent.changeText(ui.getByTestId('setup-code'), 'SETUP-AMANE');
    await fireEvent.press(ui.getByTestId('setup-next'));
    expect(ui.getByText('Choisissez un code (4 à 8 chiffres)')).toBeTruthy();
    await typePin(ui, '2468'); await fireEvent.press(ui.getByTestId('key-ok'));
    expect(ui.getByText('Confirmez votre code')).toBeTruthy();
    await typePin(ui, '2468');
    await act(async () => { await fireEvent.press(ui.getByTestId('key-ok')); });
    await waitFor(() => expect(useStore.getState().me?.id).toBe('aziz'));
    expect(mockState().pins.aziz).toBe('2468');
    useStore.getState().stopLive();
  });

  test('la touche Valider reste inactive sous 4 chiffres', async () => {
    const ui = await render(<Login />);
    await fireEvent.press(ui.getByTestId('tile-amel'));
    await typePin(ui, '12');
    expect(ui.getByTestId('key-ok')).toBeDisabled();
    await fireEvent.press(ui.getByTestId('key-del'));
    expect(ui.getByTestId('pin-dots').props.accessibilityLabel).toBe('1 chiffre saisi');
  });
});
