import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { NotificationDialog, useNotification } from '@/components/ui/NotificationDialog';
import { Settings, Shield, Bell, Save, User, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  two_factor_enabled: boolean;
  is_active: boolean;
}

export function ParametersPage() {
  const [activeTab, setActiveTab] = useState('preferences');
  const { notification, showSuccess, showError, closeNotification } = useNotification();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === '2fa') {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, two_factor_enabled, is_active')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      showError('Load Failed', 'Could not load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async (userId: string, currentStatus: boolean) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_profiles')
        .update({ two_factor_enabled: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, two_factor_enabled: !currentStatus }
          : user
      ));

      showSuccess(
        '2FA Updated',
        `Two-factor authentication has been ${!currentStatus ? 'enabled' : 'disabled'} successfully.`
      );
    } catch (error: any) {
      console.error('Error updating 2FA:', error);
      showError(
        'Update Failed',
        error.message || 'Could not update 2FA status. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: '2fa', label: '2FA Management', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Parameters</h1>
          <p className="text-gray-600">Configure system settings and user preferences</p>
        </div>

        {/* Horizontal Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors
                      ${isActive
                        ? 'border-amber-500 text-amber-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-amber-500' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">General Preferences</h2>
                  <Card>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Default Language</h3>
                          <p className="text-sm text-gray-500">Set the default language for new users</p>
                        </div>
                        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                          <option value="en">English</option>
                          <option value="fr">Français</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Default Currency</h3>
                          <p className="text-sm text-gray-500">Primary currency for transactions</p>
                        </div>
                        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="XOF">CFA (XOF)</option>
                          <option value="GNF">GNF</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Timezone</h3>
                          <p className="text-sm text-gray-500">Default timezone for the system</p>
                        </div>
                        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                          <option value="UTC">UTC</option>
                          <option value="Africa/Abidjan">Africa/Abidjan</option>
                          <option value="Africa/Conakry">Africa/Conakry</option>
                          <option value="Africa/Bamako">Africa/Bamako</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-3">
                        <div>
                          <h3 className="font-medium text-gray-900">Weight Unit</h3>
                          <p className="text-sm text-gray-500">Primary unit for weight measurements</p>
                        </div>
                        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                          <option value="grams">Grams (g)</option>
                          <option value="ounces">Ounces (oz)</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                    </div>
                  </Card>

                  <div className="flex justify-end mt-6">
                    <Button variant="primary" className="px-6">
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === '2fa' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Two-Factor Authentication Management</h2>
                  <p className="text-gray-600 mb-6">
                    Enable or disable 2FA for individual users. Users will be required to set up 2FA on their next login when enabled.
                  </p>

                  {loading ? (
                    <Card>
                      <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                        <p className="mt-4 text-gray-500">Loading users...</p>
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Role
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                2FA Status
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((user) => (
                              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
                                      <User className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">
                                        {user.full_name || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{user.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800 capitalize">
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {user.is_active ? (
                                    <span className="flex items-center text-sm text-green-600">
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Active
                                    </span>
                                  ) : (
                                    <span className="flex items-center text-sm text-red-600">
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Inactive
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  {user.two_factor_enabled ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Enabled
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                      Disabled
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <Toggle
                                    checked={user.two_factor_enabled}
                                    onChange={() => handleToggle2FA(user.id, user.two_factor_enabled)}
                                    disabled={saving || !user.is_active}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {users.length === 0 && (
                        <div className="p-12 text-center">
                          <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No users found</p>
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Settings</h2>
                  <Card>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Email Notifications</h3>
                          <p className="text-sm text-gray-500">Send email notifications for important events</p>
                        </div>
                        <Toggle checked={true} onChange={() => {}} />
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Batch Status Updates</h3>
                          <p className="text-sm text-gray-500">Notify when batch status changes</p>
                        </div>
                        <Toggle checked={true} onChange={() => {}} />
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Sales Notifications</h3>
                          <p className="text-sm text-gray-500">Notify about new sales and approvals</p>
                        </div>
                        <Toggle checked={true} onChange={() => {}} />
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <h3 className="font-medium text-gray-900">Variance Alerts</h3>
                          <p className="text-sm text-gray-500">Alert when weight variances exceed threshold</p>
                        </div>
                        <Toggle checked={true} onChange={() => {}} />
                      </div>

                      <div className="flex items-center justify-between py-3">
                        <div>
                          <h3 className="font-medium text-gray-900">Daily Summary</h3>
                          <p className="text-sm text-gray-500">Receive daily activity summary emails</p>
                        </div>
                        <Toggle checked={false} onChange={() => {}} />
                      </div>
                    </div>
                  </Card>

                  <div className="flex justify-end mt-6">
                    <Button variant="primary" className="px-6">
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        confirmText={notification.confirmText}
        onConfirm={notification.onConfirm}
        cancelText={notification.cancelText}
        showCancel={notification.showCancel}
      />
    </MainLayout>
  );
}
