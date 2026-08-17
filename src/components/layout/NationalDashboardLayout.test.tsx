import { render, screen } from '@testing-library/react';
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
    expect(screen.queryByText(/Société Nationale/i)).not.toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Collecte de l'Or" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Expéditions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Artisans Miniers' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Administration' })).toBeInTheDocument();
    expect(container.querySelector('.national-shell__desktop-sidebar')).not.toHaveClass('is-collapsed');

    await user.click(screen.getByRole('button', { name: 'Réduire le menu' }));

    expect(container.querySelector('.national-shell__desktop-sidebar')).toHaveClass('is-collapsed');
    expect(localStorage.getItem('sidebar:collapsed')).toBe('true');
  });

  it('ouvre les groupes sites artisanaux et paramétrage de façon exclusive', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/artisan-sites']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const sites = screen.getByRole('button', { name: 'Gestion des sites artisanaux' });
    const settings = screen.getByRole('button', { name: 'Paramétrage' });
    expect(sites).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: "Vue d'ensemble" })).toBeInTheDocument();

    await user.click(settings);

    expect(sites).toHaveAttribute('aria-expanded', 'false');
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Paramètres des ventes' })).toHaveAttribute('href', '/admin/gold-sales-settings');
    expect(screen.getByRole('link', { name: 'Paramètres des statuts' })).toHaveAttribute('href', '/admin/status-manager');
  });
});
