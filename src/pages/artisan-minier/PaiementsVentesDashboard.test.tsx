import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaiementsVentesDashboard, { SEUIL_ATTENTE_JOURS, filterVentes } from './PaiementsVentesDashboard';
import type { VenteEnAttentePaiement } from '@/services/artisanPaiementsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getVentes: vi.fn(),
  getStats: vi.fn(),
  emettreFacture: vi.fn(),
  showError: vi.fn(),
  user: {
    id: 'u1', role: 'customer', is_active: true,
    capabilities: ['comptoir.manage', 'comptoir.invoices.issue', 'comptoir.payments.execute'],
  } as Record<string, unknown>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));

vi.mock('@/services/artisanPaiementsService', () => ({
  default: {
    getVentesEnAttentePaiement: mocks.getVentes,
    getDashboardStats: mocks.getStats,
    emettreFacture: mocks.emettreFacture,
  },
  createArtisanPaymentIdempotencyKey: () => '10000000-0000-4000-8000-000000000001',
}));

const vente = (over: Partial<VenteEnAttentePaiement>): VenteEnAttentePaiement =>
  ({
    vente_id: 'v1',
    reference_vente: 'VTE-001',
    date_vente: '2026-05-02',
    artisan_id: 'a1',
    artisan_nom_complet: 'KABORE Awa',
    numero_carte: 'CP-0001',
    telephone: '+226 70 00 00 00',
    facture_id: null,
    numero_facture: null,
    montant_net_a_payer: 4_500_000,
    date_facture: null,
    statut_paiement: 'non_paye',
    vente_statut: 'validee',
    vente_version: 3,
    facture_version: null,
    jours_attente: 12,
    ...over,
  }) as VenteEnAttentePaiement;

const ventes = [
  vente({}),
  vente({ vente_id: 'v2', reference_vente: 'VTE-002', artisan_nom_complet: 'KONE Mamadou', facture_id: 'f2', numero_facture: 'FA-002', statut_paiement: 'facture_emise', jours_attente: 45 }),
  vente({ vente_id: 'v3', reference_vente: 'VTE-003', artisan_nom_complet: 'BURKINA GOLD', statut_paiement: 'paye', jours_attente: 3 }),
];

describe('filterVentes', () => {
  it('combine la recherche et le statut', () => {
    expect(filterVentes(ventes, '', 'tous')).toHaveLength(3);
    expect(filterVentes(ventes, '', 'paye')).toHaveLength(1);
    expect(filterVentes(ventes, 'kone', 'tous')).toHaveLength(1);
    expect(filterVentes(ventes, 'FA-002', 'tous')).toHaveLength(1);
    expect(filterVentes(ventes, 'kone', 'paye')).toHaveLength(0);
  });
});

describe('PaiementsVentesDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: 'u1', role: 'customer', is_active: true,
      capabilities: ['comptoir.manage', 'comptoir.invoices.issue', 'comptoir.payments.execute'],
    };
    mocks.getVentes.mockResolvedValue(ventes);
    mocks.getStats.mockResolvedValue({
      total_ventes_en_attente: 3,
      montant_total_a_payer: 13_500_000,
      paiements_en_cours: 1,
      paiements_completes: 1,
    });
    mocks.emettreFacture.mockResolvedValue({ invoice_id: 'f1' });
  });

  it('affiche les indicateurs et les dossiers', async () => {
    render(<PaiementsVentesDashboard />);

    expect(screen.getByRole('heading', { name: 'Factures DGI et paiements' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs des paiements' }));
    expect(stats.getByText('Achats à traiter')).toBeInTheDocument();
    expect(stats.getByText('13,5 M FCFA')).toBeInTheDocument();
  });

  it('signale les dossiers au-delà du seuil d’attente', async () => {
    render(<PaiementsVentesDashboard />);
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`attendent depuis plus de ${SEUIL_ATTENTE_JOURS} jours`))).toBeInTheDocument()
    );
  });

  it('émet la facture puis ouvre le dossier DGI en lecture seule', async () => {
    render(<PaiementsVentesDashboard />);
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Émettre la facture/ })[0]);

    await waitFor(() => expect(mocks.emettreFacture).toHaveBeenCalled());
    expect(mocks.emettreFacture).toHaveBeenCalledWith({
      saleId: 'v1', expectedSaleStatus: 'validee', expectedSaleVersion: 3,
      idempotencyKey: '10000000-0000-4000-8000-000000000001',
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/ventes-or/v1/facture');
  });

  it('n’ouvre pas le paiement si l’émission de la facture échoue', async () => {
    mocks.emettreFacture.mockRejectedValue(new Error('RPC indisponible'));
    render(<PaiementsVentesDashboard />);
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Émettre la facture/ })[0]);

    await waitFor(() => expect(mocks.showError).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('ouvre la facture non certifiée sans exposer une action DGI forgée', async () => {
    render(<PaiementsVentesDashboard />);
    await waitFor(() => expect(screen.getByText('KONE Mamadou')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^Voir la facture$/ })[0]);

    expect(mocks.emettreFacture).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/ventes-or/v2/facture');
  });

  it('reste en lecture seule sans capacité sensible autoritative', async () => {
    mocks.user = {
      id: 'u2', role: 'customer', is_active: true, capabilities: ['comptoir.manage'],
    };
    render(<PaiementsVentesDashboard />);
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    expect(screen.getAllByRole('button', { name: /Émettre la facture/ })[0]).toBeDisabled();
    expect(mocks.emettreFacture).not.toHaveBeenCalled();
  });
});
