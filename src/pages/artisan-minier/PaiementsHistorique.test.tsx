import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaiementsHistorique, { EMPTY_HISTORIQUE_FILTERS, filterPaiements } from './PaiementsHistorique';
import type { FactureDefinitive, PaiementArtisan } from '@/services/artisanPaiementsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAllPaiements: vi.fn(),
  showError: vi.fn(),
  user: {
    id: 'validator-id', role: 'management', is_active: true,
    capabilities: ['sonasp.finance.execute', 'sonasp.finance.reconcile'],
  } as Record<string, unknown>,
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
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useCollectorWorkspace', () => ({
  useCollectorWorkspace: () => ({
    isCollector: mocks.user.role === 'customer', loading: false,
    workspace: mocks.user.role === 'customer' ? { assignedArtisanIds: ['a1'] } : null,
  }),
}));

vi.mock('@/services/artisanPaiementsService', () => ({
  default: {
    getAllPaiements: mocks.getAllPaiements,
  },
}));

type Row = PaiementArtisan & {
  artisan?: { nom?: string; prenoms?: string; numero_carte?: string };
  facture?: FactureDefinitive | null;
  vente?: { numero_recu?: string | null } | null;
};

const facture = (over: Partial<FactureDefinitive> = {}): FactureDefinitive => ({
  numero_facture: 'FAC-001',
  vente_or_id: 'v1',
  artisan_id: 'a1',
  montant_brut: 3_620_000,
  montant_taxe_tva: 0,
  montant_taxe_retenue_source: 120_000,
  montant_autres_taxes: 0,
  montant_total_taxes: 120_000,
  montant_net_a_payer: 3_500_000,
  taux_tva: 0,
  taux_retenue_source: 3.31,
  date_emission: '2026-05-11',
  statut: 'emise',
  ...over,
});

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
    version: 4,
    date_paiement: '2026-05-12T10:00:00Z',
    artisan: { nom: 'KABORE', prenoms: 'Awa', numero_carte: 'CP-0001' },
    vente: { numero_recu: 'VE-OR-2026-00001' },
    facture: facture(),
    ...over,
  }) as Row;

const paiements = [
  paiement({}),
  paiement({ id: 'p2', reference_paiement: 'PAY-002', type_paiement: 'cash', statut: 'en_traitement', montant_paye: 900_000, date_paiement: '2026-06-20T10:00:00Z', artisan: { nom: 'KONE', prenoms: 'Mamadou', numero_carte: 'CP-0002' } }),
  paiement({ id: 'p3', artisan_id: 'a2', reference_paiement: 'PAY-003', type_paiement: 'cheque', statut: 'annule', montant_paye: 400_000, date_paiement: '2026-01-05T10:00:00Z' }),
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
    mocks.user = {
      id: 'validator-id', role: 'management', is_active: true,
      capabilities: ['sonasp.finance.execute', 'sonasp.finance.reconcile'],
    };
    mocks.getAllPaiements.mockResolvedValue(paiements);
  });

  it('affiche les indicateurs et les règlements', async () => {
    render(<PaiementsHistorique />);

    expect(screen.getByRole('heading', { name: 'Dossiers de paiement' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('PAY-001')).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs des dossiers de paiement' }));
    expect(stats.getByText('Dossiers enregistrés')).toBeInTheDocument();
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

  it('ouvre une fiche détaillée depuis une ligne de paiement', async () => {
    render(<PaiementsHistorique />);
    await waitFor(() => expect(screen.getByText('PAY-002')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Voir le dossier PAY-002' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/paiements/historique/p2');
  });

  it('signale un historique indisponible', async () => {
    mocks.getAllPaiements.mockRejectedValue(new Error('hors ligne'));
    render(<PaiementsHistorique />);

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith('Impossible de charger les dossiers de paiement')
    );
  });

  it('présente au Collecteur un registre filtré en lecture seule', async () => {
    mocks.user = {
      id: 'collector-user', role: 'customer', is_active: true,
      capabilities: ['collector.operate'],
    };
    render(<PaiementsHistorique />);

    await waitFor(() => expect(screen.getByText('PAY-001')).toBeInTheDocument());
    expect(screen.queryByText('PAY-003')).not.toBeInTheDocument();
    expect(screen.getByText(/Vous consultez uniquement les paiements/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ventes à régler/ })).not.toBeInTheDocument();
  });

  it('n’expose aucune transition financière dans le registre', async () => {
    mocks.user = { id: 'reader', role: 'management', is_active: true, capabilities: [] };
    render(<PaiementsHistorique />);
    await waitFor(() => expect(screen.getByText('PAY-002')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /Confirmer le contrôle/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Effectuer le double contrôle').length).toBeGreaterThan(0);
  });

  it('explique la confirmation sécurisée sans demander une URL libre', async () => {
    mocks.getAllPaiements.mockResolvedValue([
      paiement({ id: 'p4', statut: 'valide', facture: facture({ certification_dgi_status: 'certified' }) }),
    ]);
    render(<PaiementsHistorique />);
    await waitFor(() => expect(screen.getByText('Attendre la confirmation du versement')).toBeInTheDocument());

    expect(screen.queryByPlaceholderText(/URL ou chemin/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clôturer' })).not.toBeInTheDocument();
  });
});
