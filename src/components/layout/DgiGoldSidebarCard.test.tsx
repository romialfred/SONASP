import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DgiGoldSidebarCard } from './DgiGoldSidebarCard';

const hook = vi.hoisted(() => vi.fn());
const history = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useCoursOr', () => ({ useCoursOr: hook }));
vi.mock('@/services/liveGoldPriceService', async () => {
  const actual = await vi.importActual<typeof import('@/services/liveGoldPriceService')>('@/services/liveGoldPriceService');
  return { ...actual, fetchGoldPriceHistory: history };
});

describe('cours de l’or du portail DGI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    history.mockResolvedValue([
      { date: '2026-09-03', price: 2800 },
      { date: '2026-09-04', price: 2848.87 },
    ]);
  });

  it('affiche la source, la fraîcheur et les conversions du référentiel', async () => {
    hook.mockReturnValue({
      cours: { price: 2848.87, timestamp: Date.now(), source: 'Référentiel SONASP · LBMA', currency: 'USD', changePercent24h: 0.42 },
      tauxUsdXof: 598.42,
      prixGrammeFcfa: 54_807,
      chargement: false,
      erreur: null,
      actualiser: vi.fn(),
    });
    render(<DgiGoldSidebarCard />);
    expect(screen.getByText('FCFA/oz').closest('strong')).toHaveTextContent(/1.704.821/);
    expect(screen.getByText('54 807 FCFA/g')).toBeInTheDocument();
    expect(screen.getByText('Mise à jour récente')).toBeInTheDocument();
    expect(screen.getByText('Référentiel SONASP · LBMA')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Évolution récente/ })).toBeInTheDocument();
  });

  it('ne fabrique aucune conversion en l’absence du taux de change', () => {
    hook.mockReturnValue({
      cours: { price: 2848.87, timestamp: Date.now(), source: 'Référentiel SONASP', currency: 'USD' },
      tauxUsdXof: null,
      prixGrammeFcfa: null,
      chargement: false,
      erreur: null,
      actualiser: vi.fn(),
    });
    render(<DgiGoldSidebarCard />);
    expect(screen.getByText('Conversion au gramme indisponible')).toBeInTheDocument();
    expect(screen.getByText('Taux USD/XOF indisponible.')).toBeInTheDocument();
  });

  it('rend l’indisponibilité et une action de reprise', () => {
    hook.mockReturnValue({ cours: null, tauxUsdXof: null, prixGrammeFcfa: null, chargement: false, erreur: 'Source indisponible.', actualiser: vi.fn() });
    render(<DgiGoldSidebarCard />);
    expect(screen.getByText('Source indisponible.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
  });
});
