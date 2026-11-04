import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Composer } from '@/components/Composer';
import { missions, partenaires } from '@/mocks/data';
import { t } from '@amane/shared';
import { fmtDay } from '@/lib/format';

const base = () => ({ convId: '971501234567', lang: 'FR', open: true, firstName: 'Khalid', onSend: jest.fn(async () => 'id'), onNote: jest.fn(async () => undefined), onError: jest.fn(), translateFn: jest.fn(async (t: string, to: string) => `[${to}] ${t}`) });

describe('composer WhatsApp', () => {
  test('texte en français → envoi direct', async () => {
    const p = base(); const ui = await render(<Composer {...p} />);
    expect(ui.getByTestId('btn-send')).toBeDisabled();
    await fireEvent.changeText(ui.getByTestId('composer-input'), 'Bonjour Khalid');
    await act(async () => { await fireEvent.press(ui.getByTestId('btn-send')); });
    expect(p.onSend).toHaveBeenCalledWith({ text: 'Bonjour Khalid' }, { type: 'text', text: 'Bonjour Khalid' });
    expect(p.translateFn).not.toHaveBeenCalled();
    await waitFor(() => expect(ui.getByTestId('composer-input').props.value).toBe(''));
  });

  test('client arabe : traduction, aperçu modifiable, envoi traduit ou en français', async () => {
    const p = { ...base(), lang: 'AR' }; const ui = await render(<Composer {...p} />);
    await fireEvent.changeText(ui.getByTestId('composer-input'), 'Votre chauffeur vous attend.');
    await act(async () => { await fireEvent.press(ui.getByTestId('btn-send')); });
    await waitFor(() => expect(ui.getByTestId('translation-preview')).toBeTruthy());
    expect(p.translateFn).toHaveBeenCalledWith('Votre chauffeur vous attend.', 'AR');
    expect(ui.getByTestId('preview-input').props.value).toBe('[AR] Votre chauffeur vous attend.');
    await fireEvent.changeText(ui.getByTestId('preview-input'), 'سائقكم بانتظاركم.');
    await act(async () => { await fireEvent.press(ui.getByTestId('preview-send')); });
    expect(p.onSend).toHaveBeenCalledWith({ text: 'سائقكم بانتظاركم.', translation: 'Votre chauffeur vous attend.' }, { type: 'text', text: 'سائقكم بانتظاركم.' });
    // envoyer en français quand même
    await fireEvent.changeText(ui.getByTestId('composer-input'), 'Merci.');
    await act(async () => { await fireEvent.press(ui.getByTestId('btn-send')); });
    await waitFor(() => expect(ui.getByTestId('preview-send-fr')).toBeTruthy());
    await act(async () => { await fireEvent.press(ui.getByTestId('preview-send-fr')); });
    expect(p.onSend).toHaveBeenLastCalledWith({ text: 'Merci.' }, { type: 'text', text: 'Merci.' });
  });

  test('réponses rapides dans la langue du client, brouillon IA inséré, jamais envoyé seul', async () => {
    const p = { ...base(), lang: 'AR', aiDraft: 'مرحباً سيد خالد' }; const ui = await render(<Composer {...p} />);
    await fireEvent.press(ui.getByTestId('qr-accuse'));
    const attendu = t('AR', 'quick.accuse', { prenom: 'Khalid' });
    expect(attendu).toContain('Khalid'); expect(attendu).toMatch(/[\u0600-\u06FF]/);
    expect(ui.getByTestId('composer-input').props.value).toBe(attendu);
    await fireEvent.press(ui.getByTestId('qr-ai'));
    expect(ui.getByTestId('composer-input').props.value).toContain('مرحباً سيد خالد');
    expect(p.onSend).not.toHaveBeenCalled();
  });

  test('fenêtre fermée : saisie bloquée, modèle approuvé envoyé avec paramètres', async () => {
    const p = { ...base(), lang: 'EN', open: false, mission: missions[0], vehiculeNom: 'Urus SE' }; const ui = await render(<Composer {...p} />);
    expect(ui.getByTestId('window-closed')).toBeTruthy();
    expect(ui.queryByTestId('quick-replies')).toBeNull();
    await fireEvent.press(ui.getByTestId('btn-template'));
    await act(async () => { await fireEvent.press(ui.getByTestId('tpl-amane_rappel')); });
    const params = ['Khalid', 'chauffeur', fmtDay(missions[0].debut), '20:00', missions[0].lieu];
    expect(p.onSend).toHaveBeenCalledWith({ template: { name: 'amane_rappel', lang: 'en', params } }, { type: 'template', text: `[Modèle amane_rappel] ${params.join(' · ')}` });
  });

  test('pièces jointes : lieu de la mission, contact chauffeur, photo compressée envoyée', async () => {
    const p = { ...base(), mission: missions[0], chauffeur: partenaires[0] }; const ui = await render(<Composer {...p} />);
    await fireEvent.press(ui.getByTestId('btn-attach'));
    await act(async () => { await fireEvent.press(ui.getByTestId('qr-location')); });
    expect(p.onSend).toHaveBeenCalledWith({ location: { lat: 0, lng: 0, name: missions[0].titre, address: missions[0].lieu } }, { type: 'location', text: missions[0].lieu });
    await fireEvent.press(ui.getByTestId('btn-attach'));
    await act(async () => { await fireEvent.press(ui.getByTestId('qr-contact')); });
    expect(p.onSend).toHaveBeenLastCalledWith({ contact: { partenaireId: 'p_karim' } }, { type: 'contacts', text: 'Karim Benali · +33 6 11 22 33 44' });
    const { installMockFetch } = require('@/mocks/server'); installMockFetch();
    await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId: 'amel', pin: '1234' }) });
    await fireEvent.press(ui.getByTestId('btn-attach'));
    await act(async () => { await fireEvent.press(ui.getByTestId('qr-camera')); });
    await waitFor(() => expect(p.onSend).toHaveBeenCalledTimes(3));
    const call = p.onSend.mock.calls[2] as any[];
    expect(call[0].media).toMatchObject({ type: 'image' }); expect(String(call[0].media.photoId)).toMatch(/^ph_/);
  });

  test('note interne : jamais envoyée au client', async () => {
    const p = base(); const ui = await render(<Composer {...p} />);
    await fireEvent.press(ui.getByTestId('btn-note'));
    await fireEvent.changeText(ui.getByTestId('composer-input'), 'Youssouf : siège enfant');
    await act(async () => { await fireEvent.press(ui.getByTestId('btn-send')); });
    expect(p.onNote).toHaveBeenCalledWith('Youssouf : siège enfant');
    expect(p.onSend).not.toHaveBeenCalled();
  });
});
