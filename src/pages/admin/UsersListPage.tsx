/**
 * Users List Page
 * Liste de tous les utilisateurs avec tableau et actions
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserPlus, Search, Filter, Shield, Phone, Building2,
  Edit, Lock, Unlock, CheckCircle, XCircle, Eye
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { safeFetch } from '@/lib/apiClient';
import type { UserRole } from '@/types/auth';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  phone?: string | null;
  site_ids?: string[];
  mining_company_names?: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  management: 'Management',
  factory: 'Factory',
  airport: 'Airport',
  refinery: 'Refinery',
  customer: 'Customer',
};

const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-amber-100 text-amber-900 border-amber-300',
  admin: 'bg-red-100 text-red-800 border-red-300',
  management: 'bg-purple-100 text-purple-800 border-purple-300',
  factory: 'bg-green-100 text-green-800 border-green-300',
  airport: 'bg-blue-100 text-blue-800 border-blue-300',
  refinery: 'bg-orange-100 text-orange-800 border-orange-300',
  customer: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function UsersListPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Essayer via Edge Function d'abord
      const result = await safeFetch<{ users?: any[] }>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let fetchedUsers: any[] = [];

      if (!result.ok) {
        // Fallback vers requête directe
        const { data: usersData, error: dbError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;
        fetchedUsers = usersData || [];
      } else {
        fetchedUsers = result.data?.users || [];
      }

      // Charger les mining company assignments
      const { data: assignments } = await supabase
        .from('user_site_assignments')
        .select(`
          user_id,
          site_id,
          mining_companies:site_id(name, abbreviation)
        `);

      const assignmentMap = new Map<string, { site_ids: string[]; company_names: string[] }>();
      if (assignments) {
        assignments.forEach((assignment: any) => {
          if (!assignmentMap.has(assignment.user_id)) {
            assignmentMap.set(assignment.user_id, { site_ids: [], company_names: [] });
          }
          const userAssignments = assignmentMap.get(assignment.user_id)!;
          userAssignments.site_ids.push(assignment.site_id);
          if (assignment.mining_companies?.name) {
            userAssignments.company_names.push(assignment.mining_companies.abbreviation || assignment.mining_companies.name);
          }
        });
      }

      const processedUsers: User[] = fetchedUsers
        .filter((profile: any) => profile && profile.id && profile.email)
        .map((profile: any) => {
          const userAssignments = assignmentMap.get(profile.id) || { site_ids: [], company_names: [] };
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            phone: profile.phone,
            site_ids: userAssignments.site_ids,
            mining_company_names: userAssignments.company_names,
            is_active: profile.is_active !== false,
            last_login_at: profile.last_login_at,
            created_at: profile.created_at,
          };
        });

      setUsers(processedUsers);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      addToast(error.message || 'Failed to load users', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      addToast(
        currentStatus ? 'User deactivated successfully' : 'User activated successfully',
        'success'
      );
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to toggle user status:', error);
      addToast(error.message || 'Failed to update user status', 'error');
    }
  };

  const filteredUsers = users.filter(user => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.mining_company_names?.some(name => name.toLowerCase().includes(searchLower));

    // Role filter
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    // Status filter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'inactive' && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
            <p className="text-gray-600 mt-1">
              Manage user accounts and permissions
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/users/new')}
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Add New User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {users.filter(u => u.is_active).length}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inactive Users</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {users.filter(u => !u.is_active).length}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Roles</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {new Set(users.map(u => u.role)).size}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Search className="h-4 w-4 inline mr-2" />
                  Search
                </label>
                <Input
                  type="text"
                  placeholder="Search by name, email, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Filter className="h-4 w-4 inline mr-2" />
                  Role
                </label>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                >
                  <option value="all">All Roles</option>
                  <option value="management">Management</option>
                  <option value="factory">Factory</option>
                  <option value="airport">Airport</option>
                  <option value="refinery">Refinery</option>
                  <option value="customer">Customer</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Filter className="h-4 w-4 inline mr-2" />
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700 border-b border-gray-300">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Companies
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">
                                {(user.full_name || user.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {user.full_name || 'N/A'}
                              </p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.phone ? (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4" />
                              {user.phone}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No phone</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                              ROLE_COLORS[user.role]
                            }`}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.mining_company_names && user.mining_company_names.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.mining_company_names.map((name, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No assignments</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                              <XCircle className="h-3 w-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {formatDate(user.last_login_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/users/${user.id}`)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/users/edit?userId=${user.id}`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user.id, user.is_active)}
                              className={`p-2 rounded-lg transition-colors ${
                                user.is_active
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={user.is_active ? 'Deactivate user' : 'Activate user'}
                            >
                              {user.is_active ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Unlock className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
