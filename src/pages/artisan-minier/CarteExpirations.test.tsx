import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CarteExpirations, { daysUntil, groupByHorizon } from './CarteExpirations';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import type { ArtisanMinier } from '@/services/artisanMinierService';

type CarteRow = CarteProfessionnelle & { artisan?: ArtisanMinier | null };

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAllCartes: vi.fn(),
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
  carteProfessionnelleService: { getAllCartes: mocks.getAllCartes },
}));

const REFERENCE = new Date('2026-06-01T12:00:00Z');
const inDays = (days: number) => new Date(REFERENCE.getTime() + days * 86_400_000).toISOString().slice(0, 10);

const card = (id: string, days: number, name: string) =>
  ({
  id,
  artisan_id: `a-${id}`,
  numero_carte: `CP-${id}`,
  statut: 'en_exploitation',
  date_delivrance: '2025-06-01',
  date_expiration: inDays(days),
    artisan: { id: `a-${id}`, type_personne: 'physique', nom: name, prenoms: '', type_artisan: 'collecteur', region: 'Centre' },
  }) as unknown as CarteRow;

const cards = [
  card('exp', -12, 'EXPIREE'),
  card('urgent', 3, 'URGENTE'),
  card('mois', 21, 'MENSUELLE'),
  card('deux', 47, 'BIMESTRIELLE'),
  card('loin', 200, 'LOINTAINE'),
];

describe('groupByHorizon', () => {
  it('classe chaque carte dans une seule fenêtre', () => {
    const buckets = groupByHorizon(cards, REFERENCE);

    expect(buckets.expirees.map((c) => c.id)).toEqual(['exp']);
    expect(buckets['7j'].map((c) => c.id)).toEqual(['urgent']);
    expect(buckets['30j'].map((c) => c.id)).toEqual(['mois']);
    expect(buckets['60j'].map((c) => c.id)).toEqual(['deux']);

    const total = Object.values(buckets).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(4); // la carte à 200 jours n'est dans aucune fenêtre
  });

  it('trie chaque fenêtre par échéance croissante', () => {
    const buckets = groupByHorizon([card('b', 25, 'B'), card('a', 10, 'A')], REFERENCE);
    expect(buckets['30j'].map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('calcule les jours restants, négatifs si dépassés', () => {
    expect(daysUntil(inDays(5), REFERENCE)).toBe(5);
    expect(daysUntil(inDays(-3), REFERENCE)).toBe(-3);
    expect(daysUntil(undefined, REFERENCE)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('CarteExpirations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(REFERENCE);
    mocks.getAllCartes.mockResolvedValue(cards);
  });

  it('affiche les quatre fenêtres et la liste de la fenêtre active', async () => {
    render(<CarteExpirations />);

    expect(screen.getByRole('heading', { name: 'Expirations des cartes professionnelles' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('URGENTE')).toBeInTheDocument());

    const stats = within(screen.getByRole('region', { name: 'Fenêtres d’expiration' }));
    expect(stats.getByText('Déjà expirées')).toBeInTheDocument();
    expect(stats.getByText('Sous 60 jours')).toBeInTheDocument();

    // Fenêtre « sous 7 jours » active par défaut : les autres cartes ne sont pas listées.
    expect(screen.queryByText('MENSUELLE')).not.toBeInTheDocument();
  });

  it('bascule de fenêtre via les puces', async () => {
    render(<CarteExpirations />);
    await waitFor(() => expect(screen.getByText('URGENTE')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Sous 30 jours/ }));

    expect(screen.getByText('MENSUELLE')).toBeInTheDocument();
    expect(screen.queryByText('URGENTE')).not.toBeInTheDocument();
  });

  it('signale une erreur de chargement', async () => {
    mocks.getAllCartes.mockRejectedValue(new Error('hors ligne'));
    render(<CarteExpirations />);

    await waitFor(() =>
      expect(mocks.showAlert).toHaveBeenCalledWith('Erreur lors du chargement des données', 'error')
    );
  });
});
