import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { installMockFetch, resetMock, mockState } from '@/mocks/server';
import { useStore } from '@/store';
import { RelancesList } from '@/components/Relances';
import { EspacePrestataire } from '@/components/EspacePrestataire';

beforeAll(() => installMockFetch());
beforeEach(async () => { resetMock(); await useStore.getState().login('amel', '1234'); useStore.getState().stopLive(); });
afterAll(() => useStore.getState().stopLive());

describe('relances et espace prestataire', () => {
  test('relance du chauffeur en un geste, puis bloquée : jamais deux fois', async () => {
    const onToast = jest.fn();
    const ui = await render(<RelancesList onToast={onToast} />);
    const key = 'prestataire:m_haddad:p_karim';
    await waitFor(() => expect(ui.getByTestId(`relance-${key}`)).toBeTruthy());
    expect(ui.getByText(/Bonjour Karim, pouvez-vous nous confirmer la mission/)).toBeTruthy();
    await act(async () => { await fireEvent.press(ui.getByTestId(`relancer-${key}`)); });
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/^Relance envoyée à Karim Benali/)));
    expect(mockState().relances.map((r) => [r.key, r.by, r.statut])).toEqual([[key, 'amel', 'envoye']]);
    await waitFor(() => expect(ui.queryByTestId(`relancer-${key}`)).toBeNull());
    await act(async () => { await fireEvent.press(ui.getByText('Relancées')); });
    expect(ui.getByText(/^Relancé à l’instant par Amel/)).toBeTruthy();
  });

  test('WhatsApp non relié : relance notée hors CRM', async () => {
    mockState().whatsappOff = true; const onToast = jest.fn();
    const ui = await render(<RelancesList onToast={onToast} />);
    const key = 'prestataire:m_haddad:p_karim';
    await waitFor(() => expect(ui.getByTestId(`relancer-${key}`)).toBeTruthy());
    await act(async () => { await fireEvent.press(ui.getByTestId(`relancer-${key}`)); });
    await waitFor(() => expect(ui.getByText(/WhatsApp n’est pas relié au serveur/)).toBeTruthy());
    await act(async () => { await fireEvent.press(ui.getByTestId(`noter-${key}`)); });
    await waitFor(() => expect(mockState().relances.map((r) => r.canal)).toEqual(['manuel']));
  });

  test('espace prestataire : créer, noter une confirmation, révoquer', async () => {
    const onToast = jest.fn();
    const ui = await render(<EspacePrestataire pid="p_karim" nom="Karim Benali" tel="+33 6 11 22 33 44" onToast={onToast} />);
    await waitFor(() => expect(ui.getByTestId('espace-creer')).toBeTruthy());
    await act(async () => { await fireEvent.press(ui.getByTestId('espace-creer')); });
    await waitFor(() => expect(ui.getByText(/^https:\/\/amane\.paris\/api\/prestataire\//)).toBeTruthy());
    expect(onToast).toHaveBeenCalledWith('Lien de l’espace créé');
    await act(async () => { await fireEvent.press(ui.getByTestId('confirmer-m_haddad')); });
    await waitFor(() => expect(ui.getByText('Confirmée')).toBeTruthy());
    await act(async () => { await fireEvent.press(ui.getByTestId('espace-revoquer')); });
    await act(async () => { await fireEvent.press(ui.getByTestId('espace-revoquer-oui')); });
    await waitFor(() => expect(ui.getByTestId('espace-creer')).toBeTruthy());
    expect(mockState().acces).toEqual({});
  });
});
