import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search, Download, Shield, User, Package, ShoppingCart, Settings as SettingsIcon } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'error';
}

export function AuditTrailPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  const auditLogs: AuditLog[] = [
    {
      id: 'LOG-001',
      timestamp: '2025-10-25T14:30:00Z',
      user: 'John Administrator',
      action: 'UPDATE',
      entity: 'Batch',
      entityId: 'BTH-2025-001',
      details: 'Updated batch status from Shipped to Refined',
      ipAddress: '192.168.1.100',
      status: 'success',
    },
    {
      id: 'LOG-002',
      timestamp: '2025-10-25T13:45:00Z',
      user: 'Sarah Analyst',
      action: 'CREATE',
      entity: 'Sale',
      entityId: 'SALE-2025-011',
      details: 'Created new sale record for Dubai Gold Traders',
      ipAddress: '192.168.1.105',
      status: 'success',
    },
    {
      id: 'LOG-003',
      timestamp: '2025-10-25T12:15:00Z',
      user: 'Mike Viewer',
      action: 'VIEW',
      entity: 'Customer',
      entityId: 'CUST-003',
      details: 'Viewed customer details for Standard Bank of Africa',
      ipAddress: '192.168.1.110',
      status: 'success',
    },
    {
      id: 'LOG-004',
      timestamp: '2025-10-25T11:30:00Z',
      user: 'John Administrator',
      action: 'DELETE',
      entity: 'User',
      entityId: 'user-005',
      details: 'Deleted inactive user account',
      ipAddress: '192.168.1.100',
      status: 'warning',
    },
    {
      id: 'LOG-005',
      timestamp: '2025-10-25T10:00:00Z',
      user: 'Sarah Analyst',
      action: 'UPDATE',
      entity: 'Settings',
      entityId: 'SYS-001',
      details: 'Modified gold price alert threshold to $2,500',
      ipAddress: '192.168.1.105',
      status: 'success',
    },
    {
      id: 'LOG-006',
      timestamp: '2025-10-25T09:15:00Z',
      user: 'System',
      action: 'BACKUP',
      entity: 'Database',
      entityId: 'DB-MAIN',
      details: 'Automated daily backup completed successfully',
      ipAddress: 'SYSTEM',
      status: 'success',
    },
    {
      id: 'LOG-007',
      timestamp: '2025-10-25T08:30:00Z',
      user: 'John Administrator',
      action: 'LOGIN',
      entity: 'Auth',
      entityId: 'user-001',
      details: 'Successful login with 2FA',
      ipAddress: '192.168.1.100',
      status: 'success',
    },
    {
      id: 'LOG-008',
      timestamp: '2025-10-24T23:45:00Z',
      user: 'Unknown User',
      action: 'LOGIN',
      entity: 'Auth',
      entityId: 'user-unknown',
      details: 'Failed login attempt - invalid credentials',
      ipAddress: '203.0.113.45',
      status: 'error',
    },
  ];

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesUser = filterUser === 'all' || log.user === filterUser;

    return matchesSearch && matchesAction && matchesUser;
  });

  const getStatusColor = (status: AuditLog['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (entity: string) => {
    switch (entity) {
      case 'Batch':
        return <Package className="w-4 h-4" />;
      case 'Sale':
        return <ShoppingCart className="w-4 h-4" />;
      case 'User':
        return <User className="w-4 h-4" />;
      case 'Settings':
        return <SettingsIcon className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const uniqueUsers = Array.from(new Set(auditLogs.map(log => log.user)));
  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action)));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-gray-600 mt-1">Complete system activity and security logs</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Logs
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {((auditLogs.filter(l => l.status === 'success').length / auditLogs.length) * 100).toFixed(0)}%
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Failed Events</p>
              <p className="text-2xl font-bold text-red-600">
                {auditLogs.filter(l => l.status === 'error').length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueUsers.length - 1}</p>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>

              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Audit Logs */}
        <Card>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.user}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          {getActionIcon(log.entity)}
                          <span>{log.entity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {log.details}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                        {log.ipAddress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No audit logs found matching your criteria.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
