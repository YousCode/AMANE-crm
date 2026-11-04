import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../src/screens/Login';
import { Chip, ContactBtns, Field } from '../src/components/ui';
import { ConvRow } from '../src/screens/Messages';
import { useStore } from '../src/store/store';
import { reset } from '../src/mocks/node';
import { seed } from '../src/mocks/seed';

describe('composants', () => {
  beforeEach(() => { reset(); try { localStorage.clear(); } catch { /* ignore */ } useStore.setState({ user: null, auth: 'login', clients: [], messages: [] }); });
  it('Login : trois tuiles, pavé, première connexion', async () => {
    render(<Login />);
    expect(screen.getByText('Amel')).toBeInTheDocument(); expect(screen.getByText('Youssouf')).toBeInTheDocument(); expect(screen.getByText('Aziz')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tile-aziz'));
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument(); expect(screen.getByText(/Bonjour,/)).toBeInTheDocument();
    for (const k of '1234') fireEvent.click(screen.getByRole('button', { name: k }));
    await waitFor(() => expect(useStore.getState().user?.id).toBe('aziz'), { timeout: 4000 });
  });
  it('Login : code incorrect affiché', async () => {
    render(<Login />); fireEvent.click(screen.getByTestId('tile-amel'));
    for (const k of '0000') fireEvent.click(screen.getByRole('button', { name: k }));
    await waitFor(() => expect(screen.getByText('Code incorrect.')).toBeInTheDocument(), { timeout: 4000 });
    fireEvent.click(screen.getByText('Première connexion ou code oublié ?')); expect(screen.getByLabelText('Code d’installation')).toBeInTheDocument();
  });
  it('Chip : libellé et couleur de statut', () => { const { container } = render(<Chip st="confirmee" />); expect(screen.getByText('Confirmée')).toBeInTheDocument(); expect(container.querySelector('.c-confirmee')).toBeTruthy(); });
  it('ContactBtns : appeler, WhatsApp, itinéraire', () => {
    render(<ContactBtns tel="06 12 34 56 78" lieu="Avenue Montaigne" wa="Bonjour" />);
    expect(screen.getByText('Appeler').closest('a')).toHaveAttribute('href', 'tel:+33612345678');
    expect(screen.getByText('WhatsApp').closest('a')).toHaveAttribute('href', 'https://wa.me/33612345678?text=Bonjour');
    expect(screen.getByText('Itinéraire').closest('a')?.getAttribute('href')).toContain('google.com/maps');
  });
  it('Field : saisie numérique convertie', () => { let v: unknown; render(<Field k="montant" label="Montant" value={''} type="number" onChange={(_, x) => { v = x; }} />); fireEvent.change(screen.getByLabelText('Montant'), { target: { value: '1300' } }); expect(v).toBe(1300); });
  it('ConvRow : nom, langue, aperçu vocal, non lus', () => {
    const S = seed(); useStore.setState({ clients: S.clients as never, messages: S.messages as never });
    const cv = S.conversations.find((c) => c.id === '8613800138000')!;
    render(<MemoryRouter><ConvRow cv={cv as never} /></MemoryRouter>);
    expect(screen.getByText('Mme Chen Wei')).toBeInTheDocument(); expect(screen.getByText('EN')).toBeInTheDocument(); expect(screen.getByText(/vocal 0:42/)).toBeInTheDocument(); expect(screen.getByLabelText('1 non lu')).toBeInTheDocument();
  });
});
