import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import ArtisanMinierDashboard from './ArtisanMinierDashboard';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAll: vi.fn(),
  getAllCartes: vi.fn(),
  listSites: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getAll: mocks.getAll },
}));

vi.mock('@/services/carteProfessionnelleService', () => ({
  carteProfessionnelleService: { getAllCartes: mocks.getAllCartes },
}));

vi.mock('@/services/artisanalSiteService', () => ({
  artisanalSiteService: { listSites: mocks.listSites },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Line: () => null,
  LabelList: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const artisans: ArtisanMinier[] = [
  { id: 'a1', numero_carte: 'CP-1', type_personne: 'physique', type_artisan: 'exploitant', telephone: '+226 70 00 00 01', region: 'Nord', commune: 'Kalsaka', created_at: '2026-02-10T09:00:00.000Z' },
  { id: 'a2', numero_carte: 'CP-2', type_personne: 'physique', type_artisan: 'collecteur', telephone: '+226 70 00 00 02', region: 'Boucle du Mouhoun', commune: 'Poura', created_at: '2026-03-12T09:00:00.000Z' },
  { id: 'a3', numero_carte: 'CP-3', type_personne: 'physique', type_artisan: 'exploitant', telephone: '+226 70 00 00 03', region: 'Nord', commune: 'Kalsaka', created_at: '2026-04-02T09:00:00.000Z' },
];

const cards: CarteProfessionnelle[] = [
  { id: 'c1', artisan_id: 'a1', numero_carte: 'CP-1', statut: 'validee', date_delivrance: '2026-02-20', date_expiration: '2027-02-20' },
  { id: 'c2', artisan_id: 'a2', numero_carte: 'CP-2', statut: 'en_cours', date_delivrance: '2026-03-20', date_expiration: '2027-03-20' },
];

describe('ArtisanMinierDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAll.mockResolvedValue(artisans);
    mocks.getAllCartes.mockResolvedValue(cards);
    mocks.listSites.mockResolvedValue(DEMO_ARTISANAL_SITES);
  });

  it('affiche les indicateurs et panneaux de la vue territoriale', async () => {
    render(<ArtisanMinierDashboard />);

    expect(screen.getByRole('heading', { name: 'Gestion des Artisans Miniers' })).toBeInTheDocument();
    expect(screen.getByText('Vue territoriale des artisans, régions et sites miniers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvel artisan/ })).toBeInTheDocument();

    const metrics = within(screen.getByRole('region', { name: 'Indicateurs des artisans miniers' }));
    ['Artisans enregistrés', 'Régions couvertes', 'Sites miniers actifs', 'Cartes valides', 'Dossiers en attente', 'Alertes conformité']
      .forEach((label) => expect(metrics.getByText(label)).toBeInTheDocument());

    expect(screen.getByText('Répartition territoriale des artisans')).toBeInTheDocument();
    expect(screen.getByText('Classement par région')).toBeInTheDocument();
    expect(screen.getByText('État administratif')).toBeInTheDocument();
    expect(screen.getByText('Évolution des enregistrements')).toBeInTheDocument();

    await waitFor(() => expect(metrics.getByText('2 / 13')).toBeInTheDocument());
    expect(metrics.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('6 sites')).toBeInTheDocument();
  });

  it('rattache les artisans aux sites par localité dans le tableau', async () => {
    render(<ArtisanMinierDashboard />);

    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Kalsaka')).toBeInTheDocument());

    const row = within(screen.getByRole('table')).getByText('Kalsaka').closest('tr');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('Yatenga');
    expect(row).toHaveTextContent('Surveillance');
  });

  it('bascule la carte vers la liste des régions', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Liste' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Liste' }));

    expect(screen.getByRole('columnheader', { name: 'Sites actifs' })).toBeInTheDocument();
  });

  it('n’affiche plus de zone de recherche', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    expect(screen.queryByPlaceholderText(/Rechercher/)).not.toBeInTheDocument();
  });

  it('ouvre les filtres dans un volet et le referme à l’application', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    // Les filtres occupaient une bande pleine largeur au-dessus des indicateurs.
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    const volet = screen.getByRole('dialog', { name: 'Filtres des artisans' });
    expect(within(volet).getByLabelText('Région')).toBeInTheDocument();

    fireEvent.click(within(volet).getByRole('button', { name: 'Appliquer' }));
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();
  });

  it('referme le volet au clic hors du panneau, par le bouton et par Échap', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    fireEvent.click(document.querySelector('.artisans-drawer__backdrop') as HTMLElement);
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les filtres' }));
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();
  });

  it('compte les filtres appliqués sur le bouton', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    const volet = screen.getByRole('dialog', { name: 'Filtres des artisans' });
    fireEvent.change(within(volet).getByLabelText('Type d’artisan'), { target: { value: 'collecteur' } });
    fireEvent.click(within(volet).getByRole('button', { name: 'Appliquer' }));

    expect(screen.getByRole('button', { name: /Filtres/ })).toHaveTextContent('1');
  });
});
