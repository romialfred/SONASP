import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccordionSidebar } from './AccordionSidebar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' },
  }),
}));

function renderSidebar(path = '/artisan-minier/liste') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccordionSidebar />
    </MemoryRouter>
  );
}

describe('AccordionSidebar', () => {
  beforeEach(() => localStorage.clear());

  it('affiche une navigation compacte sans la définition institutionnelle', () => {
    renderSidebar();

    const sidebar = screen.getByRole('complementary', { name: 'Navigation principale' });
    expect(sidebar).toHaveClass('w-[244px]');
    expect(screen.getByRole('img', { name: 'SONASP' })).toBeInTheDocument();
    expect(screen.queryByText(/Société Nationale/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.listeArtisans' })).toHaveAttribute('aria-current', 'page');
  });

  it('garde une seule section ouverte et conserve la largeur pendant les clics', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const sidebar = screen.getByRole('complementary', { name: 'Navigation principale' });
    const artisans = screen.getByRole('button', { name: 'nav.artisanMinier' });
    const production = screen.getByRole('button', { name: 'nav.productionManagement' });

    expect(artisans).toHaveAttribute('aria-expanded', 'true');
    await user.click(production);

    expect(artisans).toHaveAttribute('aria-expanded', 'false');
    expect(production).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar).toHaveClass('w-[244px]');
  });

  it('réduit le menu depuis le pied de sidebar', async () => {
    const user = userEvent.setup();
    renderSidebar('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Réduire le menu' }));

    expect(screen.getByRole('complementary', { name: 'Navigation principale' })).toHaveClass('w-[72px]');
    expect(screen.queryByText('MES APPLICATIONS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déployer le menu' })).toBeInTheDocument();
  });
});
