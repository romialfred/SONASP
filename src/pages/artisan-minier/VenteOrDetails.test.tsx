import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VenteOrDetails, { artisanLabel, availableActions } from './VenteOrDetails';
import type { ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import type { ArtisanMinier } from '@/services/artisanMinierService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { id: 'v1' as string | undefined },
  getById: vi.fn(),
  updateStatus: vi.fn(),
  getArtisan: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  openConfirm: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', is_active: true, is_sales_approver: true, role: 'management' },
  }),
}));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({ open: mocks.openConfirm, ConfirmationDialog: () => null }),
}));

vi.mock('@/services/artisanGoldSalesService', () => ({
  artisanGoldSalesService: { getById: mocks.getById, updateStatus: mocks.updateStatus },
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getById: mocks.getArtisan },
}));

const vente = (over: Partial<ArtisanGoldSale> = {}): ArtisanGoldSale =>
  ({
    id: 'v1',
    artisan_id: 'a1',
    date_vente: '2026-05-10',
    quantite_grammes: 100,
    type_or: 'lingot',
    purete_karat: 22,
    prix_kg_fcfa: 40_000_000,
    montant_brut_fcfa: 4_000_000,
    tva_taux: 18,
    tva_montant_fcfa: 720_000,
    taxe_dev_comm_taux: 1,
    taxe_dev_comm_montant_fcfa: 40_000,
    montant_total_fcfa: 4_760_000,
    numero_recu: 'REC-001',
    observations: 'Collecte contrôlée sur site.',
    statut: 'en_attente',
    created_at: '2026-05-10T08:30:00Z',
    updated_at: '2026-05-11T09:00:00Z',
    ...over,
  }) as ArtisanGoldSale;

const artisan = {
  id: 'a1',
  nom: 'KABORE',
  prenoms: 'Awa',
  numero_carte: 'CP-0001',
  region: 'Centre',
  commune: 'Ouagadougou',
  telephone: '+226 70 00 00 01',
  email: 'awa@example.bf',
} as unknown as ArtisanMinier;

describe('availableActions', () => {
  it('ouvre les actions selon le statut', () => {
    expect(availableActions('en_attente')).toEqual({ modifier: true, valider: true, annuler: true, payer: false });
    expect(availableActions('validee')).toEqual({ modifier: false, valider: false, annuler: true, payer: true });
    expect(availableActions('payee')).toEqual({ modifier: false, valider: false, annuler: false, payer: false });
    expect(availableActions('annulee')).toEqual({ modifier: false, valider: false, annuler: false, payer: false });
  });

  it('compose le libellé de l’artisan', () => {
    expect(artisanLabel(artisan)).toBe('KABORE Awa');
    expect(artisanLabel(null)).toBe('Artisan inconnu');
  });
});

describe('VenteOrDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.id = 'v1';
    mocks.getById.mockResolvedValue(vente());
    mocks.getArtisan.mockResolvedValue(artisan);
    mocks.updateStatus.mockResolvedValue(vente({ statut: 'validee' }));
    mocks.openConfirm.mockResolvedValue(true);
  });

  it('hiérarchise l’identité, les indicateurs et le détail fiscal', async () => {
    render(<VenteOrDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'REC-001' })).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs de la vente' }));
    expect(stats.getByText('Quantité déclarée')).toBeInTheDocument();
    expect(stats.getByText('4 760 000 FCFA')).toBeInTheDocument();

    expect(screen.getByText('Détail fiscal')).toBeInTheDocument();
    expect(screen.getByText('TVA (18 %)')).toBeInTheDocument();
    expect(screen.getByText('720 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('Collecte contrôlée sur site.')).toBeInTheDocument();
  });

  it('affiche l’artisan et permet d’ouvrir sa fiche', async () => {
    render(<VenteOrDetails />);
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    expect(screen.getByText('CP-0001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche artisan' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/a1');
  });

  it('valide la vente après confirmation puis recharge', async () => {
    render(<VenteOrDetails />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Approuver la vente/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Approuver la vente/ }));

    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith('v1', 'validee'));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Vente approuvée');
    await waitFor(() => expect(mocks.getById).toHaveBeenCalledTimes(2));
  });

  it('n’expose ni modification ni validation sur une vente payée', async () => {
    mocks.getById.mockResolvedValue(vente({ statut: 'payee' }));
    render(<VenteOrDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'REC-001' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Approuver la vente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annuler la vente/ })).not.toBeInTheDocument();
  });

  it('propose le paiement sur une vente validée', async () => {
    mocks.getById.mockResolvedValue(vente({ statut: 'validee' }));
    render(<VenteOrDetails />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Ouvrir le paiement/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le paiement/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-minier/paiements/v1/nouveau');
  });

  it('reste consultable si la fiche artisan est indisponible', async () => {
    mocks.getArtisan.mockRejectedValue(new Error('artisan absent'));
    render(<VenteOrDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'REC-001' })).toBeInTheDocument());
    expect(screen.getByText('Fiche artisan indisponible.')).toBeInTheDocument();
  });

  it('affiche un état vide si la vente n’existe pas', async () => {
    mocks.getById.mockResolvedValue(null);
    render(<VenteOrDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Vente introuvable' })).toBeInTheDocument());
  });
});
