import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Globe } from 'lucide-react';
import { NotificationPanel, Notification } from '@/components/ui/NotificationPanel';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const mockNotifications: Notification[] = [
    {
      id: '1',
      type: 'success',
      title: 'Batch Received',
      message: 'Batch #BT-2024-001 has been successfully received at airport',
      time: '5 minutes ago',
      read: false
    },
    {
      id: '2',
      type: 'warning',
      title: 'Weight Variance Detected',
      message: 'Batch #BT-2024-002 has a 2.5% variance in weight',
      time: '1 hour ago',
      read: false
    },
    {
      id: '3',
      type: 'info',
      title: 'Approval Required',
      message: 'Sale #SL-2024-015 is pending your approval',
      time: '3 hours ago',
      read: true
    }
  ];

  const unreadCount = mockNotifications.filter(n => !n.read).length;

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
    setShowLanguageMenu(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <img
            src="/image.png"
            alt="Mansa Logo"
            className="h-10 w-auto object-contain"
          />
          <h1 className="text-xl font-bold text-gray-900">
            Mansa Resources <span className="text-gray-500 font-normal hidden md:inline">Gold Sales Management Solution</span>
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
              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {i18n.language === 'en' ? 'EN' : 'FR'}
              </span>
            </button>
            {showLanguageMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                <button
                  onClick={toggleLanguage}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {i18n.language === 'en' ? 'Français' : 'English'}
                </button>
              </div>
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
                    notifications={mockNotifications}
                    onNotificationClick={(id) => {
                      console.log('Notification clicked:', id);
                      setShowNotifications(false);
                    }}
                    onMarkAllRead={() => console.log('Mark all as read')}
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
