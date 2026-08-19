import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import ArtisanMinierListe, { TAILLE_PAGE, initiales } from './ArtisanMinierListe';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAll: vi.fn(),
  getAllCartes: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/artisan/ArtisanMinierForm', () => ({
  ArtisanMinierForm: () => <div>Formulaire artisan</div>,
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getAll: mocks.getAll },
}));

vi.mock('@/services/carteProfessionnelleService', () => ({
  carteProfessionnelleService: { getAllCartes: mocks.getAllCartes },
}));

const artisans = [
  { id: 'a1', numero_carte: 'SONASP/AM/2025/000063', type_personne: 'physique', type_artisan: 'collecteur', nom: 'KAMBOU', prenoms: 'Inoucent', telephone: '+226 64 64 56 37', email: 'innocent.kambou@gmail.com', region: 'Centre', commune: 'Ouagadougou', created_at: '2025-12-28T09:00:00Z', quantite_or_vendu_grammes: 0, chiffre_affaires_fcfa: 0, total_taxes_fcfa: 0 },
  { id: 'a2', numero_carte: 'SONASP/AM/2025/BF/0002', type_personne: 'physique', type_artisan: 'collecteur', nom: 'KONE', prenoms: 'Mamadou', telephone: '+226 76 23 45 67', region: 'Cascades', commune: 'Banfora', created_at: '2025-12-27T09:00:00Z', quantite_or_vendu_grammes: 212.2, chiffre_affaires_fcfa: 409_300_000, total_taxes_fcfa: 0 },
  { id: 'a3', numero_carte: 'SONASP/AM/2025/000041', type_personne: 'physique', type_artisan: 'exploitant', nom: 'OUEDRAOGO', prenoms: 'Salif', telephone: '+226 70 11 22 33', region: 'Nord', commune: 'Ouahigouya', created_at: '2025-11-04T09:00:00Z', quantite_or_vendu_grammes: 88.5, chiffre_affaires_fcfa: 172_000_000, total_taxes_fcfa: 5_160_000 },
] as unknown as ArtisanMinier[];

const cards = [
  { id: 'c1', artisan_id: 'a1', numero_carte: 'SONASP/AM/2025/000063', statut: 'validee', date_delivrance: '2025-12-28', date_expiration: '2099-04-28' },
] as CarteProfessionnelle[];

/** Le panneau de filtres est replie a l'ouverture : les tests qui s'en servent l'ouvrent. */
const deplierFiltres = () => fireEvent.click(screen.getByRole('button', { name: /Filtrer les artisans/ }));

describe('ArtisanMinierListe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAll.mockResolvedValue(artisans);
    mocks.getAllCartes.mockResolvedValue(cards);
  });

  it('affiche l’en-tête, les filtres et la barre de résultats', async () => {
    render(<ArtisanMinierListe />);

    expect(screen.getByRole('heading', { name: 'Artisans miniers' })).toBeInTheDocument();
    expect(screen.getByText('Filtrer les artisans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvel artisan/ })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('3 artisans enregistrés')).toBeInTheDocument());
    expect(screen.getByText(/3 résultats/)).toBeInTheDocument();

    // Le panneau est replie a l'ouverture : il occupait un tiers de l'ecran en permanence.
    expect(screen.queryByPlaceholderText(/Rechercher par nom/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filtrer les artisans/ })).toHaveAttribute('aria-expanded', 'false');

    deplierFiltres();

    expect(screen.getByPlaceholderText(/Rechercher par nom, numéro de carte/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Appliquer$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réinitialiser/ })).toBeInTheDocument();

    ['Type d’artisan', 'Région', 'Province', 'Date d’ouverture'].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );

    // Le type se choisit desormais dans une liste deroulante, non plus par pastilles.
    expect(within(screen.getByLabelText('Type d’artisan')).getByRole('option', { name: /Collecteurs/ })).toHaveTextContent('(2)');
  });

  it('replie et deplie le panneau de filtres', async () => {
    render(<ArtisanMinierListe />);
    await waitFor(() => expect(screen.getByText('3 artisans enregistrés')).toBeInTheDocument());

    const bascule = screen.getByRole('button', { name: /Filtrer les artisans/ });
    deplierFiltres();
    expect(bascule).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(bascule);
    expect(bascule).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByPlaceholderText(/Rechercher par nom/)).not.toBeInTheDocument();
  });

  it('compose la carte artisan avec sa province déduite de la commune', async () => {
    const { container } = render(<ArtisanMinierListe />);
    await waitFor(() => expect(container.querySelectorAll('.artisan-card')).toHaveLength(3));

    const card = within(container.querySelector('.artisan-card') as HTMLElement);
    expect(card.getByText('KAMBOU Inoucent')).toBeInTheDocument();
    expect(card.getByText('SONASP/AM/2025/000063')).toBeInTheDocument();
    // La commune Ouagadougou est le chef-lieu du Kadiogo.
    expect(card.getByText(/Kadiogo/)).toBeInTheDocument();
    expect(card.getByText('Collecteur')).toBeInTheDocument();
    expect(card.getByText('Or vendu')).toBeInTheDocument();
    expect(card.getByText('Voir le dossier')).toBeInTheDocument();
  });

  it('filtre par type et affiche le filtre actif retirable', async () => {
    const { container } = render(<ArtisanMinierListe />);
    await waitFor(() => expect(container.querySelectorAll('.artisan-card')).toHaveLength(3));

    deplierFiltres();
    fireEvent.change(screen.getByLabelText('Type d’artisan'), { target: { value: 'exploitant' } });

    expect(container.querySelectorAll('.artisan-card')).toHaveLength(1);
    expect(screen.getByText(/1 résultat/)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Type : Exploitants/ });

    fireEvent.click(chip);
    expect(container.querySelectorAll('.artisan-card')).toHaveLength(3);
  });

  it('recherche à la validation puis bascule en vue tableau', async () => {
    const { container } = render(<ArtisanMinierListe />);
    await waitFor(() => expect(container.querySelectorAll('.artisan-card')).toHaveLength(3));

    deplierFiltres();
    fireEvent.change(screen.getByPlaceholderText(/Rechercher par nom/), { target: { value: 'KONE' } });
    fireEvent.click(screen.getByRole('button', { name: /^Appliquer$/ }));

    expect(container.querySelectorAll('.artisan-card')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Affichage en tableau' }));

    expect(container.querySelectorAll('.artisan-card')).toHaveLength(0);
    expect(screen.getByRole('columnheader', { name: 'N° de carte' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /KONE Mamadou/ })).toHaveTextContent('409,3M FCFA');
  });

  it('retire les colonnes région et téléphone du tableau', async () => {
    const { container } = render(<ArtisanMinierListe />);
    await waitFor(() => expect(container.querySelectorAll('.artisan-card')).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: 'Affichage en tableau' }));

    // La région doublonnait la province, le téléphone relève de la fiche.
    expect(screen.queryByRole('columnheader', { name: 'Région' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Téléphone' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Province' })).toBeInTheDocument();
  });

  it('compose les initiales affichées devant le nom', () => {
    expect(initiales('KABORE Awa')).toBe('KA');
    expect(initiales('BURKINA GOLD SARL')).toBe('BG');
    expect(initiales('')).toBe('?');
  });

  it('pagine le tableau par trente lignes', async () => {
    const nombreux = Array.from({ length: TAILLE_PAGE + 5 }, (_, index) => ({
      id: `p${index}`,
      numero_carte: `BF-AM-2026-E397-${String(index + 1).padStart(4, '0')}`,
      type_personne: 'physique',
      type_artisan: 'collecteur',
      nom: 'ARTISAN',
      prenoms: `N${index}`,
      telephone: '+226 70 00 00 00',
      region: 'Centre',
      commune: 'Ouagadougou',
      created_at: `2025-12-${String((index % 28) + 1).padStart(2, '0')}T09:00:00Z`,
      quantite_or_vendu_grammes: 0,
      chiffre_affaires_fcfa: 0,
      total_taxes_fcfa: 0,
    }));
    mocks.getAll.mockResolvedValue(nombreux);

    const { container } = render(<ArtisanMinierListe />);
    await waitFor(() => expect(container.querySelectorAll('.artisan-card')).toHaveLength(TAILLE_PAGE + 5));

    fireEvent.click(screen.getByRole('button', { name: 'Affichage en tableau' }));

    expect(container.querySelectorAll('tbody tr')).toHaveLength(TAILLE_PAGE);
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));

    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });
});
