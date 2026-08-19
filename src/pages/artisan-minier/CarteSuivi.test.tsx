import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CarteSuivi, { timeAgo } from './CarteSuivi';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getDashboardStats: vi.fn(),
  getRecentActivities: vi.fn(),
  getTopArtisans: vi.fn(),
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
    getRecentActivities: mocks.getRecentActivities,
    getTopArtisans: mocks.getTopArtisans,
  },
}));

const REFERENCE = new Date('2026-08-18T12:00:00Z');

const stats = {
  total: 120,
  en_cours: 8,
  validees: 40,
  en_exploitation: 62,
  expirees: 7,
  suspendues: 3,
  expirant_30_jours: 5,
};

const activities = [
  {
    id: 'act1',
    description: 'Carte validée par la direction',
    created_at: new Date(REFERENCE.getTime() - 45 * 60_000).toISOString(),
    artisan: { type_personne: 'physique', nom: 'SAWADOGO', prenoms: 'Adama' },
    carte: { numero_carte: 'CP-0001' },
  },
];

const top = [
  { artisanId: 'a1', artisan: { type_personne: 'morale', raison_sociale: 'BURKINA GOLD' }, carte: { statut: 'en_exploitation' }, ventes: 12, montant: 409_300_000, grammes: 212.2 },
  { artisanId: 'a2', artisan: { type_personne: 'physique', nom: 'KONE', prenoms: 'Mamadou' }, carte: { statut: 'suspendue' }, ventes: 4, montant: 51_000, grammes: 18 },
];

describe('timeAgo', () => {
  it('exprime l’ancienneté en minutes, heures puis jours', () => {
    expect(timeAgo(new Date(REFERENCE.getTime() - 30_000).toISOString(), REFERENCE)).toBe("à l'instant");
    expect(timeAgo(new Date(REFERENCE.getTime() - 20 * 60_000).toISOString(), REFERENCE)).toBe('il y a 20 min');
    expect(timeAgo(new Date(REFERENCE.getTime() - 5 * 3_600_000).toISOString(), REFERENCE)).toBe('il y a 5 h');
    expect(timeAgo(new Date(REFERENCE.getTime() - 3 * 86_400_000).toISOString(), REFERENCE)).toBe('il y a 3 j');
    expect(timeAgo(undefined, REFERENCE)).toBe('—');
  });
});

describe('CarteSuivi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(REFERENCE);
    mocks.getDashboardStats.mockResolvedValue(stats);
    mocks.getRecentActivities.mockResolvedValue(activities);
    mocks.getTopArtisans.mockResolvedValue(top);
  });

  it('affiche le parc de cartes, l’activité et le classement', async () => {
    render(<CarteSuivi />);

    expect(screen.getByRole('heading', { name: 'Suivi des cartes professionnelles' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('SAWADOGO Adama')).toBeInTheDocument());

    const parc = within(screen.getByRole('region', { name: 'État du parc de cartes' }));
    expect(parc.getByText('Cartes délivrées')).toBeInTheDocument();
    expect(parc.getByText('120')).toBeInTheDocument();
    // 40 validées + 62 en exploitation sur 120 = 85 %
    expect(parc.getByText('85 % en cours de validité')).toBeInTheDocument();

    expect(screen.getByText('il y a 45 min')).toBeInTheDocument();
    expect(screen.getByText('BURKINA GOLD')).toBeInTheDocument();
    expect(screen.getByText('409,3 M FCFA')).toBeInTheDocument();
  });

  it('alerte sur les cartes arrivant à échéance', async () => {
    render(<CarteSuivi />);
    await waitFor(() =>
      expect(screen.getByText(/5 carte\(s\) arrivent à échéance/)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Traiter les expirations' })).toBeInTheDocument();
  });

  it('reste utilisable si une source de données échoue', async () => {
    mocks.getRecentActivities.mockRejectedValue(new Error('table absente'));
    render(<CarteSuivi />);

    // Les indicateurs restent affichés malgré l'échec du flux d'activité.
    await waitFor(() => expect(screen.getByText('Aucune activité enregistrée')).toBeInTheDocument());
    expect(screen.getByText('BURKINA GOLD')).toBeInTheDocument();
    expect(mocks.showAlert).not.toHaveBeenCalled();
  });

  it('signale l’échec des indicateurs', async () => {
    mocks.getDashboardStats.mockRejectedValue(new Error('hors ligne'));
    render(<CarteSuivi />);

    await waitFor(() =>
      expect(mocks.showAlert).toHaveBeenCalledWith('Erreur lors du chargement des indicateurs', 'error')
    );
  });
});
