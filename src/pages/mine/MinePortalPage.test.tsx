import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minePortalService, MinePortalDataError } from '@/services/minePortalService';
import MinePortalPage from './MinePortalPage';

vi.mock('@/components/auth/MinePortalGuard', () => ({
  useMinePortalAccess: () => ({
    companyId: 'mine-1',
    user: { email: 'mine@example.bf', full_name: 'Responsable Mine' },
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('@/services/minePortalService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/minePortalService')>();
  return { ...original, minePortalService: { load: vi.fn() } };
});

const mockedLoad = vi.mocked(minePortalService.load);
const emptySnapshot = {
  company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
  contracts: [], requests: [], invoices: [], payments: [], analyses: [], requisitions: [],
  situation: null,
};

describe('MinePortalPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('charge exclusivement la société fournie par le garde et affiche des états vides', async () => {
    mockedLoad.mockResolvedValue(emptySnapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Mine Exemple')).toBeInTheDocument());
    expect(mockedLoad).toHaveBeenCalledWith('mine-1');
    expect(screen.getByText('Aucun contrat accessible dans votre périmètre.')).toBeInTheDocument();
    expect(screen.getByText('Aucune facture ou aucun règlement enregistré.')).toBeInTheDocument();
  });

  it('présente une erreur sobre et permet une nouvelle tentative', async () => {
    mockedLoad
      .mockRejectedValueOnce(new MinePortalDataError('Impossible de charger les contrats.'))
      .mockResolvedValueOnce(emptySnapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    expect(await screen.findByText('Données indisponibles')).toBeInTheDocument();
    expect(screen.getByText('Impossible de charger les contrats.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Mine Exemple')).toBeInTheDocument());
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });
});
