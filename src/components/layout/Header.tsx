import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Globe, HelpCircle } from 'lucide-react';
import { NotificationPanel, Notification } from '@/components/ui/NotificationPanel';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivities();

    const channel = supabase
      .channel('sales-activities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        fetchRecentActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentActivities = async () => {
    try {
      setLoading(true);

      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          total_amount,
          quantity_oz,
          created_at,
          status,
          customers (
            name
          ),
          mining_companies (
            abbreviation
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedNotifications: Notification[] = salesData?.map((sale: any, index: number) => {
        const timeAgo = getTimeAgo(new Date(sale.created_at));
        const companyName = sale.mining_companies?.abbreviation || 'N/A';
        const customerName = sale.customers?.name || 'N/A';
        const amount = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(sale.total_amount || 0);
        const quantity = sale.quantity_oz?.toFixed(2) || '0.00';

        return {
          id: sale.id,
          type: index < 2 ? 'success' : 'info',
          title: `Vente ${sale.sale_number}`,
          message: `${companyName} → ${customerName} | ${amount} | ${quantity} oz`,
          time: timeAgo,
          read: index > 1,
        };
      }) || [];

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return t('common.justNow');
    if (diffInMinutes < 60) return t('common.minutesAgo', { count: diffInMinutes });
    if (diffInHours < 24) return t('common.hoursAgo', { count: diffInHours });
    return t('common.daysAgo', { count: diffInDays });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleLanguage = () => {
    const currentLang = i18n.language || 'en';
    const newLang = currentLang.startsWith('en') ? 'fr' : 'en';
    console.log('Changing language from', currentLang, 'to', newLang);
    i18n.changeLanguage(newLang).then(() => {
      console.log('Language changed successfully to:', i18n.language);
      localStorage.setItem('i18nextLng', newLang);
    });
    setShowLanguageMenu(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">
            {t('header.appTitle')}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative"
              aria-label="Change language"
            >
              <Globe className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {(i18n.language || 'en').startsWith('en') ? 'En' : 'Fr'}
              </span>
            </button>
            {showLanguageMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowLanguageMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={toggleLanguage}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Globe className="h-4 w-4" />
                    <span>{(i18n.language || 'en').startsWith('en') ? 'Français' : 'English'}</span>
                  </button>
                  <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 mt-1">
                    {t('header.currentLanguage', { language: (i18n.language || 'en').startsWith('en') ? 'English' : 'Français' })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 z-20">
                  <NotificationPanel
                    notifications={notifications}
                    onNotificationClick={(id) => {
                      const sale = notifications.find(n => n.id === id);
                      if (sale) {
                        navigate(`/sales/${id}`);
                        setShowNotifications(false);
                      }
                    }}
                    onMarkAllRead={() => {
                      setNotifications(prev =>
                        prev.map(n => ({ ...n, read: true }))
                      );
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
            >
              <div className="w-8 h-8 bg-secondary-500 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              {user && (
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              )}
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="h-4 w-4" />
                    {t('auth.profile')}
                  </Link>
                  <Link
                    to="/help"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 text-blue-600"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <HelpCircle className="h-4 w-4" />
                    {t('nav.helpCenter')}
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={async () => {
                      await signOut();
                      setShowUserMenu(false);
                      navigate('/login');
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('auth.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
