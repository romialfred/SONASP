import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Edit, Lock, Unlock, Shield } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Modal } from '@/components/ui/Modal';
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
  site_ids: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export function UserManagement() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: '' as UserRole | '',
    siteIds: [] as string[],
    password: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchSites();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Use Edge Function to fetch users (bypasses RLS using service role)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

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

      const { users: fetchedUsers } = await response.json();

      const usersData: User[] = fetchedUsers.map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        site_ids: [], // Site assignments need separate query if needed
        is_active: profile.is_active,
        last_login_at: profile.last_login_at,
        created_at: profile.created_at,
      }));

      setUsers(usersData);
    } catch (error: any) {
      addToast(error.message || 'Failed to fetch users', 'error');
    } finally {
      setLoading(false);
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

  const handleCreateUser = async () => {
    if (!currentUser || !formData.email || !formData.role || !formData.password) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
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
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        if (formData.siteIds.length > 0) {
          const siteAssignments = formData.siteIds.map((siteId, index) => ({
            user_id: authData.user!.id,
            site_id: siteId,
            is_primary: index === 0,
            assigned_by: currentUser.id,
          }));

          const { error: siteError } = await supabase
            .from('user_site_assignments')
            .insert(siteAssignments);

          if (siteError) throw siteError;
        }

        await logUserAction(
          currentUser.id,
          currentUser.email,
          'CREATE',
          formData.email,
          `Created new user with role: ${formData.role}`
        );

        addToast('User created successfully', 'success');
        setShowCreateModal(false);
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          role: '',
          siteIds: [],
          password: '',
        });
        fetchUsers();
      }
    } catch (error: any) {
      addToast(error.message || 'Failed to create user', 'error');
    } finally {
      setLoading(false);
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

  const roleLabels = {
    factory: 'Factory',
    airport: 'Airport',
    refinery: 'Refinery',
    customer: 'Customer',
    management: 'Management',
  };

  const permissions = {
    batches: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    sales: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    customers: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    reports: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    settings: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Name',
      render: (user: User) => user.full_name || user.email,
    },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (user: User) => (
        <StatusBadge
          label={roleLabels[user.role]}
          variant="info"
        />
      ),
    },
    {
      key: 'site_ids',
      label: 'Sites',
      render: (user: User) => (
        <span className="text-sm">
          {user.site_ids.length > 0 ? `${user.site_ids.length} site(s)` : 'No sites'}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (user: User) => (
        <StatusBadge
          label={user.is_active ? 'Active' : 'Inactive'}
          variant={user.is_active ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key: 'last_login_at',
      label: 'Last Login',
      render: (user: User) =>
        user.last_login_at
          ? new Date(user.last_login_at).toLocaleString()
          : 'Never',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user: User) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(user);
              setShowPermissionsModal(true);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Manage Permissions"
          >
            <Shield className="h-4 w-4 text-gray-600" />
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
      ),
    },
  ];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
            onClick={() => setShowCreateModal(true)}
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
            <Table
              columns={columns}
              data={filteredUsers}
              onRowClick={(user) => console.log('View user:', user.id)}
            />
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New User"
      >
        <div className="space-y-4">
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

          <FormField label="Site Assignment" required>
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

          <FormField label="Initial Password" required hint="User will be prompted to change on first login">
            <Input
              type="password"
              placeholder="Enter temporary password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} loading={loading}>
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        title={`Manage Permissions - ${selectedUser?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Configure access permissions for {selectedUser?.name} ({roleLabels[selectedUser?.role || 'management']})
          </p>

          <div className="space-y-4">
            {Object.entries(permissions).map(([module, perms]) => (
              <div key={module} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 capitalize">{module}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(perms).map(([action, enabled]) => (
                    <label key={action} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked={enabled}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowPermissionsModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowPermissionsModal(false)}>
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
