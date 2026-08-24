import {
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
import { useTranslation } from 'react-i18next';
import {
  Bell,
  HelpCircle,
  ChevronDown,
  Languages,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  UserRound,
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
    owner: 'Owner',
    admin: 'Administrateur',
    management: 'Direction',
    factory: 'Site de production',
    airport: 'Expéditions',
    refinery: 'Raffinerie',
    customer: 'Utilisateur',
    mine: 'Société minière',
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMine, companyName, companyCode } = useMineWorkspace();
  const {
    isComptoir,
    workspace: comptoirWorkspace,
    displayName: comptoirDisplayName,
  } = useComptoirWorkspace();
  const { isCollector, workspace: collectorWorkspace } = useCollectorWorkspace();
  const mineDisplayName = companyCode || companyName;
  const collectorDisplayName = collectorWorkspace?.collectorName || 'Collecteur d’or';
  const navigationSections = useMemo(() => {
    const sections = getNavigationSectionsForUser(user);
    if (!isMine) return sections;

    const order = [
      'production',
      'inventory',
      'shipping',
      'sales',
      'refining',
      'market',
      'stakeholders',
      'achats-industriels',
      'documents',
    ];
    const labels: Record<string, string> = {
      production: 'Gestion de la production',
      inventory: 'Gestion des stocks',
      shipping: 'Gestion des expéditions',
      sales: 'Gestion des ventes',
      refining: 'Raffinerie',
      market: 'Marché de l’or',
      stakeholders: 'Parties prenantes',
      'achats-industriels': 'Relations avec la SONASP',
      documents: 'Documents et rapports',
    };

    return sections.map((section): NavigationSection => ({
      ...section,
      title: 'Mon espace',
      groups: [...section.groups]
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        .map((group) => ({ ...group, label: labels[group.id] || group.label })),
    }));
  }, [isMine, user]);
  const navigationGroups = useMemo(
    () => navigationSections.flatMap((section) => section.groups),
    [navigationSections]
  );
  const mineHomePath = '/portail-mine';
  const mineDashboardPath = '/portail-mine?vue=tableau-de-bord';
  const dashboardPath = isCollector
    ? '/portail-collecteur'
    : isComptoir
      ? '/portail-comptoir'
      : isMine
        ? mineDashboardPath
        : '/dashboard';
  const mineDashboardActive = isMine
    && location.pathname === mineHomePath
    && new URLSearchParams(location.search).get('vue') === 'tableau-de-bord';
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  /* La cloche ne dit que ce que la base contient. Un compteur inventé, affiché
     sur chaque écran, est le plus visible des indicateurs faux. */
  const chargerNotifications = useCallback(async () => {
    try {
      const [liste, resume] = await Promise.all([
        notificationsService.lister({ limite: 8 }),
        notificationsService.resume(),
      ]);
      setNotifications(liste);
      setResumeNotifications(resume);
    } catch {
      // Une cloche muette vaut mieux qu'une cloche qui ment.
      setNotifications([]);
      setResumeNotifications({ non_lues: 0, urgentes: 0, hautes: 0, plus_ancienne: null });
    }
  }, []);

  useEffect(() => {
    void chargerNotifications();
  }, [chargerNotifications]);
  const [resumeNotifications, setResumeNotifications] = useState<ResumeNotifications>({
    non_lues: 0, urgentes: 0, hautes: 0, plus_ancienne: null,
  });
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

  const changeLanguage = async (language: 'fr' | 'en') => {
    await i18n.changeLanguage(language);
    localStorage.setItem('i18nextLng', language);
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
    <aside className={cn(
      'national-sidebar',
      isMine && 'is-mine',
      isComptoir && 'is-comptoir',
      isCollector && 'is-collector',
      sidebarCollapsed && 'is-collapsed',
    )} aria-label="Navigation principale">
      <div className="national-sidebar__brand">
        <img src="/sonasp_logo.png" alt="SONASP" />
        {(isMine || isComptoir || isCollector) && !sidebarCollapsed && (
          <span
            className="national-sidebar__mine-name"
            title={(isCollector ? collectorWorkspace?.collectorName : isComptoir ? comptoirWorkspace?.name : companyName) || undefined}
          >
            {isCollector ? collectorDisplayName : isComptoir ? comptoirDisplayName : mineDisplayName}
          </span>
        )}
      </div>

      <div className="national-sidebar__section-title">
        <span>NAVIGATION</span>
        <button
          type="button"
          className="national-sidebar__collapse"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'}
          title={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'}
        >
          {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      </div>

      <nav className="national-sidebar__navigation" ref={rattacherNavigation} onScroll={memoriserDefilement}>
        {isMine && (
          <Link
            to={mineHomePath}
            className={cn('national-sidebar__dashboard-link', !mineDashboardActive && 'is-active')}
            onClick={() => setMobileOpen(false)}
          >
            <span className="national-sidebar__icon" style={{ color: '#0f8b62' }}>
              <Home aria-hidden="true" />
            </span>
            <span>Accueil</span>
          </Link>
        )}
        <Link
          to={dashboardPath}
          className={cn(
            'national-sidebar__dashboard-link',
            isMine ? mineDashboardActive && 'is-active' : isActive(dashboardPath) && 'is-active'
          )}
          onClick={() => setMobileOpen(false)}
        >
          <span className="national-sidebar__icon" style={{ color: '#e2a100' }}>
            <LayoutDashboard aria-hidden="true" />
          </span>
          <span>Tableau de bord</span>
        </Link>

        {navigationSections.map((section) => (
          <section className="national-sidebar__section" key={section.id} aria-label={section.title}>
            <h2 className="national-sidebar__section-heading">{section.title}</h2>

            {section.groups.map((group) => {
              const Icon = group.icon;
              const hasChildren = Boolean(group.children?.length);
              const groupActive = isActive(group.path) || Boolean(group.children?.some((item) => isActive(item.path)));
              const isOpen = openGroup === group.id;

          if (hasChildren) {
            return (
              <div className="national-sidebar__group" key={group.label}>
                <button
                  type="button"
                  className={cn(
                    'national-sidebar__group-trigger',
                    !isMine && !isComptoir && ['market', 'sales'].includes(group.id)
                      && 'national-sidebar__group-trigger--compact',
                    groupActive && 'is-current'
                  )}
                  onClick={(evenement) => basculerGroupe(group.id, evenement.currentTarget)}
                  aria-expanded={isOpen}
                >
                  <span className="national-sidebar__icon" style={{ color: group.color }}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span title={group.label}>{group.label}</span>
                  {/* Plus quand le groupe est replie, moins quand il est deplie :
                      le signe decrit l'action offerte, pas l'etat courant. */}
                  {isOpen ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
                </button>
                {isOpen && (
                  <div className="national-sidebar__subnav">
                    {/* Une puce claire remplace l'icone de module : a ce niveau, dix
                        icones de dix couleurs se lisaient comme dix alertes. */}
                    {group.children?.map((item) => (
                      <Link
                        to={item.path}
                        key={item.path}
                        className={cn(isActive(item.path) && 'is-current')}
                        onClick={() => setMobileOpen(false)}
                      >
                        <i className="national-sidebar__puce" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

              return (
                <Link
                  to={group.path}
                  className={cn('national-sidebar__group-trigger national-sidebar__group-link', groupActive && 'is-current')}
                  key={group.id}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="national-sidebar__icon" style={{ color: group.color }}>
                    <Icon aria-hidden="true" />
                  </span>
                  {/* Ni plus ni chevron : cette entree n'a pas de sous-menu a deplier, et le
                      signe promettait un repli qui n'existait pas. La place gagnee revient
                      a l'intitule, qui doit tenir sur une seule ligne. */}
                  <span>{group.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>

    </aside>
  );

  return (
    <div className={cn(
      'national-shell',
      isMine && 'is-mine',
      isComptoir && 'is-comptoir',
      isCollector && 'is-collector',
    )}>
      <ProfileErrorBanner />
      <div className={cn('national-shell__desktop-sidebar', sidebarCollapsed && 'is-collapsed')}>{sidebar}</div>
      {mobileOpen && (
        <div className="national-shell__mobile-sidebar">
          <button
            className="national-shell__sidebar-backdrop"
            type="button"
            aria-label="Fermer la navigation"
            onClick={() => setMobileOpen(false)}
          />
          {sidebar}
        </div>
      )}

      <div className="national-shell__body">
        <header className="national-header">
          <button
            type="button"
            className="national-header__mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir la navigation"
          >
            <Menu aria-hidden="true" />
          </button>

          <div className="national-header__identity">
            <div>
              {isCollector ? (
                <>
                  <p className="national-header__eyebrow">Espace collecteur d’or</p>
                  <h1 title={collectorWorkspace?.collectorName}>{collectorDisplayName}</h1>
                </>
              ) : isComptoir ? (
                <>
                  <p className="national-header__eyebrow">Espace comptoir d’or</p>
                  <h1 title={comptoirWorkspace?.name}>{comptoirDisplayName}</h1>
                </>
              ) : isMine ? (
                <>
                  <p className="national-header__eyebrow">Espace société minière</p>
                  <h1 title={companyName || undefined}>{mineDisplayName}</h1>
                </>
              ) : (
                <>
                  <h1>Plateforme SONASP</h1>
                  <p>Collecte, traçabilité et valorisation de l’or</p>
                </>
              )}
            </div>
          </div>

          <div className="national-header__actions" ref={headerActionsRef}>
            <div className="national-header__popover">
              <button
                type="button"
                className="national-header__language"
                onClick={toggleLanguageMenu}
                aria-expanded={languageOpen}
                aria-haspopup="menu"
                aria-controls="language-menu"
              >
                <Languages aria-hidden="true" />
                <span>{i18n.language?.startsWith('en') ? 'EN' : 'FR'}</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {languageOpen && (
                <div id="language-menu" role="menu" className="national-header__menu national-header__language-menu">
                  <button role="menuitem" type="button" onClick={() => changeLanguage('fr')}>Français</button>
                  <button role="menuitem" type="button" onClick={() => changeLanguage('en')}>English</button>
                </div>
              )}
            </div>

            <div className="national-header__popover national-header__bell-wrap">
              <button
                type="button"
                className="national-header__icon-button"
                aria-label="Afficher les notifications"
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
                        Tout marquer comme lu
                      </button>
                    )}
                  </header>

                  {notifications.length === 0 ? (
                    <p className="national-header__vide">
                      Rien à signaler pour le moment.
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
                aria-label="Ouvrir le menu utilisateur"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-controls="profile-menu"
              >
                <span className="national-header__avatar"><UserRound aria-hidden="true" /></span>
                <span className="national-header__profile-copy">
                  <strong>{displayName}</strong>
                  <small>{isCollector ? 'Collecteur d’or' : isComptoir ? 'Comptoir d’or' : getRoleLabel(user?.role)}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {profileOpen && (
                <div id="profile-menu" role="menu" className="national-header__menu national-header__profile-menu">
                  <Link role="menuitem" to="/profile" onClick={() => setProfileOpen(false)}><Settings aria-hidden="true" /> Mon profil</Link>
                  <Link role="menuitem" to="/help" onClick={() => setProfileOpen(false)}><HelpCircle aria-hidden="true" /> Documentation</Link>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={async () => {
                      await signOut();
                      navigate('/login');
                    }}
                  >
                    <LogOut aria-hidden="true" /> Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="national-header__mobile-close"
            aria-label="Fermer les menus"
            onClick={closeMenus}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        {/* Le repli de suspense vit dans la zone de contenu : le chargement d'une
            page ne doit pas effacer l'en-tete ni la barre laterale. */}
        <main className="national-shell__content">
          <ChromeContext.Provider value={true}>
            <Suspense fallback={<RouteFallback />}>{children ?? <Outlet />}</Suspense>
          </ChromeContext.Provider>
        </main>

        <footer className="national-shell__footer">
          <span>© {new Date().getFullYear()} SONASP — Société Nationale des Substances Précieuses</span>
          <span className="national-shell__footer-motto">Confidentialité · Intégrité · Transparence</span>
        </footer>
      </div>
    </div>
  );
}
