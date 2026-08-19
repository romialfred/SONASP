import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VentesOr, { filterSales, sortSales } from './VentesOr';
import type { ArtisanGoldSale } from '@/services/artisanGoldSalesService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAll: vi.fn(),
  remove: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  openConfirm: vi.fn(),
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

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({
    open: mocks.openConfirm,
    ConfirmationDialog: () => null,
  }),
}));

vi.mock('@/services/artisanGoldSalesService', () => ({
  artisanGoldSalesService: { getAll: mocks.getAll, delete: mocks.remove },
}));

const sale = (over: Partial<ArtisanGoldSale>): ArtisanGoldSale =>
  ({
    id: 's1',
    artisan_id: 'a1',
    date_vente: '2026-05-10',
    quantite_grammes: 120,
    type_or: 'poudre',
    purete_karat: 22,
    prix_kg_fcfa: 40_000_000,
    montant_brut_fcfa: 4_800_000,
    tva_taux: 18,
    tva_montant_fcfa: 864_000,
    taxe_dev_comm_taux: 3,
    taxe_dev_comm_montant_fcfa: 144_000,
    montant_total_fcfa: 5_808_000,
    numero_recu: 'REC-001',
    statut: 'en_attente',
    ...over,
  }) as ArtisanGoldSale;

const sales = [
  sale({}),
  sale({ id: 's2', numero_recu: 'REC-002', statut: 'payee', type_or: 'lingot', date_vente: '2026-06-01', quantite_grammes: 400, montant_total_fcfa: 19_000_000 }),
  sale({ id: 's3', numero_recu: 'REC-003', statut: 'validee', type_or: 'pepites', date_vente: '2026-01-20', quantite_grammes: 55, montant_total_fcfa: 2_100_000 }),
];

describe('filterSales / sortSales', () => {
  const base = { search: '', statut: 'all' as const, typeOr: 'all' as const, from: '', to: '' };

  it('cumule les critères de filtrage', () => {
    expect(filterSales(sales, { ...base, statut: 'payee' })).toHaveLength(1);
    expect(filterSales(sales, { ...base, typeOr: 'pepites' })).toHaveLength(1);
    expect(filterSales(sales, { ...base, statut: 'payee', typeOr: 'pepites' })).toHaveLength(0);
    expect(filterSales(sales, { ...base, from: '2026-05-01' })).toHaveLength(2);
    expect(filterSales(sales, { ...base, from: '2026-05-01', to: '2026-05-31' })).toHaveLength(1);
    expect(filterSales(sales, { ...base, search: 'rec-003' })).toHaveLength(1);
  });

  it('trie par date, montant ou quantité', () => {
    expect(sortSales(sales, 'date').map((s) => s.id)).toEqual(['s2', 's1', 's3']);
    expect(sortSales(sales, 'montant').map((s) => s.id)).toEqual(['s2', 's1', 's3']);
    expect(sortSales(sales, 'quantite').map((s) => s.id)).toEqual(['s2', 's1', 's3']);
  });
});

describe('VentesOr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAll.mockResolvedValue(sales);
    mocks.remove.mockResolvedValue(undefined);
    mocks.openConfirm.mockResolvedValue(true);
  });

  it('affiche les indicateurs et le registre', async () => {
    render(<VentesOr />);

    expect(screen.getByRole('heading', { name: 'Ventes d’or des artisans' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('REC-001')).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs des ventes d’or' }));
    expect(stats.getByText('Ventes filtrées')).toBeInTheDocument();
    expect(stats.getByText('3')).toBeInTheDocument();
    expect(stats.getByText('575,0 g')).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: 'N° de reçu' })).toBeInTheDocument();
  });

  it('filtre par statut via les puces', async () => {
    render(<VentesOr />);
    await waitFor(() => expect(screen.getByText('REC-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Payée/ }));

    expect(screen.getByText('REC-002')).toBeInTheDocument();
    expect(screen.queryByText('REC-001')).not.toBeInTheDocument();
  });

  it('supprime une vente après confirmation par le dialogue de la plateforme', async () => {
    render(<VentesOr />);
    await waitFor(() => expect(screen.getByText('REC-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la vente REC-001' }));

    await waitFor(() => expect(mocks.openConfirm).toHaveBeenCalled());
    expect(mocks.openConfirm.mock.calls[0][0]).toMatchObject({ severity: 'danger' });
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('s1'));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Vente supprimée avec succès');
  });

  it('n’appelle pas le service si la confirmation est refusée', async () => {
    mocks.openConfirm.mockResolvedValue(false);
    render(<VentesOr />);
    await waitFor(() => expect(screen.getByText('REC-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la vente REC-001' }));

    await waitFor(() => expect(mocks.openConfirm).toHaveBeenCalled());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('propose de réessayer quand le registre est indisponible', async () => {
    mocks.getAll.mockRejectedValue(new Error('table absente'));
    render(<VentesOr />);

    await waitFor(() => expect(screen.getByText('Impossible de charger le registre')).toBeInTheDocument());
    expect(screen.getByText('table absente')).toBeInTheDocument();

    mocks.getAll.mockResolvedValue(sales);
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));

    await waitFor(() => expect(screen.getByText('REC-001')).toBeInTheDocument());
  });

  it('affiche un état vide actionnable', async () => {
    mocks.getAll.mockResolvedValue([]);
    render(<VentesOr />);

    await waitFor(() => expect(screen.getByText('Aucune vente enregistrée')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Nouvelle vente/ }).length).toBeGreaterThan(1);
  });
});
