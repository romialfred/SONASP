import { ReactNode, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  FlaskConical,
  Grid2X2,
  Languages,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPinned,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileErrorBanner } from '@/components/ui/ProfileErrorBanner';
import { cn } from '@/utils/cn';
import './national-dashboard-layout.css';

type NavigationItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
};

type NavigationGroup = NavigationItem & {
  id: string;
  children?: NavigationItem[];
};

const artisanItems: NavigationItem[] = [
  { label: 'Tableau de Bord', path: '/artisan-minier', icon: Grid2X2, color: '#10976b' },
  { label: 'Liste des Artisans', path: '/artisan-minier/liste', icon: Users, color: '#2f6fec' },
  { label: 'Suivi des Cartes', path: '/artisan-minier/cartes/suivi', icon: TrendingUp, color: '#8b5cf6' },
  { label: 'Validation Cartes', path: '/artisan-minier/cartes/validation', icon: CheckCircle2, color: '#635bff' },
  { label: 'Expirations', path: '/artisan-minier/cartes/expirations', icon: AlertTriangle, color: '#f36b21' },
  { label: "Ventes d'Or", path: '/artisan-minier/ventes-or', icon: CircleDollarSign, color: '#d79a00' },
  { label: 'Paiements des Ventes', path: '/artisan-minier/paiements', icon: CircleDollarSign, color: '#16a363' },
  { label: 'Rapports & Analyses', path: '/artisan-minier/rapports', icon: BarChart3, color: '#2f6fec' },
];

const navigationGroups: NavigationGroup[] = [
  {
    id: 'artisan-minier',
    label: 'Artisans Miniers',
    path: '/artisan-minier',
    icon: Users,
    color: '#10976b',
    children: artisanItems,
  },
  {
    id: 'artisanal-sites',
    label: 'Gestion des sites artisanaux',
    path: '/artisan-sites',
    icon: MapPinned,
    color: '#21c995',
    children: [
      { label: "Vue d'ensemble", path: '/artisan-sites', icon: Grid2X2, color: '#21c995' },
      { label: 'Ajouter un site', path: '/artisan-sites/nouveau', icon: MapPinned, color: '#2f6fec' },
      { label: 'Production des sites', path: '/artisan-sites/production', icon: Building2, color: '#d79a00' },
    ],
  },
  { id: 'production', label: "Collecte de l'Or", path: '/production/daily', icon: Building2, color: '#10976b' },
  { id: 'shipping', label: 'Expéditions', path: '/shipping/preparation', icon: Truck, color: '#2f6fec' },
  { id: 'refining', label: 'Raffinage', path: '/refining', icon: FlaskConical, color: '#10976b' },
  { id: 'inventory', label: 'Suivi des Stocks', path: '/inventory', icon: PackageCheck, color: '#10976b' },
  { id: 'documents', label: 'Documents', path: '/documents/assay-certificates', icon: FileText, color: '#8b5cf6' },
  { id: 'market', label: 'Marché', path: '/sales/trade-space', icon: CircleDollarSign, color: '#f59e0b' },
  { id: 'sales', label: 'Ventes', path: '/sales', icon: CircleDollarSign, color: '#ec4899' },
  { id: 'stakeholders', label: 'Parties prenantes', path: '/stakeholders/mining-companies', icon: Users, color: '#14b8a6' },
  { id: 'analytics', label: 'Analyses', path: '/analytics', icon: TrendingUp, color: '#3b82f6' },
  {
    id: 'settings',
    label: 'Paramétrage',
    path: '/admin/gold-sales-settings',
    icon: SlidersHorizontal,
    color: '#f59e0b',
    children: [
      { label: 'Paramètres des ventes', path: '/admin/gold-sales-settings', icon: CircleDollarSign, color: '#d79a00' },
      { label: 'Paramètres des statuts', path: '/admin/status-manager', icon: Layers, color: '#14b8a6' },
    ],
  },
  { id: 'administration', label: 'Administration', path: '/users', icon: Settings, color: '#f97316' },
];

interface NationalDashboardLayoutProps {
  children: ReactNode;
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
  const { i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sidebar:collapsed') === 'true'
  );
  const routeGroupId = useMemo(
    () =>
      navigationGroups.find((group) =>
        group.children?.some(
          (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        )
      )?.id || null,
    [location.pathname]
  );
  const [openGroup, setOpenGroup] = useState<string | null>(() => routeGroupId);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (routeGroupId) setOpenGroup(routeGroupId);
  }, [routeGroupId]);

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
    <aside className={cn('national-sidebar', sidebarCollapsed && 'is-collapsed')} aria-label="Navigation principale">
      <div className="national-sidebar__brand">
        <img src="/sonasp_logo.png" alt="SONASP" />
      </div>

      <div className="national-sidebar__section-title">
        <span>MES APPLICATIONS</span>
      </div>

      <nav className="national-sidebar__navigation">
        <Link
          to="/dashboard"
          className={cn('national-sidebar__dashboard-link', isActive('/dashboard') && 'is-active')}
          onClick={() => setMobileOpen(false)}
        >
          <LayoutDashboard aria-hidden="true" />
          <span>Tableau de bord</span>
        </Link>

        {navigationGroups.map((group) => {
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
                  onClick={() => {
                    if (sidebarCollapsed) {
                      setSidebarCollapsed(false);
                      localStorage.setItem('sidebar:collapsed', 'false');
                      setOpenGroup(group.id);
                      return;
                    }
                    setOpenGroup((current) => current === group.id ? null : group.id);
                  }}
                  aria-expanded={isOpen}
                >
                  <Icon style={{ color: group.color }} aria-hidden="true" />
                  <span className={cn(group.id === 'artisanal-sites' && 'text-[9px] font-semibold tracking-[-0.01em]')} title={group.label}>{group.label}</span>
                  {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                </button>
                {isOpen && (
                  <div className="national-sidebar__subnav">
                    {group.children?.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          to={item.path}
                          key={item.path}
                          className={cn(isActive(item.path) && 'is-current')}
                          onClick={() => setMobileOpen(false)}
                        >
                          <ItemIcon style={{ color: item.color }} aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
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
              className={cn('national-sidebar__group-trigger national-sidebar__group-link', groupActive && 'is-current')}
              key={group.path}
              onClick={() => setMobileOpen(false)}
            >
              <Icon style={{ color: group.color }} aria-hidden="true" />
              <span>{group.label}</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className="national-sidebar__footer">
        <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'}>
          {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          <span>{sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'}</span>
        </button>
        <small>© 2026 SONASP</small>
      </div>
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
            <span className="national-header__accent" aria-hidden="true" />
            <div>
              <h1>Plateforme Nationale de Collecte et de Suivi des Ventes d’Or</h1>
              <p>Transparence, traçabilité et pilotage stratégique de la filière aurifère</p>
            </div>
          </div>

          <div className="national-header__actions">
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

        <main className="national-shell__content">{children}</main>
      </div>
    </div>
  );
}
