import { useState } from 'react';
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

interface User {
  id: string;
  name: string;
  email: string;
  role: 'factory' | 'airport' | 'refinery' | 'customer' | 'management';
  site: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  createdDate: string;
}

export function UserManagement() {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const users: User[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@mansa.com',
      role: 'management',
      site: 'All Sites',
      status: 'active',
      lastLogin: '2024-10-24T09:30:00',
      createdDate: '2024-01-15',
    },
    {
      id: '2',
      name: 'Marie Koné',
      email: 'marie.kone@mansa.com',
      role: 'factory',
      site: 'Siguiri Mine',
      status: 'active',
      lastLogin: '2024-10-23T16:45:00',
      createdDate: '2024-02-20',
    },
    {
      id: '3',
      name: 'Ahmed Traoré',
      email: 'ahmed.traore@mansa.com',
      role: 'airport',
      site: 'Conakry Airport',
      status: 'active',
      lastLogin: '2024-10-24T08:15:00',
      createdDate: '2024-03-10',
    },
    {
      id: '4',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@mansa.com',
      role: 'refinery',
      site: 'Bamako Refinery',
      status: 'active',
      lastLogin: '2024-10-23T14:20:00',
      createdDate: '2024-04-05',
    },
    {
      id: '5',
      name: 'David Smith',
      email: 'david.smith@premiumgold.com',
      role: 'customer',
      site: 'N/A',
      status: 'inactive',
      lastLogin: '2024-09-15T10:00:00',
      createdDate: '2024-05-12',
    },
  ];

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
    { key: 'name', label: 'Name' },
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
    { key: 'site', label: 'Site' },
    {
      key: 'status',
      label: 'Status',
      render: (user: User) => (
        <StatusBadge
          label={user.status === 'active' ? 'Active' : 'Inactive'}
          variant={user.status === 'active' ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (user: User) => new Date(user.lastLogin).toLocaleString(),
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
              console.log('Toggle user status:', user.id);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title={user.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {user.status === 'active' ? (
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
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <MainLayout userRole="management">
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
                {users.filter(u => u.status === 'active').length}
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
            <Input placeholder="Enter full name" />
          </FormField>

          <FormField label="Email Address" required>
            <Input type="email" placeholder="user@example.com" />
          </FormField>

          <FormField label="Phone Number">
            <Input type="tel" placeholder="+1 234 567 8900" />
          </FormField>

          <FormField label="Role" required>
            <Select>
              <option value="">Select role</option>
              <option value="factory">Factory</option>
              <option value="airport">Airport</option>
              <option value="refinery">Refinery</option>
              <option value="customer">Customer</option>
              <option value="management">Management</option>
            </Select>
          </FormField>

          <FormField label="Site Assignment" required>
            <Select>
              <option value="">Select site</option>
              <option value="all">All Sites</option>
              <option value="guinea">Siguiri Mine, Guinea</option>
              <option value="mali">Bamako Operations, Mali</option>
              <option value="ivory">Abidjan Facility, Côte d'Ivoire</option>
            </Select>
          </FormField>

          <FormField label="Initial Password" required hint="User will be prompted to change on first login">
            <Input type="password" placeholder="Enter temporary password" />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCreateModal(false)}>
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
