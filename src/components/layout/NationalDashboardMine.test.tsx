import { render, screen, within } from '@testing-library/react';
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
vi.mock('./OwnerMineSwitcher', () => ({ OwnerMineSwitcher: () => null }));

describe('NationalDashboardLayout — espace Mine', () => {
  it('affiche la mine et réordonne les modules dans le shell ivoire dédié', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/portail-mine']}>
        <NationalDashboardLayout><div>Contenu Mine</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(container.querySelector('.national-shell')).toHaveClass('is-mine');
    expect(screen.getByRole('heading', { name: 'Burkina Mining SA' })).toBeInTheDocument();
    expect(screen.getByText(/Mon espace sécurisé · BMSA/)).toBeInTheDocument();

    const sidebar = screen.getAllByRole('complementary', { name: 'Navigation principale' })[0];
    expect(within(sidebar).getByRole('region', { name: 'Mon espace' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('region', { name: 'Mines industrielles' })).not.toBeInTheDocument();

    const labels = within(sidebar)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter(Boolean);
    const production = labels.indexOf('Gestion de la production');
    const stocks = labels.indexOf('Gestion des stocks');
    const expeditions = labels.indexOf('Gestion des expéditions');
    const ventes = labels.indexOf('Gestion des ventes');
    expect(production).toBeGreaterThan(-1);
    expect(stocks).toBeGreaterThan(production);
    expect(expeditions).toBeGreaterThan(stocks);
    expect(ventes).toBeGreaterThan(expeditions);
  });
});
