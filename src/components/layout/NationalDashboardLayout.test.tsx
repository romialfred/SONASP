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

vi.mock('./DgiGoldSidebarCard', () => ({
  DgiGoldSidebarCard: () => <section aria-label="Cours de l’or">Cours DGI sécurisé</section>,
}));

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

describe('NationalDashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    reinitialiserEtatBarre();
    Object.assign(authState.user, {
      id: 'direction-id',
      email: 'direction@sonasp.bf',
      full_name: 'Direction SONASP',
      role: 'management',
      organization_id: undefined,
      organization_type: undefined,
      access_role_name: undefined,
      module_codes: undefined,
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

  it('aligne les deux identités au-dessus de la sidebar réduisible', async () => {
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
    expect(screen.getByRole('heading', { name: 'Plateforme Nationale de Traçabilité de l’Or' })).toBeInTheDocument();
    expect(screen.getByText('Production, collecte, commercialisation et suivi des recettes')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /société minière/i })).not.toBeInTheDocument();
    // La barre laterale n'affiche que le logo : la raison sociale appartient au pied de page.
    const sidebar = screen.getAllByRole('complementary', { name: 'Navigation principale' })[0];
    expect(within(sidebar).queryByText(/Société Nationale/i)).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/FASO SANAMA/i);
    expect(screen.getByText('Direction SONASP')).toBeInTheDocument();
    // Les sections métier autorisées structurent la navigation Direction.
    ['Sites artisanaux & Artisans', 'Mine industrielle', 'Vente & achat d’or', 'Raffinage & stocks',
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

    const sites = screen.getByRole('button', { name: 'Sites artisanaux' });
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

  it('borne le chrome bleu, l’identité et la navigation au compte DGI', () => {
    Object.assign(authState.user, {
      id: 'dgi-user',
      email: 'controle@dgi.bf',
      full_name: 'KABORE Aïssata',
      role: 'dgi',
      organization_id: 'dgi-organization',
      organization_type: 'dgi',
      access_role_name: 'Contrôleur fiscal DGI',
      module_codes: ['dashboard', 'production', 'artisan_gold_market', 'conciliation'],
      capabilities: ['dgi.fiscal.control'],
    });

    render(
      <MemoryRouter initialEntries={['/portail-dgi']}>
        <NationalDashboardLayout><div>Collecte fiscale</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('app-shell')).toHaveClass('is-dgi');
    expect(screen.getAllByTestId('app-sidebar')[0]).toHaveClass('is-dgi');
    expect(screen.getByRole('img', { name: 'Armoiries du Burkina Faso' })).toHaveAttribute('src', '/institutional/armoiries-burkina-faso.png');
    expect(screen.getByLabelText('Portail Finances · DGI')).toBeInTheDocument();
    expect(screen.getByText('Contrôleur fiscal DGI')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Contrôle fiscal' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Paiements & recettes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rapprochement' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cours de l’or' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Vue fiscale' })).not.toHaveClass('is-current');
  });

  it('borne la charte minérale, le header et la navigation au compte DGMG réel', () => {
    Object.assign(authState.user, {
      id: 'dgmg-user',
      email: 'supervision@dgmg.bf',
      full_name: 'Agent DGMG de test',
      role: 'dgmg',
      organization_id: 'dgmg-organization',
      organization_type: 'dgmg',
      access_role_name: 'Superviseur réglementaire',
      module_codes: ['dashboard', 'mining_sites', 'artisan-minier', 'production'],
      capabilities: ['dgmg.supervise'],
    });

    render(
      <MemoryRouter initialEntries={['/portail-dgmg']}>
        <NationalDashboardLayout><div>Vue réglementaire</div></NationalDashboardLayout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('app-shell')).toHaveClass('is-dgmg');
    expect(screen.getAllByTestId('app-sidebar')[0]).toHaveClass('is-dgmg');
    expect(screen.getByRole('img', { name: 'Armoiries du Burkina Faso' })).toHaveAttribute('src', '/institutional/armoiries-burkina-faso.png');
    expect(screen.getByLabelText('Portail Mines · DGMG')).toBeInTheDocument();
    expect(screen.getByText('Agent DGMG de test')).toBeInTheDocument();
    expect(screen.getByText('Superviseur réglementaire')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Supervision & régulation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vue d’ensemble' })).toHaveClass('is-current');
    expect(screen.queryByRole('link', { name: 'Tableau de bord' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cours de l’or' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('FASO SANAMA');
  });

  it.each(['/artisan-minier/comptoirs', '/artisan-minier/comptoirs/comptoir-id'])('surligne seulement la page active à %s et jamais son groupe', async (path) => {
    Object.assign(authState.user, { role: 'owner', capabilities: [] });
    render(<MemoryRouter initialEntries={[path]}><NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout></MemoryRouter>);
    await act(async () => {});
    const sidebar = screen.getByRole('complementary', { name: 'Navigation principale' });
    const group = within(sidebar).getByRole('button', { name: 'Artisans miniers' });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(group).not.toHaveClass('is-current');
    expect(within(sidebar).getByRole('link', { name: 'Comptoirs' })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.querySelectorAll('.is-current, .is-active')).toHaveLength(1);
    expect(sidebar.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByLabelText('Portail Administrateur').querySelector('.national-header__security-badge')).toBeInTheDocument();
  });

  it('ne surligne pas deux liens vers l’accueil du collecteur', async () => {
    Object.assign(authState.user, { role: 'collector', organization_id: 'sonasp', organization_type: 'sonasp', capabilities: ['collector.operate'] });
    render(<MemoryRouter initialEntries={['/portail-collecteur']}><NationalDashboardLayout><div>Contenu</div></NationalDashboardLayout></MemoryRouter>);
    await act(async () => {});
    const sidebar = screen.getByRole('complementary', { name: 'Navigation principale' });
    expect(within(sidebar).getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar).getByRole('link', { name: 'Mon espace' })).not.toHaveClass('is-current');
    expect(sidebar.querySelectorAll('.is-current, .is-active')).toHaveLength(1);
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
    ['Sites artisanaux & Artisans', 'Mine industrielle', 'Vente & achat d’or', 'Raffinage & stocks',
      'Réserve d’or du Burkina Faso', 'Vente internationale', 'Paramètres et configuration', 'Rapports et analyses'].forEach(
      (titre) => expect(screen.getByRole('region', { name: titre })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Sites artisanaux' })).toBeInTheDocument();
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
    expect(screen.getByRole('menuitem', { name: 'Français' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('menuitem', { name: 'Anglais — bientôt disponible' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu utilisateur' }));
    expect(language).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
  });
});
