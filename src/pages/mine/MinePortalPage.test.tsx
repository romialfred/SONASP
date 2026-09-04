import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  minePortalService,
  MinePortalDataError,
  type MinePortalSnapshot,
} from '@/services/minePortalService';
import MinePortalPage from './MinePortalPage';

const portalAccess = vi.hoisted(() => ({
  companyId: 'mine-1',
  canChooseCompany: false,
  user: undefined,
}));

vi.mock('@/components/auth/MinePortalGuard', () => ({
  useMinePortalAccess: () => portalAccess,
}));
vi.mock('@/services/minePortalService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/minePortalService')>();
  return { ...original, minePortalService: { ...original.minePortalService, load: vi.fn() } };
});

const snapshot: MinePortalSnapshot = {
  company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
  budgets: [],
  monthlyBudgets: [],
  forecasts: [],
  productions: [],
  documents: [],
  contracts: [],
  requests: [],
  invoices: [],
  payments: [],
  analyses: [],
  requisitions: [],
  shipments: [],
  purchases: [],
  inventory: [],
  freightShipments: [],
  sales: [],
  situation: null,
  unavailableSources: [],
};
const mockedLoad = vi.mocked(minePortalService.load);

describe('MinePortalPage — tableau de bord des opérations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalAccess.companyId = 'mine-1';
    portalAccess.canChooseCompany = false;
  });

  it('affiche la synthèse opérationnelle sans inventer de valeurs en cas de données vides', async () => {
    mockedLoad.mockResolvedValue(snapshot);
    render(<MemoryRouter initialEntries={['/portail-mine']}><MinePortalPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Tableau de bord des opérations' })).toBeInTheDocument();
    expect(mockedLoad).toHaveBeenCalledWith('mine-1', expect.objectContaining({
      force: false,
      startDate: expect.any(String),
      endDate: expect.any(String),
    }));
    expect(screen.getByText('Production sur la période')).toBeInTheDocument();
    expect(screen.getByText('Or fin disponible')).toBeInTheDocument();
    expect(screen.getByText('Engagement SONASP')).toBeInTheDocument();
    expect(screen.getByText('Expéditions en cours')).toBeInTheDocument();
    expect(screen.getByText('Paiements attendus')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Production et objectifs mensuels' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Répartition de la production' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exécution du contrat SONASP' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activités opérationnelles récentes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prochaines actions' })).toBeInTheDocument();
    expect(screen.queryByText(/12 480|8 235|2,84 Md/)).not.toBeInTheDocument();
  });

  it('permet de relancer un chargement en échec', async () => {
    mockedLoad
      .mockRejectedValueOnce(new MinePortalDataError('Périmètre inaccessible.'))
      .mockResolvedValueOnce(snapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    expect(await screen.findByText('Périmètre inaccessible.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Réessayer/ })[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tableau de bord des opérations' })).toBeInTheDocument());
    expect(mockedLoad).toHaveBeenLastCalledWith('mine-1', expect.objectContaining({ force: true }));
  });

  it('signale une source partielle sans transformer ses données manquantes en zéro', async () => {
    mockedLoad.mockResolvedValue({
      ...snapshot,
      unavailableSources: ['stock d’or fin', 'situation financière'],
    });
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    expect(await screen.findByText(/Données partielles : stock d’or fin, situation financière/)).toBeInTheDocument();
    expect(screen.getAllByText('Donnée indisponible').length).toBeGreaterThanOrEqual(2);
  });

  it('conserve le tableau de bord comme entrée unique même avec l’ancienne URL à paramètre', async () => {
    mockedLoad.mockResolvedValue(snapshot);
    render(
      <MemoryRouter initialEntries={['/portail-mine?vue=tableau-de-bord']}>
        <MinePortalPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Tableau de bord des opérations' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Modules' })).not.toBeInTheDocument();
  });
});
