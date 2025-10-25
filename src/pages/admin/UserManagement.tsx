import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, ArrowLeft, Lock, Unlock, Shield, Save, X, Check } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logUserAction } from '@/lib/auditLog';
import type { UserRole } from '@/types/auth';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  phone?: string | null;
  site_ids: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  is_active: boolean;
}

interface Permission {
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

type ViewMode = 'list' | 'create' | 'edit';

export function UserManagement() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: '' as UserRole | '',
    siteIds: [] as string[],
    password: '',
    isActive: true,
  });

  const [permissions, setPermissions] = useState<Record<string, Permission>>({});

  useEffect(() => {
    fetchUsers();
    fetchModules();
    fetchSites();

    const mode = searchParams.get('mode');
    const userId = searchParams.get('userId');
    if (mode === 'create') {
      setViewMode('create');
      setActiveTab('info');
    } else if (mode === 'edit' && userId) {
      setViewMode('edit');
      setSelectedUserId(userId);
      loadUserData(userId);
    }
  }, [searchParams]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[UserManagement] No session found');
        throw new Error('Not authenticated');
      }

      console.log('[UserManagement] Fetching users from Edge Function');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('[UserManagement] Edge Function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('[UserManagement] Edge Function error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      const fetchedUsers = responseData.users;

      console.log('[UserManagement] Fetched users:', fetchedUsers);

      if (!fetchedUsers || !Array.isArray(fetchedUsers)) {
        console.error('[UserManagement] Invalid users data:', fetchedUsers);
        setUsers([]);
        addToast('No users data received', 'warning');
        return;
      }

      const usersData: User[] = fetchedUsers
        .filter((profile: any) => profile && profile.id && profile.email)
        .map((profile: any) => ({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          phone: profile.phone,
          site_ids: [],
          is_active: profile.is_active,
          last_login_at: profile.last_login_at,
          created_at: profile.created_at,
        }));

      console.log('[UserManagement] Processed users:', usersData.length, 'users');
      setUsers(usersData);
    } catch (error: any) {
      console.error('[UserManagement] Error in fetchUsers:', error);
      addToast(error.message || 'Failed to fetch users', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .order('category, display_name');

      if (error) throw error;
      setModules(data || []);

      const initialPerms: Record<string, Permission> = {};
      data?.forEach(mod => {
        initialPerms[mod.id] = {
          module_id: mod.id,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
        };
      });
      setPermissions(initialPerms);
    } catch (error: any) {
      console.error('Failed to fetch modules:', error);
    }
  };

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      const user = users.find(u => u.id === userId);
      if (user) {
        setFormData({
          fullName: user.full_name || '',
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          siteIds: user.site_ids,
          password: '',
          isActive: user.is_active,
        });
      }

      const { data: perms, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const userPerms: Record<string, Permission> = {};
      perms?.forEach(perm => {
        userPerms[perm.module_id] = {
          module_id: perm.module_id,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
          can_approve: perm.can_approve,
        };
      });

      modules.forEach(mod => {
        if (!userPerms[mod.id]) {
          userPerms[mod.id] = {
            module_id: mod.id,
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_approve: false,
          };
        }
      });

      setPermissions(userPerms);
    } catch (error: any) {
      addToast('Failed to load user data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    if (!currentUser || !formData.email || !formData.role) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    if (viewMode === 'create' && !formData.password) {
      addToast('Password is required for new users', 'error');
      return;
    }

    setSaving(true);
    try {
      if (viewMode === 'create') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({
              full_name: formData.fullName,
              phone: formData.phone || null,
              role: formData.role,
              is_active: formData.isActive,
            })
            .eq('id', authData.user.id);

          if (profileError) throw profileError;

          await savePermissions(authData.user.id);

          await logUserAction(
            currentUser.id,
            currentUser.email,
            'CREATE',
            formData.email,
            `Created new user with role: ${formData.role}`
          );

          addToast('User created successfully', 'success');
        }
      } else if (viewMode === 'edit' && selectedUserId) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            full_name: formData.fullName,
            phone: formData.phone || null,
            role: formData.role,
            is_active: formData.isActive,
          })
          .eq('id', selectedUserId);

        if (profileError) throw profileError;

        await savePermissions(selectedUserId);

        await logUserAction(
          currentUser.id,
          currentUser.email,
          'UPDATE',
          formData.email,
          `Updated user with role: ${formData.role}`
        );

        addToast('User updated successfully', 'success');
      }

      setSearchParams({});
      setViewMode('list');
      fetchUsers();
    } catch (error: any) {
      addToast(error.message || 'Failed to save user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async (userId: string) => {
    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    const permsToInsert = Object.values(permissions)
      .filter(p => p.can_view || p.can_create || p.can_edit || p.can_delete || p.can_approve)
      .map(p => ({
        user_id: userId,
        module_id: p.module_id,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_approve: p.can_approve,
      }));

    if (permsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('user_permissions')
        .insert(permsToInsert);

      if (insertError) throw insertError;
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    if (!currentUser) return;

    try {
      const newStatus = !user.is_active;

      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      await logUserAction(
        currentUser.id,
        currentUser.email,
        newStatus ? 'ACTIVATE' : 'DEACTIVATE',
        user.email,
        `${newStatus ? 'Activated' : 'Deactivated'} user account`
      );

      addToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchUsers();
    } catch (error: any) {
      addToast(error.message || 'Failed to update user status', 'error');
    }
  };

  const handleCancel = () => {
    setSearchParams({});
    setViewMode('list');
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      role: '',
      siteIds: [],
      password: '',
      isActive: true,
    });
  };

  const updatePermission = (moduleId: string, field: keyof Permission, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [field]: value,
      },
    }));
  };

  const roleLabels = {
    factory: 'Factory',
    airport: 'Airport',
    refinery: 'Refinery',
    customer: 'Customer',
    management: 'Management',
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Name',
      render: (user: User) => {
        if (!user) return 'N/A';
        return (
          <div>
            <div className="font-medium text-gray-900">{user.full_name || 'N/A'}</div>
            <div className="text-sm text-gray-500">{user.email || 'N/A'}</div>
          </div>
        );
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (user: User) => {
        if (!user || !user.role) return 'N/A';
        return (
          <StatusBadge
            label={roleLabels[user.role] || user.role}
            variant="info"
          />
        );
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (user: User) => (user && user.phone) ? user.phone : 'N/A',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (user: User) => {
        if (!user) return 'N/A';
        return (
          <StatusBadge
            label={user.is_active ? 'Active' : 'Inactive'}
            variant={user.is_active ? 'success' : 'neutral'}
          />
        );
      },
    },
    {
      key: 'last_login_at',
      label: 'Last Login',
      render: (user: User) => {
        if (!user) return 'Never';
        return user.last_login_at
          ? new Date(user.last_login_at).toLocaleString()
          : 'Never';
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user: User) => {
        if (!user) return null;
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchParams({ mode: 'edit', userId: user.id });
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Edit User"
            >
              <Shield className="h-4 w-4 text-primary-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleUserStatus(user);
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title={user.is_active ? 'Deactivate' : 'Activate'}
            >
              {user.is_active ? (
                <Lock className="h-4 w-4 text-red-600" />
              ) : (
                <Unlock className="h-4 w-4 text-accent-600" />
              )}
            </button>
          </div>
        );
      },
    },
  ];

  const filteredUsers = users.filter((user) => {
    if (!user) return false;
    const matchesSearch =
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const modulesByCategory = modules.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, Module[]>);

  const categories = Object.keys(modulesByCategory);

  if (viewMode === 'list') {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                User Management
              </h1>
              <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
            </div>
            <Button
              onClick={() => setSearchParams({ mode: 'create' })}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add New User
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                <p className="text-sm text-gray-600 mt-1">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-accent-600">
                  {users.filter(u => u.is_active).length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Active Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-primary-600">
                  {users.filter(u => u.role === 'management').length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Administrators</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.role === 'customer').length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Customer Users</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  <option value="management">Management</option>
                  <option value="factory">Factory</option>
                  <option value="airport">Airport</option>
                  <option value="refinery">Refinery</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-2 text-gray-600">Loading users...</p>
                  </div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No users found</p>
                </div>
              ) : (
                <Table
                  columns={columns}
                  data={filteredUsers}
                  onRowClick={(user) => user && setSearchParams({ mode: 'edit', userId: user.id })}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Users
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {viewMode === 'create' ? 'Add New User' : 'Edit User'}
              </h1>
              <p className="text-gray-600 mt-1">
                {viewMode === 'create'
                  ? 'Create a new user account and configure permissions'
                  : `Editing: ${formData.email}`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveUser} loading={saving}>
              <Save className="h-4 w-4 mr-2" />
              {viewMode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'info'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User Information
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'permissions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Permissions
            </button>
          </nav>
        </div>

        {activeTab === 'info' && (
          <Card>
            <CardHeader>
              <CardTitle>User Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Full Name" required>
                  <Input
                    placeholder="Enter full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </FormField>

                <FormField label="Email Address" required>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={viewMode === 'edit'}
                  />
                </FormField>

                <FormField label="Phone Number">
                  <Input
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </FormField>

                <FormField label="Role" required>
                  <Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  >
                    <option value="">Select role</option>
                    <option value="factory">Factory</option>
                    <option value="airport">Airport</option>
                    <option value="refinery">Refinery</option>
                    <option value="customer">Customer</option>
                    <option value="management">Management</option>
                  </Select>
                </FormField>

                <FormField label="Site Assignment">
                  <Select
                    value={formData.siteIds[0] || ''}
                    onChange={(e) => setFormData({ ...formData, siteIds: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">Select site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.country})
                      </option>
                    ))}
                  </Select>
                </FormField>

                {viewMode === 'create' && (
                  <FormField label="Initial Password" required hint="User will be prompted to change on first login">
                    <Input
                      type="password"
                      placeholder="Enter temporary password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </FormField>
                )}

                <FormField label="Status">
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.isActive ? 'bg-accent-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-700">
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </FormField>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Module Permissions</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Configure what the user can do in each module
                </p>
              </CardHeader>
            </Card>

            <div className="border-b border-gray-200 mb-6">
              <nav className="flex gap-2 overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveTab(category)}
                    className={`py-3 px-6 whitespace-nowrap border-b-2 font-medium text-sm transition-colors ${
                      activeTab === category
                        ? 'border-primary-500 text-primary-600 bg-primary-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            {categories.map((category) => (
              activeTab === category && (
                <div key={category} className="space-y-4">
                  {modulesByCategory[category].map((module) => (
                    <Card key={module.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{module.display_name}</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                          </div>
                          <StatusBadge
                            label={module.is_active ? 'Active' : 'Inactive'}
                            variant={module.is_active ? 'success' : 'neutral'}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions[module.id]?.can_view || false}
                              onChange={(e) => updatePermission(module.id, 'can_view', e.target.checked)}
                              className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">View</div>
                              <div className="text-xs text-gray-500">Read access</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions[module.id]?.can_create || false}
                              onChange={(e) => updatePermission(module.id, 'can_create', e.target.checked)}
                              className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Create</div>
                              <div className="text-xs text-gray-500">Add new</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions[module.id]?.can_edit || false}
                              onChange={(e) => updatePermission(module.id, 'can_edit', e.target.checked)}
                              className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Edit</div>
                              <div className="text-xs text-gray-500">Modify</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions[module.id]?.can_delete || false}
                              onChange={(e) => updatePermission(module.id, 'can_delete', e.target.checked)}
                              className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Delete</div>
                              <div className="text-xs text-gray-500">Remove</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions[module.id]?.can_approve || false}
                              onChange={(e) => updatePermission(module.id, 'can_approve', e.target.checked)}
                              className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Approve</div>
                              <div className="text-xs text-gray-500">Authorize</div>
                            </div>
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
