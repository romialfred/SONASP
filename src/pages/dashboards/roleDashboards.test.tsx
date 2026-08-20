import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FactoryDashboard } from './FactoryDashboard';
import { AirportDashboard } from './AirportDashboard';
import { RefineryDashboard } from './RefineryDashboard';
import { CustomerDashboard } from './CustomerDashboard';
import { ManagementDashboard } from './ManagementDashboard';
import {
  clefMois,
  cumulerDansSerie,
  douzeMois,
  entier,
  fcfa,
  lignes,
  oncesProduction,
  statutFr,
} from './roleDashboardData';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
  tables: [] as string[],
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
    AreaChart: Boite,
    Area: Vide,
    CartesianGrid: Vide,
    Tooltip: Vide,
    XAxis: Vide,
    YAxis: Vide,
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

/** Constructeur de requête minimal : renvoie la réponse configurée pour la table visée. */
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

describe('utilitaires des tableaux de bord métier', () => {
  it('convertit la production en onces', () => {
    expect(oncesProduction({ estimated_oz: 5 })).toBe(5);
    expect(oncesProduction({ pure_gold_grams: TROY_OZ_GRAMS })).toBeCloseTo(1, 6);
  });

  it('traduit les statuts techniques', () => {
    expect(statutFr('pending_approval')).toBe('À approuver');
    expect(statutFr('in_transit')).toBe('En transit');
    expect(statutFr('statut_inconnu')).toBe('statut_inconnu');
    expect(statutFr(null)).toBe('—');
  });

  it('construit et alimente une série de douze mois', () => {
    const serie = douzeMois(new Date('2026-08-15T00:00:00Z'));
    expect(serie).toHaveLength(12);
    expect(serie[11].periode).toBe('Août 2026');
    expect(clefMois('2026-08-03')).toBe('Août 2026');
    expect(clefMois('pas-une-date')).toBeNull();

    cumulerDansSerie(serie, '2026-08-03', 12);
    cumulerDansSerie(serie, '2019-01-01', 99);
    expect(serie[11].valeur).toBe(12);
    expect(serie.reduce((somme, point) => somme + point.valeur, 0)).toBe(12);
  });

  it('distingue une source vide d’une source indisponible', () => {
    expect(lignes({ status: 'fulfilled', value: { data: [], error: null } })).toEqual([]);
    expect(lignes({ status: 'fulfilled', value: { data: null, error: { message: 'x' } } })).toBeNull();
    expect(lignes({ status: 'rejected', reason: new Error('x') })).toBeNull();
  });

  it('formate les montants en FCFA', () => {
    expect(fcfa(2_840_000_000)).toBe('2,84 Mds FCFA');
    expect(fcfa(1_500_000)).toBe('1,5 M FCFA');
    expect(fcfa(4_000_000)).toBe('4 M FCFA'); // pas « 4,0 M FCFA »
    expect(fcfa(45_000)).toMatch(/^45.000 FCFA$/);
    expect(entier(1234.6)).toMatch(/^1.235$/);
  });
});

describe('tableaux de bord métier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tables = [];
    mocks.reponses = {};
    mocks.from.mockImplementation((table: string) => {
      mocks.tables.push(table);
      return stub(table);
    });
  });

  it('l’usine consolide production et préparations réelles', async () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    mocks.reponses = {
      daily_production: [{ id: 'p1', production_date: aujourdhui, estimated_oz: 40, pure_gold_grams: null, bullion_grams: 1000, status: 'completed' }],
      shipping_preparations: [
        { id: 's1', reference_number: 'PREP-001', expedition_number: 'EXP-1', shipment_date: aujourdhui, status: 'prepared', total_weight_oz: 32.5, total_boxes: 2 },
      ],
    };

    render(<FactoryDashboard />);
    await waitFor(() => expect(screen.getByText('PREP-001')).toBeInTheDocument());

    const indicateurs = within(screen.getByRole('region', { name: 'Indicateurs du poste' }));
    expect(indicateurs.getByText('Or produit ce mois')).toBeInTheDocument();
    expect(indicateurs.getByText('40,00 oz')).toBeInTheDocument();
    expect(screen.getByText('Préparé')).toBeInTheDocument();
    // Les anciens écrans affichaient des numéros de lots inventés (« BT-2024-012 »).
    expect(screen.queryByText(/BT-2024/)).not.toBeInTheDocument();
  });

  it('l’aéroport lit les expéditions de fret', async () => {
    mocks.reponses = {
      freight_shipments: [
        { id: 'f1', reference_number: 'FRT-2026-001', status: 'in_transit', shipment_date: '2026-08-01', number_of_boxes: 3, total_pure_gold_oz: 120, total_value_local: 1_000_000 },
      ],
    };

    render(<AirportDashboard />);
    await waitFor(() => expect(screen.getByText('FRT-2026-001')).toBeInTheDocument());

    expect(mocks.tables).toContain('freight_shipments');
    expect(screen.getByText('En transit')).toBeInTheDocument();
    const indicateurs = within(screen.getByRole('region', { name: 'Indicateurs du poste' }));
    expect(indicateurs.getByText('120,00 oz')).toBeInTheDocument();
  });

  it('la raffinerie calcule le titre réellement constaté', async () => {
    mocks.reponses = {
      freight_shipments: [
        { id: 'f1', reference_number: 'FRT-1', status: 'received', shipment_date: '2026-08-01', total_bullion_grams: 1000, total_pure_gold_grams: 940, total_pure_gold_oz: 30 },
      ],
      gold_inventory: [{ quantity_available_oz: 25 }],
    };

    render(<RefineryDashboard />);
    await waitFor(() => expect(screen.getByText('FRT-1')).toBeInTheDocument());

    // Le rendement était annoncé « 95,2 % » en dur, sans calcul.
    const indicateurs = within(screen.getByRole('region', { name: 'Indicateurs du poste' }));
    expect(indicateurs.getByText('Teneur moyenne constatée')).toBeInTheDocument();
    expect(indicateurs.getByText('94,00 %')).toBeInTheDocument();
    expect(indicateurs.getByText('25,00 oz')).toBeInTheDocument();
  });

  it('le client voit ses commandes en FCFA', async () => {
    mocks.reponses = {
      sales: [
        { id: 'v1', sale_number: 'VTE-2026-001', sale_date: '2026-08-02', status: 'pending', quantity_oz: 10, total_amount: 1_500_000, gross_proceeds: null, customers: { name: 'Comptoir Central' } },
      ],
    };

    render(<CustomerDashboard />);
    await waitFor(() => expect(screen.getByText('VTE-2026-001')).toBeInTheDocument());

    // Les montants étaient libellés en dollars sur une plateforme burkinabè.
    expect(screen.getByText('Comptoir Central')).toBeInTheDocument();
    expect(screen.getAllByText('1,5 M FCFA').length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('la direction agrège ventes, production, clients et stock', async () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    mocks.reponses = {
      sales: [
        { id: 'v1', sale_number: 'VTE-1', sale_date: aujourdhui, status: 'pending', quantity_oz: 10, total_amount: 4_000_000, gross_proceeds: null, customers: { name: 'Client A' } },
      ],
      daily_production: [{ production_date: aujourdhui, estimated_oz: 55, pure_gold_grams: null }],
      customers: [{ id: 'c1', is_active: true }, { id: 'c2', is_active: false }],
      gold_inventory: [{ quantity_available_oz: 12 }],
    };

    render(<ManagementDashboard />);
    await waitFor(() => expect(screen.getByText('VTE-1')).toBeInTheDocument());

    const indicateurs = within(screen.getByRole('region', { name: 'Indicateurs du poste' }));
    expect(indicateurs.getByText('4 M FCFA')).toBeInTheDocument();
    expect(indicateurs.getByText('55,00 oz')).toBeInTheDocument();
    expect(indicateurs.getByText('Clients actifs')).toBeInTheDocument();
    expect(indicateurs.getByText('2 client(s) enregistré(s)')).toBeInTheDocument();
    // Les sites « Siguiri (Guinée) » et « Bamako (Mali) » ne concernent pas la SONASP.
    expect(screen.queryByText(/Siguiri|Bamako|Abidjan/)).not.toBeInTheDocument();
  });

  it('annonce une source indisponible au lieu de la combler', async () => {
    mocks.reponses = { daily_production: null, shipping_preparations: [] };

    render(<FactoryDashboard />);
    await waitFor(() => expect(screen.getByText(/la production journalière/)).toBeInTheDocument());

    expect(screen.getByText('Aucune préparation d’expédition')).toBeInTheDocument();
  });
});
