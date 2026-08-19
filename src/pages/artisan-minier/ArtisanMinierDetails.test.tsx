import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanMinierDetails, { artisanFullName, carteActive } from './ArtisanMinierDetails';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import type { ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import type { ArtisanInfraction } from '@/services/artisanInfractionsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { id: 'a1' as string | undefined },
  getArtisan: vi.fn(),
  getCartes: vi.fn(),
  getVentes: vi.fn(),
  getInfractions: vi.fn(),
  showError: vi.fn(),
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

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getById: mocks.getArtisan },
}));

vi.mock('@/services/carteProfessionnelleService', () => ({
  carteProfessionnelleService: { getByArtisanId: mocks.getCartes },
}));

vi.mock('@/services/artisanGoldSalesService', () => ({
  artisanGoldSalesService: { getByArtisan: mocks.getVentes },
}));

vi.mock('@/services/artisanInfractionsService', () => ({
  artisanInfractionsService: { getByArtisanId: mocks.getInfractions },
}));

const artisan = {
  id: 'a1',
  type_personne: 'physique',
  type_artisan: 'collecteur',
  nom: 'KABORE',
  prenoms: 'Awa',
  numero_carte: 'CP-0001',
  telephone: '+226 70 00 00 01',
  email: 'awa@example.bf',
  commune: 'Ouagadougou',
  region: 'Centre',
  actif: true,
} as unknown as ArtisanMinier;

const cartes = [
  { id: 'c-old', artisan_id: 'a1', numero_carte: 'CP-0001-A', statut: 'expiree', date_delivrance: '2024-01-01', date_expiration: '2025-01-01' },
  { id: 'c-new', artisan_id: 'a1', numero_carte: 'CP-0001', statut: 'validee', date_delivrance: '2026-01-01', date_expiration: '2027-01-01', carte_pdf_url: 'https://exemple/carte.pdf' },
] as CarteProfessionnelle[];

const ventes = [
  { id: 'v1', artisan_id: 'a1', numero_recu: 'REC-001', date_vente: '2026-05-10', type_or: 'lingot', quantite_grammes: 100, purete_karat: 22, prix_kg_fcfa: 40_000_000, montant_total_fcfa: 4_760_000, statut: 'payee' },
  { id: 'v2', artisan_id: 'a1', numero_recu: 'REC-002', date_vente: '2026-06-01', type_or: 'poudre', quantite_grammes: 50, purete_karat: 20, prix_kg_fcfa: 38_000_000, montant_total_fcfa: 2_261_000, statut: 'en_attente' },
] as ArtisanGoldSale[];

const infractions = [
  { id: 'i1', artisan_id: 'a1', date_infraction: '2026-03-02', type_infraction: 'Vente hors circuit', description: 'Or vendu sans reçu', lieu: 'Kalsaka', statut_traitement: 'en_cours', documents: [], created_at: '', updated_at: '' },
] as ArtisanInfraction[];

describe('carteActive', () => {
  it('retient la carte valide la plus récente', () => {
    expect(carteActive(cartes)?.id).toBe('c-new');
  });

  it('retombe sur la plus récente si aucune n’est valide', () => {
    const expirees = cartes.map((carte) => ({ ...carte, statut: 'expiree' })) as CarteProfessionnelle[];
    expect(carteActive(expirees)?.id).toBe('c-new');
    expect(carteActive([])).toBeNull();
  });

  it('compose le nom selon le type de personne', () => {
    expect(artisanFullName(artisan)).toBe('KABORE Awa');
    expect(artisanFullName({ type_personne: 'morale', raison_sociale: 'BURKINA GOLD' } as ArtisanMinier)).toBe('BURKINA GOLD');
    expect(artisanFullName(null)).toBe('Artisan inconnu');
  });
});

describe('ArtisanMinierDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.id = 'a1';
    mocks.getArtisan.mockResolvedValue(artisan);
    mocks.getCartes.mockResolvedValue(cartes);
    mocks.getVentes.mockResolvedValue(ventes);
    mocks.getInfractions.mockResolvedValue(infractions);
  });

  it('présente l’identité, les indicateurs et les alertes du dossier', async () => {
    render(<ArtisanMinierDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'KABORE Awa' })).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs du dossier' }));
    expect(stats.getByText('Ventes déclarées')).toBeInTheDocument();
    expect(stats.getByText('150,00 g')).toBeInTheDocument();
    expect(stats.getByText('7 021 000 FCFA')).toBeInTheDocument();

    expect(screen.getByText('1 infraction(s) en cours')).toBeInTheDocument();
  });

  it('navigue entre les sections du dossier', async () => {
    render(<ArtisanMinierDetails />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Informations/ })).toBeInTheDocument());

    expect(screen.getByText('Contact et localisation')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    expect(screen.getByText('REC-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Infractions/ }));
    expect(screen.getByText('Vente hors circuit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Carte professionnelle/ }));
    // La carte valide la plus récente est retenue, pas l'expirée.
    expect(screen.getByText('CP-0001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger/ })).toHaveAttribute('href', 'https://exemple/carte.pdf');
  });

  it('filtre les ventes du dossier', async () => {
    render(<ArtisanMinierDetails />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Ventes déclarées/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    fireEvent.change(screen.getByPlaceholderText(/Rechercher par reçu/), { target: { value: 'REC-002' } });

    expect(screen.getByText('REC-002')).toBeInTheDocument();
    expect(screen.queryByText('REC-001')).not.toBeInTheDocument();
  });

  it('reste consultable quand les sources annexes échouent', async () => {
    mocks.getVentes.mockRejectedValue(new Error('table absente'));
    mocks.getInfractions.mockRejectedValue(new Error('table absente'));

    render(<ArtisanMinierDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'KABORE Awa' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    expect(screen.getByText('Aucune vente déclarée')).toBeInTheDocument();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('affiche un état vide si l’artisan n’existe pas', async () => {
    mocks.getArtisan.mockResolvedValue(null);
    render(<ArtisanMinierDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Artisan introuvable' })).toBeInTheDocument());
    expect(mocks.showError).toHaveBeenCalledWith("Impossible de charger le dossier de l'artisan");
  });
});
