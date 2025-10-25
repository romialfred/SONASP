import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { NotificationDialog, useNotification } from '@/components/ui/NotificationDialog';
import { ArrowLeft, Save, User, Shield, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  fields: string[];
}

interface Permission {
  module_id: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  field_permissions: Record<string, { read: boolean; write: boolean }>;
}

export function UserPermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { notification, showSuccess, showError, closeNotification } = useNotification();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [activeTab, setActiveTab] = useState('batches');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tabCategories = [
    { id: 'batches', label: 'Batches Management', icon: '📦' },
    { id: 'sales', label: 'Sales Management', icon: '💰' },
    { id: 'operations', label: 'Operations', icon: '⚙️' },
    { id: 'analytics', label: 'Insights & Reports', icon: '📊' },
    { id: 'system', label: 'System', icon: '🔧' },
  ];

  useEffect(() => {
    if (userId) {
      loadUserData();
      loadModules();
      loadPermissions();
    }
  }, [userId]);

  const loadUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .order('category, display_name');

      if (error) throw error;

      const modulesWithFields: Module[] = (data || []).map((mod) => ({
        ...mod,
        fields: getModuleFields(mod.name),
      }));

      setModules(modulesWithFields);

      const firstModule = modulesWithFields.find(m => m.category === activeTab);
      if (firstModule) {
        setSelectedModule(firstModule);
      }
    } catch (error) {
      console.error('Error loading modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const perms: Record<string, Permission> = {};
      data?.forEach((p) => {
        perms[p.module_id] = {
          module_id: p.module_id,
          can_read: p.can_read,
          can_write: p.can_write,
          can_delete: p.can_delete,
          field_permissions: p.field_permissions || {},
        };
      });

      setPermissions(perms);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const getModuleFields = (moduleName: string): string[] => {
    const fieldMap: Record<string, string[]> = {
      batches_view: ['batch_number', 'weight', 'status', 'origin_site', 'destination', 'shipping_date', 'comments'],
      batches_create: ['batch_number', 'weight', 'origin_site', 'shipping_date', 'mine_transport', 'comments'],
      receiving: ['received_weight', 'variance', 'received_date', 'condition_notes', 'photos'],
      refining: ['pre_melting_weight', 'post_melting_weight', 'fineness_percentage', 'metal_retained', 'final_fine'],
      sales_view: ['customer', 'quantity', 'price', 'london_am_rate', 'gross_proceeds', 'net_proceeds'],
      sales_create: ['customer', 'quantity', 'price', 'freight_costs', 'other_costs'],
      customers_view: ['name', 'email', 'country', 'phone', 'contact_person', 'payment_terms'],
      customers_manage: ['credit_limit', 'payment_history', 'outstanding_balance'],
      payments: ['amount', 'currency', 'fx_rate', 'payment_date', 'proof_document', 'bank_details'],
      shipping: ['transport_company', 'tracking_number', 'departure_date', 'arrival_date', 'customs_docs'],
      analytics_dashboard: ['sales_metrics', 'revenue_charts', 'customer_performance', 'inventory_levels'],
      reports: ['financial_reports', 'operational_reports', 'compliance_reports', 'custom_reports'],
      users_manage: ['email', 'full_name', 'role', 'permissions', 'status', 'last_login'],
      system_settings: ['company_info', 'currency_settings', 'email_templates', 'thresholds'],
      audit_trail: ['action', 'user', 'timestamp', 'ip_address', 'changes'],
    };

    return fieldMap[moduleName] || [];
  };

  const handleSavePermissions = async () => {
    if (!userId) return;

    try {
      setSaving(true);

      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      const permsToInsert = Object.entries(permissions)
        .filter(([_, perm]) => perm.can_read || perm.can_write || perm.can_delete)
        .map(([moduleId, perm]) => ({
          user_id: userId,
          module_id: moduleId,
          can_read: perm.can_read,
          can_write: perm.can_write,
          can_delete: perm.can_delete,
          field_permissions: perm.field_permissions,
          granted_by: currentUser?.id,
        }));

      if (permsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permsToInsert);

        if (error) throw error;
      }

      showSuccess(
        'Permissions Saved',
        `Permissions for ${user?.full_name || user?.email} have been successfully updated.`
      );
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      showError(
        'Failed to Save Permissions',
        error.message || 'An unexpected error occurred while saving permissions. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const updateModulePermission = (moduleId: string, field: 'can_read' | 'can_write' | 'can_delete', value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: {
        ...(prev[moduleId] || { module_id: moduleId, can_read: false, can_write: false, can_delete: false, field_permissions: {} }),
        [field]: value,
      },
    }));
  };

  const updateFieldPermission = (moduleId: string, fieldName: string, permType: 'read' | 'write', value: boolean) => {
    setPermissions((prev) => {
      const modulePerm = prev[moduleId] || {
        module_id: moduleId,
        can_read: false,
        can_write: false,
        can_delete: false,
        field_permissions: {},
      };

      return {
        ...prev,
        [moduleId]: {
          ...modulePerm,
          field_permissions: {
            ...modulePerm.field_permissions,
            [fieldName]: {
              ...(modulePerm.field_permissions[fieldName] || { read: false, write: false }),
              [permType]: value,
            },
          },
        },
      };
    });
  };

  const filteredModules = modules.filter((m) => m.category === activeTab);

  useEffect(() => {
    if (filteredModules.length > 0 && !selectedModule) {
      setSelectedModule(filteredModules[0]);
    }
  }, [filteredModules]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/users')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Permissions</h1>
              <p className="text-gray-600 mt-1">
                Configure module and field-level access for {user?.full_name || user?.email}
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={handleSavePermissions} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {user && (
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">{user.full_name || user.email}</h3>
                  <p className="text-gray-600">{user.email}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm capitalize">
                      <Shield className="h-3 w-3" />
                      {user.role}
                    </span>
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-3">
            <Card>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Categories</h3>
                <nav className="space-y-1">
                  {tabCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setActiveTab(category.id);
                        const firstModule = modules.find(m => m.category === category.id);
                        if (firstModule) setSelectedModule(firstModule);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                        activeTab === category.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{category.icon}</span>
                      <span className="text-sm">{category.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </Card>

            <Card className="mt-4">
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Modules</h3>
                <nav className="space-y-1">
                  {filteredModules.map((module) => {
                    const perm = permissions[module.id];
                    const hasAccess = perm?.can_read || perm?.can_write || perm?.can_delete;

                    return (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModule(module)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          selectedModule?.id === module.id
                            ? 'bg-gray-100 font-medium'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900">{module.display_name}</span>
                          {hasAccess && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-9">
            {selectedModule ? (
              <div className="space-y-6">
                <Card>
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {selectedModule.display_name}
                    </h2>
                    <p className="text-gray-600 text-sm mb-6">{selectedModule.description}</p>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Module-Level Permissions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                            <div>
                              <p className="font-medium text-gray-900">Read</p>
                              <p className="text-xs text-gray-500">View module data</p>
                            </div>
                            <Toggle
                              checked={permissions[selectedModule.id]?.can_read || false}
                              onChange={(checked) => updateModulePermission(selectedModule.id, 'can_read', checked)}
                              size="lg"
                            />
                          </div>

                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                            <div>
                              <p className="font-medium text-gray-900">Write</p>
                              <p className="text-xs text-gray-500">Create and edit data</p>
                            </div>
                            <Toggle
                              checked={permissions[selectedModule.id]?.can_write || false}
                              onChange={(checked) => updateModulePermission(selectedModule.id, 'can_write', checked)}
                              size="lg"
                            />
                          </div>

                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                            <div>
                              <p className="font-medium text-gray-900">Delete</p>
                              <p className="text-xs text-gray-500">Remove data</p>
                            </div>
                            <Toggle
                              checked={permissions[selectedModule.id]?.can_delete || false}
                              onChange={(checked) => updateModulePermission(selectedModule.id, 'can_delete', checked)}
                              size="lg"
                            />
                          </div>
                        </div>
                      </div>

                      {selectedModule.fields.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Field-Level Permissions</h3>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Field Name</th>
                                  <th className="text-center py-3 px-4 font-semibold text-gray-700 w-32">Read</th>
                                  <th className="text-center py-3 px-4 font-semibold text-gray-700 w-32">Write</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {selectedModule.fields.map((field) => {
                                  const fieldPerm = permissions[selectedModule.id]?.field_permissions?.[field] || { read: false, write: false };

                                  return (
                                    <tr key={field} className="hover:bg-gray-50">
                                      <td className="py-3 px-4">
                                        <p className="font-medium text-gray-900 capitalize">
                                          {field.replace(/_/g, ' ')}
                                        </p>
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex justify-center">
                                          <Toggle
                                            checked={fieldPerm.read}
                                            onChange={(checked) =>
                                              updateFieldPermission(selectedModule.id, field, 'read', checked)
                                            }
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex justify-center">
                                          <Toggle
                                            checked={fieldPerm.write}
                                            onChange={(checked) =>
                                              updateFieldPermission(selectedModule.id, field, 'write', checked)
                                            }
                                            size="md"
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Permission Guide</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>Read:</strong> User can view data in this module</li>
                    <li>• <strong>Write:</strong> User can create and edit data</li>
                    <li>• <strong>Delete:</strong> User can remove data</li>
                    <li>• <strong>Field-Level:</strong> Control access to specific fields within the module</li>
                    <li>• If a user doesn't have Read permission, the module won't appear in their navigation</li>
                  </ul>
                </div>
              </div>
            ) : (
              <Card>
                <div className="p-12 text-center">
                  <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a module to configure permissions</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Notification Dialog */}
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
