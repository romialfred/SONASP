import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { supabase } from '@/lib/supabase';
import { ensureArray } from '@/utils/arrayUtils';
import { useAlert } from '@/hooks/useAlert';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string;
}

interface ModulePermission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

interface MiningCompany {
  id: string;
  name: string;
  code: string;
  country: string;
  is_active: boolean;
}

const ROLES = [
  { value: 'management', label: 'Management' },
  { value: 'factory', label: 'Factory' },
  { value: 'airport', label: 'Airport' },
  { value: 'refinery', label: 'Refinery' },
  { value: 'customer', label: 'Customer' },
];

export default function UserManagementPage() {
  const alert = useAlert();
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [userCredentials, setUserCredentials] = useState<{
    email: string;
    full_name: string;
    temporary_password: string;
    activation_url?: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'factory',
    password: '',
    mining_company_ids: [] as string[],
  });

  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});

  useEffect(() => {
    loadUsers();
    loadModules();
    loadMiningCompanies();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        setUsers([]);
        return;
      }

      console.log('[UserManagement] Fetching users...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      console.log('[UserManagement] Received users:', responseData);

      const fetchedUsers = ensureArray(responseData?.users);
      setUsers(fetchedUsers);
      console.log('[UserManagement] Loaded', fetchedUsers.length, 'users');

    } catch (error: any) {
      console.error('[UserManagement] Error loading users:', error);
      setError(`Failed to load users: ${error?.message || 'Unknown error'}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      setModules(data || []);

      // Initialize permissions for all modules
      const initialPerms: Record<string, ModulePermission> = {};
      (data || []).forEach(module => {
        initialPerms[module.name] = {
          module_name: module.name,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
        };
      });
      setPermissions(initialPerms);
    } catch (error) {
      console.error('[UserManagement] Error loading modules:', error);
    }
  };

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, code, country, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
    } catch (error) {
      console.error('[UserManagement] Error loading mining companies:', error);
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += charset.charAt(array[i] % charset.length);
    }
    return password;
  };

  const handleGeneratePassword = () => {
    const newPassword = generateRandomPassword();
    setGeneratedPassword(newPassword);
    setFormData({ ...formData, password: newPassword });
  };

  const handleCreateUser = async () => {
    try {
      setCreating(true);
      setError(null);

      // Validation
      if (!formData.email || !formData.full_name || !formData.role) {
        alert.error('Please fill in all required fields');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        alert.error('Please enter a valid email address');
        return;
      }

      console.log('[UserManagement] Creating user:', {
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        hasPassword: !!formData.password,
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert.error('Not authenticated');
        return;
      }

      // Prepare permissions data
      const permissionsData: Record<string, ModulePermission> = {};
      Object.entries(permissions).forEach(([moduleName, perm]) => {
        if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_approve) {
          permissionsData[moduleName] = perm;
        }
      });

      const requestBody = {
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone || null,
        role: formData.role,
        password: formData.password || undefined,
        is_active: true,
        permissions: Object.keys(permissionsData).length > 0 ? permissionsData : undefined,
      };

      console.log('[UserManagement] Sending create request:', requestBody);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();
      console.log('[UserManagement] Create response:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || 'Failed to create user');
      }

      // Check if email was sent
      const emailSent = result.email_sent !== false;

      if (emailSent) {
        alert.success(`User created successfully! Email sent to ${formData.email}`);
      } else {
        alert.success(`User created successfully! ${result.message || ''}`);

        // Only show credentials modal if email was NOT sent
        setUserCredentials({
          email: formData.email,
          full_name: formData.full_name,
          temporary_password: result.temporary_password || formData.password,
          activation_url: result.activation_url,
        });
        setShowCredentialsModal(true);
      }

      // Reset form and reload users
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        role: 'factory',
        password: '',
        mining_company_ids: [],
      });
      setGeneratedPassword('');
      setShowCreateModal(false);
      await loadUsers();

    } catch (error: any) {
      console.error('[UserManagement] Error creating user:', error);
      alert.error(`Failed to create user: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    try {
      if (!confirm(`Reset password for ${email}?`)) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }

      alert.success('Password reset successfully!');
      if (result.temporary_password) {
        alert.info(`New Temporary Password: ${result.temporary_password}`, 10000);
      }

    } catch (error: any) {
      console.error('[UserManagement] Error resetting password:', error);
      alert.error(`Failed to reset password: ${error.message}`);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      alert.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      await loadUsers();
    } catch (error: any) {
      console.error('[UserManagement] Error toggling user status:', error);
      alert.error(`Failed to update user: ${error.message}`);
    }
  };

  const handleManagePermissions = async (user: User) => {
    setSelectedUser(user);
    setShowPermissionsModal(true);

    // Load user's current permissions
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('module_id, can_read, can_write, can_delete')
        .eq('user_id', user.id);

      if (error) throw error;

      // Map module IDs to module names
      const { data: modulesData } = await supabase
        .from('modules')
        .select('id, name');

      const moduleMap = new Map(modulesData?.map(m => [m.id, m.name]) || []);

      const userPerms: Record<string, ModulePermission> = {};
      modules.forEach(module => {
        const perm = data?.find(p => p.module_id === module.id);
        userPerms[module.name] = {
          module_name: module.name,
          can_view: perm?.can_read || false,
          can_create: false,
          can_edit: perm?.can_write || false,
          can_delete: perm?.can_delete || false,
          can_approve: false,
        };
      });

      setPermissions(userPerms);
    } catch (error) {
      console.error('[UserManagement] Error loading permissions:', error);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      // Delete existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.id);

      // Insert new permissions
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, perm]) => perm.can_view || perm.can_edit || perm.can_delete)
        .map(([moduleName, perm]) => {
          const module = modules.find(m => m.name === moduleName);
          return {
            user_id: selectedUser.id,
            module_id: module?.id,
            can_read: perm.can_view,
            can_write: perm.can_edit,
            can_delete: perm.can_delete,
          };
        })
        .filter(p => p.module_id);

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      alert.success('Permissions updated successfully');
      setShowPermissionsModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('[UserManagement] Error saving permissions:', error);
      alert.error(`Failed to save permissions: ${error.message}`);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8" />
              User Management
            </h1>
            <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Create User
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error Loading Users</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                className="mt-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-600 mt-2">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-gray-600 mt-2">
                  {searchTerm ? 'No users found matching your search' : 'No users yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Login</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                            {user.phone && (
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Shield className="w-3 h-3" />
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManagePermissions(user)}
                              title="Manage Permissions"
                            >
                              <Shield className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(user.id, user.email)}
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(user.id, user.is_active)}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {user.is_active ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => !creating && setShowCreateModal(false)}
          title="Create New User"
        >
          <div className="space-y-4">
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              required
            />

            <Input
              label="Full Name *"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              required
            />

            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+225 0767344711"
            />

            <Select
              label="Role *"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={ROLES}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave empty to auto-generate"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                >
                  Generate
                </Button>
              </div>
              {generatedPassword && (
                <p className="text-xs text-green-600 mt-1">
                  Password generated! Make sure to save it.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Permissions</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {modules.map((module) => (
                  <div key={module.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm text-gray-900 mb-2">
                      {module.display_name}
                    </div>
                    <div className="flex gap-4 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={permissions[module.name]?.can_view || false}
                          onChange={(e) =>
                            setPermissions({
                              ...permissions,
                              [module.name]: {
                                ...permissions[module.name],
                                can_view: e.target.checked,
                              },
                            })
                          }
                        />
                        View
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={permissions[module.name]?.can_edit || false}
                          onChange={(e) =>
                            setPermissions({
                              ...permissions,
                              [module.name]: {
                                ...permissions[module.name],
                                can_edit: e.target.checked,
                              },
                            })
                          }
                        />
                        Edit
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={permissions[module.name]?.can_delete || false}
                          onChange={(e) =>
                            setPermissions({
                              ...permissions,
                              [module.name]: {
                                ...permissions[module.name],
                                can_delete: e.target.checked,
                              },
                            })
                          }
                        />
                        Delete
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Permissions Modal */}
        <Modal
          isOpen={showPermissionsModal}
          onClose={() => setShowPermissionsModal(false)}
          title={`Manage Permissions: ${selectedUser?.full_name}`}
        >
          <div className="space-y-4">
            {modules.map((module) => (
              <div key={module.id} className="border rounded-lg p-3">
                <div className="font-medium text-sm text-gray-900 mb-2">
                  {module.display_name}
                </div>
                <div className="text-xs text-gray-600 mb-2">{module.description}</div>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={permissions[module.name]?.can_view || false}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          [module.name]: {
                            ...permissions[module.name],
                            can_view: e.target.checked,
                          },
                        })
                      }
                    />
                    View
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={permissions[module.name]?.can_edit || false}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          [module.name]: {
                            ...permissions[module.name],
                            can_edit: e.target.checked,
                          },
                        })
                      }
                    />
                    Edit
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={permissions[module.name]?.can_delete || false}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          [module.name]: {
                            ...permissions[module.name],
                            can_delete: e.target.checked,
                          },
                        })
                      }
                    />
                    Delete
                  </label>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowPermissionsModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSavePermissions}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Permissions
              </Button>
            </div>
          </div>
        </Modal>

        {/* User Credentials Modal */}
        <Modal
          isOpen={showCredentialsModal}
          onClose={() => setShowCredentialsModal(false)}
          title="User Created Successfully"
        >
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">
                  Account Created!
                </h3>
              </div>
              <p className="text-sm text-green-700">
                Please save these credentials and send them to the user securely.
              </p>
            </div>

            {userCredentials && (
              <div className="space-y-4">
                {/* User Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-md p-3 font-medium">
                    {userCredentials.full_name}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="bg-gray-50 border border-gray-300 rounded-md p-3 font-mono text-sm">
                    {userCredentials.email}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userCredentials.email);
                      alert.success('Email copied to clipboard!');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  >
                    Copy email
                  </button>
                </div>

                {/* Temporary Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temporary Password
                  </label>
                  <div className="bg-yellow-50 border border-yellow-300 rounded-md p-3">
                    <p className="font-mono text-lg font-bold text-yellow-900 break-all">
                      {userCredentials.temporary_password}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userCredentials.temporary_password);
                      alert.success('Password copied to clipboard!');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  >
                    Copy password
                  </button>
                </div>

                {/* Activation URL (if available) */}
                {userCredentials.activation_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activation Link
                    </label>
                    <div className="bg-blue-50 border border-blue-300 rounded-md p-3">
                      <p className="font-mono text-xs text-blue-900 break-all">
                        {userCredentials.activation_url}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (userCredentials.activation_url) {
                          navigator.clipboard.writeText(userCredentials.activation_url);
                          alert.success('Activation link copied to clipboard!');
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      Copy activation link
                    </button>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Instructions for User:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Use the email address as your username</li>
                    <li>Log in with the temporary password provided</li>
                    {userCredentials.activation_url && (
                      <li>Click the activation link to activate your account</li>
                    )}
                    <li>You will be required to change your password on first login</li>
                    <li>Password must be at least 12 characters with uppercase, lowercase, number, and special character</li>
                    <li>Two-Factor Authentication (2FA) setup is mandatory</li>
                  </ol>
                </div>

                {/* Warning */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 mb-1">Security Notice</h4>
                      <p className="text-sm text-red-700">
                        This temporary password will only be shown once. Please copy it now and send it to the user through a secure channel (not email). The user must activate their account within 24 hours.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Copy All Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                    const text = `
Gold Shipper Account Credentials

Full Name: ${userCredentials.full_name}
Email: ${userCredentials.email}
Temporary Password: ${userCredentials.temporary_password}
${userCredentials.activation_url ? `Activation Link: ${userCredentials.activation_url}` : ''}

Instructions:
1. Use your email address as username
2. Log in with the temporary password
${userCredentials.activation_url ? '3. Click the activation link to activate your account\n' : ''}
${userCredentials.activation_url ? '4' : '3'}. Change your password on first login
${userCredentials.activation_url ? '5' : '4'}. Set up Two-Factor Authentication (2FA)

⚠️ IMPORTANT: Change your password immediately after first login.
⚠️ This temporary password expires in 24 hours.
                    `.trim();

                    navigator.clipboard.writeText(text);
                    alert.success('All credentials copied to clipboard!');
                  }}
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Copy All Credentials
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setShowCredentialsModal(false)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Done
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
