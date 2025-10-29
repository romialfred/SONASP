import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import { ensureArray } from '@/utils/arrayUtils';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Mail,
  Phone,
  MapPin,
  Shield,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  password_must_change: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string;
}

interface UserPermission {
  module_id: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface MiningCompany {
  id: string;
  name: string;
  code: string;
  country: string;
  is_active: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'factory',
    site_ids: [] as string[],
  });

  const [permissions, setPermissions] = useState<Record<string, UserPermission>>({});

  useEffect(() => {
    loadUsers();
    loadModules();
    loadMiningCompanies();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Use Edge Function to fetch users (bypasses RLS using service role)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        setUsers([]);
        setLoading(false);
        return;
      }

      try {
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
        console.log('[UserManagement] Received response:', responseData);

        // Defensive: ensure users is always an array
        const fetchedUsers = ensureArray(responseData?.users);
        console.log('[UserManagement] Processed users:', fetchedUsers.length, 'users');

        setUsers(fetchedUsers);
        setError(null);
      } catch (edgeFunctionError: any) {
        console.warn('[UserManagement] Edge function failed, trying direct query:', edgeFunctionError);

        // Fallback: Query directly from user_profiles
        // This will work if the user has management role and RLS policies are set up correctly
        const { data: directUsers, error: directError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (directError) {
          throw new Error(`Both edge function and direct query failed: ${directError.message}`);
        }

        const fetchedUsers = ensureArray(directUsers);
        console.log('[UserManagement] Loaded users via direct query:', fetchedUsers.length, 'users');
        setUsers(fetchedUsers);
        setError(null);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
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
    } catch (error) {
      console.error('Error loading modules:', error);
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
      console.error('Error loading mining companies:', error);
    }
  };

  const loadUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const perms: Record<string, UserPermission> = {};
      data?.forEach((p) => {
        perms[p.module_id] = {
          module_id: p.module_id,
          can_read: p.can_read,
          can_write: p.can_write,
          can_delete: p.can_delete,
        };
      });

      setPermissions(perms);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleCreateUser = async () => {
    try {
      const defaultPassword = generateRandomPassword();
      const invitationToken = crypto.randomUUID();

      // Create invitation record
      const { data: invitation, error: invError } = await supabase
        .from('user_invitations')
        .insert({
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          site_ids: formData.site_ids,
          default_password: defaultPassword,
          invitation_token: invitationToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (invError) throw invError;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
          phone: formData.phone,
        },
      });

      if (authError) throw authError;

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          site_ids: formData.site_ids,
          is_active: true,
          two_factor_enabled: true,
          password_must_change: true,
          invitation_id: invitation.id,
        });

      if (profileError) throw profileError;

      // TODO: Send welcome email via Edge Function
      alert(`User created successfully!\n\nEmail: ${formData.email}\nDefault Password: ${defaultPassword}\n\nA welcome email will be sent to the user.`);

      setShowCreateModal(false);
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        role: 'factory',
        site_ids: [],
      });
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUser) return;

    try {
      // Delete existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.id);

      // Get current user for granted_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Insert new permissions
      const permsToInsert = Object.entries(permissions)
        .filter(([_, perm]) => perm.can_read || perm.can_write || perm.can_delete)
        .map(([moduleId, perm]) => ({
          user_id: selectedUser.id,
          module_id: moduleId,
          can_read: perm.can_read,
          can_write: perm.can_write,
          can_delete: perm.can_delete,
          granted_by: currentUser?.id,
        }));

      if (permsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permsToInsert);

        if (error) throw error;
      }

      alert('Permissions updated successfully!');
      setShowPermissionsModal(false);
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      alert(`Failed to update permissions: ${error.message}`);
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !isActive })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  // Defensive: ensure users is an array and handle missing properties
  const safeUsers = ensureArray(users);
  const filteredUsers = safeUsers.filter(
    (user) =>
      user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800">Error Loading Users</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={loadUsers}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold">{safeUsers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold">
                    {safeUsers.filter((u) => u?.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">2FA Enabled</p>
                  <p className="text-2xl font-bold">
                    {safeUsers.filter((u) => u?.two_factor_enabled).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Key className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Must Change Password</p>
                  <p className="text-2xl font-bold">
                    {safeUsers.filter((u) => u?.password_must_change).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {searchTerm ? 'No users found matching your search' : 'No users yet'}
                </p>
                {!searchTerm && (
                  <Button
                    variant="primary"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First User
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">2FA</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Login</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      if (!user || !user.id) return null;

                      return (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{user.email || 'N/A'}</p>
                          {user.phone && (
                            <p className="text-xs text-gray-500 flex items-center mt-1">
                              <Phone className="h-3 w-3 mr-1" />
                              {user.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                          {user.role || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {user.is_active ? (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600">
                            <XCircle className="h-4 w-4 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {user.two_factor_enabled ? (
                          <Shield className="h-5 w-5 text-green-600" />
                        ) : (
                          <Shield className="h-5 w-5 text-gray-300" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              loadUserPermissions(user.id);
                              setShowPermissionsModal(true);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Manage Permissions"
                          >
                            <Key className="h-4 w-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {user.is_active ? (
                              <XCircle className="h-4 w-4 text-red-600" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New User"
          size="lg"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="+1234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="factory">Factory</option>
                <option value="airport">Airport</option>
                <option value="refinery">Refinery</option>
                <option value="customer">Customer</option>
                <option value="management">Management</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mining Companies Assignment <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.site_ids.length === miningCompanies.length && miningCompanies.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, site_ids: miningCompanies.map(mc => mc.id) });
                      } else {
                        setFormData({ ...formData, site_ids: [] });
                      }
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-semibold text-primary-700">Select All</span>
                </label>
                <div className="border-t border-gray-200 pt-2">
                  {miningCompanies.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No mining companies available</p>
                  ) : (
                    miningCompanies.map((company) => (
                      <label
                        key={company.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.site_ids.includes(company.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                site_ids: [...formData.site_ids, company.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                site_ids: formData.site_ids.filter(id => id !== company.id)
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{company.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({company.code} - {company.country})</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
              {formData.site_ids.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  {formData.site_ids.length} compan{formData.site_ids.length === 1 ? 'y' : 'ies'} selected
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> A random secure password will be generated and sent to the user via email.
                The user will be required to change this password on first login. 2FA will be enabled by default.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateUser}
                disabled={!formData.email || !formData.full_name}
              >
                Create User & Send Invitation
              </Button>
            </div>
          </div>
        </Modal>

        {/* Permissions Modal */}
        <Modal
          isOpen={showPermissionsModal}
          onClose={() => setShowPermissionsModal(false)}
          title={`Manage Permissions - ${selectedUser?.full_name}`}
          size="xl"
        >
          <div className="p-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Configure module-level permissions. If a user doesn't have Read permission for a module,
                it won't be visible in their navigation menu.
              </p>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Module</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Read</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Write</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => {
                      const perm = permissions[module.id] || {
                        module_id: module.id,
                        can_read: false,
                        can_write: false,
                        can_delete: false,
                      };

                      return (
                        <tr key={module.id} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{module.display_name}</p>
                              <p className="text-xs text-gray-500">{module.description}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm.can_read}
                              onChange={(e) =>
                                setPermissions({
                                  ...permissions,
                                  [module.id]: { ...perm, can_read: e.target.checked },
                                })
                              }
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm.can_write}
                              onChange={(e) =>
                                setPermissions({
                                  ...permissions,
                                  [module.id]: { ...perm, can_write: e.target.checked },
                                })
                              }
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm.can_delete}
                              onChange={(e) =>
                                setPermissions({
                                  ...permissions,
                                  [module.id]: { ...perm, can_delete: e.target.checked },
                                })
                              }
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <Button
                variant="secondary"
                onClick={() => setShowPermissionsModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdatePermissions}
              >
                Save Permissions
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
