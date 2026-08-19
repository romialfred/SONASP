import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductionDashboardModern, libelleSelection } from './ProductionDashboardModern';
import {
  EMPTY_PRODUCTION_DASHBOARD,
  agregerParMois,
  clefAnneeMois,
  squeletteMois,
  titreMoyenSerie,
  totalOnces,
} from './productionDashboardData';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('recharts', () => {
  const Boite = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Vide = () => null;
  return {
    ResponsiveContainer: Boite,
    ComposedChart: Boite,
    Area: Vide,
    Line: Vide,
    CartesianGrid: Vide,
    Legend: Vide,
    Tooltip: Vide,
    XAxis: Vide,
    YAxis: Vide,
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const resultat = rows === null ? { data: null, error: { message: 'offline' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  ['select', 'eq', 'gte', 'lte', 'gt', 'order', 'limit', 'in'].forEach((methode) => {
    builder[methode] = vi.fn(() => builder);
  });
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const reference = new Date('2026-08-15T00:00:00Z');

describe('agrégation de la production', () => {
  it('construit douze mois du plus ancien au plus récent', () => {
    const serie = squeletteMois(reference);
    expect(serie).toHaveLength(12);
    expect(serie[11].mois).toMatch(/août 2026/i);
    expect(clefAnneeMois('2026-08-03')).toBe('2026-08');
    expect(clefAnneeMois('pas-une-date')).toBeNull();
  });

  it('pondère le titre moyen par le nombre de déclarations', () => {
    const serie = agregerParMois(
      [
        { id: '1', production_date: '2026-08-03', bullion_grams: 1000, pure_gold_grams: 900, estimated_oz: 30, estimated_fineness_pct: 90, mining_company_id: 'c1' },
        { id: '2', production_date: '2026-08-10', bullion_grams: 1000, pure_gold_grams: 950, estimated_oz: 30, estimated_fineness_pct: 96, mining_company_id: 'c1' },
      ],
      reference
    );

    const aout = serie[11];
    expect(aout.onces).toBe(60);
    expect(aout.declarations).toBe(2);
    expect(aout.titreMoyen).toBe(93);
    // Un mois sans déclaration n'a pas de titre : il tirait auparavant la moyenne vers zéro.
    expect(serie[0].titreMoyen).toBeNull();
    expect(titreMoyenSerie(serie)).toBe(93);
    expect(titreMoyenSerie(squeletteMois(reference))).toBeNull();
    expect(totalOnces(serie)).toBe(60);
  });

  it('nomme la sélection sans référence à une organisation tierce', () => {
    const data = { ...EMPTY_PRODUCTION_DASHBOARD, compagnies: [{ id: 'c1', name: 'Essakane SA', abbreviation: 'ESK' }] };
    // Le consolidé s'intitulait « Groupe Mansa Resources ».
    expect(libelleSelection(data, 'all')).toBe('Toutes les compagnies');
    expect(libelleSelection(data, 'c1')).toBe('Essakane SA');
    expect(libelleSelection(data, 'inconnu')).toBe('Compagnie inconnue');
  });
});

describe('ProductionDashboardModern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const aujourdhui = new Date().toISOString().slice(0, 10);
    mocks.reponses = {
      mining_companies: [
        { id: 'c1', name: 'Essakane SA', abbreviation: 'ESK' },
        { id: 'c2', name: 'Bissa Gold', abbreviation: 'BSG' },
      ],
      daily_production: [
        { id: 'p1', production_date: aujourdhui, bullion_grams: 1000, pure_gold_grams: 940, estimated_oz: 30, estimated_fineness_pct: 94, mining_company_id: 'c1' },
        { id: 'p2', production_date: aujourdhui, bullion_grams: 500, pure_gold_grams: 450, estimated_oz: 15, estimated_fineness_pct: 90, mining_company_id: 'c2' },
      ],
      shipping_preparations: [
        { id: 's1', status: 'prepared', total_weight_oz: 20 },
        { id: 's2', status: 'in_transit', total_weight_oz: 15 },
        { id: 's3', status: 'prepared', total_weight_oz: 10 },
      ],
    };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('présente production, expéditions et compagnies réelles', async () => {
    render(<ProductionDashboardModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    const indicateurs = within(screen.getByRole('region', { name: 'Indicateurs de production' }));
    expect(indicateurs.getByText('45,00 oz')).toBeInTheDocument();
    expect(indicateurs.getByText('Expéditions actives')).toBeInTheDocument();
    expect(indicateurs.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Préparé')).toBeInTheDocument();
    expect(screen.getByText('(67 %)')).toBeInTheDocument();
    expect(screen.getByText('En transit')).toBeInTheDocument();
  });

  it('filtre le graphique sur la compagnie sélectionnée', async () => {
    render(<ProductionDashboardModern />);
    await waitFor(() => expect(screen.getByText(/Toutes les compagnies/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Compagnie'), { target: { value: 'c2' } });

    expect(screen.getByText('Production mensuelle — Bissa Gold')).toBeInTheDocument();
  });

  it('n’affiche pas de titre moyen sans déclaration', async () => {
    mocks.reponses.daily_production = [];
    render(<ProductionDashboardModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    expect(screen.getByText('Aucune production déclarée')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('Aucun titre déclaré')).toBeInTheDocument();
  });

  it('annonce une source indisponible', async () => {
    mocks.reponses.mining_companies = null;
    render(<ProductionDashboardModern />);

    await waitFor(() => expect(screen.getByText(/les compagnies minières/)).toBeInTheDocument());
    expect(screen.getByText('Aucune compagnie minière enregistrée')).toBeInTheDocument();
  });
});
