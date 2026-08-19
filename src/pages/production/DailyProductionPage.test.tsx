import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DailyProductionPage,
  cumulsProduction,
  lignesExport,
  periodeParDefaut,
  titreMoyen,
} from './DailyProductionPage';
import type { DailyProduction } from '@/services/dailyProductionService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
  listProduction: vi.fn(),
  deleteProduction: vi.fn(),
  showConfirm: vi.fn(),
  showError: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/components/ui/CustomConfirm', () => ({ CustomConfirm: () => null }));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    confirmState: { isOpen: false, message: '' },
    showError: mocks.showError,
    showConfirm: mocks.showConfirm,
    closeAlert: vi.fn(),
    closeConfirm: vi.fn(),
    handleConfirmAction: vi.fn(),
  }),
}));

vi.mock('@/components/production/DailyProductionFormEnhanced', () => ({
  DailyProductionFormEnhanced: () => <div>Formulaire de production</div>,
}));

vi.mock('@/components/production/ProductionChart', () => ({
  ProductionChart: () => <div>Graphique de production</div>,
}));

vi.mock('@/components/production/ProductionTable', () => ({
  ProductionTable: ({
    productions,
    onDelete,
  }: {
    productions: DailyProduction[];
    onDelete: (id: string) => void;
  }) => (
    <div>
      {productions.map((production) => (
        <div key={production.id}>
          <span>{production.bar_reference}</span>
          <button type="button" onClick={() => onDelete(production.id)}>
            Supprimer {production.bar_reference}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/services/dailyProductionService', () => ({
  dailyProductionService: {
    listProduction: mocks.listProduction,
    deleteProduction: mocks.deleteProduction,
  },
}));

vi.mock('@/utils/miningCompanyFilters', () => ({
  filterOperationalMiningCompanies: (liste: unknown[]) => liste,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const resultat = rows === null ? { data: null, error: { message: 'accès refusé' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  ['select', 'eq', 'order'].forEach((methode) => {
    builder[methode] = vi.fn(() => builder);
  });
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const productions = [
  {
    id: 'p1',
    production_date: '2026-08-01',
    bullion_grams: 1000,
    estimated_fineness_pct: 94,
    pure_gold_grams: 940,
    estimated_oz: 30.2,
    bar_reference: 'BAR-001',
    notes: 'Coulée du matin',
    site_id: 's1',
    mining_company_id: 'c1',
    status: 'prepared',
    created_by: 'u1',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'p2',
    production_date: '2026-08-02',
    bullion_grams: 500,
    estimated_fineness_pct: 90,
    pure_gold_grams: 450,
    estimated_oz: 14.5,
    bar_reference: 'BAR-002',
    notes: null,
    site_id: 's2',
    mining_company_id: 'c2',
    status: 'prepared',
    created_by: 'u1',
    created_at: '',
    updated_at: '',
  },
] as DailyProduction[];

const compagnies = [
  { id: 'c1', name: 'Essakane SA' },
  { id: 'c2', name: 'Bissa Gold' },
];

describe('calculs de production', () => {
  it('cumule doré, or fin et onces', () => {
    expect(cumulsProduction(productions)).toEqual({
      declarations: 2,
      dore: 1500,
      orFin: 1390,
      onces: 44.7,
    });
  });

  it('pondère le titre moyen par la masse de doré', () => {
    // Une moyenne arithmétique des titres donnerait 92 % ; la pondération donne 92,67 %.
    expect(titreMoyen(productions)).toBeCloseTo((1390 / 1500) * 100, 6);
    expect(titreMoyen([])).toBeNull();
  });

  it('borne la période par défaut sur l’exercice', () => {
    expect(periodeParDefaut(new Date('2026-08-18T10:00:00Z'))).toEqual({
      debut: '2026-01-01',
      fin: '2026-08-18',
    });
  });

  it('exporte la raison sociale, pas l’identifiant technique', () => {
    const lignes = lignesExport(productions, compagnies);
    // La colonne recevait `mining_company_id` : l'export livrait des UUID.
    expect(lignes[0][1]).toBe('Compagnie minière');
    expect(lignes[1][1]).toBe('Essakane SA');
    expect(lignes[2][1]).toBe('Bissa Gold');
    expect(lignesExport([{ ...productions[0], mining_company_id: null }], compagnies)[1][1]).toBe('Non renseignée');
  });
});

describe('DailyProductionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showConfirm.mockResolvedValue(true);
    mocks.listProduction.mockResolvedValue(productions);
    mocks.deleteProduction.mockResolvedValue(undefined);
    mocks.reponses = { mining_companies: compagnies };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('présente les cumuls de la période', async () => {
    render(<DailyProductionPage />);
    await waitFor(() => expect(screen.getByText('BAR-001')).toBeInTheDocument());

    const indicateurs = within(screen.getByRole('region', { name: 'Cumuls de la période' }));
    expect(indicateurs.getByText('1 500,00 g')).toBeInTheDocument();
    expect(indicateurs.getByText('1 390,00 g')).toBeInTheDocument();
    expect(indicateurs.getByText('92,67 %')).toBeInTheDocument();
  });

  it('filtre les déclarations sur la compagnie', async () => {
    render(<DailyProductionPage />);
    await waitFor(() => expect(screen.getByText('BAR-001')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Compagnie'), { target: { value: 'c2' } });

    expect(screen.queryByText('BAR-001')).not.toBeInTheDocument();
    expect(screen.getByText('BAR-002')).toBeInTheDocument();
  });

  it('supprime réellement après confirmation', async () => {
    render(<DailyProductionPage />);
    await waitFor(() => expect(screen.getByText('BAR-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer BAR-001' }));

    // L'appel à `showConfirm` employait la mauvaise signature : la fonction de
    // suppression n'était jamais exécutée.
    await waitFor(() => expect(mocks.showConfirm).toHaveBeenCalled());
    expect(mocks.showConfirm.mock.calls[0][0]).toBe('Supprimer cette déclaration ?');
    await waitFor(() => expect(mocks.deleteProduction).toHaveBeenCalledWith('p1'));
  });

  it('ne supprime rien si la confirmation est refusée', async () => {
    mocks.showConfirm.mockResolvedValue(false);
    render(<DailyProductionPage />);
    await waitFor(() => expect(screen.getByText('BAR-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer BAR-001' }));

    await waitFor(() => expect(mocks.showConfirm).toHaveBeenCalled());
    expect(mocks.deleteProduction).not.toHaveBeenCalled();
  });

  it('mène vers la route de budget qui existe', async () => {
    render(<DailyProductionPage />);
    await waitFor(() => expect(screen.getByText('BAR-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Budgets et prévisions/ }));

    // Le bouton pointait vers `/production/budget`, route inexistante.
    expect(mocks.navigate).toHaveBeenCalledWith('/performance/budgets');
  });

  it('conserve la période choisie après un enregistrement', async () => {
    render(<DailyProductionPage />);
    await waitFor(() => expect(screen.getByText('BAR-001')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-07-01' } });
    await waitFor(() =>
      expect(mocks.listProduction).toHaveBeenCalledWith({ startDate: '2026-07-01', endDate: periodeParDefaut().fin })
    );

    // L'enregistrement remplaçait la période par une fenêtre de 90 jours.
    expect(screen.getByLabelText('Du')).toHaveValue('2026-07-01');
  });

  it('signale un échec de chargement', async () => {
    mocks.listProduction.mockRejectedValue({ message: 'table indisponible' });
    render(<DailyProductionPage />);

    await waitFor(() => expect(screen.getByText('table indisponible')).toBeInTheDocument());
    expect(screen.getAllByText('Aucune déclaration').length).toBeGreaterThan(0);
  });
});
