import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minePortalService, MinePortalDataError } from '@/services/minePortalService';
import MinePortalPage from './MinePortalPage';

const portalAccess = vi.hoisted(() => ({
  value: {
    companyId: 'mine-1',
    canChooseCompany: false,
    user: { email: 'mine@example.bf', full_name: 'Responsable Mine', role: 'customer' },
  } as {
    companyId: string;
    canChooseCompany: boolean;
    user: { email: string; full_name: string; role: string };
  },
}));

vi.mock('@/components/auth/MinePortalGuard', () => ({
  useMinePortalAccess: () => portalAccess.value,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('@/services/minePortalService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/minePortalService')>();
  return {
    ...original,
    minePortalService: {
      load: vi.fn(), listCompanies: vi.fn(), submitForecast: vi.fn(), submitMonthlyBudget: vi.fn(), declareProduction: vi.fn(),
      respondToRequest: vi.fn(), respondToPayment: vi.fn(), uploadDocument: vi.fn(), getDocumentUrl: vi.fn(),
    },
  };
});

const mockedLoad = vi.mocked(minePortalService.load);
const mockedListCompanies = vi.mocked(minePortalService.listCompanies);
const mockedSubmitForecast = vi.mocked(minePortalService.submitForecast);
const emptySnapshot = {
  company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
  budgets: [], monthlyBudgets: [], forecasts: [], productions: [], documents: [],
  contracts: [], requests: [], invoices: [], payments: [], analyses: [], requisitions: [],
  situation: null,
};

describe('MinePortalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalAccess.value = {
      companyId: 'mine-1',
      canChooseCompany: false,
      user: { email: 'mine@example.bf', full_name: 'Responsable Mine', role: 'customer' },
    };
  });

  it('charge exclusivement la société fournie par le garde et affiche des états vides', async () => {
    mockedLoad.mockResolvedValue(emptySnapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Bonjour Responsable')).toBeInTheDocument());
    expect(mockedLoad).toHaveBeenCalledWith('mine-1');
    expect(screen.getByRole('complementary', { name: 'Navigation du Portail Mine' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Production journalière' })).toBeInTheDocument();
    expect(screen.getByText('Aucune facture ou aucun règlement enregistré.')).toBeInTheDocument();
  });

  it('présente une erreur sobre et permet une nouvelle tentative', async () => {
    mockedLoad
      .mockRejectedValueOnce(new MinePortalDataError('Impossible de charger les contrats.'))
      .mockResolvedValueOnce(emptySnapshot);
    render(<MemoryRouter><MinePortalPage /></MemoryRouter>);

    expect(await screen.findByText('Périmètre indisponible')).toBeInTheDocument();
    expect(screen.getByText('Impossible de charger les contrats.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Bonjour Responsable')).toBeInTheDocument());
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });

  it('présente à l’Owner la liste des sociétés actives dans l’en-tête du portail', async () => {
    portalAccess.value = {
      companyId: 'mine-1',
      canChooseCompany: true,
      user: { email: 'owner@sonasp.bf', full_name: 'Administrateur général', role: 'owner' },
    };
    mockedListCompanies.mockResolvedValue([
      { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
      { id: 'mine-2', name: 'Mine Nationale', code: 'MNA' },
    ]);
    mockedLoad.mockImplementation(async (companyId) => ({
      ...emptySnapshot,
      company: companyId === 'mine-2'
        ? { id: 'mine-2', name: 'Mine Nationale', code: 'MNA' }
        : emptySnapshot.company,
    }));

    render(<MemoryRouter initialEntries={['/portail-mine?mine=mine-1']}><MinePortalPage /></MemoryRouter>);

    const companySelector = await screen.findByLabelText('Changer de société minière');
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledWith('mine-1'));
    expect(screen.getByText('Mode consultation Owner')).toBeInTheDocument();
    expect(companySelector).toHaveValue('mine-1');
    expect(screen.getByRole('option', { name: 'Mine Nationale' })).toBeInTheDocument();
  });

  it('permet au compte société de transmettre une prévision puis recharge silencieusement son périmètre', async () => {
    mockedLoad.mockResolvedValue(emptySnapshot);
    mockedSubmitForecast.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={['/portail-mine/previsions']}><MinePortalPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Transmettre un objectif' });
    await userEvent.type(screen.getByLabelText('Volume (oz)'), '125.5');
    await userEvent.type(screen.getByLabelText('Hypothèses'), 'Montée en cadence prévue');
    await userEvent.click(screen.getByRole('button', { name: 'Transmettre à la SONASP' }));

    await waitFor(() => expect(mockedSubmitForecast).toHaveBeenCalledWith(expect.objectContaining({ forecastOz: 125.5 })));
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
  });

  it('maintient la vue Owner en consultation sans afficher les commandes de la mine', async () => {
    portalAccess.value = {
      companyId: 'mine-1',
      canChooseCompany: true,
      user: { email: 'owner@sonasp.bf', full_name: 'Administrateur général', role: 'owner' },
    };
    mockedLoad.mockResolvedValue(emptySnapshot);
    mockedListCompanies.mockResolvedValue([emptySnapshot.company]);
    render(<MemoryRouter initialEntries={['/portail-mine/previsions?mine=mine-1']}><MinePortalPage /></MemoryRouter>);

    await screen.findByText('Mode consultation Owner');
    expect(screen.queryByRole('heading', { name: 'Transmettre un objectif' })).not.toBeInTheDocument();
  });
});
