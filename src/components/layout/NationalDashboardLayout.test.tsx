import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NationalDashboardLayout, reinitialiserEtatBarre } from './NationalDashboardLayout';
import { MODULE_CATALOG_UPDATED_EVENT, modulesService } from '@/services/modulesService';

const authState = vi.hoisted(() => ({
  user: {
    id: 'direction-id',
    email: 'direction@sonasp.bf',
    full_name: 'Direction SONASP',
    role: 'management',
    mining_company_id: null,
    is_active: true,
    capabilities: [
      'reports.read',
      'sonasp.workflow.read',
      'sonasp.prepare',
      'sonasp.finance.execute',
      'reconciliation.manage',
      'reconciliation.read',
      'tax.rules.read',
      'refining.supervise',
      'collectors.manage',
    ],
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ProfileErrorBanner', () => ({
  ProfileErrorBanner: () => null,
}));

vi.mock('@/services/modulesService', () => ({
  MODULE_CATALOG_UPDATED_EVENT: 'sonasp:module-catalog-updated',
  modulesService: { getNavigationAvailability: vi.fn().mockResolvedValue(null) },
}));

describe('NationalDashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    reinitialiserEtatBarre();
    Object.assign(authState.user, {
      id: 'direction-id',
      email: 'direction@sonasp.bf',
      full_name: 'Direction SONASP',
      role: 'management',
      module_domains: undefined,
      capabilities: [
        'reports.read',
        'sonasp.workflow.read',
        'sonasp.prepare',
        'sonasp.finance.execute',
        'reconciliation.manage',
        'reconciliation.read',
        'tax.rules.read',
        'refining.supervise',
        'collectors.manage',
      ],
    });
  });

  it('utilise le logo seul et une sidebar réduisible', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: 'SONASP' })).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getAllByTestId('app-sidebar')[0]).toBeInTheDocument();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('app-footer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plateforme SONASP' })).toBeInTheDocument();
    expect(screen.getByText('Collecte, traçabilité et valorisation de l’or')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /société minière/i })).not.toBeInTheDocument();
    // La barre laterale n'affiche que le logo : la raison sociale appartient au pied de page.
    const sidebar = screen.getAllByRole('complementary', { name: 'Navigation principale' })[0];
    expect(within(sidebar).queryByText(/Société Nationale/i)).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Société Nationale des Substances Précieuses/i);
    expect(screen.getByText('Direction SONASP')).toBeInTheDocument();
    // Les sections métier autorisées structurent la navigation Direction.
    ['Mine semi-mécanisée', 'Mine industrielle', 'Vente & achat d’or', 'Raffinage & stocks',
      'Réserve d’or du Burkina Faso', 'Vente internationale', 'Paramètres et configuration', 'Rapports et analyses'].forEach(
      (titre) => expect(screen.getByRole('region', { name: titre })).toBeInTheDocument()
    );

    // Chaque groupe porteur d'un chevron est deployable : plus aucun n'est un simple lien.
    ['Gestion de la production', 'Gestion des expéditions', 'Documents', 'Artisans miniers'].forEach((label) => {
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
    const collecte = screen.getByRole('button', { name: 'Gestion de la production' });
    expect(screen.queryByRole('link', { name: 'Or en coffre' })).not.toBeInTheDocument();

    await user.click(collecte);

    expect(collecte).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Production journalière' })).toHaveAttribute('href', '/production/daily');
    expect(screen.getByRole('link', { name: 'Or en coffre' })).toHaveAttribute('href', '/production/in-safe');
    expect(screen.queryByRole('link', { name: 'Licences d’exportation' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prévisions & licences' }));
    expect(collecte).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Licences d’exportation' })).toHaveAttribute('href', '/production/licenses');

    await user.click(screen.getByRole('button', { name: 'Gestion des expéditions' }));

    // Un seul groupe déplié à la fois : ouvrir le second referme le premier.
    expect(collecte).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Or en coffre' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Formalités douanières' })).toHaveAttribute('href', '/freight-customs');

    // Un second clic sur le déclencheur referme son propre groupe.
    await user.click(screen.getByRole('button', { name: 'Gestion des expéditions' }));
    expect(screen.queryByRole('link', { name: 'Formalités douanières' })).not.toBeInTheDocument();
  });

  it('ouvre deux groupes métier de façon exclusive', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/artisan-sites']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const sites = screen.getByRole('button', { name: 'Sites miniers' });
    const conciliation = screen.getByRole('button', { name: 'Ventes d’or internationales' });
    expect(sites).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: "Vue d'ensemble" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Productions' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ajouter un site' })).not.toBeInTheDocument();

    await user.click(conciliation);

    expect(sites).toHaveAttribute('aria-expanded', 'false');
    expect(conciliation).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Dossiers de conciliation' })).toHaveAttribute('href', '/conciliation');
    expect(screen.getByRole('link', { name: 'Règles fiscales' })).toHaveAttribute('href', '/conciliation/regles-fiscales');
  });

  it('rend tous les modules au Owner même sans périmètre explicite', () => {
    Object.assign(authState.user, {
      id: 'owner-id',
      email: 'owner@sonasp.bf',
      full_name: 'Compte technique',
      role: 'owner',
      capabilities: [],
      module_domains: [],
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toBeInTheDocument();
    ['Mine semi-mécanisée', 'Mine industrielle', 'Vente & achat d’or', 'Raffinage & stocks',
      'Réserve d’or du Burkina Faso', 'Vente internationale', 'Paramètres et configuration', 'Rapports et analyses'].forEach(
      (titre) => expect(screen.getByRole('region', { name: titre })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Sites miniers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ventes d’or internationales' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Administration' })).toBeInTheDocument();
  });

  it('conserve les six écrans Réserve du Owner après chargement et désactivation du catalogue', async () => {
    Object.assign(authState.user, {
      role: 'owner',
      capabilities: [],
      module_domains: [],
    });
    vi.mocked(modulesService.getNavigationAvailability).mockResolvedValueOnce({});
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/national-reserve']}>
          <NationalDashboardLayout><div>Réserve</div></NationalDashboardLayout>
        </MemoryRouter>
      );
    });

    const assertReserveLinks = () => {
      expect(screen.getByRole('button', { name: 'Réserve nationale d’or' })).toHaveAttribute('aria-expanded', 'true');
      const routes = ['/national-reserve', '/national-reserve/allocations', '/national-reserve/physical',
        '/national-reserve/controls', '/national-reserve/valuation', '/national-reserve/audit'];
      const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
      routes.forEach((route) => expect(links).toContain(route));
    };
    assertReserveLinks();

    vi.mocked(modulesService.getNavigationAvailability).mockResolvedValueOnce({
      national_reserve: { isActive: false, isVisibleInMenu: false },
    });
    await act(async () => { window.dispatchEvent(new Event(MODULE_CATALOG_UPDATED_EVENT)); });
    assertReserveLinks();
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
    expect(sousMenu.querySelectorAll('.national-sidebar__puce')).toHaveLength(1);
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
    expect(screen.getByRole('button', { name: 'Gestion de la production' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Or en coffre' })).toBeInTheDocument();
  });

  it('ferme réellement le menu utilisateur et y expose la documentation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const profile = screen.getByRole('button', { name: 'Ouvrir le menu utilisateur' });
    await user.click(profile);

    expect(profile).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toHaveAttribute('href', '/help');

    await user.click(profile);
    expect(profile).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menuitem', { name: 'Documentation' })).not.toBeInTheDocument();

    await user.click(profile);
    await user.keyboard('{Escape}');
    expect(profile).toHaveAttribute('aria-expanded', 'false');
  });

  it('n’ouvre jamais deux menus d’en-tête simultanément', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    const language = screen.getByRole('button', { name: /FR/i });
    await user.click(language);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu utilisateur' }));
    expect(language).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
  });
});
