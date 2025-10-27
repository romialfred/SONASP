import { useState, useEffect } from 'react';
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
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';

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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAuditLogs() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          const mappedLogs: AuditLog[] = data.map(log => ({
            id: log.id,
            timestamp: log.created_at,
            user: log.user_id || 'System',
            action: log.action || 'UNKNOWN',
            module: log.entity_type || 'System',
            details: log.details || '',
            ipAddress: log.ip_address || 'N/A',
            status: 'success',
          }));
          setAuditLogs(mappedLogs);
        }
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAuditLogs();
  }, []);

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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
              </div>
            ) : (
              <>
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
                {filteredLogs.length > 0 ? (
                  <Table
                    columns={columns}
                    data={filteredLogs}
                    onRowClick={(log) => console.log('View log details:', log.id)}
                  />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {auditLogs.length === 0 ? 'No audit logs yet.' : 'No logs found matching your criteria.'}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      System activities will appear here as they occur.
                    </p>
                  </div>
                )}
              </>
            )}
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
