import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  user: null as Record<string, unknown> | null,
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

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getById: mocks.getArtisan },
}));

vi.mock('@/components/artisan/AffiliationDossier', () => ({ AffiliationDossier: ({ artisanId }: { artisanId: string }) => <div data-testid="affiliation-dossier">{artisanId}</div> }));

// Le résumé réel reste rendu, mais ses lectures annexes ne sortent jamais du test.
vi.mock('@/services/artisanDocumentService', () => ({ artisanDocumentService: { list: async () => [] } }));
vi.mock('@/services/artisanDossierService', () => ({ artisanDossierService: { getExploitant: async () => null } }));
vi.mock('@/services/artisanalSiteService', () => ({ artisanalSiteService: { listSites: async () => [] } }));

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

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
    vi.resetAllMocks();
    mocks.user = null;
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

    expect(screen.getByText('Coordonnées et rattachement')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    expect(screen.getByText('REC-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Infractions/ }));
    expect(screen.getByText('Vente hors circuit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Carte professionnelle/ }));
    expect(screen.getByTestId('affiliation-dossier')).toHaveTextContent('a1');
  });

  it('filtre les ventes du dossier', async () => {
    render(<ArtisanMinierDetails />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Ventes déclarées/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    fireEvent.change(screen.getByPlaceholderText(/Rechercher par reçu/), { target: { value: 'REC-002' } });

    expect(screen.getByText('REC-002')).toBeInTheDocument();
    expect(screen.queryByText('REC-001')).not.toBeInTheDocument();
  });

  it('reste consultable mais ne présente aucun faux zéro quand les sources annexes échouent', async () => {
    mocks.getVentes.mockRejectedValue(new Error('table absente'));
    mocks.getInfractions.mockRejectedValue(new Error('table absente'));

    render(<ArtisanMinierDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'KABORE Awa' })).toBeInTheDocument());
    const stats = within(screen.getByRole('region', { name: 'Indicateurs du dossier' }));
    expect(stats.getAllByText('Indisponible')).toHaveLength(4);
    expect(stats.queryByText('0')).not.toBeInTheDocument();
    expect(stats.queryByText('0,00 g')).not.toBeInTheDocument();
    expect(stats.queryByText('0 FCFA')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Réessayer les ventes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer les infractions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    expect(screen.queryByText('Aucune vente déclarée')).not.toBeInTheDocument();
    expect(screen.getByText(/Les ventes sont indisponibles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Infractions/ }));
    expect(screen.queryByText('Aucune infraction enregistrée')).not.toBeInTheDocument();
    expect(screen.getByText(/Les infractions sont indisponibles/)).toBeInTheDocument();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('reprend uniquement les ventes et conserve l’erreur indépendante des infractions', async () => {
    mocks.getVentes.mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce(ventes);
    mocks.getInfractions.mockRejectedValue(new Error('accès indisponible'));
    render(<ArtisanMinierDetails />);

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer les ventes' }));
    await waitFor(() => expect(screen.getByText('150,00 g')).toBeInTheDocument());
    expect(screen.getByText('7 021 000 FCFA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer les ventes' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer les infractions' })).toBeInTheDocument();
    expect(mocks.getVentes).toHaveBeenCalledTimes(2);
    expect(mocks.getInfractions).toHaveBeenCalledTimes(1);
    expect(mocks.getArtisan).toHaveBeenCalledTimes(1);
  });

  it('conserve l’état indisponible après une reprise infructueuse puis récupère les infractions', async () => {
    mocks.getInfractions
      .mockRejectedValueOnce(new Error('réseau'))
      .mockRejectedValueOnce(new Error('réseau persistant'))
      .mockResolvedValueOnce(infractions);
    render(<ArtisanMinierDetails />);

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer les infractions' }));
    await waitFor(() => expect(mocks.getInfractions).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Réessayer les infractions' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Indicateurs du dossier' })).getByText('Indisponible')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer les infractions' }));
    await waitFor(() => expect(screen.getByText('1 infraction(s) en cours')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Réessayer les infractions' })).not.toBeInTheDocument();
    expect(mocks.getInfractions).toHaveBeenCalledTimes(3);
    expect(mocks.getVentes).toHaveBeenCalledTimes(1);
    expect(mocks.getArtisan).toHaveBeenCalledTimes(1);
  });

  it('affiche les zéros et états vides seulement après une lecture vide réussie', async () => {
    mocks.getVentes.mockResolvedValue([]);
    mocks.getInfractions.mockResolvedValue([]);
    render(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'KABORE Awa' });

    const stats = within(screen.getByRole('region', { name: 'Indicateurs du dossier' }));
    expect(stats.getAllByText('0')).toHaveLength(2);
    expect(stats.getByText('0,00 g')).toBeInTheDocument();
    expect(stats.getByText('0 FCFA')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Ventes déclarées/ }));
    expect(screen.getByText('Aucune vente déclarée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Infractions/ }));
    expect(screen.getByText('Aucune infraction enregistrée')).toBeInTheDocument();
  });

  it('affiche le dossier sans attendre une source lente et distingue son chargement d’un zéro', async () => {
    const pendingVentes = deferred<ArtisanGoldSale[]>();
    mocks.getVentes.mockReturnValue(pendingVentes.promise);
    render(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'KABORE Awa' });

    const stats = within(screen.getByRole('region', { name: 'Indicateurs du dossier' }));
    expect(stats.getAllByText('Chargement…')).toHaveLength(3);
    expect(screen.getByText('Chargement des ventes…')).toHaveAttribute('role', 'status');
    expect(screen.queryByText('Aucune vente déclarée')).not.toBeInTheDocument();
    await act(async () => pendingVentes.resolve(ventes));
    expect(stats.getByText('150,00 g')).toBeInTheDocument();
    expect(screen.queryByText('Chargement des ventes…')).not.toBeInTheDocument();
  });

  it('ignore les réponses tardives de l’artisan précédent après un changement de dossier', async () => {
    const oldVentes = deferred<ArtisanGoldSale[]>();
    const oldInfractions = deferred<ArtisanInfraction[]>();
    mocks.getVentes.mockReturnValueOnce(oldVentes.promise).mockResolvedValueOnce([]);
    mocks.getInfractions.mockReturnValueOnce(oldInfractions.promise).mockResolvedValueOnce([]);
    const { rerender } = render(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'KABORE Awa' });

    mocks.params.id = 'a2';
    mocks.getArtisan.mockResolvedValue({ ...artisan, id: 'a2', nom: 'OUEDRAOGO', prenoms: 'Adama' });
    rerender(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'OUEDRAOGO Adama' });
    await act(async () => {
      oldVentes.resolve(ventes);
      oldInfractions.resolve(infractions);
    });

    const stats = within(screen.getByRole('region', { name: 'Indicateurs du dossier' }));
    expect(stats.getByText('0,00 g')).toBeInTheDocument();
    expect(stats.queryByText('150,00 g')).not.toBeInTheDocument();
    expect(screen.queryByText('1 infraction(s) en cours')).not.toBeInTheDocument();
    expect(mocks.getVentes).toHaveBeenLastCalledWith('a2');
    expect(mocks.getInfractions).toHaveBeenLastCalledWith('a2');
  });

  it.each([
    ['id', 'agent-b'],
    ['organization_id', 'org-b'],
    ['mining_company_id', 'mine-b'],
    ['access_role_id', 'role-b'],
    ['role', 'owner'],
    ['account_type', 'sonasp'],
    ['organization_type', 'comptoir'],
    ['is_active', false],
    ['capabilities', ['artisan.read']],
    ['module_codes', ['artisan_mining']],
    ['site_ids', ['site-b']],
    ['responsibilities', ['controle']],
    ['module_domains', ['artisan']],
    ['access_portal_id', 'portal-b'],
    ['access_portal_code', 'sonasp'],
    ['actor_category_code', 'agent-b'],
  ])('efface immédiatement le dossier et recharge les trois sources quand %s change', async (field, value) => {
    mocks.user = { id: 'agent-a', role: 'admin', is_active: true, capabilities: [] };
    const { rerender } = render(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'KABORE Awa' });
    const nextArtisan = deferred<ArtisanMinier>();
    mocks.getArtisan.mockReturnValueOnce(nextArtisan.promise);
    mocks.getVentes.mockResolvedValueOnce([]);
    mocks.getInfractions.mockResolvedValueOnce([]);
    mocks.user = { ...mocks.user, [field]: value };

    rerender(<ArtisanMinierDetails />);
    expect(screen.queryByRole('heading', { name: 'KABORE Awa' })).not.toBeInTheDocument();
    expect(screen.queryByText('150,00 g')).not.toBeInTheDocument();
    expect(screen.getByText('Chargement du dossier…')).toBeInTheDocument();
    await act(async () => nextArtisan.resolve({ ...artisan, nom: 'OUEDRAOGO', prenoms: 'Adama' }));
    expect(screen.getByRole('heading', { name: 'OUEDRAOGO Adama' })).toBeInTheDocument();
    expect(screen.getByText('0,00 g')).toBeInTheDocument();
    expect(mocks.getArtisan).toHaveBeenCalledTimes(2);
    expect(mocks.getVentes).toHaveBeenCalledTimes(2);
    expect(mocks.getInfractions).toHaveBeenCalledTimes(2);
  });

  it('ignore une identité et des sources tardives après changement de contexte sans changement de rôle', async () => {
    mocks.user = { id: 'agent-a', role: 'admin', is_active: true, organization_id: 'org-a' };
    const oldArtisan = deferred<ArtisanMinier>();
    const oldVentes = deferred<ArtisanGoldSale[]>();
    const oldInfractions = deferred<ArtisanInfraction[]>();
    mocks.getArtisan.mockReturnValueOnce(oldArtisan.promise);
    mocks.getVentes.mockReturnValueOnce(oldVentes.promise);
    mocks.getInfractions.mockReturnValueOnce(oldInfractions.promise);
    const { rerender } = render(<ArtisanMinierDetails />);
    mocks.user = { ...mocks.user, organization_id: 'org-b' };
    mocks.getArtisan.mockResolvedValue({ ...artisan, nom: 'OUEDRAOGO', prenoms: 'Adama' });
    mocks.getVentes.mockResolvedValue([]);
    mocks.getInfractions.mockResolvedValue([]);
    rerender(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'OUEDRAOGO Adama' });

    await act(async () => {
      oldArtisan.resolve(artisan);
      oldVentes.resolve(ventes);
      oldInfractions.resolve(infractions);
    });
    expect(screen.queryByRole('heading', { name: 'KABORE Awa' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'OUEDRAOGO Adama' })).toBeInTheDocument();
    expect(screen.getByText('0,00 g')).toBeInTheDocument();
    expect(screen.queryByText('1 infraction(s) en cours')).not.toBeInTheDocument();
  });

  it('quitte l’onglet Infractions et masque ses données lors du passage au contexte Collecteur', async () => {
    mocks.user = { id: 'agent-a', role: 'admin', is_active: true, capabilities: [] };
    const { rerender } = render(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'KABORE Awa' });
    fireEvent.click(screen.getByRole('tab', { name: /Infractions/ }));
    expect(screen.getByText('Vente hors circuit')).toBeInTheDocument();

    mocks.user = { id: 'agent-a', role: 'customer', is_active: true, capabilities: ['collector.operate'] };
    rerender(<ArtisanMinierDetails />);
    expect(screen.queryByText('Vente hors circuit')).not.toBeInTheDocument();
    await screen.findByText(/Dossier en lecture seule/);
    expect(screen.getByRole('tab', { name: 'Informations' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /Infractions/ })).not.toBeInTheDocument();
    expect(mocks.getInfractions).toHaveBeenCalledTimes(1);
  });

  it('affiche un état vide si l’artisan n’existe pas', async () => {
    mocks.getArtisan.mockResolvedValue(null);
    render(<ArtisanMinierDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Artisan introuvable' })).toBeInTheDocument());
    expect(mocks.showError).toHaveBeenCalledWith("Impossible de charger le dossier de l'artisan");
  });

  it('rend le dossier Collecteur consultatif et ne charge pas les infractions', async () => {
    mocks.user = {
      id: 'collector-user', role: 'customer', is_active: true,
      capabilities: ['collector.operate'],
    };
    render(<ArtisanMinierDetails />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'KABORE Awa' })).toBeInTheDocument());
    expect(screen.getByText(/Dossier en lecture seule/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier le dossier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Signaler une infraction/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Infractions/ })).not.toBeInTheDocument();
    expect(mocks.getInfractions).not.toHaveBeenCalled();
  });
});
