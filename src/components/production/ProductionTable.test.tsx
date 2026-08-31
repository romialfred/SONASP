import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductionTable } from './ProductionTable';
import type { DailyProduction } from '@/services/dailyProductionService';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

/**
 * `pure_gold_grams` et `estimated_oz` sont calculés après la saisie du lingot :
 * la table les déclare nullables et des enregistrements réels portent `null`.
 * Une seule ligne dans ce cas suffisait à faire tomber l'écran entier.
 */
function production(surcharge: Partial<DailyProduction> = {}): DailyProduction {
  return {
    id: 'p1',
    production_date: '2026-08-20',
    bullion_grams: 1000,
    estimated_fineness_pct: 90,
    estimated_gold_pct: 90,
    estimated_silver_pct: 5,
    silver_content_grams: 50,
    pure_gold_grams: 900,
    estimated_oz: 28.9,
    bar_reference: 'BR-001',
    notes: null,
    site_id: 'national',
    mining_company_id: null,
    status: 'prepared',
    created_by: 'u1',
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    ...surcharge,
  };
}

describe('ProductionTable', () => {
  it('affiche une production dont l’or pur et les onces ne sont pas calculés', () => {
    render(
      <ProductionTable
        productions={[production({ pure_gold_grams: null, estimated_oz: null })]}
        loading={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // La ligne s'affiche au lieu de faire tomber l'écran, et rien n'est inventé.
    expect(screen.getByText('BR-001')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });

  it('totalise sans compter les valeurs absentes', () => {
    render(
      <ProductionTable
        productions={[
          production({ id: 'p1', bar_reference: 'BR-001' }),
          production({ id: 'p2', bar_reference: 'BR-002', pure_gold_grams: null, estimated_oz: null }),
        ]}
        loading={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const pied = screen.getByText(/barres ·/);
    expect(pied).toHaveTextContent('2 barres');
    expect(pied).toHaveTextContent('28.90 oz total');
  });

  it('formate normalement une production complète', () => {
    render(
      <ProductionTable
        productions={[production()]}
        loading={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const ligne = screen.getByText('BR-001').closest('tr') as HTMLElement;
    expect(within(ligne).getByText('900,00')).toBeInTheDocument();
    expect(within(ligne).getByText('28,9000')).toBeInTheDocument();
  });

  it('n’expose aucune mutation lorsque les callbacks ne sont pas autorisés', () => {
    render(
      <ProductionTable
        productions={[production()]}
        loading={false}
      />,
    );

    expect(screen.getByTitle('Voir détails')).toBeInTheDocument();
    expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
  });
});
