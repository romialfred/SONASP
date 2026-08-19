import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GlobalDashboardEnhanced,
  formatBorne,
  formatTendance,
  periodeParDefaut,
} from './GlobalDashboardEnhanced';
import {
  EMPTY_DASHBOARD,
  buildTransactions,
  originShares,
  previousWindow,
  productionOunces,
  variation,
  type NationalDashboardData,
  type RawSale,
} from './nationalDashboardData';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  load: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('recharts', () => {
  const Boite = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Vide = () => null;
  return {
    ResponsiveContainer: Boite,
    AreaChart: Boite,
    PieChart: Boite,
    Pie: Boite,
    Area: Vide,
    Cell: Vide,
    CartesianGrid: Vide,
    Tooltip: Vide,
    XAxis: Vide,
    YAxis: Vide,
  };
});

vi.mock('./nationalDashboardData', async () => {
  const reel = await vi.importActual<typeof import('./nationalDashboardData')>('./nationalDashboardData');
  return { ...reel, loadNationalDashboard: mocks.load };
});

const donnees: NationalDashboardData = {
  ...EMPTY_DASHBOARD,
  collectedGold: 1244.23,
  salesValue: 2_840_000_000,
  availableStock: 386.4,
  royalties: 85_200_000,
  transactionsCount: 248,
  pendingCount: 12,
  monthlyMetrics: [{ month: 'Jan 2026', volume: 120, value: 240 }],
  transactions: [
    { reference: 'VTE-2026-0842', actor: 'Comptoir A', type: 'Vente locale', quantity: 52.4, amount: 128_600_000, status: 'validated', date: '17/08/2026 09:15' },
    { reference: 'COL-2026-0315', actor: 'Artisan B', type: 'Collecte', quantity: 9.2, amount: 22_500_000, status: 'pending', date: '15/08/2026 08:21' },
  ],
  origins: [
    { name: 'Mines industrielles', value: 70, ounces: 700, color: '#dda000' },
    { name: 'Artisans miniers', value: 30, ounces: 300, color: '#3975d6' },
  ],
  collectedGoldTrend: 8.4,
  salesValueTrend: -3.2,
  stockShare: 31,
  royaltyRate: 3,
  expiringCards: 4,
};

describe('calculs du tableau de bord national', () => {
  it('convertit la production en onces troy', () => {
    expect(productionOunces({ estimated_oz: 12 })).toBe(12);
    expect(productionOunces({ pure_gold_grams: TROY_OZ_GRAMS })).toBeCloseTo(1, 6);
    expect(productionOunces({})).toBe(0);
  });

  it('ne présente pas de variation sans référence', () => {
    expect(variation(100, 0)).toBeNull();
    expect(variation(110, 100)).toBeCloseTo(10, 6);
    expect(formatTendance(null)).toBeNull();
    expect(formatTendance(8.42)).toBe('+8,4 %');
    expect(formatTendance(-3.2)).toBe('−3,2 %');
  });

  it('calcule la fenêtre précédente de même durée', () => {
    expect(previousWindow('2026-02-01', '2026-02-28')).toEqual({ debut: '2026-01-04', fin: '2026-01-31' });
  });

  it('déduit la répartition par origine des ventes réelles', () => {
    const ventes: RawSale[] = [
      { seller_type: 'mining_company', quantity_oz: 700 },
      { seller_type: 'artisan', quantity_oz: 200 },
      { seller_type: 'stakeholder', quantity_oz: 100 },
    ];
    // La répartition était figée à 62 / 24 / 14 % sans aucun lien avec les données.
    expect(originShares(ventes)).toEqual([
      { name: 'Mines industrielles', color: '#dda000', ounces: 700, value: 70 },
      { name: 'Comptoirs', color: '#10976b', ounces: 100, value: 10 },
      { name: 'Artisans miniers', color: '#3975d6', ounces: 200, value: 20 },
    ]);
    expect(originShares([])).toEqual([]);
  });

  it('construit les transactions à partir des ventes', () => {
    const lignes = buildTransactions([
      { sale_number: 'VTE-1', seller_type: 'artisan', quantity_oz: 3, total_amount: 100, status: 'draft', sale_date: '2026-03-02' },
    ]);
    expect(lignes[0]).toMatchObject({ reference: 'VTE-1', type: 'Collecte', status: 'pending' });
  });

  it('borne la période par défaut sur l’exercice en cours', () => {
    expect(periodeParDefaut(new Date('2026-08-18T10:00:00Z'))).toEqual({ debut: '2026-01-01', fin: '2026-08-18' });
    expect(formatBorne('2026-01-01')).toMatch(/janv/);
    expect(formatBorne('pas-une-date')).toBe('—');
  });
});

describe('GlobalDashboardEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue(donnees);
  });

  it('affiche les indicateurs issus des données chargées', async () => {
    render(<GlobalDashboardEnhanced />);
    // Attendre le rendu des valeurs, et non le seul appel au chargeur : l'assertion
    // synchrone pouvait s'exécuter avant que l'état chargé ne soit appliqué.
    await screen.findByText('+8,4 %');

    expect(screen.getByRole('heading', { name: 'Tableau de bord national' })).toBeInTheDocument();
    const indicateurs = within(screen.getByRole('region', { name: 'Indicateurs nationaux' }));
    expect(indicateurs.getByText(/1[  ]?244,23 oz/)).toBeInTheDocument();
    expect(indicateurs.getByText(/2,84 Mds FCFA/)).toBeInTheDocument();
    expect(indicateurs.getByText('+8,4 %')).toBeInTheDocument();
    expect(indicateurs.getByText('−3,2 %')).toBeInTheDocument();
    // Le taux de redevance affiché est celui constaté, non un « 3 % » annoncé en dur.
    expect(indicateurs.getByText('Taux constaté 3 %')).toBeInTheDocument();
  });

  it('interroge la période effectivement retenue', async () => {
    const { debut, fin } = periodeParDefaut();
    render(<GlobalDashboardEnhanced />);

    // Les bornes étaient figées à 2026-01-01 / 2026-08-17 dans le code.
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith(debut, fin));
    expect(screen.getByRole('button', { name: new RegExp(formatBorne(debut)) })).toBeInTheDocument();
  });

  it('n’affiche aucune donnée inventée quand tout est vide', async () => {
    mocks.load.mockResolvedValue(EMPTY_DASHBOARD);
    render(<GlobalDashboardEnhanced />);

    await waitFor(() => expect(screen.getByText('Aucune transaction à afficher.')).toBeInTheDocument());
    // L'ancien écran servait un jeu de démonstration codé en dur comme s'il s'agissait
    // de statistiques nationales réelles.
    expect(screen.queryByText('Burkina Gold Refinery')).not.toBeInTheDocument();
    expect(screen.getByText(/la répartition par origine ne peut pas être établie/)).toBeInTheDocument();
    expect(screen.getByText('Aucun point d’attention sur la période.')).toBeInTheDocument();
    // Or collecté et valeur des ventes : deux cartes sans référence exploitable.
    expect(screen.getAllByText('Pas de référence sur la période précédente')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Exporter/ })).toBeDisabled();
  });

  it('annonce les sources indisponibles au lieu de les masquer', async () => {
    mocks.load.mockResolvedValue({ ...EMPTY_DASHBOARD, unavailable: ['les ventes', 'le stock'] });
    render(<GlobalDashboardEnhanced />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/les ventes, le stock/));
    expect(screen.getByText('Sources de données incomplètes')).toBeInTheDocument();
  });

  it('bascule le graphique et filtre les transactions à valider', async () => {
    render(<GlobalDashboardEnhanced />);
    await waitFor(() => expect(screen.getByText('VTE-2026-0842')).toBeInTheDocument());

    const valeur = screen.getByRole('button', { name: 'Valeur' });
    fireEvent.click(valeur);
    expect(valeur).toHaveClass('is-active');

    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Transactions à valider uniquement' }));

    expect(screen.queryByText('VTE-2026-0842')).not.toBeInTheDocument();
    expect(screen.getByText('COL-2026-0315')).toBeInTheDocument();
  });

  it('ne relance pas le chargement sur une période inversée', async () => {
    render(<GlobalDashboardEnhanced />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /–/ }));
    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2030-01-01' } });

    expect(screen.getByText('La date de début est postérieure à la date de fin.')).toBeInTheDocument();
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
});
