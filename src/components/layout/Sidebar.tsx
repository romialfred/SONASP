import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  Inbox,
  Beaker,
  DollarSign,
  Users,
  BarChart3,
  FileText,
  Settings,
  Shield,
  GitBranch,
  X
} from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: 'factory' | 'airport' | 'refinery' | 'customer' | 'management';
}

export function Sidebar({ isOpen, onClose, userRole = 'management' }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const menuItems = {
    factory: [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: Package, label: t('nav.batches'), href: '/batches' },
      { icon: Truck, label: t('nav.shipments'), href: '/shipments' },
      { icon: FileText, label: t('nav.reports'), href: '/reports' },
    ],
    airport: [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: Inbox, label: t('nav.receiving'), href: '/receiving' },
      { icon: Package, label: t('nav.batches'), href: '/batches' },
      { icon: Truck, label: t('nav.shipments'), href: '/shipments' },
    ],
    refinery: [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: Inbox, label: t('nav.receiving'), href: '/receiving' },
      { icon: Beaker, label: t('nav.refining'), href: '/refining' },
      { icon: Package, label: t('nav.batches'), href: '/batches' },
    ],
    customer: [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: DollarSign, label: t('nav.sales'), href: '/sales' },
      { icon: FileText, label: t('nav.reports'), href: '/reports' },
    ],
    management: [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: BarChart3, label: t('nav.analytics'), href: '/analytics' },
      { icon: DollarSign, label: t('nav.sales'), href: '/sales' },
      { icon: Users, label: t('nav.customers'), href: '/customers' },
      { icon: Package, label: t('nav.batches'), href: '/batches' },
      { icon: GitBranch, label: 'Workflow', href: '/admin/workflow' },
      { icon: FileText, label: t('nav.reports'), href: '/reports' },
      { icon: Settings, label: t('nav.settings'), href: '/settings' },
      { icon: Shield, label: t('nav.audit'), href: '/audit' },
    ],
  };

  const rawItems = menuItems[userRole] || menuItems.management;
  const items = Array.isArray(rawItems) ? rawItems : menuItems.management;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 z-50',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 lg:hidden">
          <span className="font-heading font-semibold text-lg">Menu</span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {items.map((item) => {
            if (!item) {
              return null;
            }
            const Icon = item.icon ?? LayoutDashboard;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary-100 text-primary-700 font-semibold"
                    : "text-gray-700 hover:bg-primary-50 hover:text-primary-700"
                )}
                onClick={onClose}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
