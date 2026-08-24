import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaiementsHistorique, { EMPTY_HISTORIQUE_FILTERS, filterPaiements } from './PaiementsHistorique';
import type { PaiementArtisan } from '@/services/artisanPaiementsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAllPaiements: vi.fn(),
  updatePaiementStatut: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'validator-id' } }) }));

vi.mock('@/services/artisanPaiementsService', () => ({
  default: {
    getAllPaiements: mocks.getAllPaiements,
    updatePaiementStatut: mocks.updatePaiementStatut,
  },
}));

type Row = PaiementArtisan & { artisan?: { nom?: string; prenoms?: string; numero_carte?: string } };

const paiement = (over: Partial<Row>): Row =>
  ({
    id: 'p1',
    reference_paiement: 'PAY-001',
    facture_id: 'f1',
    vente_or_id: 'v1',
    artisan_id: 'a1',
    type_paiement: 'orange_money',
    montant_paye: 3_500_000,
    montant_taxes_retenues: 120_000,
    details_paiement: {},
    statut: 'complete',
    date_paiement: '2026-05-12T10:00:00Z',
    artisan: { nom: 'KABORE', prenoms: 'Awa', numero_carte: 'CP-0001' },
    ...over,
  }) as Row;

const paiements = [
  paiement({}),
  paiement({ id: 'p2', reference_paiement: 'PAY-002', type_paiement: 'cash', statut: 'en_traitement', montant_paye: 900_000, date_paiement: '2026-06-20T10:00:00Z', artisan: { nom: 'KONE', prenoms: 'Mamadou', numero_carte: 'CP-0002' } }),
  paiement({ id: 'p3', reference_paiement: 'PAY-003', type_paiement: 'cheque', statut: 'annule', montant_paye: 400_000, date_paiement: '2026-01-05T10:00:00Z' }),
];

describe('filterPaiements', () => {
  it('combine statut, moyen de paiement, période et recherche', () => {
    expect(filterPaiements(paiements, EMPTY_HISTORIQUE_FILTERS)).toHaveLength(3);
    expect(filterPaiements(paiements, { ...EMPTY_HISTORIQUE_FILTERS, statut: 'complete' })).toHaveLength(1);
    expect(filterPaiements(paiements, { ...EMPTY_HISTORIQUE_FILTERS, type: 'cash' })).toHaveLength(1);
    expect(filterPaiements(paiements, { ...EMPTY_HISTORIQUE_FILTERS, search: 'kone' })).toHaveLength(1);
    expect(filterPaiements(paiements, { ...EMPTY_HISTORIQUE_FILTERS, from: '2026-05-01', to: '2026-05-31' })).toHaveLength(1);
    expect(filterPaiements(paiements, { ...EMPTY_HISTORIQUE_FILTERS, statut: 'complete', type: 'cash' })).toHaveLength(0);
  });

  it('inclut les bornes de la période', () => {
    const filters = { ...EMPTY_HISTORIQUE_FILTERS, from: '2026-05-12', to: '2026-05-12' };
    expect(filterPaiements(paiements, filters).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('PaiementsHistorique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllPaiements.mockResolvedValue(paiements);
    mocks.updatePaiementStatut.mockResolvedValue(undefined);
  });

  it('affiche les indicateurs et les règlements', async () => {
    render(<PaiementsHistorique />);

    expect(screen.getByRole('heading', { name: 'Historique des paiements' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('PAY-001')).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs de l’historique' }));
    expect(stats.getByText('Paiements enregistrés')).toBeInTheDocument();
    // Seuls les règlements complétés alimentent le montant réglé.
    expect(stats.getByText('3,5 M FCFA')).toBeInTheDocument();
  });

  it('filtre par statut', async () => {
    render(<PaiementsHistorique />);
    await waitFor(() => expect(screen.getByText('PAY-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Annulé/ }));

    expect(screen.getByText('PAY-003')).toBeInTheDocument();
    expect(screen.queryByText('PAY-001')).not.toBeInTheDocument();
  });

  it('demande au serveur de valider un paiement préparé par un autre agent', async () => {
    render(<PaiementsHistorique />);
    await waitFor(() => expect(screen.getByText('PAY-002')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    await waitFor(() => expect(mocks.updatePaiementStatut).toHaveBeenCalledWith('p2', 'valide', {
      preuvePaiementUrl: undefined,
    }));
  });

  it('signale un historique indisponible', async () => {
    mocks.getAllPaiements.mockRejectedValue(new Error('hors ligne'));
    render(<PaiementsHistorique />);

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith("Impossible de charger l'historique des paiements")
    );
  });
});
