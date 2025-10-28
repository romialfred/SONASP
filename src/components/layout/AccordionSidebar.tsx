import { useState, useEffect } from 'react';
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
  X,
  CreditCard,
  Warehouse,
  PackagePlus,
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
}

const menuGroups: MenuGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    groupIconColor: 'text-blue-500',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, iconColor: 'text-blue-500' },
    ],
  },
  {
    id: 'batches',
    label: 'Batches Management',
    groupIconColor: 'text-green-500',
    items: [
      { label: 'Batches', path: '/batches', icon: Package, iconColor: 'text-green-500' },
      { label: 'Shipping', path: '/shipping', icon: Truck, iconColor: 'text-cyan-500' },
      { label: 'Refining', path: '/refining', icon: FlaskConical, iconColor: 'text-teal-500' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory Management',
    groupIconColor: 'text-orange-500',
    items: [
      { label: 'Gold Inventory', path: '/inventory', icon: Warehouse, iconColor: 'text-orange-500' },
      { label: 'Add Stock Entry', path: '/inventory/add', icon: PackagePlus, iconColor: 'text-orange-600' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales Management',
    groupIconColor: 'text-amber-500',
    items: [
      { label: 'Customers', path: '/customers', icon: Users, iconColor: 'text-purple-500' },
      { label: 'Sales', path: '/sales', icon: ShoppingCart, iconColor: 'text-pink-500' },
      { label: 'Payments', path: '/payments', icon: CreditCard, iconColor: 'text-green-500' },
      { label: 'Gold Price', path: '/gold-prices', icon: TrendingUp, iconColor: 'text-yellow-500' },
      { label: 'FX Rates', path: '/fx-rates', icon: DollarSign, iconColor: 'text-emerald-500' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights & Reports',
    groupIconColor: 'text-indigo-500',
    items: [
      { label: 'Analytics', path: '/analytics', icon: BarChart3, iconColor: 'text-indigo-500' },
      { label: 'Reports', path: '/reports', icon: FileText, iconColor: 'text-violet-500' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    groupIconColor: 'text-red-500',
    items: [
      { label: 'Users Management', path: '/users', icon: Users, iconColor: 'text-slate-500' },
      { label: 'Parameters', path: '/parameters', icon: Settings, iconColor: 'text-orange-500' },
      { label: 'Workflow', path: '/admin/workflow', icon: GitBranch, iconColor: 'text-blue-500' },
      { label: 'Audit Trail', path: '/audit', icon: Shield, iconColor: 'text-red-500' },
    ],
  },
];

const STORAGE_KEY = 'sidebar:lastGroup';
const COLLAPSED_KEY = 'sidebar:collapsed';

interface AccordionSidebarProps {
  onToggle?: (collapsed: boolean) => void;
}

export function AccordionSidebar({ onToggle }: AccordionSidebarProps) {
  const location = useLocation();
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
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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

      {/* Toggle Button */}
      <div className="p-2 border-b border-gray-200">
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 rounded-lg transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
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
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-gray-900',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-transparent',
                  isOpen || hasActiveItem
                    ? 'bg-gray-100/70 font-semibold'
                    : 'hover:bg-gray-100/50'
                )}
                aria-expanded={isOpen}
                aria-controls={`group-${group.id}`}
                title={collapsed ? group.label : ''}
              >
                {collapsed ? (
                  <span className="w-full flex justify-center">
                    {(() => {
                      const Icon = groupItems[0]?.icon ?? LayoutDashboard;
                      return <Icon className={cn('w-5 h-5', group.groupIconColor)} />;
                    })()}
                  </span>
                ) : (
                  <>
                    <span className="text-sm">
                      {group.label}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </>
                )}
              </button>

              {/* Group Items */}
              {!collapsed && isOpen && (
                <div
                  id={`group-${group.id}`}
                  className="space-y-1 pl-6 pt-1"
                  role="group"
                  aria-label={group.label}
                >
                  {groupItems.map((item) => {
                    if (!item) {
                      return null;
                    }
                    const Icon = item.icon ?? LayoutDashboard;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm text-gray-900',
                          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-transparent',
                          active
                            ? 'bg-amber-500 text-white font-medium shadow-md'
                            : 'hover:bg-gray-100/50'
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon
                          className={cn(
                            'w-5 h-5 flex-shrink-0',
                            active ? 'text-white' : item.iconColor || 'text-primary-500'
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Collapsed state - show items as icons on hover */}
              {collapsed && (
                <div className="relative group">
                  <div className="hidden group-hover:block absolute left-full top-0 ml-2 w-48 bg-white/95 backdrop-blur-md border border-gray-200 rounded-lg shadow-xl z-50 py-2">
                    <div className="px-3 py-2 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-900">
                        {group.label}
                      </p>
                    </div>
                    {groupItems.map((item) => {
                      if (!item) {
                        return null;
                      }
                      const Icon = item.icon ?? LayoutDashboard;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 text-sm transition-colors text-gray-900',
                            active
                              ? 'bg-amber-500 text-white font-medium'
                              : 'hover:bg-gray-100/50'
                          )}
                        >
                          <Icon className={cn('w-4 h-4', active ? 'text-white' : item.iconColor || 'text-primary-500')} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          {collapsed ? '© 2025' : '© 2025 Mansa Resources'}
        </p>
      </div>
    </aside>
  );
}
