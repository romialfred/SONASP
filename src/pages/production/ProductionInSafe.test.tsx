import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductionInSafe, grammes, onces } from './ProductionInSafe';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reponses: {} as Record<string, { data: unknown; error: unknown }>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/production/ProductionStatusBadge', () => ({
  ProductionStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

/**
 * Chaque table répond par son entrée dans `mocks.reponses`. Le constructeur de
 * requête est un objet chaînable qui se résout comme une promesse, à l'image du
 * client Supabase.
 */
vi.mock('@/lib/supabase', () => {
  const construire = (table: string) => {
    const resultat = () => mocks.reponses[table] || { data: [], error: null };
    const chaine: Record<string, unknown> = {
      then: (resoudre: (valeur: unknown) => unknown) => Promise.resolve(resultat()).then(resoudre),
    };
    ['select', 'eq', 'neq', 'not', 'gte', 'lte', 'order'].forEach((methode) => {
      chaine[methode] = () => chaine;
    });
    return chaine;
  };
  return { supabase: { from: (table: string) => construire(table) } };
});

const AUJOURDHUI = new Date(2026, 7, 20); // jeudi 20 août 2026

const production = (partiel: Partial<Record<string, unknown>> & { id: string }) => ({
  production_date: '2026-08-18',
  mining_company_id: 'm1',
  bullion_grams: 12_000,
  pure_gold_grams: 10_500,
  estimated_oz: 337.58,
  estimated_fineness_pct: 87.5,
  bar_reference: 'BAR-001',
  status: 'prepared',
  ...partiel,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(AUJOURDHUI);
  mocks.reponses = {
    mining_companies: { data: [{ id: 'm1', name: 'Wahgnion Gold Mine' }], error: null },
    daily_production: { data: [production({ id: 'p1' })], error: null },
    monthly_budgets: { data: [], error: null },
    quarterly_forecasts: { data: [], error: null },
    freight_shipment_productions: { data: [], error: null },
  };
});

describe('formats', () => {
  it('affiche « — » plutôt qu’un zéro trompeur quand la valeur manque', () => {
    expect(onces(null)).toBe('—');
    expect(grammes(undefined)).toBe('—');
  });

  it('formate à la française', () => {
    expect(onces(1234.5)).toMatch(/1\s?234,50 oz/);
    expect(grammes(1234.5)).toMatch(/1\s?235 g/);
  });
});

describe('ProductionInSafe', () => {
  it('affiche les barres au coffre', async () => {
    render(<ProductionInSafe />);
    expect(await screen.findByText('BAR-001')).toBeInTheDocument();
    expect(screen.getAllByText('Wahgnion Gold Mine').length).toBeGreaterThan(0);
  });

  it('écarte du coffre une barre partie avec son expédition', async () => {
    // Une barre rattachée à une expédition déjà partie n'est plus détenue :
    // l'écran la retire du cumul plutôt que de compter de l'or qu'il n'a plus.
    mocks.reponses.daily_production = {
      data: [production({ id: 'p1' }), production({ id: 'p2', bar_reference: 'BAR-002' })],
      error: null,
    };
    mocks.reponses.freight_shipment_productions = {
      data: [{ production_id: 'p2', expedition: { shipped_at: '2026-08-19T10:00:00Z' } }],
      error: null,
    };

    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');

    expect(screen.queryByText('BAR-002')).not.toBeInTheDocument();
    expect(screen.getByText(/1 barre expédiée, écartée du coffre/)).toBeInTheDocument();
  });

  it('garde au coffre une barre dont l’expédition n’est pas partie', async () => {
    mocks.reponses.daily_production = {
      data: [production({ id: 'p1' }), production({ id: 'p2', bar_reference: 'BAR-002' })],
      error: null,
    };
    mocks.reponses.freight_shipment_productions = {
      data: [{ production_id: 'p2', expedition: { shipped_at: null } }],
      error: null,
    };

    render(<ProductionInSafe />);
    expect(await screen.findByText('BAR-002')).toBeInTheDocument();
  });

  it('avertit quand les expéditions sont illisibles plutôt que de surestimer', async () => {
    mocks.reponses.freight_shipment_productions = { data: null, error: { message: 'table absente' } };
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');
    expect(screen.getByText(/cumuls sont probablement surestimés/)).toBeInTheDocument();
  });

  it('replie la définition derrière une icône plutôt que de la déployer', async () => {
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');

    const declencheur = screen.getByRole('button', { name: 'Ce que contient le coffre' });
    expect(declencheur).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(declencheur);
    expect(declencheur).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/en sort au départ de son expédition/);
  });

  it('ne répète plus les filtres actifs sous le titre', async () => {
    // Les filtres vivent dans le panneau latéral ; les pastilles faisaient
    // doublon avec le compte porté par le bouton.
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');
    expect(document.querySelector('.production-page__resume')).toBeNull();
  });

  it('nomme la source manquante au lieu d’afficher un objectif inventé', async () => {
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');
    // Sans ligne de budget, l'écran doit dire que le budget n'est pas voté.
    // Le message reste court : nommer chaque mois manquant tenait de la copie
    // d'écran de formation, pas d'un outil de pilotage.
    expect(screen.getAllByText('Budget non voté').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prévision non saisie').length).toBeGreaterThan(0);
  });

  it('compare le réalisé au budget voté quand il existe', async () => {
    mocks.reponses.monthly_budgets = {
      data: [
        { month: 8, daily_budget_oz: 100, mining_company_id: 'm1', annual_budget: { year: 2026 } },
        { month: 7, daily_budget_oz: 100, mining_company_id: 'm1', annual_budget: { year: 2026 } },
        ...Array.from({ length: 6 }, (_, index) => ({
          month: index + 1,
          daily_budget_oz: 100,
          mining_company_id: 'm1',
          annual_budget: { year: 2026 },
        })),
      ],
      error: null,
    };
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');

    // Semaine du lundi 17 au jeudi 20 : 4 jours à 100 oz.
    const semaine = screen.getByText('Semaine en cours').closest('article') as HTMLElement;
    expect(within(semaine).getByText(/400,00 oz/)).toBeInTheDocument();
    // 337,58 réalisées contre 400 attendues : le manque doit se voir.
    expect(within(semaine).getByText(/-62,42 oz/)).toBeInTheDocument();
  });

  it('signale une source illisible sans vider la page', async () => {
    mocks.reponses.monthly_budgets = { data: null, error: { message: 'table absente' } };
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');
    expect(screen.getAllByText('Source illisible').length).toBe(3);
  });

  it('remonte l’erreur quand les déclarations ne se chargent pas', async () => {
    mocks.reponses.daily_production = { data: null, error: { message: 'réseau indisponible' } };
    render(<ProductionInSafe />);
    expect(await screen.findByText(/Impossible de charger|réseau indisponible/)).toBeInTheDocument();
  });

  it('ouvre la fiche de la déclaration au clic', async () => {
    render(<ProductionInSafe />);
    fireEvent.click(await screen.findByText('BAR-001'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/production/p1'));
  });

  it('ouvre et referme le volet de filtres', async () => {
    render(<ProductionInSafe />);
    await screen.findByText('BAR-001');

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    expect(screen.getByRole('dialog', { name: /Filtres du coffre/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fermer les filtres/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
