import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivateAccount from './ActivateAccount';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

describe('ActivateAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirige une session de récupération vers la définition du mot de passe', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'signed-session' } }, error: null });
    render(<MemoryRouter><ActivateAccount /></MemoryRouter>);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/modifier-mot-de-passe', { replace: true });
    });
  });

  it('n’utilise plus de mot de passe provisoire ni de RPC d’activation côté client', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<MemoryRouter><ActivateAccount /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Demandez un nouveau lien sécurisé' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/mot de passe provisoire/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recevoir un lien' })).toHaveAttribute('href', '/recuperer-acces');
  });
});
