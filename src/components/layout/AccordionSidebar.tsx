import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
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
  Menu,
  CreditCard,
  Warehouse,
  PackagePlus,
  Sparkles,
  Coins,
  Building2,
  Factory,
  Handshake,
  Store,
  Activity,
  ScanText,
  Lock,
  Award,
  Layers,
  UserPlus,
  CheckCircle,
  AlertTriangle,
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
        // { label: 'Batch Management', path: '/batches', icon: Package, iconColor: 'text-blue-600' }, // Hidden as requested
        { label: t('nav.shippingPreparation'), path: '/shipping/preparation', icon: PackagePlus, iconColor: 'text-emerald-600' },
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
        { label: t('nav.preSales'), path: '/presales', icon: PackagePlus, iconColor: 'text-purple-600' },
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
      id: 'administration',
      label: t('nav.administration'),
      groupIconColor: 'text-red-600',
      groupIcon: Shield,
      items: [
        { label: t('nav.users'), path: '/users', icon: Users, iconColor: 'text-slate-600' },
        { label: t('nav.settings'), path: '/parameters', icon: Settings, iconColor: 'text-orange-600' },
        { label: t('nav.goldSalesSettings'), path: '/admin/gold-sales-settings', icon: Coins, iconColor: 'text-yellow-600' },
        { label: t('nav.statusManager'), path: '/admin/status-manager', icon: Layers, iconColor: 'text-teal-600' },
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
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Start with no groups expanded
    return new Set();
  });

  useEffect(() => {
    const currentPath = location.pathname;
    for (const group of menuGroups) {
      const isInGroup = group.items.some(item =>
        currentPath === item.path || currentPath.startsWith(item.path + '/')
      );
      if (isInGroup) {
        setOpenGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(group.id);
          localStorage.setItem(STORAGE_KEY, group.id);
          return newSet;
        });
        break;
      }
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.clear();
        newSet.add(groupId);
        localStorage.setItem(STORAGE_KEY, groupId);
      }
      return newSet;
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
        'bg-gradient-to-b from-emerald-50/60 via-transparent to-emerald-50/40 h-screen border-r border-emerald-200/30 flex flex-col shadow-xl transition-all duration-300 flex-shrink-0 backdrop-blur-sm',
        collapsed ? 'w-[70px]' : 'w-[280px]'
      )}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-emerald-200/40 bg-gradient-to-r from-emerald-50/50 to-transparent backdrop-blur-sm">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3 w-full">
              <div className="flex-shrink-0">
                <img
                  src="/logo_transparent_sonasp.png"
                  alt="SONASP Logo"
                  className="h-12 w-12 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-[1.3] text-gray-900">
                  <span className="text-red-600 text-[15px]">S</span>ociété{' '}
                  <span className="text-red-600 text-[15px]">N</span>ationale
                  <br />
                  des <span className="text-red-600 text-[15px]">S</span>ubstances{' '}
                  <span className="text-red-600 text-[15px]">N</span>aturelles
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl blur-md opacity-40"></div>
              <img
                src="/logo_transparent_sonasp.png"
                alt="SONASP Logo"
                className="w-10 h-10 object-contain mx-auto relative rounded-xl"
              />
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button with "My Applications" */}
      <div className="px-3 py-3 border-b border-emerald-200/40 bg-gradient-to-r from-emerald-50/30 to-transparent">
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-between px-3 py-2.5 text-slate-700 hover:bg-gradient-to-r hover:from-slate-100/80 hover:to-transparent rounded-xl transition-all duration-300 group"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {!collapsed && (
            <span className="text-sm font-medium tracking-wide">My Applications</span>
          )}
          <Menu className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        {/* Dashboard - Direct Link (Not in Group) */}
        <Link
          to="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2',
            isDashboardActive
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-100/80 hover:to-transparent hover:shadow-sm'
          )}
        >
          {isDashboardActive && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent animate-pulse"></div>
          )}
          <div className={cn(
            'p-1.5 rounded-lg transition-all duration-300 flex-shrink-0',
            isDashboardActive ? 'bg-white/20' : 'bg-blue-50 group-hover:bg-blue-100'
          )}>
            <LayoutDashboard className={cn('w-4 h-4', isDashboardActive ? 'text-white' : 'text-blue-600')} />
          </div>
          {!collapsed && (
            <span className="text-sm font-medium relative z-10 whitespace-nowrap overflow-hidden text-ellipsis">
              {t('nav.dashboard')}
            </span>
          )}
        </Link>

        {/* Menu Groups */}
        {menuGroups.map((group) => {
          const groupItems = Array.isArray(group.items) ? group.items : [];
          const isOpen = openGroups.has(group.id);
          const hasActiveItem = groupItems.some(item => isActive(item.path));

          return (
            <div key={group.id} className="space-y-1">
              {/* Group Header */}
              <button
                onClick={() => !collapsed && toggleGroup(group.id)}
                className={cn(
                  'group w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2',
                  isOpen || hasActiveItem
                    ? 'bg-gradient-to-r from-slate-100/80 to-transparent shadow-sm'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-100/60 hover:to-transparent'
                )}
              >
                <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
                  {group.groupIcon && (
                    <div className={cn(
                      'p-1.5 rounded-lg transition-all duration-300 flex-shrink-0',
                      isOpen || hasActiveItem ? 'bg-white shadow-sm' : 'bg-slate-50 group-hover:bg-white'
                    )}>
                      <group.groupIcon className={cn('w-4 h-4', group.groupIconColor)} />
                    </div>
                  )}
                  {!collapsed && (
                    <span className={cn(
                      'text-sm transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis',
                      isOpen || hasActiveItem ? 'font-medium text-slate-900' : 'font-normal text-slate-700'
                    )}>
                      {group.label}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <div className={cn(
                    'p-1 rounded-lg transition-all duration-300 flex-shrink-0',
                    isOpen ? 'bg-slate-200/50' : 'group-hover:bg-slate-200/30'
                  )}>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                )}
              </button>

              {/* Group Items */}
              {isOpen && !collapsed && (
                <div className="ml-3 pl-4 space-y-1 border-l-2 border-slate-200/60 relative">
                  {/* Gradient line on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {groupItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 group relative overflow-hidden',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2',
                          active
                            ? 'bg-gradient-to-r from-emerald-50 to-emerald-50/50 text-emerald-900 shadow-sm border border-emerald-200/50'
                            : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent hover:translate-x-1'
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-r-full"></div>
                        )}
                        <div className={cn(
                          'p-1 rounded-md transition-all duration-300 relative z-10 flex-shrink-0',
                          active ? 'bg-emerald-100/80' : 'bg-slate-50 group-hover:bg-slate-100'
                        )}>
                          <item.icon className={cn('w-3.5 h-3.5', active ? 'text-emerald-600' : item.iconColor)} />
                        </div>
                        <span className={cn(
                          'text-sm transition-all duration-300 relative z-10 whitespace-nowrap overflow-hidden text-ellipsis',
                          active ? 'font-medium' : 'font-normal'
                        )}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200/60 bg-white/30">
        {!collapsed && (
          <p className="text-xs text-slate-500 text-center font-medium">
            © 2025 Mansa Resources
          </p>
        )}
      </div>
    </aside>
  );
}
