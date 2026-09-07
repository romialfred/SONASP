import {
  Fragment,
  ReactNode,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ageRelatif,
  formaterBadge,
  notificationsService,
  type Notification,
  type ResumeNotifications,
} from '@/services/notificationsService';
import { navigationLabel } from '@/i18n/navigationLabels';
import {
  INTERFACE_LANGUAGES,
  INTERFACE_LANGUAGE_STORAGE_KEY,
  isInterfaceLanguageEnabled,
  type InterfaceLanguage,
} from '@/i18n/interfaceLanguages';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  HelpCircle,
  ChevronDown,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileErrorBanner } from '@/components/ui/ProfileErrorBanner';
import { cn } from '@/utils/cn';
import { RouteFallback } from '@/components/common/RouteFallback';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { useComptoirWorkspace } from '@/hooks/useComptoirWorkspace';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { getNavigationSectionsForUser, type NavigationSection } from './sidebarNavigation';
import { accountTypeFor, homePathForAccountType } from '@/lib/routeAccessRegistry';
import {
  MODULE_CATALOG_UPDATED_EVENT,
  modulesService,
} from '@/services/modulesService';
import type { ModuleAvailabilityMap } from '@/lib/platformModuleCatalog';
import { DgiGoldSidebarCard } from './DgiGoldSidebarCard';
import { MineGoldSidebarCard } from './MineGoldSidebarCard';
import { PORTAL_THEMES, portalThemeVariables } from './portalThemes';
import { usePortalBrand } from './usePortalBrand';
import { PortalBrandPair } from './PortalBrandPair';
import { PortalIdentity, PlatformTraceIcon, HeaderWaves } from './PortalIdentity';
import './national-dashboard-layout.css';

interface NationalDashboardLayoutProps {
  children?: ReactNode;
}

/**
 * Indique qu'un habillage — barre laterale, en-tete, pied — est deja monte plus
 * haut dans l'arbre.
 *
 * Chaque page rendait son propre `NationalDashboardLayout`. Comme la mise en page
 * se trouvait a l'interieur de l'element de route, changer de page detruisait
 * l'habillage pour le reconstruire : barre laterale, en-tete et filtres repartaient
 * de zero a chaque navigation, et l'ecran blanchissait le temps du chargement.
 *
 * `NationalDashboardChrome` monte l'habillage une fois, comme route parente. Les
 * pages qui l'appellent encore deviennent alors de simples passe-plats : aucune
 * n'a eu besoin d'etre reecrite.
 */
const ChromeContext = createContext(false);

/**
 * Etat visuel de la barre laterale, conserve hors du composant.
 *
 * Chaque page rend sa propre instance de `NationalDashboardLayout` : naviguer
 * demonte l'ancienne et en monte une neuve. Sans ce relais, le defilement de la
 * barre repartait en haut et le groupe ouvert se recalculait a chaque clic —
 * c'est ce que l'on voyait bouger.
 */
const etatBarre: { defilement: number; groupeOuvert: string | null } = {
  defilement: 0,
  groupeOuvert: null,
};

/** Remet le relais a zero. Reserve aux tests : sans cela, ils dependraient de leur ordre. */
export function reinitialiserEtatBarre() {
  etatBarre.defilement = 0;
  etatBarre.groupeOuvert = null;
}

function getRoleLabel(role?: string) {
  const labels: Record<string, string> = {
    owner: 'Administrateur',
    admin: 'Administrateur',
    management: 'Agent SONASP',
    manager: 'Direction SONASP',
    factory: 'Site de production',
    airport: 'Expéditions',
    refinery: 'Raffinerie',
    customer: 'Client',
    collector: 'Agent collecteur',
    comptoir: 'Comptoir',
    mine: 'Société minière',
    dgi: 'Agent fiscal DGI',
    dgmg: 'Agent de supervision DGMG',
  };

  return labels[role || ''] || 'Utilisateur';
}

export function NationalDashboardLayout({ children }: NationalDashboardLayoutProps) {
  const habillageDejaMonte = useContext(ChromeContext);
  if (habillageDejaMonte) return <>{children}</>;
  return <NationalDashboardChrome>{children}</NationalDashboardChrome>;
}

/**
 * Habillage de l'application, monte une seule fois.
 * Sans enfant, il rend l'`Outlet` de la route courante : c'est la forme employee
 * comme route parente dans `App.tsx`.
 */
export function NationalDashboardChrome({ children }: NationalDashboardLayoutProps) {
  const { i18n } = useTranslation();
  const label = (value: string) => navigationLabel(value, i18n.language || 'fr');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMine, companyName } = useMineWorkspace();
  const { isComptoir } = useComptoirWorkspace();
  const { isCollector } = useCollectorWorkspace();
  const accountType = accountTypeFor(user);
  const theme = PORTAL_THEMES[accountType];
  const scopeKey = [user?.id, user?.organization_id, user?.mining_company_id, accountType, user?.access_role_id, user?.capabilities?.join(',')].join(':');
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const brand = usePortalBrand(user, accountType, companyName);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.portalTheme = theme.id;
    const variables = portalThemeVariables(theme);
    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, String(value)));
    return () => {
      delete root.dataset.portalTheme;
      Object.keys(variables).forEach((name) => root.style.removeProperty(name));
    };
  }, [theme]);
  const isDgi = accountType === 'dgi';
  const isDgmg = accountType === 'dgmg';
  const [moduleAvailability, setModuleAvailability] = useState<ModuleAvailabilityMap | null>(null);

  const chargerDisponibiliteModules = useCallback(async () => {
    try {
      setModuleAvailability(await modulesService.getNavigationAvailability());
    } catch (reason) {
      // La route reste le garde-fou autoritatif. En cas d'indisponibilité
      // ponctuelle du catalogue, conserver la navigation statique évite de
      // transformer un incident réseau en sidebar entièrement vide.
      console.warn('[Modules] Catalogue de navigation indisponible :', reason);
      setModuleAvailability(null);
    }
  }, []);

  useEffect(() => {
    void chargerDisponibiliteModules();
    const actualiser = () => void chargerDisponibiliteModules();
    window.addEventListener(MODULE_CATALOG_UPDATED_EVENT, actualiser);
    return () => window.removeEventListener(MODULE_CATALOG_UPDATED_EVENT, actualiser);
  }, [chargerDisponibiliteModules]);

  const navigationSections = useMemo(() => {
    const sections = getNavigationSectionsForUser(user, moduleAvailability);
    if (!isMine) return sections;

    const groupes = sections.flatMap((section) => section.groups);
    const parIdentifiant = new Map(groupes.map((group) => [group.id, group]));
    const labels: Record<string, string> = {
      production: 'Gestion de la production',
      inventory: 'Position des stocks',
      shipping: 'Gestion des expéditions',
      sales: 'Ventes internationales',
      refining: 'Suivi du raffinage',
      'achats-industriels': 'Achats et demandes',
      documents: 'Documents',
      'rapports-institutionnels': 'Rapports',
    };
    const construireSection = (id: string, title: string, ids: string[]): NavigationSection => ({
      id,
      title,
      groups: ids.flatMap((groupId) => {
        const group = parIdentifiant.get(groupId);
        return group ? [{ ...group, label: labels[group.id] || group.label }] : [];
      }),
    });

    return [
      construireSection('mine-production', 'Production et prévisions', ['production', 'previsions-licences']),
      construireSection('mine-relations', 'Relations SONASP', ['achats-industriels']),
      construireSection('mine-expeditions', 'Expéditions et ventes', ['shipping', 'sales']),
      construireSection('mine-stock', 'Stock et raffinage', ['inventory', 'refining']),
      construireSection('mine-documents', 'Documents et rapports', ['documents', 'rapports-institutionnels']),
    ].filter((section) => section.groups.length > 0);
  }, [isMine, moduleAvailability, user]);
  const navigationGroups = useMemo(
    () => navigationSections.flatMap((section) => section.groups),
    [navigationSections]
  );
  const mineHomePath = '/portail-mine';
  const accountHomePath = homePathForAccountType(accountType);
  const dashboardPath = isMine ? mineHomePath : (accountHomePath || '/login');
  const mineDashboardActive = isMine
    && location.pathname === mineHomePath;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sidebar:collapsed') === 'true'
  );
  /**
   * Groupe correspondant a la route, choisi sur la correspondance **la plus longue**.
   *
   * La recherche retenait le premier groupe venu : `/artisan-minier/paiements`
   * correspondait a « Artisans miniers » via son enfant `/artisan-minier`, si bien que
   * cliquer dans « Marche d'or artisanal » repliait ce groupe pour en ouvrir un autre —
   * la barre laterale sautait sous le curseur.
   */
  const routeGroupId = useMemo<string | null>(() => {
    let meilleurId: string | null = null;
    let meilleureLongueur = -1;

    navigationGroups.forEach((group) => {
      (group.children || []).forEach((item) => {
        const correspond =
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        if (correspond && item.path.length > meilleureLongueur) {
          meilleurId = group.id;
          meilleureLongueur = item.path.length;
        }
      });
    });

    return meilleurId;
  }, [location.pathname, navigationGroups]);
  /**
   * Groupe deplie. Un seul a la fois : ouvrir le suivant referme le precedent.
   *
   * Replier un groupe situe plus haut fait remonter tout ce qui suit, y compris la
   * ligne que l'on vient de cliquer. `basculerGroupe` releve donc la position du
   * declencheur avant la bascule et corrige le defilement d'autant, avant peinture.
   */
  const [openGroup, setOpenGroup] = useState<string | null>(
    () => etatBarre.groupeOuvert ?? routeGroupId
  );
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const emptyResume: ResumeNotifications = { non_lues: 0, urgentes: 0, hautes: 0, plus_ancienne: null };
  const [notificationResult, setNotificationResult] = useState<{ scope: string; list: Notification[]; summary: ResumeNotifications } | null>(null);
  const notifications = notificationResult?.scope === scopeKey ? notificationResult.list : [];
  const resumeNotifications = notificationResult?.scope === scopeKey ? notificationResult.summary : emptyResume;
  const chargerNotifications = useCallback(async () => {
    try {
      const [list, summary] = await Promise.all([
        notificationsService.lister({ limite: 8 }), notificationsService.resume(),
      ]);
      if (scopeRef.current === scopeKey) setNotificationResult({ scope: scopeKey, list, summary });
    } catch {
      if (scopeRef.current === scopeKey) setNotificationResult(null);
    }
  }, [scopeKey]);
  useEffect(() => { setNotificationsOpen(false); void chargerNotifications(); }, [chargerNotifications]);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (routeGroupId) setOpenGroup(routeGroupId);
  }, [routeGroupId]);

  useEffect(() => {
    etatBarre.groupeOuvert = openGroup;
  }, [openGroup]);

  const navRef = useRef<HTMLElement | null>(null);
  const headerActionsRef = useRef<HTMLDivElement | null>(null);
  /** Ligne a maintenir en place pendant le repli d'un groupe situe plus haut. */
  const ancrage = useRef<{ element: HTMLElement; haut: number } | null>(null);

  /**
   * Restaure le defilement des le rattachement du noeud, donc avant la peinture :
   * la barre reapparait la ou l'utilisateur l'avait laissee, sans saut visible.
   * La copie mobile est ignoree pour ne pas ecraser la reference de la copie fixe.
   */
  const rattacherNavigation = useCallback((element: HTMLElement | null) => {
    if (!element || element.closest('.national-shell__mobile-sidebar')) return;
    navRef.current = element;
    element.scrollTop = etatBarre.defilement;
  }, []);

  const memoriserDefilement = useCallback(() => {
    if (navRef.current) etatBarre.defilement = navRef.current.scrollTop;
  }, []);

  /**
   * Ramene le declencheur a sa position d'avant la bascule.
   *
   * Le repli d'un groupe situe plus haut raccourcit le contenu qui le precede : sans
   * cette correction, la ligne cliquee remonte sous le curseur. La compensation est
   * complete tant qu'il reste du defilement a reprendre ; collee en haut de liste,
   * elle ne peut plus rien et le decalage se voit — c'est la limite de l'ouverture
   * exclusive elle-meme.
   */
  useLayoutEffect(() => {
    const ancre = ancrage.current;
    ancrage.current = null;
    const navigation = navRef.current;
    if (!ancre || !navigation) return;

    const ecart = ancre.element.getBoundingClientRect().top - ancre.haut;
    if (ecart) navigation.scrollTop += ecart;
    etatBarre.defilement = navigation.scrollTop;
  }, [openGroup]);

  const basculerGroupe = (groupId: string, declencheur: HTMLElement) => {
    ancrage.current = { element: declencheur, haut: declencheur.getBoundingClientRect().top };

    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      localStorage.setItem('sidebar:collapsed', 'false');
      setOpenGroup(groupId);
      return;
    }
    setOpenGroup((courant) => (courant === groupId ? null : groupId));
  };

  const displayName = useMemo(() => {
    const name = user?.full_name?.trim();
    if (name && !name.includes('@')) return name;
    return user?.email?.split('@')[0] || 'Utilisateur';
  }, [user?.email, user?.full_name]);

  const closeMenus = useCallback(() => {
    setLanguageOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = document.querySelector<HTMLElement>('.national-shell__mobile-sidebar');
    if (!drawer) return;
    const previous = document.activeElement;
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'))
      .filter(element => element.offsetParent !== null);
    drawer.querySelector<HTMLElement>('nav a, nav button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [mobileOpen]);

  const toggleLanguageMenu = () => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    setLanguageOpen((open) => !open);
  };

  const toggleNotificationsMenu = () => {
    setLanguageOpen(false);
    setProfileOpen(false);
    setNotificationsOpen((open) => {
      const next = !open;
      if (next) void chargerNotifications();
      return next;
    });
  };

  const toggleProfileMenu = () => {
    setLanguageOpen(false);
    setNotificationsOpen(false);
    setProfileOpen((open) => !open);
  };

  useEffect(() => {
    if (!languageOpen && !notificationsOpen && !profileOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerActionsRef.current?.contains(event.target)) {
        closeMenus();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenus();
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeMenus, languageOpen, notificationsOpen, profileOpen]);

  const changeLanguage = async (language: InterfaceLanguage) => {
    if (!isInterfaceLanguageEnabled(language)) return;
    await i18n.changeLanguage(language);
    localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, language);
    setLanguageOpen(false);
  };

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/dashboard' || !location.pathname.startsWith(`${path}/`)) return false;

    const navigationPaths = navigationGroups.flatMap((group) => [
      group.path,
      ...(group.children?.map((item) => item.path) || []),
    ]);
    const moreSpecificPathExists = navigationPaths.some(
      (item) =>
        item !== path &&
        (location.pathname === item || location.pathname.startsWith(`${item}/`))
    );
    return !moreSpecificPathExists;
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem('sidebar:collapsed', String(next));
      return next;
    });
  };

  const sidebar = (
    <aside data-testid="app-sidebar" className={cn(
      'national-sidebar',
      isMine && 'is-mine',
      isComptoir && 'is-comptoir',
      isCollector && 'is-collector',
      isDgi && 'is-dgi',
      isDgmg && 'is-dgmg',
      sidebarCollapsed && 'is-collapsed',
    )} aria-label={label('Navigation principale')}>
      <div className="national-sidebar__section-title">
        <span>{theme.space}</span>
        <button
          type="button"
          className="national-sidebar__collapse"
          onClick={toggleSidebar}
          aria-label={label(sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu')}
          title={label(sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu')}
        >
          {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      </div>

      <nav className="national-sidebar__navigation" ref={rattacherNavigation} onScroll={memoriserDefilement}>
        {!isDgmg && (
          <Link
            to={dashboardPath}
            aria-label={label('Tableau de bord')}
            title={label('Tableau de bord')}
            className={cn(
              'national-sidebar__dashboard-link',
              isMine ? mineDashboardActive && 'is-active' : isActive(dashboardPath) && 'is-active'
            )}
            onClick={() => setMobileOpen(false)}
          >
            <span className="national-sidebar__icon">
              <LayoutDashboard aria-hidden="true" />
            </span>
            <span>{label('Tableau de bord')}</span>
          </Link>
        )}

        {navigationSections.map((section) => (
          <section className="national-sidebar__section" key={section.id} aria-label={label(section.title)}>
            <h2 className="national-sidebar__section-heading">{label(section.title)}</h2>

            {section.groups.map((group) => {
              const Icon = group.icon;
              const hasChildren = Boolean(group.children?.length);
              const groupActive = isDgi && group.id === 'dgi-overview'
                ? false
                : isActive(group.path) || Boolean(group.children?.some((item) => isActive(item.path)));
              const isOpen = openGroup === group.id;

          if (hasChildren) {
            return (
              <div className="national-sidebar__group" key={group.label}>
                <button
                  type="button"
                  className={cn(
                    'national-sidebar__group-trigger',
                    !isMine && !isComptoir && ['market', 'sales', 'dgmg-productions'].includes(group.id)
                      && 'national-sidebar__group-trigger--compact',
                    groupActive && 'is-current'
                  )}
                  onClick={(evenement) => basculerGroupe(group.id, evenement.currentTarget)}
                  aria-expanded={isOpen}
                  aria-label={label(group.label)}
                  title={label(group.label)}
                >
                  <span className="national-sidebar__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span title={label(group.label)}>{label(group.label)}</span>
                  {/* Plus quand le groupe est replie, moins quand il est deplie :
                      le signe decrit l'action offerte, pas l'etat courant. */}
                  {isOpen ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
                </button>
                {isOpen && (
                  <div className="national-sidebar__subnav">
                    {/* Une puce claire remplace l'icone de module : a ce niveau, dix
                        icones de dix couleurs se lisaient comme dix alertes. */}
                    {group.children?.map((item, index) => {
                      const showCategory = Boolean(
                        item.category && group.children?.[index - 1]?.category !== item.category
                      );
                      return (
                        <Fragment key={item.path}>
                          {showCategory && (
                            <p className="national-sidebar__subnav-category">
                              {label(item.category as string)}
                            </p>
                          )}
                          <Link
                            to={item.path}
                            className={cn(isActive(item.path) && 'is-current')}
                            onClick={() => setMobileOpen(false)}
                            title={label(item.label)}
                          >
                            <i className="national-sidebar__puce" aria-hidden="true" />
                            <span>{label(item.label)}</span>
                          </Link>
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

              return (
                <Link
                  to={group.path}
                  aria-label={label(group.label)}
                  title={label(group.label)}
                  className={cn('national-sidebar__group-trigger national-sidebar__group-link', groupActive && 'is-current')}
                  key={group.id}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="national-sidebar__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  {/* Ni plus ni chevron : cette entree n'a pas de sous-menu a deplier, et le
                      signe promettait un repli qui n'existait pas. La place gagnee revient
                      a l'intitule, qui doit tenir sur une seule ligne. */}
                  <span>{label(group.label)}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>

      {(isDgi || isDgmg) && <DgiGoldSidebarCard />}
      {isMine && <MineGoldSidebarCard />}
      <Link className="national-sidebar__help" to="/help" aria-label="Centre d’assistance" title="Centre d’assistance" onClick={() => setMobileOpen(false)}><HelpCircle aria-hidden="true" /><span>Centre d’assistance</span></Link>

    </aside>
  );

  return (
    <div data-testid="app-shell" data-portal={theme.id} style={portalThemeVariables(theme)} className={cn(
      'national-shell',
      sidebarCollapsed && 'has-collapsed-sidebar',
      isMine && 'is-mine',
      isComptoir && 'is-comptoir',
      isCollector && 'is-collector',
      isDgi && 'is-dgi',
      isDgmg && 'is-dgmg',
    )}>
        <header className="national-header" data-testid="app-header">
          <button
            type="button"
            className="national-header__mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label={label('Ouvrir la navigation')}
          >
            <Menu aria-hidden="true" />
          </button>

          <HeaderWaves />
          <PortalBrandPair brand={brand} />
          <div className="national-header__identity">
            <PlatformTraceIcon />
            <div><h1>Plateforme Nationale de Traçabilité de l’Or</h1><p>Production, collecte, commercialisation et suivi des recettes</p></div>
          </div>
          <PortalIdentity theme={theme} />

          <div className="national-header__actions" ref={headerActionsRef}>
            <div className="national-header__popover">
              <button
                type="button"
                className="national-header__language"
                onClick={toggleLanguageMenu}
                aria-expanded={languageOpen}
                aria-haspopup="menu"
                aria-controls="language-menu"
                aria-label="Choisir la langue (FR)"
              >
                <Languages aria-hidden="true" />
                <span>FR</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {languageOpen && (
                <div id="language-menu" role="menu" className="national-header__menu national-header__language-menu">
                  {INTERFACE_LANGUAGES.map((option) => (
                    <button
                      key={option.code}
                      role="menuitem"
                      type="button"
                      disabled={!option.enabled}
                      aria-disabled={!option.enabled}
                      aria-current={option.code === 'fr' ? 'true' : undefined}
                      title={option.enabled ? undefined : 'Disponible dans une prochaine version'}
                      onClick={() => void changeLanguage(option.code)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="national-header__popover national-header__bell-wrap">
              <button
                type="button"
                className="national-header__icon-button"
                aria-label={label('Afficher les notifications')}
                onClick={toggleNotificationsMenu}
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
                aria-controls="notifications-menu"
              >
                <Bell aria-hidden="true" />
                {resumeNotifications.non_lues > 0 && (
                  <span
                    className={`national-header__badge${
                      resumeNotifications.urgentes > 0 ? ' est-urgent' : ''}`}
                  >
                    {formaterBadge(resumeNotifications.non_lues)}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div id="notifications-menu" role="menu" className="national-header__menu national-header__notifications">
                  <header>
                    <strong>Notifications</strong>
                    {resumeNotifications.non_lues > 0 && (
                      <button
                        type="button"
                        className="national-header__tout-lu"
                        onClick={async () => {
                          await notificationsService.marquerLues();
                          await chargerNotifications();
                        }}
                      >
                        {label('Tout marquer comme lu')}
                      </button>
                    )}
                  </header>
                  {notifications.length === 0 ? (
                    <p className="national-header__vide">
                      {label('Rien à signaler pour le moment.')}
                    </p>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`national-header__notification${notification.lue ? '' : ' est-non-lue'} is-${notification.gravite}`}
                        onClick={async () => {
                          await notificationsService.marquerLues([notification.id]);
                          setNotificationsOpen(false);
                          if (notification.chemin) navigate(notification.chemin);
                          else await chargerNotifications();
                        }}
                      >
                        <span className="national-header__notification-titre">
                          {notification.titre}
                        </span>
                        <span className="national-header__notification-corps">
                          {notification.message}
                        </span>
                        <span className="national-header__notification-age">
                          {ageRelatif(notification.created_at)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <span className="national-header__separator" aria-hidden="true" />

            <div className="national-header__popover">
              <button
                type="button"
                className="national-header__profile"
                onClick={toggleProfileMenu}
                aria-label={label('Ouvrir le menu utilisateur')}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-controls="profile-menu"
              >
                <span className="national-header__avatar" aria-hidden="true">{displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                <span className="national-header__profile-copy">
                  <strong title={displayName}>{displayName}</strong>
                  <small>{label(
                    isDgi || isDgmg || isMine
                      ? (user?.access_role_name?.trim() || getRoleLabel(user?.role))
                      : isCollector
                        ? 'Collecteur d’or'
                        : isComptoir
                          ? 'Comptoir d’or'
                          : getRoleLabel(user?.role)
                  )}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {profileOpen && (
                <div id="profile-menu" role="menu" className="national-header__menu national-header__profile-menu">
                  <Link role="menuitem" to="/profile" onClick={() => setProfileOpen(false)}><Settings aria-hidden="true" /> {label('Mon profil')}</Link>
                  <Link role="menuitem" to="/help" onClick={() => setProfileOpen(false)}><HelpCircle aria-hidden="true" /> Documentation</Link>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={async () => {
                      await signOut();
                      navigate('/login');
                    }}
                  >
                    <LogOut aria-hidden="true" /> {label('Déconnexion')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="national-header__mobile-close"
            aria-label={label('Fermer les menus')}
            onClick={closeMenus}
          >
            <X aria-hidden="true" />
          </button>
        </header>

      <ProfileErrorBanner />
      <div className={cn('national-shell__desktop-sidebar', sidebarCollapsed && 'is-collapsed')}>{sidebar}</div>
      {mobileOpen && (
        <div className="national-shell__mobile-sidebar">
          <button
            className="national-shell__sidebar-backdrop"
            type="button"
            aria-label={label('Fermer la navigation')}
            onClick={() => setMobileOpen(false)}
          />
          {sidebar}
        </div>
      )}

      <div className="national-shell__body">



        {/* Le repli de suspense vit dans la zone de contenu : le chargement d'une
            page ne doit pas effacer l'en-tete ni la barre laterale. */}
        <main className="national-shell__content">
          <ChromeContext.Provider key={scopeKey} value={true}>
            <Suspense fallback={<RouteFallback />}>{children ?? <Outlet />}</Suspense>
          </ChromeContext.Provider>
        </main>

        <footer className="national-shell__footer" data-testid="app-footer">
          <span>© {new Date().getFullYear()} FASO SANAMA</span>
          <span className="national-shell__footer-motto">{label('Confidentialité · Intégrité · Transparence')}</span>
        </footer>
      </div>
    </div>
  );
}
