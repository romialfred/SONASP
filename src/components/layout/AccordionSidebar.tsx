import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  FlaskConical,
  Users,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  BarChart3,
  FileText,
  Settings,
  Shield,
  GitBranch,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Warehouse,
  Sparkles,
  Coins,
  Factory,
  Handshake,
  Store,
  Activity,
  ScanText,
  Lock,
  Award,
  Layers,
  CheckCircle,
  AlertTriangle,
  Ship,
  Grid,
  MapPinned,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
  groupIconColor: string;
  groupIcon?: React.ComponentType<{ className?: string }>;
}

const useMenuGroups = (): MenuGroup[] => {
  const { t, i18n } = useTranslation();

  return useMemo(() => [
    {
      id: 'artisan-minier',
      label: t('nav.artisanMinier'),
      groupIconColor: 'text-emerald-700',
      groupIcon: Users,
      items: [
        { label: t('nav.artisanDashboard'), path: '/artisan-minier', icon: LayoutDashboard, iconColor: 'text-emerald-700' },
        { label: t('nav.listeArtisans'), path: '/artisan-minier/liste', icon: Users, iconColor: 'text-blue-600' },
        { label: t('nav.suiviCartes'), path: '/artisan-minier/cartes/suivi', icon: TrendingUp, iconColor: 'text-purple-600' },
        { label: t('nav.validationCartes'), path: '/artisan-minier/cartes/validation', icon: CheckCircle, iconColor: 'text-indigo-600' },
        { label: t('nav.expirations'), path: '/artisan-minier/cartes/expirations', icon: AlertTriangle, iconColor: 'text-orange-600' },
        { label: 'Ventes d\'Or', path: '/artisan-minier/ventes-or', icon: Coins, iconColor: 'text-yellow-600' },
        { label: 'Paiements des Ventes', path: '/artisan-minier/paiements', icon: DollarSign, iconColor: 'text-green-600' },
        { label: 'Rapports & Analyses', path: '/artisan-minier/rapports', icon: BarChart3, iconColor: 'text-blue-600' },
      ],
    },
    {
      id: 'artisanal-sites',
      label: t('nav.artisanalSites'),
      groupIconColor: 'text-emerald-600',
      groupIcon: MapPinned,
      items: [
        { label: t('nav.artisanalSitesOverview'), path: '/artisan-sites', icon: Grid, iconColor: 'text-emerald-600' },
        { label: t('nav.artisanalSiteProduction'), path: '/artisan-sites/production', icon: Factory, iconColor: 'text-amber-600' },
      ],
    },
    {
      id: 'production',
      label: t('nav.productionManagement'),
      groupIconColor: 'text-emerald-600',
      groupIcon: Factory,
      items: [
        { label: t('nav.dailyProduction'), path: '/production/daily', icon: Activity, iconColor: 'text-emerald-600' },
        { label: t('nav.productionInSafe'), path: '/production/in-safe', icon: Lock, iconColor: 'text-yellow-600' },
        { label: t('nav.exportLicenses'), path: '/production/licenses', icon: Award, iconColor: 'text-purple-600' },
        { label: t('nav.budgetForecasts'), path: '/performance/budgets', icon: TrendingUp, iconColor: 'text-blue-600' },
      ],
    },
    {
      id: 'shipping',
      label: t('nav.shippingManagement'),
      groupIconColor: 'text-blue-600',
      groupIcon: Truck,
      items: [
        { label: t('nav.shippingPreparation'), path: '/shipping/preparation', icon: Ship, iconColor: 'text-blue-600' },
        { label: t('nav.invoiceConsignment'), path: '/freight', icon: Truck, iconColor: 'text-cyan-600' },
      ],
    },
    {
      id: 'refining',
      label: t('nav.refining'),
      groupIconColor: 'text-teal-600',
      groupIcon: FlaskConical,
      items: [
        { label: t('nav.refiningProcess'), path: '/refining', icon: FlaskConical, iconColor: 'text-teal-600' },
      ],
    },
    {
      id: 'refinery-inventory',
      label: t('nav.inventoryMonitoring'),
      groupIconColor: 'text-emerald-600',
      groupIcon: Warehouse,
      items: [
        { label: t('nav.goldInventory'), path: '/inventory', icon: Coins, iconColor: 'text-yellow-600' },
        { label: t('nav.silverInventory'), path: '/inventory/silver', icon: Sparkles, iconColor: 'text-slate-500' },
      ],
    },
    {
      id: 'documents',
      label: t('nav.documentManagement'),
      groupIconColor: 'text-violet-600',
      groupIcon: FileText,
      items: [
        { label: t('nav.assayCertificates'), path: '/documents/assay-certificates', icon: ScanText, iconColor: 'text-violet-600' },
      ],
    },
    {
      id: 'marketplace',
      label: t('nav.marketplace'),
      groupIconColor: 'text-orange-600',
      groupIcon: Store,
      items: [
        { label: t('nav.tradeSpace'), path: '/sales/trade-space', icon: Store, iconColor: 'text-emerald-600' },
        { label: t('nav.goldPrices'), path: '/gold-prices', icon: TrendingUp, iconColor: 'text-orange-600' },
        { label: t('nav.fxRates'), path: '/fx-rates', icon: DollarSign, iconColor: 'text-emerald-600' },
      ],
    },
    {
      id: 'sales',
      label: t('nav.sales'),
      groupIconColor: 'text-pink-600',
      groupIcon: ShoppingCart,
      items: [
        { label: t('nav.sales'), path: '/sales', icon: ShoppingCart, iconColor: 'text-pink-600' },
        { label: t('nav.payments'), path: '/payments', icon: CreditCard, iconColor: 'text-green-600' },
      ],
    },
    {
      id: 'stakeholders',
      label: t('nav.stakeholders'),
      groupIconColor: 'text-teal-600',
      groupIcon: Handshake,
      items: [
        { label: t('nav.miningCompanies'), path: '/stakeholders/mining-companies', icon: Factory, iconColor: 'text-emerald-700' },
        { label: t('nav.freightCompanies'), path: '/stakeholders/freight-companies', icon: Truck, iconColor: 'text-blue-700' },
        { label: t('nav.refineryPlants'), path: '/stakeholders/refinery-plants', icon: FlaskConical, iconColor: 'text-purple-700' },
        { label: t('nav.depositors'), path: '/stakeholders/depositors', icon: Shield, iconColor: 'text-emerald-700' },
        { label: t('nav.customers'), path: '/customers', icon: Users, iconColor: 'text-teal-700' },
      ],
    },
    {
      id: 'insights',
      label: t('nav.insights'),
      groupIconColor: 'text-blue-600',
      groupIcon: BarChart3,
      items: [
        { label: t('nav.analytics'), path: '/analytics', icon: BarChart3, iconColor: 'text-blue-600' },
        { label: t('nav.reports'), path: '/reports', icon: FileText, iconColor: 'text-indigo-600' },
      ],
    },
    {
      id: 'settings',
      label: t('nav.configuration'),
      groupIconColor: 'text-amber-500',
      groupIcon: SlidersHorizontal,
      items: [
        { label: t('nav.goldSalesSettings'), path: '/admin/gold-sales-settings', icon: Coins, iconColor: 'text-yellow-500' },
        { label: t('nav.statusSettings'), path: '/admin/status-manager', icon: Layers, iconColor: 'text-teal-500' },
      ],
    },
    {
      id: 'administration',
      label: t('nav.administration'),
      groupIconColor: 'text-red-600',
      groupIcon: Shield,
      items: [
        { label: t('nav.users'), path: '/users', icon: Users, iconColor: 'text-slate-600' },
        { label: t('nav.settings'), path: '/parameters', icon: Settings, iconColor: 'text-orange-600' },
        { label: t('nav.workflow'), path: '/admin/workflow', icon: GitBranch, iconColor: 'text-sky-600' },
        { label: t('nav.audit'), path: '/audit', icon: Shield, iconColor: 'text-red-600' },
      ],
    },
  ], [t, i18n.language]);
};

const STORAGE_KEY = 'sidebar:lastGroup';
const COLLAPSED_KEY = 'sidebar:collapsed';

interface AccordionSidebarProps {
  onToggle?: (collapsed: boolean) => void;
}

export function AccordionSidebar({ onToggle }: AccordionSidebarProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const menuGroups = useMenuGroups();
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    return stored === 'true';
  });
  const [openGroup, setOpenGroup] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );
  const routeGroupId = useMemo(() => {
    const currentPath = location.pathname;
    return menuGroups.find((group) =>
      group.items.some((item) =>
        currentPath === item.path || currentPath.startsWith(item.path + '/')
      )
    )?.id ?? null;
  }, [location.pathname, menuGroups]);

  useEffect(() => {
    if (routeGroupId) {
      setOpenGroup(routeGroupId);
      localStorage.setItem(STORAGE_KEY, routeGroupId);
    }
  }, [location.pathname, routeGroupId]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) {
      setCollapsed(false);
      localStorage.setItem(COLLAPSED_KEY, 'false');
      onToggle?.(false);
      setOpenGroup(groupId);
      localStorage.setItem(STORAGE_KEY, groupId);
      return;
    }

    setOpenGroup((current) => {
      const next = current === groupId ? null : groupId;
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
      return next;
    });
  };

  const toggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem(COLLAPSED_KEY, String(newCollapsed));
    onToggle?.(newCollapsed);
  };

  const isActive = (path: string) => {
    const currentPath = location.pathname;

    // Exact match first
    if (currentPath === path) {
      return true;
    }

    // For paths with sub-routes, check if it starts with path + '/'
    if (currentPath.startsWith(path + '/')) {
      // Find the current group
      const currentGroup = menuGroups.find(group =>
        group.items.some(item => item.path === path)
      );

      // Check if there's a more specific match in the same group
      if (currentGroup) {
        const hasMoreSpecificMatch = currentGroup.items.some(item =>
          item.path !== path &&
          (currentPath === item.path || currentPath.startsWith(item.path + '/'))
        );

        // Only return true if there's no more specific match
        return !hasMoreSpecificMatch;
      }

      return true;
    }

    return false;
  };

  const isDashboardActive = isActive('/dashboard');

  return (
    <aside
      className={cn(
        'h-screen flex flex-col flex-shrink-0 overflow-hidden border-r border-[#28524a] bg-[#123b35] text-white shadow-[8px_0_28px_rgba(15,49,44,0.12)] transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[244px]'
      )}
      aria-label="Navigation principale"
    >
      <div className="flex h-[76px] flex-shrink-0 items-center border-b border-white/10 px-4">
        <img
          src="/sonasp_logo.png"
          alt="SONASP"
          className={cn('object-contain', collapsed ? 'h-10 w-10 object-left' : 'h-[48px] w-[142px]')}
        />
      </div>

      <div className="flex h-[58px] flex-shrink-0 items-center justify-between px-5">
        {!collapsed && <span className="text-[11px] font-semibold tracking-[0.12em] text-emerald-100/70">MES APPLICATIONS</span>}
      </div>

      <nav className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-gutter:stable]">
        <Link
          to="/dashboard"
          className={cn(
            'relative flex h-12 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-inset',
            isDashboardActive
              ? 'bg-[#08705f] text-white shadow-[0_8px_20px_rgba(2,25,22,0.22)] before:absolute before:inset-y-2 before:right-0 before:w-1 before:rounded-l-full before:bg-amber-400'
              : 'text-emerald-50/85 hover:bg-white/[0.07] hover:text-white'
          )}
          aria-current={isDashboardActive ? 'page' : undefined}
          title={collapsed ? t('nav.dashboard') : undefined}
        >
          <LayoutDashboard className={cn('h-5 w-5 flex-shrink-0', isDashboardActive ? 'text-white' : 'text-emerald-300')} aria-hidden="true" />
          {!collapsed && (
            <span className="min-w-0 truncate">{t('nav.dashboard')}</span>
          )}
        </Link>

        {menuGroups.map((group) => {
          const groupItems = Array.isArray(group.items) ? group.items : [];
          const isOpen = openGroup === group.id;
          const hasActiveItem = groupItems.some(item => isActive(item.path));

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[13px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-inset',
                  isOpen || hasActiveItem
                    ? 'bg-white/10 font-semibold text-white'
                    : 'text-emerald-50/85 hover:bg-white/[0.07] hover:text-white'
                )}
                aria-expanded={isOpen}
                aria-controls={`sidebar-group-${group.id}`}
                title={collapsed ? group.label : undefined}
              >
                {group.groupIcon && <group.groupIcon className="h-5 w-5 flex-shrink-0 text-emerald-300" aria-hidden="true" />}
                {!collapsed && (
                  <>
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={group.label}
                    >
                      {group.label}
                    </span>
                    {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                  </>
                )}
              </button>

              {isOpen && !collapsed && (
                <div id={`sidebar-group-${group.id}`} className="relative ml-[22px] border-l border-emerald-200/20 py-1 pl-3">
                  {groupItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex min-h-10 items-center gap-3 rounded-lg px-3 text-xs transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-inset',
                          active
                            ? 'bg-emerald-200/[0.15] font-semibold text-white'
                            : 'text-emerald-50/65 hover:bg-white/[0.07] hover:text-white'
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <item.icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-amber-300' : 'text-emerald-300/80')} aria-hidden="true" />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-emerald-100/70 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-inset"
          aria-label={collapsed ? 'Déployer le menu' : 'Réduire le menu'}
          title={collapsed ? 'Déployer le menu' : undefined}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5 flex-shrink-0" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5 flex-shrink-0" aria-hidden="true" />}
          {!collapsed && <span>Réduire le menu</span>}
        </button>
        {!collapsed && <p className="mt-2 text-center text-[11px] text-emerald-100/45">© 2026 SONASP</p>}
      </div>
    </aside>
  );
}
