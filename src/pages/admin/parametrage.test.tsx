import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatusManagerPage, { etapesWorkflow, filtrerEtapes, MODULE_LABELS } from './StatusManagerPage';
import GoldSalesSettingsPage, { dateEffet, filterSettings } from './GoldSalesSettingsPage';
import { ALLOWED_TRANSITIONS, WorkflowModule } from '@/services/statusTransitionControlService';
import type { GoldSalesSettingView } from '@/services/goldSalesSettingsService';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  remove: vi.fn(),
  confirmer: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({ open: mocks.confirmer, ConfirmationDialog: () => null }),
}));

vi.mock('@/components/ui/UserFriendlyError', () => ({
  UserFriendlyErrorModal: ({ isOpen, message }: { isOpen: boolean; message: string }) =>
    isOpen ? <div role="alert">{message}</div> : null,
}));

vi.mock('@/components/admin/GoldSalesSettingFormPanel', () => ({
  GoldSalesSettingFormPanel: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Formulaire de paramétrage</div> : null),
}));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: vi.fn(),
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/services/goldSalesSettingsService', () => ({
  getAllGoldSalesSettings: mocks.getAll,
  deleteGoldSalesSetting: mocks.remove,
  getSaleMethods: () => [
    { value: 'spot', label: 'Vente au comptant' },
    { value: 'forward', label: 'Vente à terme' },
  ],
}));

const parametrages = [
  {
    id: 'p1',
    mining_company_id: 'c1',
    mining_company_name: 'Essakane SA',
    mining_company_abbr: 'ESK',
    customer_id: 'k1',
    customer_name: 'Metalor',
    contact_person: 'Jean DUPONT',
    max_stock_percentage: 45.5,
    sale_method: 'spot',
    refining_fees_paid_by_customer: true,
    transport_fees_paid_by_customer: false,
    is_active: true,
    effective_date: '2026-01-15',
  },
  {
    id: 'p2',
    mining_company_id: 'c2',
    mining_company_name: 'Bissa Gold',
    mining_company_abbr: 'BSG',
    customer_id: 'k2',
    customer_name: 'Comptoir Central',
    contact_person: null,
    max_stock_percentage: 20,
    sale_method: 'forward',
    refining_fees_paid_by_customer: false,
    transport_fees_paid_by_customer: false,
    is_active: false,
    effective_date: null,
  },
] as unknown as GoldSalesSettingView[];

describe('référentiel des statuts', () => {
  it('lit la chaîne de transitions du service de contrôle', () => {
    const etapes = etapesWorkflow();
    // L'écran reconstituait sa propre carte de transitions, codée en dur.
    expect(etapes.length).toBe(Object.keys(ALLOWED_TRANSITIONS).length);

    const prepare = etapes.find((etape) => etape.statut === 'prepared');
    expect(prepare?.transitions).toEqual(ALLOWED_TRANSITIONS.prepared);
    expect(prepare?.module).toBe(MODULE_LABELS[WorkflowModule.PRODUCTION]);
    expect(prepare?.estFinal).toBe(false);

    expect(etapes.find((etape) => etape.statut === 'paid')?.estFinal).toBe(true);
  });

  it('filtre les étapes sur le statut, le libellé ou le module', () => {
    const etapes = etapesWorkflow();
    expect(filtrerEtapes(etapes, 'prepared').length).toBeGreaterThan(0);
    expect(filtrerEtapes(etapes, 'inexistant')).toHaveLength(0);
    expect(filtrerEtapes(etapes, '')).toHaveLength(etapes.length);
  });
});

describe('StatusManagerPage', () => {
  it('se présente en lecture seule, sans action factice', () => {
    render(<StatusManagerPage />);

    expect(screen.getByRole('heading', { name: 'Référentiel des statuts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Référentiel en lecture seule' })).toBeInTheDocument();

    // « Éditer » n'écrivait rien et annonçait « une prochaine version » ;
    // « Voir les détails » n'avait aucune action.
    expect(screen.queryByRole('button', { name: /Éditer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir les détails/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/prochaine version/)).not.toBeInTheDocument();
  });

  it('affiche les états finaux et les transitions réelles', () => {
    render(<StatusManagerPage />);

    expect(screen.getAllByText('État final').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Circuit de traçabilité/ })).toBeInTheDocument();
    expect(screen.getByText(/Circuit porté par le moteur de validation/)).toBeInTheDocument();
  });

  it('filtre le circuit sur la recherche', () => {
    render(<StatusManagerPage />);

    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'raffinerie' } });
    const tableau = within(screen.getAllByRole('table')[0]);
    expect(tableau.getAllByText('Raffinerie').length).toBeGreaterThan(0);
  });
});

describe('paramétrage des ventes', () => {
  it('recherche sans planter sur un contact absent', () => {
    expect(() => filterSettings(parametrages, 'bissa')).not.toThrow();
    expect(filterSettings(parametrages, 'bissa')).toHaveLength(1);
    expect(filterSettings(parametrages, 'jean')).toHaveLength(1);
    expect(filterSettings(parametrages, '')).toHaveLength(2);
  });

  it('n’affiche une date d’effet que si elle existe', () => {
    expect(dateEffet('2026-01-15')).toBe('15/01/2026');
    expect(dateEffet(null)).toBeNull();
    expect(dateEffet('pas-une-date')).toBeNull();
  });
});

describe('GoldSalesSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmer.mockResolvedValue(true);
    mocks.getAll.mockResolvedValue({ success: true, data: parametrages });
    mocks.remove.mockResolvedValue({ success: true });
  });

  it('présente les règles et la charge des frais', async () => {
    render(<GoldSalesSettingsPage />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('45,5 %')).toBeInTheDocument();
    expect(tableau.getByText('Vente au comptant')).toBeInTheDocument();
    expect(tableau.getByText('Raffinage')).toBeInTheDocument();
    expect(tableau.getByText('Aucun — à la charge du vendeur')).toBeInTheDocument();
    expect(tableau.getByText('Depuis le 15/01/2026')).toBeInTheDocument();
  });

  it('remplace le dialogue natif par une confirmation tracée', async () => {
    render(<GoldSalesSettingsPage />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Supprimer le paramétrage Essakane SA vers Metalor/ }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.confirmer.mock.calls[0][0]).toMatchObject({ severity: 'danger' });
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('p1'));
  });

  it('n’exécute rien si la suppression est refusée', async () => {
    mocks.confirmer.mockResolvedValue(false);
    render(<GoldSalesSettingsPage />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Supprimer le paramétrage Essakane SA vers Metalor/ }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('signale un échec de chargement', async () => {
    mocks.getAll.mockResolvedValue({ success: false, error: { message: 'vue indisponible' } });
    render(<GoldSalesSettingsPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('vue indisponible'));
    expect(screen.getByText('Aucun paramétrage')).toBeInTheDocument();
  });
});
