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
    user: { full_name: 'Agent SONASP', role: 'admin' },
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
    expect(container.querySelector('.national-shell__desktop-sidebar')).not.toHaveClass('is-collapsed');

    await user.click(screen.getByRole('button', { name: 'Réduire le menu' }));

    expect(container.querySelector('.national-shell__desktop-sidebar')).toHaveClass('is-collapsed');
    expect(localStorage.getItem('sidebar:collapsed')).toBe('true');
  });
});
