import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Relances } from '../src/screens/Relances';
import { EspaceTab, RelancesHist } from '../src/drawers/Prestataire';
import { useUI } from '../src/store/ui';
import { api } from '../src/lib/api';
import { S } from '../src/mocks/fakeApi';

const toasts = () => useUI.getState().toasts.map((t) => t.text);
const karim = async () => { let row: HTMLElement | undefined; await waitFor(() => { row = screen.queryAllByTestId('relance-prestataire').find((r) => r.textContent?.includes('Karim B.')); expect(row).toBeTruthy(); }, { timeout: 4000 }); return row!; };
const noKarim = () => waitFor(() => expect(screen.queryAllByTestId('relance-prestataire').some((r) => r.textContent?.includes('Karim B.'))).toBe(false));

describe('relances et espace prestataire', () => {
  beforeEach(async () => { useUI.setState({ toasts: [], filters: { mine: false, svc: '', q: '', week: 0, todo: '', fm: 0 } }); await api('POST', '/api/auth/login', { userId: 'amel', pin: '1234' }); });

  it('Relances : vue unique avec la confirmation du chauffeur, relance en un geste, puis bloquée (jamais deux fois)', async () => {
    render(<MemoryRouter><Relances /></MemoryRouter>);
    const row = await karim();
    expect(within(row).getByText('Karim B.')).toBeInTheDocument();
    expect(within(row).getByText('Prestataire')).toBeInTheDocument();
    expect(within(row).getByText(/Bonjour Karim, pouvez-vous nous confirmer la mission/)).toBeInTheDocument();
    fireEvent.click(within(row).getByTestId('relancer'));
    await waitFor(() => expect(toasts().some((t) => /^Relance envoyée à Karim B\./.test(t))).toBe(true), { timeout: 4000 });
    await noKarim();
    expect(S.relances.map((r) => [r.type, r.by, r.statut])).toEqual([['prestataire', 'amel', 'envoye']]);
    fireEvent.click(screen.getByTestId('vue-faites'));
    const done = await karim();
    expect(within(done).getByTestId('bloquee')).toBeInTheDocument();
    expect(within(done).queryByTestId('relancer')).toBeNull();
    expect(within(done).getByTestId('derniere').textContent).toMatch(/^Relancé à l’instant par Amel · /);
    const again = await api('POST', '/api/relances/envoyer', { key: S.relances[0].key }).catch((e) => e);
    expect(again.code).toBe('deja_relance');
  });

  it('Relances : « Noter » une relance faite hors CRM ; WhatsApp non relié → bandeau et lien WhatsApp', async () => {
    S.whatsappOn = false;
    render(<MemoryRouter><Relances /></MemoryRouter>);
    fireEvent.click(within(await karim()).getByTestId('relancer'));
    await screen.findByText(/WhatsApp n’est pas relié au serveur\. Ouvrez WhatsApp/);
    expect(within(await karim()).getByText('WhatsApp').closest('a')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/33655443322\?text=/);
    fireEvent.click(within(await karim()).getByTestId('noter'));
    await waitFor(() => expect(S.relances.map((r) => r.canal)).toEqual(['manuel']));
    await noKarim();
  });

  it('Espace prestataire : créer le lien, noter une confirmation, révoquer ; historique des relances', async () => {
    render(<MemoryRouter><EspaceTab pid="p_karim" nom="Karim B." contact="Karim" tel="+33 6 55 44 33 22" /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('espace-creer', {}, { timeout: 4000 }));
    const url = await screen.findByTestId('espace-url');
    expect((url as HTMLInputElement).value).toMatch(/\/api\/prestataire\/[A-Za-z0-9]{24}$/);
    expect(screen.getByText('Envoyer par WhatsApp').closest('a')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/33655443322\?text=Bonjour%20Karim%2C%20voici%20votre%20espace%20prestataire/);
    fireEvent.click(await screen.findByTestId('confirmer-m_sejour'));
    await screen.findByText('Confirmée');
    fireEvent.click(screen.getByTestId('revoquer'));
    fireEvent.click(screen.getByTestId('revoquer-oui'));
    await screen.findByTestId('espace-creer');
    expect(S.acces.size).toBe(0);
  });

  it('Historique des relances d’une fiche', async () => {
    S.relances.push({ id: 'solde:m1#1', key: 'solde:m1', type: 'solde', cible: 'client', clientId: 'c_laurent', statut: 'envoye', canal: 'modele', by: 'aziz', at: new Date().toISOString(), texte: 'Bonjour' });
    render(<RelancesHist q="clientId=c_laurent" />);
    const h = await screen.findByTestId('relances-hist');
    expect(h.textContent).toMatch(/Solde à régler · modèle approuvé, par Aziz/);
  });
});
