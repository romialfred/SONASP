import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductionDetails, grammes, onces, pourcent } from './ProductionDetails';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getProductionById: vi.fn(),
  listDocuments: vi.fn(),
  chargerHistorique: vi.fn(),
  compagnie: { data: null as unknown, error: null as unknown },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ id: 'p1' }),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'a@sonasp.bf' } }) }));
vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'info' },
    showError: vi.fn(),
    showSuccess: vi.fn(),
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/Tabs', () => ({
  Tabs: ({ children }: { children: (onglet: string) => ReactNode }) => <div>{children('details')}</div>,
}));

vi.mock('@/components/production/ProductionStatusBadge', () => ({
  ProductionStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('@/components/production/ProductionStatusWorkflow', () => ({
  ProductionStatusWorkflow: ({ production }: { production: { site_country?: string } }) => (
    <div>Pays transmis : {production.site_country ?? 'aucun'}</div>
  ),
}));
vi.mock('@/components/production/ProductionStatusWorkflowEnhanced', () => ({
  ProductionStatusWorkflowEnhanced: () => <div>Progression</div>,
}));
vi.mock('@/components/production/ProductionDocumentsList', () => ({
  ProductionDocumentsList: () => <div>Liste des documents</div>,
}));
vi.mock('@/components/production/ProductionDocumentUpload', () => ({
  ProductionDocumentUpload: () => null,
}));
vi.mock('@/components/production/ProductionStatusHistory', () => ({
  ProductionStatusHistory: () => <div>Historique</div>,
}));

vi.mock('@/services/dailyProductionService', () => ({
  dailyProductionService: { getProductionById: mocks.getProductionById },
}));
vi.mock('@/services/productionDocumentService', () => ({
  productionDocumentService: { listDocuments: mocks.listDocuments },
}));
vi.mock('./productionDetailsData', async () => {
  const reel = await vi.importActual<typeof import('./productionDetailsData')>('./productionDetailsData');
  return { ...reel, chargerHistorique: mocks.chargerHistorique };
});

vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {
    maybeSingle: () => Promise.resolve(mocks.compagnie),
  };
  ['select', 'eq'].forEach((methode) => {
    chaine[methode] = () => chaine;
  });
  return { supabase: { from: () => chaine } };
});

const declaration = {
  id: 'p1',
  production_date: '2026-08-18',
  mining_company_id: 'm1',
  bullion_grams: 1_000,
  pure_gold_grams: 875,
  estimated_oz: 28.132,
  estimated_fineness_pct: 87.5,
  estimated_silver_pct: 10,
  bar_reference: 'BAR-001',
  status: 'prepared',
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProductionById.mockResolvedValue({ ...declaration });
  mocks.listDocuments.mockResolvedValue([]);
  mocks.chargerHistorique.mockResolvedValue([]);
  mocks.compagnie = { data: { id: 'm1', name: 'Wahgnion Gold Mine', country: 'Burkina Faso' }, error: null };
});

describe('formats', () => {
  it('affiche « — » quand la valeur manque', () => {
    expect(grammes(null)).toBe('—');
    expect(onces(undefined)).toBe('—');
    expect(pourcent(null)).toBe('—');
  });
});

describe('ProductionDetails', () => {
  it('affiche la barre et sa compagnie', async () => {
    render(<ProductionDetails />);
    expect((await screen.findAllByText('Wahgnion Gold Mine')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('BAR-001').length).toBeGreaterThan(0);
  });

  it('n’invente ni compagnie ni référence quand elles manquent', async () => {
    // L'écran affichait « Kourousa » et « KOURO-2511-1000 », vestiges d'un autre projet.
    mocks.getProductionById.mockResolvedValue({ ...declaration, bar_reference: null, mining_company_id: null });
    mocks.compagnie = { data: null, error: null };
    render(<ProductionDetails />);

    expect(await screen.findByText('Barre sans référence')).toBeInTheDocument();
    expect(screen.queryByText(/Kourous/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/KOURO-/)).not.toBeInTheDocument();
  });

  it('transmet le pays de la compagnie et non une constante figée', async () => {
    render(<ProductionDetails />);
    expect(await screen.findByText('Pays transmis : Burkina Faso')).toBeInTheDocument();
  });

  it('ne transmet aucun pays quand la compagnie n’en porte pas', async () => {
    mocks.compagnie = { data: { id: 'm1', name: 'Mine sans pays', country: null }, error: null };
    render(<ProductionDetails />);
    expect(await screen.findByText('Pays transmis : aucun')).toBeInTheDocument();
  });

  it('décompose la barre en or, argent et impuretés', async () => {
    render(<ProductionDetails />);
    await screen.findAllByText('Wahgnion Gold Mine');
    expect(screen.getByText('Argent')).toBeInTheDocument();
    expect(screen.getByText('Impuretés')).toBeInTheDocument();
    expect(screen.getAllByText(/2,50 %/).length).toBeGreaterThan(0);
  });

  it('signale une déclaration introuvable', async () => {
    mocks.getProductionById.mockResolvedValue(null);
    render(<ProductionDetails />);
    expect(await screen.findByText(/n’existe pas ou a été supprimée/)).toBeInTheDocument();
  });

  it('remonte l’erreur de chargement', async () => {
    mocks.getProductionById.mockRejectedValue({ message: 'réseau indisponible' });
    render(<ProductionDetails />);
    expect(await screen.findByText(/Impossible de charger|réseau indisponible/)).toBeInTheDocument();
  });

  it('garde la fiche lisible quand l’historique échoue', async () => {
    mocks.chargerHistorique.mockRejectedValue({ message: 'table absente' });
    render(<ProductionDetails />);
    expect((await screen.findAllByText('Wahgnion Gold Mine')).length).toBeGreaterThan(0);
  });

  it('renvoie vers la déclaration à modifier, sur une route qui existe', async () => {
    render(<ProductionDetails />);
    await screen.findAllByText('Wahgnion Gold Mine');

    screen.getByRole('button', { name: /Modifier/ }).click();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/production/daily', { state: { productionId: 'p1' } })
    );
  });
});
