import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CarteValidation from './CarteValidation';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getDashboardStats: vi.fn(),
  getCartesEnCours: vi.fn(),
  valider: vi.fn(),
  showAlert: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({ showAlert: mocks.showAlert }),
}));

vi.mock('@/services/carteProfessionnelleService', () => ({
  carteProfessionnelleService: {
    getDashboardStats: mocks.getDashboardStats,
    getCartesEnCours: mocks.getCartesEnCours,
    valider: mocks.valider,
  },
}));

const cards = [
  {
    id: 'c1',
    artisan_id: 'a1',
    numero_carte: 'SONASP/AM/2026/000012',
    statut: 'en_cours',
    date_delivrance: '2026-01-15',
    date_expiration: '2027-01-15',
    artisan: { id: 'a1', type_personne: 'physique', nom: 'KABORE', prenoms: 'Awa', type_artisan: 'collecteur', region: 'Centre' },
  },
  {
    id: 'c2',
    artisan_id: 'a2',
    numero_carte: 'SONASP/AM/2026/000013',
    statut: 'en_cours',
    date_delivrance: '2026-02-02',
    date_expiration: '2027-02-02',
    artisan: { id: 'a2', type_personne: 'morale', raison_sociale: 'BURKINA GOLD', type_artisan: 'fournisseur', region: 'Sahel' },
  },
];

describe('CarteValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboardStats.mockResolvedValue({ total: 40, en_cours: 2, validees: 31, expirees: 5, suspendues: 2 });
    mocks.getCartesEnCours.mockResolvedValue(cards);
    mocks.valider.mockResolvedValue({});
  });

  it('affiche les indicateurs et les demandes en attente', async () => {
    render(<CarteValidation />);

    expect(screen.getByRole('heading', { name: 'Validation des cartes professionnelles' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Indicateurs des cartes professionnelles' }));
    expect(stats.getByText('En attente de validation')).toBeInTheDocument();
    expect(stats.getByText('31')).toBeInTheDocument();

    expect(screen.getByText('BURKINA GOLD')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'N° de carte' })).toBeInTheDocument();
  });

  it('valide une carte et recharge les données', async () => {
    render(<CarteValidation />);
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Valider/ })[0]);

    await waitFor(() => expect(mocks.valider).toHaveBeenCalledWith('c1'));
    expect(mocks.showAlert).toHaveBeenCalledWith('Carte SONASP/AM/2026/000012 validée', 'success');
    await waitFor(() => expect(mocks.getCartesEnCours).toHaveBeenCalledTimes(2));
  });

  it('filtre les demandes par recherche', async () => {
    render(<CarteValidation />);
    await waitFor(() => expect(screen.getByText('KABORE Awa')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Rechercher par titulaire/), { target: { value: 'BURKINA' } });

    expect(screen.queryByText('KABORE Awa')).not.toBeInTheDocument();
    expect(screen.getByText('BURKINA GOLD')).toBeInTheDocument();
  });

  it('affiche un état vide explicite sans demande', async () => {
    mocks.getCartesEnCours.mockResolvedValue([]);
    render(<CarteValidation />);

    await waitFor(() =>
      expect(screen.getByText('Aucune carte en attente de validation')).toBeInTheDocument()
    );
  });

  it('signale une erreur de chargement', async () => {
    mocks.getDashboardStats.mockRejectedValue(new Error('hors ligne'));
    render(<CarteValidation />);

    await waitFor(() =>
      expect(mocks.showAlert).toHaveBeenCalledWith('Erreur lors du chargement des données', 'error')
    );
  });
});
