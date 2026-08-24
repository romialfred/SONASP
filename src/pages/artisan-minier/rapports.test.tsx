import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CentreRapportsAnalyse, { anneeDeLaPeriode } from './CentreRapportsAnalyse';
import RapportChiffreAffaires, { axeTemporel, totaliser } from './RapportChiffreAffaires';
import RapportQuantites, { libelleType, totauxQuantites } from './RapportQuantites';
import RapportTaxesRoyalties, { totauxTaxes } from './RapportTaxesRoyalties';
import {
  defaultPeriode,
  formatTaux,
  tauxEffectif,
  telechargerRapport,
  validatePeriode,
} from './rapportsShared';
import type { QuantiteParType, RapportTaxesRoyalties as LigneTaxes } from '@/services/artisanAnalyticsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getIndicateurs: vi.fn(),
  getParRegion: vi.fn(),
  getParArtisan: vi.fn(),
  getParType: vi.fn(),
  getParMois: vi.fn(),
  getParTrimestre: vi.fn(),
  getParAnnee: vi.fn(),
  getTaxes: vi.fn(),
  exporter: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Ces tests valident les rapports nationaux. Le composant consulte désormais
// le profil courant pour adapter le fil d'Ariane du portail Collecteur ; fournir
// explicitement un utilisateur national évite de masquer ce contrat derrière
// un AuthProvider complet sans rapport avec les calculs testés ici.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Recharts ne se mesure pas dans jsdom : les graphiques sont neutralisés.
vi.mock('@/lib/recharts', () => {
  const Boite = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Vide = () => null;
  return {
    ResponsiveContainer: Boite,
    BarChart: Boite,
    LineChart: Boite,
    AreaChart: Boite,
    PieChart: Boite,
    Pie: Boite,
    Bar: Vide,
    Line: Vide,
    Area: Vide,
    Cell: Vide,
    CartesianGrid: Vide,
    Legend: Vide,
    Tooltip: Vide,
    XAxis: Vide,
    YAxis: Vide,
  };
});

vi.mock('@/services/artisanAnalyticsService', () => ({
  artisanAnalyticsService: {
    getIndicateursCles: mocks.getIndicateurs,
    getChiffreAffairesParRegion: mocks.getParRegion,
    getChiffreAffairesParArtisan: mocks.getParArtisan,
    getQuantiteParType: mocks.getParType,
    getChiffreAffairesParMois: mocks.getParMois,
    getChiffreAffairesParTrimestre: mocks.getParTrimestre,
    getChiffreAffairesParAnnee: mocks.getParAnnee,
    getRapportTaxesRoyalties: mocks.getTaxes,
    exporterRapportExcel: mocks.exporter,
  },
}));

const indicateurs = {
  total_ventes: 12,
  total_artisans_actifs: 5,
  quantite_totale_grammes: 3110.34768,
  quantite_totale_onces: 100,
  chiffre_affaires_total: 120_000_000,
  taxes_total: 23_400_000,
  royalties_total: 1_200_000,
  prix_moyen_gramme: 38_580,
  ventes_en_attente: 3,
  montant_en_attente: 9_000_000,
};

const regions = [
  {
    region: 'Centre',
    nombre_ventes: 8,
    nombre_artisans: 4,
    quantite_totale_grammes: 2000,
    quantite_totale_onces: 64,
    montant_total_brut: 80_000_000,
    montant_total_taxes: 15_000_000,
    montant_total_net: 65_000_000,
  },
  {
    region: 'Nord',
    nombre_ventes: 4,
    nombre_artisans: 2,
    quantite_totale_grammes: 1110,
    quantite_totale_onces: 36,
    montant_total_brut: 40_000_000,
    montant_total_taxes: 8_400_000,
    montant_total_net: 31_600_000,
  },
];

const types: QuantiteParType[] = [
  {
    type_or: 'lingot',
    nombre_ventes: 8,
    quantite_totale_grammes: 2000,
    quantite_totale_onces: 64,
    montant_total: 80_000_000,
    prix_moyen_gramme: 40_000,
    pourcentage_total: 64.3,
  },
  {
    type_or: 'poudre',
    nombre_ventes: 4,
    quantite_totale_grammes: 1110,
    quantite_totale_onces: 36,
    montant_total: 40_000_000,
    prix_moyen_gramme: 36_036,
    pourcentage_total: 35.7,
  },
];

const taxes: LigneTaxes[] = [
  {
    periode: '2026-03',
    montant_total_ventes: 100_000_000,
    montant_total_tva: 18_000_000,
    montant_total_retenue_source: 1_500_000,
    montant_total_autres_taxes: 0,
    montant_total_taxes: 19_500_000,
    montant_total_royalties: 1_000_000,
    taux_tva_moyen: 18,
    taux_retenue_moyen: 1.5,
    nombre_factures: 6,
  },
];

describe('rapportsShared', () => {
  it('refuse une période incohérente', () => {
    expect(validatePeriode('2026-05-01', '2026-04-01')).toBe('La date de début est postérieure à la date de fin.');
    expect(validatePeriode('', '2026-04-01')).toBe('Renseignez les deux bornes de la période.');
    expect(validatePeriode('2026-01-01', '2026-12-31')).toBeNull();
  });

  it('ne produit jamais « NaN% »', () => {
    expect(tauxEffectif(18, 0)).toBeNull();
    expect(formatTaux(tauxEffectif(18, 0))).toBe('—');
    expect(formatTaux(tauxEffectif(18_000_000, 100_000_000))).toBe('18.00 %');
  });

  it('borne la période par défaut sur l’exercice en cours', () => {
    const periode = defaultPeriode(new Date('2026-08-18T10:00:00Z'));
    expect(periode.debut).toBe('2026-01-01');
    expect(periode.fin).toBe('2026-08-18');
  });

  it('signale les échecs d’export au lieu de les taire', async () => {
    expect(await telechargerRapport('T', 'f.xlsx', [])).toBe('Aucune donnée à exporter sur cette période.');
    mocks.exporter.mockRejectedValueOnce(new Error('xlsx indisponible'));
    expect(await telechargerRapport('T', 'f.xlsx', [{ a: 1 }])).toBe('xlsx indisponible');
  });

  it('déduit l’année analysée de la période', () => {
    expect(anneeDeLaPeriode('2024-01-01', '2024-12-31')).toBe(2024);
    expect(anneeDeLaPeriode('', '')).toBe(new Date().getFullYear());
  });

  it('cumule les colonnes des rapports', () => {
    expect(totaliser(regions, (l) => l.nombre_ventes)).toBe(12);
    expect(totauxQuantites(types).quantite_totale_grammes).toBe(3110);
    expect(totauxTaxes(taxes).montant_total_tva).toBe(18_000_000);
    expect(totauxTaxes([])).toMatchObject({ nombre_factures: 0, montant_total_ventes: 0 });
    expect(libelleType('pepites')).toBe('Pépites');
    expect(axeTemporel('region')).toBe(false);
    expect(axeTemporel('trimestriel')).toBe(true);
  });
});

describe('CentreRapportsAnalyse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIndicateurs.mockResolvedValue(indicateurs);
    mocks.getParRegion.mockResolvedValue(regions);
    mocks.getParType.mockResolvedValue(types);
    mocks.getParMois.mockResolvedValue([]);
  });

  it('consolide les indicateurs de la période', async () => {
    render(<CentreRapportsAnalyse />);
    // Attendre le rendu des valeurs, et non le seul appel au service : l'assertion
    // synchrone pouvait s'exécuter avant que l'état chargé ne soit appliqué.
    await screen.findByText('120 000 000 FCFA');

    const stats = within(screen.getByRole('region', { name: 'Indicateurs de la période' }));
    expect(stats.getByText('120 000 000 FCFA')).toBeInTheDocument();
    expect(stats.getByText('100.00 onces troy')).toBeInTheDocument();
    // La royaltie porte désormais son vrai nom au lieu d'un « 3 % » inventé.
    expect(stats.getByText('Taxe de développement communal')).toBeInTheDocument();
    expect(stats.getByText('1 200 000 FCFA')).toBeInTheDocument();
  });

  it('reste exploitable quand une source échoue', async () => {
    mocks.getParRegion.mockRejectedValue(new Error('hors ligne'));

    render(<CentreRapportsAnalyse />);
    await waitFor(() =>
      expect(screen.getByText(/la répartition régionale/)).toBeInTheDocument()
    );
    // Les autres blocs restent servis : l'ancien Promise.all vidait tout l'écran.
    expect(screen.getByText('120 000 000 FCFA')).toBeInTheDocument();
  });

  it('refuse une période inversée sans lancer de requête', async () => {
    render(<CentreRapportsAnalyse />);
    await waitFor(() => expect(mocks.getIndicateurs).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2030-01-01' } });

    expect(screen.getByText('La date de début est postérieure à la date de fin.')).toBeInTheDocument();
    expect(mocks.getIndicateurs).toHaveBeenCalledTimes(1);
  });
});

describe('RapportChiffreAffaires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getParRegion.mockResolvedValue(regions);
    mocks.getParArtisan.mockResolvedValue([
      {
        artisan_id: 'a1',
        numero_carte: 'CP-1',
        nom_complet: 'KABORE Awa',
        region: 'Centre',
        nombre_ventes: 8,
        quantite_totale_grammes: 2000,
        quantite_totale_onces: 64,
        montant_total_brut: 80_000_000,
        montant_total_taxes: 15_000_000,
        montant_total_net: 65_000_000,
      },
    ]);
    mocks.getParMois.mockResolvedValue([]);
  });

  it('transmet la période retenue au rapport régional', async () => {
    const { debut, fin } = defaultPeriode();
    render(<RapportChiffreAffaires />);

    // L'écran offrait un filtre mais appelait le service sans aucune borne.
    await screen.findByText('Centre');
    expect(mocks.getParRegion).toHaveBeenCalledWith(debut, fin);
  });

  it('ne totalise pas des effectifs d’artisans non additionnables', async () => {
    render(<RapportChiffreAffaires />);
    await waitFor(() => expect(screen.getByText('Centre')).toBeInTheDocument());

    expect(screen.getByText(/un même artisan peut déclarer dans/i)).toBeInTheDocument();
    const total = screen.getByText('Total').closest('tr');
    expect(within(total as HTMLElement).getAllByText('—')).toHaveLength(1);
  });

  it('propose les treize régions du référentiel national', async () => {
    render(<RapportChiffreAffaires />);
    await waitFor(() => expect(screen.getByLabelText('Axe d’analyse')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Axe d’analyse'), { target: { value: 'artisan' } });
    await waitFor(() => expect(screen.getByLabelText('Région')).toBeInTheDocument());

    // Cinq régions seulement étaient codées en dur dans la page.
    const options = within(screen.getByLabelText('Région')).getAllByRole('option');
    expect(options.length).toBeGreaterThan(6);
    expect(options.map((option) => option.textContent)).toContain('Sahel');
  });
});

describe('RapportQuantites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getParType.mockResolvedValue(types);
  });

  it('détaille les formes d’or et leurs cumuls', async () => {
    render(<RapportQuantites />);
    await waitFor(() => expect(screen.getAllByText('Lingot').length).toBeGreaterThan(0));

    const stats = within(screen.getByRole('region', { name: 'Cumuls de la période' }));
    expect(stats.getByText('3 110,00 g')).toBeInTheDocument();
    expect(stats.getByText('99.99 onces troy')).toBeInTheDocument();
    expect(stats.getByText('120 000 000 FCFA')).toBeInTheDocument();
  });

  it('explique une période sans collecte', async () => {
    mocks.getParType.mockResolvedValue([]);
    render(<RapportQuantites />);

    await waitFor(() => expect(screen.getByText('Aucune collecte sur la période')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Exporter en Excel/ })).toBeDisabled();
  });
});

describe('RapportTaxesRoyalties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTaxes.mockResolvedValue(taxes);
  });

  it('affiche les taux effectifs constatés', async () => {
    render(<RapportTaxesRoyalties />);
    await waitFor(() => expect(screen.getByText('Récapitulatif de la période')).toBeInTheDocument());

    expect(screen.getByText('18.00 %')).toBeInTheDocument();
    expect(screen.getByText('1.50 %')).toBeInTheDocument();
    expect(screen.getByText('19.50 %')).toBeInTheDocument();
    expect(screen.getAllByText('Taxe de développement communal').length).toBeGreaterThan(0);
  });

  it('recharge le rapport quand le regroupement change', async () => {
    render(<RapportTaxesRoyalties />);
    const { debut, fin } = defaultPeriode();
    await waitFor(() => expect(mocks.getTaxes).toHaveBeenCalledWith(debut, fin, 'mois'));

    fireEvent.change(screen.getByLabelText('Regroupement'), { target: { value: 'trimestre' } });

    await waitFor(() => expect(mocks.getTaxes).toHaveBeenCalledWith(debut, fin, 'trimestre'));
  });

  it('n’affiche aucun ratio sur une période sans facture', async () => {
    mocks.getTaxes.mockResolvedValue([]);
    render(<RapportTaxesRoyalties />);

    await waitFor(() => expect(screen.getByText('Aucune facture émise sur la période')).toBeInTheDocument());
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
