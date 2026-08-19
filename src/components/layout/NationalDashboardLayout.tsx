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
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileErrorBanner } from '@/components/ui/ProfileErrorBanner';
import { cn } from '@/utils/cn';
import { RouteFallback } from '@/components/common/RouteFallback';
import { ALL_GROUPS, NAVIGATION_SECTIONS } from './sidebarNavigation';
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

    ALL_GROUPS.forEach((group) => {
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
  }, [location.pathname]);
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
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (routeGroupId) setOpenGroup(routeGroupId);
  }, [routeGroupId]);

  useEffect(() => {
    etatBarre.groupeOuvert = openGroup;
  }, [openGroup]);

  const navRef = useRef<HTMLElement | null>(null);
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
    return 'Romuald TIEGNAN';
  }, [user?.full_name]);

  const closeMenus = () => {
    setLanguageOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const changeLanguage = async (language: 'fr' | 'en') => {
    await i18n.changeLanguage(language);
    localStorage.setItem('i18nextLng', language);
    setLanguageOpen(false);
  };

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/dashboard' || !location.pathname.startsWith(`${path}/`)) return false;

    const navigationPaths = ALL_GROUPS.flatMap((group) => [
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
    <aside className={cn('national-sidebar', sidebarCollapsed && 'is-collapsed')} aria-label="Navigation principale">
      <div className="national-sidebar__brand">
        <img src="/sonasp_logo.png" alt="SONASP" />
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
        {/* Seul intitule « Tableau de bord » de la barre : la vue nationale consolidee.
            Les vues propres a un module s'appellent « Vue d'ensemble ». */}
        <Link
          to="/dashboard"
          className={cn('national-sidebar__dashboard-link', isActive('/dashboard') && 'is-active')}
          onClick={() => setMobileOpen(false)}
        >
          <span className="national-sidebar__icon" style={{ color: '#e2a100' }}>
            <LayoutDashboard aria-hidden="true" />
          </span>
          <span>Tableau de bord</span>
        </Link>

        {NAVIGATION_SECTIONS.map((section) => (
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
                  className={cn('national-sidebar__group-trigger', groupActive && 'is-current')}
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
    <div className="national-shell">
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
              <h1>Système National de Collecte et du Suivi de la Traçabilité de l’Or</h1>
            </div>
          </div>

          <div className="national-header__actions">
            {/* Le centre d'aide n'etait relie qu'a `Header.tsx`, composant mort
                qu'aucun ecran n'importe : la page etait inatteignable. */}
            <button
              type="button"
              className="national-header__aide"
              onClick={() => navigate('/help')}
              aria-label="Centre d’aide"
              title="Centre d’aide"
            >
              <HelpCircle aria-hidden="true" />
            </button>

            <div className="national-header__popover">
              <button
                type="button"
                className="national-header__language"
                onClick={() => {
                  closeMenus();
                  setLanguageOpen((open) => !open);
                }}
                aria-expanded={languageOpen}
              >
                <Languages aria-hidden="true" />
                <span>{i18n.language?.startsWith('en') ? 'EN' : 'FR'}</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {languageOpen && (
                <div className="national-header__menu national-header__language-menu">
                  <button type="button" onClick={() => changeLanguage('fr')}>Français</button>
                  <button type="button" onClick={() => changeLanguage('en')}>English</button>
                </div>
              )}
            </div>

            <div className="national-header__popover national-header__bell-wrap">
              <button
                type="button"
                className="national-header__icon-button"
                aria-label="Afficher les notifications"
                onClick={() => {
                  closeMenus();
                  setNotificationsOpen((open) => !open);
                }}
                aria-expanded={notificationsOpen}
              >
                <Bell aria-hidden="true" />
                <span className="national-header__badge">3</span>
              </button>
              {notificationsOpen && (
                <div className="national-header__menu national-header__notifications">
                  <strong>Points d’attention</strong>
                  <button type="button" onClick={() => navigate('/sales')}>12 transactions à valider</button>
                  <button type="button" onClick={() => navigate('/artisan-minier/cartes/expirations')}>3 agréments expirent sous 30 jours</button>
                  <button type="button" onClick={() => navigate('/inventory')}>Écart de stock à investiguer</button>
                </div>
              )}
            </div>

            <span className="national-header__separator" aria-hidden="true" />

            <div className="national-header__popover">
              <button
                type="button"
                className="national-header__profile"
                onClick={() => {
                  closeMenus();
                  setProfileOpen((open) => !open);
                }}
                aria-expanded={profileOpen}
              >
                <span className="national-header__avatar"><UserRound aria-hidden="true" /></span>
                <span className="national-header__profile-copy">
                  <strong>{displayName}</strong>
                  <small>{getRoleLabel(user?.role)}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="national-header__menu national-header__profile-menu">
                  <Link to="/profile" onClick={() => setProfileOpen(false)}><Settings aria-hidden="true" /> Mon profil</Link>
                  <button
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
