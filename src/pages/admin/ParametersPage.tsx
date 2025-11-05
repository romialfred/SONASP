import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { NotificationDialog, useNotification } from '@/components/ui/NotificationDialog';
import { Settings, Shield, Bell, Save, User, CheckCircle, XCircle, Scale, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  two_factor_enabled: boolean;
  is_active: boolean;
}

interface BusinessRule {
  id: string;
  rule_key: string;
  rule_name: string;
  rule_value: number;
  rule_category: string;
  description: string | null;
  unit: string | null;
  updated_at: string;
}

export function ParametersPage() {
  const [activeTab, setActiveTab] = useState('preferences');
  const { notification, showSuccess, showError, closeNotification } = useNotification();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);
  const [editedRules, setEditedRules] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === '2fa') {
      loadUsers();
    } else if (activeTab === 'business-rules') {
      loadBusinessRules();
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

  const loadBusinessRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('business_rules')
        .select('*')
        .order('rule_category', { ascending: true })
        .order('rule_name', { ascending: true });

      if (error) throw error;
      setBusinessRules(data || []);

      const initialValues: Record<string, number> = {};
      data?.forEach(rule => {
        initialValues[rule.rule_key] = rule.rule_value;
      });
      setEditedRules(initialValues);
    } catch (error: any) {
      console.error('Error loading business rules:', error);
      showError('Load Failed', 'Could not load business rules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRuleChange = (ruleKey: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setEditedRules(prev => ({ ...prev, [ruleKey]: numValue }));
    }
  };

  const saveBusinessRules = async () => {
    try {
      setSaving(true);

      const updates = businessRules.map(rule => ({
        id: rule.id,
        rule_value: editedRules[rule.rule_key] || rule.rule_value,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('business_rules')
          .update({ rule_value: update.rule_value })
          .eq('id', update.id);

        if (error) throw error;
      }

      await loadBusinessRules();
      showSuccess('Business Rules Updated', 'All business rules have been saved successfully.');
    } catch (error: any) {
      console.error('Error saving business rules:', error);
      showError(
        'Save Failed',
        error.message || 'Could not save business rules. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'business-rules', label: 'Business Rules', icon: Scale },
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

            {activeTab === 'business-rules' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Business Rules Configuration</h2>
                  <p className="text-gray-600 mb-6">
                    Configure conversion rates and variance thresholds used throughout the system.
                  </p>

                  {loading ? (
                    <Card>
                      <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                        <p className="mt-4 text-gray-500">Loading business rules...</p>
                      </div>
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-6 mb-6">
                        <Card>
                          <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <Scale className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">Conversion Rates</h3>
                                <p className="text-sm text-gray-500">Standard conversion rates for weight measurements</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {businessRules
                                .filter(rule => rule.rule_category === 'conversion')
                                .map((rule) => (
                                  <div key={rule.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">{rule.rule_name}</h4>
                                      <p className="text-sm text-gray-500">{rule.description}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="number"
                                        step="0.0001"
                                        value={editedRules[rule.rule_key] || rule.rule_value}
                                        onChange={(e) => handleRuleChange(rule.rule_key, e.target.value)}
                                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-right"
                                      />
                                      {rule.unit && (
                                        <span className="text-sm text-gray-600 w-32">{rule.unit}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </Card>

                        {/* Weight Variance Thresholds - Factory to Airport & Airport to Refinery */}
                        <Card>
                          <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-amber-100 rounded-lg">
                                <Scale className="h-6 w-6 text-amber-600" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">Seuils de Variance des Poids</h3>
                                <p className="text-sm text-gray-500">Écarts maximaux acceptables entre les points de contrôle</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {businessRules
                                .filter(rule =>
                                  rule.rule_key === 'var_threshold_mine_airport' ||
                                  rule.rule_key === 'var_threshold_airport_refinery'
                                )
                                .map((rule) => (
                                  <div key={rule.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">
                                        {rule.rule_key === 'var_threshold_mine_airport'
                                          ? 'Seuil Usine → Aéroport'
                                          : 'Seuil Aéroport → Raffinerie'}
                                      </h4>
                                      <p className="text-sm text-gray-500">
                                        {rule.rule_key === 'var_threshold_mine_airport'
                                          ? 'Variance maximale acceptable entre le poids de l\'usine et l\'aéroport'
                                          : 'Variance maximale acceptable entre le poids de l\'aéroport et la raffinerie'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={editedRules[rule.rule_key] || rule.rule_value}
                                        onChange={(e) => handleRuleChange(rule.rule_key, e.target.value)}
                                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-right"
                                      />
                                      <span className="text-sm text-gray-600 w-12">%</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </Card>

                        {/* Gold Price Configuration */}
                        <Card>
                          <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-yellow-100 rounded-lg">
                                <DollarSign className="h-6 w-6 text-yellow-600" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">Configuration du Cours de l'Or</h3>
                                <p className="text-sm text-gray-500">Paramètres pour le prix de l'or et marges commerciales</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {businessRules
                                .filter(rule => rule.rule_category === 'gold_price')
                                .map((rule) => (
                                  <div key={rule.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">{rule.rule_name}</h4>
                                      <p className="text-sm text-gray-500">{rule.description}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editedRules[rule.rule_key] || rule.rule_value}
                                        onChange={(e) => handleRuleChange(rule.rule_key, e.target.value)}
                                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-right"
                                      />
                                      {rule.unit && (
                                        <span className="text-sm text-gray-600 w-20">{rule.unit}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}

                              {/* Show message if no gold price rules exist yet */}
                              {businessRules.filter(rule => rule.rule_category === 'gold_price').length === 0 && (
                                <div className="py-8 text-center">
                                  <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                  <p className="text-gray-500 text-sm">Aucune règle de cours d'or configurée</p>
                                  <p className="text-gray-400 text-xs mt-1">Ajoutez des règles dans la base de données avec category = 'gold_price'</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>

                        {/* Other Thresholds (Refining Loss, etc.) */}
                        {businessRules.filter(rule =>
                          rule.rule_category === 'threshold' &&
                          rule.rule_key !== 'var_threshold_mine_airport' &&
                          rule.rule_key !== 'var_threshold_airport_refinery'
                        ).length > 0 && (
                          <Card>
                            <div className="p-6">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-100 rounded-lg">
                                  <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">Autres Seuils de Contrôle</h3>
                                  <p className="text-sm text-gray-500">Seuils additionnels pour les processus de transformation</p>
                                </div>
                              </div>
                              <div className="space-y-4">
                                {businessRules
                                  .filter(rule =>
                                    rule.rule_category === 'threshold' &&
                                    rule.rule_key !== 'var_threshold_mine_airport' &&
                                    rule.rule_key !== 'var_threshold_airport_refinery'
                                  )
                                  .map((rule) => (
                                    <div key={rule.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                      <div className="flex-1">
                                        <h4 className="font-medium text-gray-900">{rule.rule_name}</h4>
                                        <p className="text-sm text-gray-500">{rule.description}</p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          max="100"
                                          value={editedRules[rule.rule_key] || rule.rule_value}
                                          onChange={(e) => handleRuleChange(rule.rule_key, e.target.value)}
                                          className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-right"
                                        />
                                        {rule.unit && (
                                          <span className="text-sm text-gray-600 w-12">{rule.unit}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </Card>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">Important Notice</p>
                            <p className="text-sm text-blue-700">Changes to business rules will affect all future calculations throughout the system.</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button
                          variant="primary"
                          className="px-6"
                          onClick={saveBusinessRules}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Business Rules
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
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
