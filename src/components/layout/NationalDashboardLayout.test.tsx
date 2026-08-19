import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NationalDashboardLayout } from './NationalDashboardLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Romuald TIEGNAN', role: 'owner' },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ProfileErrorBanner', () => ({
  ProfileErrorBanner: () => null,
}));

describe('NationalDashboardLayout', () => {
  beforeEach(() => localStorage.clear());

  it('utilise le logo seul et une sidebar réduisible', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: 'SONASP' })).toBeInTheDocument();
    // La barre laterale n'affiche que le logo : la raison sociale appartient au pied de page.
    const sidebar = screen.getAllByRole('complementary', { name: 'Navigation principale' })[0];
    expect(within(sidebar).queryByText(/Société Nationale/i)).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Société Nationale des Substances Précieuses/i);
    expect(screen.getByText('Owner')).toBeInTheDocument();
    // Chaque groupe porteur d'un chevron est deployable : plus aucun n'est un simple lien.
    ["Collecte de l'Or", 'Expéditions', 'Documents', 'Administration', 'Artisans Miniers'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-expanded', 'false');
    });
    expect(container.querySelector('.national-shell__desktop-sidebar')).not.toHaveClass('is-collapsed');

    await user.click(screen.getByRole('button', { name: 'Réduire le menu' }));

    expect(container.querySelector('.national-shell__desktop-sidebar')).toHaveClass('is-collapsed');
    expect(localStorage.getItem('sidebar:collapsed')).toBe('true');
  });

  it('déploie les sous-menus des groupes métier', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    // Ces groupes affichaient un chevron sans sous-menu : le clic naviguait au lieu d'ouvrir.
    const collecte = screen.getByRole('button', { name: "Collecte de l'Or" });
    expect(screen.queryByRole('link', { name: 'Or en coffre' })).not.toBeInTheDocument();

    await user.click(collecte);

    expect(collecte).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Production journalière' })).toHaveAttribute('href', '/production/daily');
    expect(screen.getByRole('link', { name: 'Or en coffre' })).toHaveAttribute('href', '/production/in-safe');
    expect(screen.getByRole('link', { name: "Licences d'exportation" })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expéditions' }));

    // Ouverture exclusive : le groupe précédent se referme.
    expect(collecte).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Formalités douanières' })).toHaveAttribute('href', '/freight-customs');
  });

  it('ouvre les groupes sites artisanaux et paramétrage de façon exclusive', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/artisan-sites']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const sites = screen.getByRole('button', { name: 'Sites Artisanaux' });
    const settings = screen.getByRole('button', { name: 'Paramétrage' });
    expect(sites).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: "Vue d'ensemble" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Production des sites' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ajouter un site' })).not.toBeInTheDocument();

    await user.click(settings);

    expect(sites).toHaveAttribute('aria-expanded', 'false');
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Paramètres des ventes' })).toHaveAttribute('href', '/admin/gold-sales-settings');
    expect(screen.getByRole('link', { name: 'Paramètres des statuts' })).toHaveAttribute('href', '/admin/status-manager');
  });
});
