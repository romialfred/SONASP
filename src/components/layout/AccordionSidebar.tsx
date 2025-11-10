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
  Award,
  FileCheck,
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
      id: 'licenses',
      label: 'License Management',
      groupIconColor: 'text-amber-600',
      groupIcon: Award,
      items: [
        { label: 'License Requests', path: '/licenses/requests', icon: FileCheck, iconColor: 'text-blue-600' },
        { label: 'Issued Licenses', path: '/licenses', icon: Award, iconColor: 'text-amber-600' },
      ],
    },
    {
      id: 'shipping',
      label: 'Shipping Management',
      groupIconColor: 'text-emerald-600',
      groupIcon: Truck,
      items: [
        { label: 'Daily Production', path: '/production/daily', icon: Activity, iconColor: 'text-emerald-600' },
        { label: 'Batch Management', path: '/batches', icon: Package, iconColor: 'text-blue-600' },
        { label: 'Shipping Preparation', path: '/assay-certificates', icon: ScanText, iconColor: 'text-violet-600' },
        { label: 'Freight & Customs', path: '/shipping', icon: Truck, iconColor: 'text-cyan-600' },
      ],
    },
    {
      id: 'refinery-inventory',
      label: 'Inventory Monitoring',
      groupIconColor: 'text-amber-600',
      groupIcon: Warehouse,
      items: [
        { label: t('inventory.goldInventory'), path: '/inventory', icon: Coins, iconColor: 'text-yellow-600' },
        { label: t('inventory.silverInventory'), path: '/inventory/silver', icon: Sparkles, iconColor: 'text-slate-500' },
      ],
    },
    {
      id: 'refining',
      label: t('refining.title'),
      groupIconColor: 'text-teal-600',
      groupIcon: FlaskConical,
      items: [
        { label: 'Refining Process', path: '/refining', icon: FlaskConical, iconColor: 'text-teal-600' },
      ],
    },
    {
      id: 'performance',
      label: 'Budget & Forecast',
      groupIconColor: 'text-blue-600',
      groupIcon: TrendingUp,
      items: [
        { label: 'Production Forecasts', path: '/performance/forecasts', icon: TrendingUp, iconColor: 'text-blue-600' },
        { label: 'Performance Analysis', path: '/performance/analysis', icon: BarChart3, iconColor: 'text-purple-600' },
      ],
    },
    {
      id: 'marketplace',
      label: t('marketplace.title'),
      groupIconColor: 'text-orange-600',
      groupIcon: Store,
      items: [
        { label: t('marketplace.tradeSpace'), path: '/sales/trade-space', icon: Store, iconColor: 'text-amber-600' },
        { label: t('prices.goldPrices'), path: '/gold-prices', icon: TrendingUp, iconColor: 'text-orange-600' },
        { label: t('prices.fxRates'), path: '/fx-rates', icon: DollarSign, iconColor: 'text-emerald-600' },
      ],
    },
    {
      id: 'sales',
      label: t('sales.title'),
      groupIconColor: 'text-pink-600',
      groupIcon: ShoppingCart,
      items: [
        { label: 'Pre-Sales', path: '/presales', icon: PackagePlus, iconColor: 'text-purple-600' },
        { label: t('nav.sales'), path: '/sales', icon: ShoppingCart, iconColor: 'text-pink-600' },
        { label: t('payments.title'), path: '/payments', icon: CreditCard, iconColor: 'text-green-600' },
      ],
    },
    {
      id: 'stakeholders',
      label: t('stakeholders.title'),
      groupIconColor: 'text-teal-600',
      groupIcon: Handshake,
      items: [
        { label: t('stakeholders.miningCompanies'), path: '/stakeholders/mining-companies', icon: Factory, iconColor: 'text-amber-700' },
        { label: t('stakeholders.freightCompanies'), path: '/stakeholders/freight-companies', icon: Truck, iconColor: 'text-blue-700' },
        { label: t('stakeholders.refineryPlants'), path: '/stakeholders/refinery-plants', icon: FlaskConical, iconColor: 'text-purple-700' },
        { label: t('nav.customers'), path: '/customers', icon: Users, iconColor: 'text-teal-700' },
      ],
    },
    {
      id: 'insights',
      label: t('reportsAnalytics.title'),
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
        { label: t('admin.userManagement'), path: '/users', icon: Users, iconColor: 'text-slate-600' },
        { label: t('admin.parameters'), path: '/parameters', icon: Settings, iconColor: 'text-orange-600' },
        { label: t('workflow.title'), path: '/admin/workflow', icon: GitBranch, iconColor: 'text-sky-600' },
        { label: t('audit.title'), path: '/audit', icon: Shield, iconColor: 'text-red-600' },
      ],
    },
  ], [i18n.language]);
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
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set([stored]) : new Set();
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
        'bg-white/30 backdrop-blur-md h-screen border-r border-gray-200 flex flex-col shadow-lg transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[70px]' : 'w-[280px]'
      )}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img
                src="/image.png"
                alt="Mansa Logo"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="text-gray-900 font-bold text-sm leading-tight">
                  Mansa Resources
                </h2>
                <span className="block text-xs font-normal text-gray-600">
                  Gold Tracker
                </span>
              </div>
            </div>
          )}
          {collapsed && (
            <img
              src="/image.png"
              alt="Mansa Logo"
              className="w-10 h-10 object-contain mx-auto"
            />
          )}
        </div>
      </div>

      {/* Toggle Button with "My Applications" */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-between p-2 text-gray-900 hover:bg-gray-100/50 rounded-lg transition-colors group"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {!collapsed && (
            <span className="text-base font-bold">My Applications</span>
          )}
          <Menu className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {/* Dashboard - Direct Link (Not in Group) */}
        <Link
          to="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            isDashboardActive
              ? 'bg-blue-500 text-white font-semibold shadow-md'
              : 'text-gray-700 hover:bg-gray-100/70'
          )}
        >
          <LayoutDashboard className={cn('w-5 h-5', isDashboardActive ? 'text-white' : 'text-blue-500')} />
          {!collapsed && (
            <span className="text-sm">
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
                  'group w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-900',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                  isOpen || hasActiveItem
                    ? 'bg-gray-100/70 font-semibold'
                    : 'hover:bg-gray-100/50'
                )}
              >
                <div className="flex items-center gap-3">
                  {group.groupIcon && (
                    <group.groupIcon className={cn('w-5 h-5', group.groupIconColor)} />
                  )}
                  {!collapsed && <span className="text-sm">{group.label}</span>}
                </div>
                {!collapsed && (
                  isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )
                )}
              </button>

              {/* Group Items */}
              {isOpen && !collapsed && (
                <div className="ml-3 space-y-1 border-l-2 border-gray-200 pl-3">
                  {groupItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                          active
                            ? 'bg-white text-gray-900 font-semibold shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100/50'
                        )}
                      >
                        <item.icon className={cn('w-4 h-4', item.iconColor)} />
                        <span>{item.label}</span>
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
      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <p className="text-xs text-gray-500 text-center">
            © 2025 Mansa Resources
          </p>
        )}
      </div>
    </aside>
  );
}
