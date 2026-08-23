import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NationalDashboardLayout, reinitialiserEtatBarre } from './NationalDashboardLayout';

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
  beforeEach(() => {
    localStorage.clear();
    reinitialiserEtatBarre();
  });

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
    // Les quatre sections structurent la navigation.
    ['Mines semi-mécanisées', 'Mines industrielles', 'Paramètres et configuration', 'Rapports et analyses'].forEach(
      (titre) => expect(screen.getByRole('region', { name: titre })).toBeInTheDocument()
    );

    // Chaque groupe porteur d'un chevron est deployable : plus aucun n'est un simple lien.
    ["Collecte de l'or", 'Expéditions', 'Documents', 'Administration', 'Artisans miniers'].forEach((label) => {
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
    const collecte = screen.getByRole('button', { name: "Collecte de l'or" });
    expect(screen.queryByRole('link', { name: 'Or en coffre' })).not.toBeInTheDocument();

    await user.click(collecte);

    expect(collecte).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Production journalière' })).toHaveAttribute('href', '/production/daily');
    expect(screen.getByRole('link', { name: 'Or en coffre' })).toHaveAttribute('href', '/production/in-safe');
    expect(screen.getByRole('link', { name: "Licences d'exportation" })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expéditions' }));

    // Un seul groupe déplié à la fois : ouvrir le second referme le premier.
    expect(collecte).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Or en coffre' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Formalités douanières' })).toHaveAttribute('href', '/freight-customs');

    // Un second clic sur le déclencheur referme son propre groupe.
    await user.click(screen.getByRole('button', { name: 'Expéditions' }));
    expect(screen.queryByRole('link', { name: 'Formalités douanières' })).not.toBeInTheDocument();
  });

  it('ouvre les groupes sites artisanaux et paramétrage de façon exclusive', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/artisan-sites']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const sites = screen.getByRole('button', { name: 'Sites miniers' });
    const settings = screen.getByRole('button', { name: 'Paramètres' });
    expect(sites).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: "Vue d'ensemble" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Productions' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ajouter un site' })).not.toBeInTheDocument();

    await user.click(settings);

    expect(sites).toHaveAttribute('aria-expanded', 'false');
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Paramètres des ventes' })).toHaveAttribute('href', '/admin/gold-sales-settings');
    expect(screen.getByRole('link', { name: 'Référentiel des statuts' })).toHaveAttribute('href', '/admin/status-manager');
  });

  it('marque les groupes d’un plus, remplacé par un moins une fois dépliés', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const signe = (bouton: HTMLElement) => bouton.querySelector(':scope > svg:last-child')?.classList.toString();
    const documents = screen.getByRole('button', { name: 'Documents' });

    expect(signe(documents)).toContain('lucide-plus');
    await user.click(documents);
    expect(signe(documents)).toContain('lucide-minus');
    await user.click(documents);
    expect(signe(documents)).toContain('lucide-plus');

    // Une entrée sans sous-menu ne porte aucun signe : rien à déplier.
    const rapports = screen.getByRole('link', { name: 'Rapports institutionnels' });
    expect(rapports.querySelectorAll('svg')).toHaveLength(1);

    // Chaque entrée de premier niveau porte sa pastille d'icône.
    expect(container.querySelectorAll('.national-sidebar__icon').length).toBeGreaterThan(10);
  });

  it('marque les sous-menus d’une puce, sans icône de module', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Documents' }));

    const sousMenu = container.querySelector('.national-sidebar__subnav') as HTMLElement;
    expect(sousMenu.querySelectorAll('.national-sidebar__puce')).toHaveLength(2);
    // Dix icônes de dix couleurs à ce niveau se lisaient comme dix alertes.
    expect(sousMenu.querySelectorAll('svg')).toHaveLength(0);
  });

  it('garde le groupe ouvert quand la navigation reconstruit la barre', async () => {
    const user = userEvent.setup();
    // Chaque page rend sa propre instance de la mise en page : naviguer démonte
    // celle-ci et en monte une neuve. Le groupe ouvert doit y survivre, sans quoi
    // la barre se réorganise sous les yeux à chaque clic.
    const premier = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByRole('link', { name: "Certificats d'essai" })).toBeInTheDocument();

    premier.unmount();

    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: "Certificats d'essai" })).toBeInTheDocument();
  });

  it('rouvre le groupe de la route quand la navigation change de module', () => {
    render(
      <MemoryRouter initialEntries={['/production/in-safe']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    // Le groupe correspond à la route dès le premier rendu : pas de repli suivi
    // d'un dépliage, donc rien qui saute.
    expect(screen.getByRole('button', { name: "Collecte de l'or" })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Or en coffre' })).toBeInTheDocument();
  });
});
