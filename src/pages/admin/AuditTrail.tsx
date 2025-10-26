import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Download, Search, Filter } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  status: 'success' | 'failed' | 'warning';
}

export function AuditTrail() {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const auditLogs: AuditLog[] = [
    {
      id: '1',
      timestamp: '2024-10-24T09:45:23',
      user: 'john.doe@mansa.com',
      action: 'CREATE',
      module: 'Sales',
      details: 'Created sale SL-2024-042 for Premium Gold Ltd.',
      ipAddress: '192.168.1.101',
      status: 'success',
    },
    {
      id: '2',
      timestamp: '2024-10-24T09:42:15',
      user: 'marie.kone@mansa.com',
      action: 'UPDATE',
      module: 'Batches',
      details: 'Updated batch BT-2024-018 status to "Shipped"',
      ipAddress: '192.168.1.105',
      status: 'success',
    },
    {
      id: '3',
      timestamp: '2024-10-24T09:38:47',
      user: 'ahmed.traore@mansa.com',
      action: 'CREATE',
      module: 'Receiving',
      details: 'Confirmed receipt of batch BT-2024-016 at airport',
      ipAddress: '192.168.1.112',
      status: 'success',
    },
    {
      id: '4',
      timestamp: '2024-10-24T09:35:12',
      user: 'john.doe@mansa.com',
      action: 'LOGIN',
      module: 'Authentication',
      details: 'User logged in with 2FA',
      ipAddress: '192.168.1.101',
      status: 'success',
    },
    {
      id: '5',
      timestamp: '2024-10-24T09:30:58',
      user: 'unknown@example.com',
      action: 'LOGIN',
      module: 'Authentication',
      details: 'Failed login attempt - invalid credentials',
      ipAddress: '203.0.113.45',
      status: 'failed',
    },
    {
      id: '6',
      timestamp: '2024-10-24T09:28:34',
      user: 'sarah.johnson@mansa.com',
      action: 'UPDATE',
      module: 'Settings',
      details: 'Changed weight variance threshold from 1.5% to 2.0%',
      ipAddress: '192.168.1.108',
      status: 'warning',
    },
    {
      id: '7',
      timestamp: '2024-10-24T09:25:19',
      user: 'john.doe@mansa.com',
      action: 'DELETE',
      module: 'Users',
      details: 'Deactivated user account: test.user@mansa.com',
      ipAddress: '192.168.1.101',
      status: 'success',
    },
    {
      id: '8',
      timestamp: '2024-10-24T09:20:45',
      user: 'marie.kone@mansa.com',
      action: 'EXPORT',
      module: 'Reports',
      details: 'Exported monthly sales report (PDF)',
      ipAddress: '192.168.1.105',
      status: 'success',
    },
  ];

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (log: AuditLog) => new Date(log.timestamp).toLocaleString(),
    },
    { key: 'user', label: 'User' },
    {
      key: 'action',
      label: 'Action',
      render: (log: AuditLog) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {log.action}
        </span>
      ),
    },
    { key: 'module', label: 'Module' },
    { key: 'details', label: 'Details' },
    {
      key: 'status',
      label: 'Status',
      render: (log: AuditLog) => {
        const statusMap = {
          success: { label: 'Success', variant: 'success' as const },
          failed: { label: 'Failed', variant: 'error' as const },
          warning: { label: 'Warning', variant: 'warning' as const },
        };
        const status = statusMap[log.status] || { label: 'Unknown', variant: 'neutral' as const };
        return <StatusBadge label={status.label} variant={status.variant} />;
      },
    },
  ];

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUser = userFilter === 'all' || log.user === userFilter;
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesUser && matchesModule && matchesAction;
  });

  const uniqueUsers = Array.from(new Set(auditLogs.map((log) => log.user)));
  const uniqueModules = Array.from(new Set(auditLogs.map((log) => log.module)));
  const uniqueActions = Array.from(new Set(auditLogs.map((log) => log.action)));

  const handleExport = () => {
    console.log('Exporting audit logs...');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.audit')}
            </h1>
            <p className="text-gray-600 mt-1">System activity and audit logging</p>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Logs
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <Shield className="h-8 w-8 text-primary-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
              <p className="text-sm text-gray-600 mt-1">Total Events Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-accent-600">
                {auditLogs.filter((l) => l.status === 'success').length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Successful Actions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-red-600">
                {auditLogs.filter((l) => l.status === 'failed').length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Failed Attempts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-blue-600">
                {uniqueUsers.length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Active Users</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <FormField label="Start Date">
                <DatePicker value={startDate} onChange={setStartDate} />
              </FormField>

              <FormField label="End Date">
                <DatePicker value={endDate} onChange={setEndDate} />
              </FormField>

              <FormField label="User">
                <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                  <option value="all">All Users</option>
                  {uniqueUsers.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Module">
                <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                  <option value="all">All Modules</option>
                  {uniqueModules.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Action">
                <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                  <option value="all">All Actions</option>
                  {uniqueActions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <Table
              columns={columns}
              data={filteredLogs}
              onRowClick={(log) => console.log('View log details:', log.id)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditLogs
                .filter((log) => log.status === 'failed' || log.status === 'warning')
                .map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg ${
                      log.status === 'failed' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{log.action} - {log.module}</p>
                        <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {log.user} | {log.ipAddress} | {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge
                        label={log.status === 'failed' ? 'Failed' : 'Warning'}
                        variant={log.status === 'failed' ? 'error' : 'warning'}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
