import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectorPortalPage from './CollectorPortalPage';

const mocks = vi.hoisted(() => ({
  getArtisans: vi.fn(), getDocuments: vi.fn(), getSales: vi.fn(), getStock: vi.fn(),
  getPayments: vi.fn(), getTaxes: vi.fn(),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useCollectorWorkspace', () => ({
  useCollectorWorkspace: () => ({
    isCollector: true, loading: false,
    workspace: {
      collectorId: 'collector-1', collectorName: 'Collecteur Test', collectorCardNumber: 'COL-1',
      organizationId: 'org-1', organizationName: 'Comptoir Test', organizationCode: 'CPT-1',
      assignedArtisanIds: ['a1'],
    },
  }),
}));
vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getAll: mocks.getArtisans, getDocuments: mocks.getDocuments },
}));
vi.mock('@/services/artisanGoldSalesService', () => ({
  artisanGoldSalesService: { getAll: mocks.getSales },
}));
vi.mock('@/services/comptoirPortalService', () => ({
  comptoirPortalService: { getStock: mocks.getStock },
}));
vi.mock('@/services/artisanPaiementsService', () => ({
  default: { getAllPaiements: mocks.getPayments, getTaxesRetenues: mocks.getTaxes },
}));

describe('CollectorPortalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArtisans.mockResolvedValue([
      { id: 'a1', type_artisan: 'exploitant', type_personne: 'physique', nom: 'Affecté' },
      { id: 'a2', type_artisan: 'exploitant', type_personne: 'physique', nom: 'Hors périmètre' },
    ]);
    mocks.getSales.mockResolvedValue([
      { id: '123e4567-e89b-12d3-a456-426614174000', artisan_id: 'a1', numero_recu: 'REC-AFFECTE', date_vente: '2026-08-24', quantite_grammes: 10, montant_total_fcfa: 500_000, statut: 'en_attente' },
      { id: '123e4567-e89b-12d3-a456-426614174001', artisan_id: 'a2', numero_recu: 'REC-INTERDIT', date_vente: '2026-08-24', quantite_grammes: 20, montant_total_fcfa: 900_000, statut: 'en_attente' },
    ]);
    mocks.getStock.mockResolvedValue([]);
    mocks.getPayments.mockResolvedValue([{ id: 'p1', artisan_id: 'a1' }, { id: 'p2', artisan_id: 'a2' }]);
    mocks.getTaxes.mockResolvedValue([{ id: 't1', artisan_id: 'a1', montant_taxe: 25_000 }, { id: 't2', artisan_id: 'a2', montant_taxe: 90_000 }]);
    mocks.getDocuments.mockResolvedValue([{ id: 'd1' }]);
  });

  it('présente uniquement les données assignées et aucun raccourci international', async () => {
    render(<MemoryRouter><CollectorPortalPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('REC-AFFECTE')).toBeInTheDocument());
    expect(screen.queryByText('REC-INTERDIT')).not.toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.queryByText('en_attente')).not.toBeInTheDocument();
    expect(screen.getByText(/Vos ventes sont soumises à l’approbation/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enregistrer une vente' })).toHaveAttribute('href', '/collecte/ventes/nouvelle');

    const stats = within(screen.getByRole('region', { name: 'Indicateurs du Collecteur' }));
    expect(stats.getByText('Orpailleurs assignés')).toBeInTheDocument();
    expect(stats.getByText('25 000 FCFA')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registre des collectes/ })).toHaveAttribute('href', '/artisan-minier/ventes-or');
    expect(screen.queryByRole('link', { name: /international|export/i })).not.toBeInTheDocument();
  });
});
