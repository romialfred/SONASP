import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minePortalService, MinePortalDataError } from '@/services/minePortalService';
import MinePortalPage from './MinePortalPage';

const portalAccess = vi.hoisted(() => ({
  companyId: 'mine-1',
  canChooseCompany: false,
}));

vi.mock('@/components/auth/MinePortalGuard', () => ({
  useMinePortalAccess: () => portalAccess,
}));
vi.mock('@/services/minePortalService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/minePortalService')>();
  return { ...original, minePortalService: { ...original.minePortalService, load: vi.fn() } };
});

const snapshot = {
  company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
  budgets: [], monthlyBudgets: [], forecasts: [], productions: [], documents: [],
  contracts: [], requests: [], invoices: [], payments: [], analyses: [], requisitions: [], shipments: [], sales: [],
  situation: null,
};
const mockedLoad = vi.mocked(minePortalService.load);

describe('MinePortalPage recentré', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalAccess.companyId = 'mine-1';
    portalAccess.canChooseCompany = false;
  });

  it('présente les vrais modules industriels sans reconstruire leurs formulaires', async () => {
    mockedLoad.mockResolvedValue(snapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Accueil' });
    expect(mockedLoad).toHaveBeenCalledWith('mine-1', { force: false });
    expect(screen.getByRole('link', { name: /Production/ })).toHaveAttribute('href', '/production/daily');
    expect(screen.getByRole('link', { name: /Expéditions/ })).toHaveAttribute('href', '/shipping/preparation');
    expect(screen.getByRole('link', { name: /Marché et ventes/ })).toHaveAttribute('href', '/sales/trade-space');
    expect(screen.queryByText('Achats aux mines')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Navigation du Portail Mine' })).not.toBeInTheDocument();
  });

  it('permet de relancer un chargement en échec', async () => {
    mockedLoad
      .mockRejectedValueOnce(new MinePortalDataError('Périmètre inaccessible.'))
      .mockResolvedValueOnce(snapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    expect(await screen.findByText('Périmètre indisponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Accueil' })).toBeInTheDocument());
    expect(mockedLoad).toHaveBeenLastCalledWith('mine-1', { force: true });
  });

  it('ne surcharge plus la page avec un message de consultation Owner', async () => {
    portalAccess.canChooseCompany = true;
    mockedLoad.mockResolvedValue(snapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
    expect(screen.queryByText(/Mode consultation Owner/)).not.toBeInTheDocument();
    expect(screen.queryByText(/modules industriels sont communs/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modules' })).toBeInTheDocument();
  });

  it('réserve les indicateurs et analyses à la vue tableau de bord', async () => {
    mockedLoad.mockResolvedValue(snapshot);
    render(
      <MemoryRouter initialEntries={['/portail-mine?vue=tableau-de-bord']}>
        <MinePortalPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument();
    expect(screen.getByText('Production récente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Production et objectifs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Situation financière' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Modules' })).not.toBeInTheDocument();
  });
});
