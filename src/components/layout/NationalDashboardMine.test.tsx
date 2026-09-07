import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NationalDashboardLayout } from './NationalDashboardLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u-mine',
      full_name: 'Responsable Mine',
      email: 'mine@example.test',
      role: 'mine',
      capabilities: ['mine.operate'],
      access_role_name: 'Responsable des opérations',
      is_active: true,
      mining_company_id: 'mine-1',
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMineWorkspace', () => ({
  useMineWorkspace: () => ({
    isMine: true,
    companyId: 'mine-1',
    companyName: 'Burkina Mining SA',
    companyCode: 'BMSA',
    loading: false,
  }),
}));

vi.mock('@/components/ui/ProfileErrorBanner', () => ({ ProfileErrorBanner: () => null }));

vi.mock('@/services/modulesService', () => ({
  MODULE_CATALOG_UPDATED_EVENT: 'sonasp:module-catalog-updated',
  modulesService: { getNavigationAvailability: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@/services/notificationsService', () => ({
  notificationsService: {
    lister: vi.fn().mockResolvedValue([]),
    resume: vi.fn().mockResolvedValue({
      non_lues: 0,
      urgentes: 0,
      hautes: 0,
      plus_ancienne: null,
    }),
    marquerLues: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/hooks/useCoursOr', () => ({
  useCoursOr: () => ({
    cours: { price: 2848.87, timestamp: Date.now(), changePercent24h: 0.42, source: 'Référentiel SONASP' },
    tauxUsdXof: 598.42,
    prixGrammeFcfa: 54811,
    chargement: false,
    erreur: null,
    actualiser: vi.fn(),
  }),
}));

vi.mock('@/services/liveGoldPriceService', () => ({
  fetchGoldPriceHistory: vi.fn().mockResolvedValue([]),
  formatGoldPrice: (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value),
}));

describe('NationalDashboardLayout — espace Mine', () => {
  it('affiche l’identité société dynamique et la navigation métier or/anthracite', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/portail-mine']}>
        <NationalDashboardLayout><div>Contenu Mine</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    await act(async () => {});
    expect(container.querySelector('.national-shell')).toHaveClass('is-mine');
    expect(screen.getByRole('heading', { name: 'Plateforme Nationale de Traçabilité de l’Or' })).toBeInTheDocument();
    expect(screen.getByText('Production, collecte, commercialisation et suivi des recettes')).toBeInTheDocument();
    expect(screen.getByLabelText('Portail Société minière')).toBeInTheDocument();

    const sidebar = screen.getAllByRole('complementary', { name: 'Navigation principale' })[0];
    expect(within(sidebar).getByText('ESPACE SOCIÉTÉ MINIÈRE')).toBeInTheDocument();
    expect(within(screen.getByTestId('app-header')).getByTitle('Burkina Mining SA')).toBeInTheDocument();
    expect(within(screen.getByTestId('app-header')).getByRole('img', { name: 'Armoiries du Burkina Faso' })).toBeInTheDocument();
    expect(within(sidebar).queryByText('Responsable Mine')).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'Accueil' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('href', '/portail-mine');
    expect(within(sidebar).getByRole('link', { name: 'Tableau de bord' })).toHaveClass('is-active');
    expect(within(sidebar).getByRole('region', { name: 'Production et prévisions' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('region', { name: 'Relations SONASP' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('region', { name: 'Expéditions et ventes' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('region', { name: 'Stock et raffinage' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('region', { name: 'Documents et rapports' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('region', { name: 'Cours de l’or' })).toBeInTheDocument();
    expect(within(sidebar).getByText('Mise à jour récente')).toBeInTheDocument();
    expect(within(sidebar).queryByText('Temps réel')).not.toBeInTheDocument();

    const labels = within(sidebar)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter(Boolean);
    const production = labels.indexOf('Gestion de la production');
    const stocks = labels.indexOf('Position des stocks');
    const expeditions = labels.indexOf('Gestion des expéditions');
    const ventes = labels.indexOf('Ventes internationales');
    expect(production).toBeGreaterThan(-1);
    expect(expeditions).toBeGreaterThan(production);
    expect(ventes).toBeGreaterThan(expeditions);
    expect(stocks).toBeGreaterThan(ventes);
  });

  it('maintient l’ancienne URL du tableau de bord sur la même entrée active', () => {
    render(
      <MemoryRouter initialEntries={['/portail-mine?vue=tableau-de-bord']}>
        <NationalDashboardLayout><div>Contenu Mine</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const sidebar = screen.getAllByRole('complementary', { name: 'Navigation principale' })[0];
    expect(within(sidebar).getByRole('link', { name: 'Tableau de bord' })).toHaveClass('is-active');
  });
});
