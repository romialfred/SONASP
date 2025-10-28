import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { Search, Download, Shield, User, Package, ShoppingCart, Settings as SettingsIcon, Filter, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  module: string;
  details: string;
  ip_address: string | null;
  status: 'success' | 'failed' | 'warning';
}

export function AuditTrailPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
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
          setAuditLogs(data);
        }
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch =
      (log.user_email || log.user_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesUser = filterUser === 'all' || log.user_email === filterUser;

    return matchesSearch && matchesAction && matchesUser;
  });

  const getModuleIcon = (module: string) => {
    switch (module.toLowerCase()) {
      case 'batch':
      case 'batches':
        return <Package className="w-4 h-4" />;
      case 'sale':
      case 'sales':
        return <ShoppingCart className="w-4 h-4" />;
      case 'user':
      case 'users':
        return <User className="w-4 h-4" />;
      case 'settings':
        return <SettingsIcon className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const uniqueUsers = Array.from(new Set(auditLogs.map(log => log.user_email).filter(Boolean)));
  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action)));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('audit.title')}</h1>
            <p className="text-gray-600 mt-1">{t('audit.description')}</p>
          </div>
          <Button className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('audit.exportLogs')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{t('audit.totalEvents')}</p>
              <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{t('audit.today')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {auditLogs.filter(log => {
                  const today = new Date().toDateString();
                  return new Date(log.created_at).toDateString() === today;
                }).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{t('audit.successRate')}</p>
              <p className="text-2xl font-bold text-green-600">100%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{t('audit.activeUsers')}</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueUsers.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {t('audit.filtersAndSearch')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('audit.searchLogs')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="all">{t('audit.allActions')}</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </Select>

              <Select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              >
                <option value="all">{t('audit.allUsers')}</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('audit.title')} ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.timestamp')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.user')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.action')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.module')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.status')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.details')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.ipAddress')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="font-medium text-gray-900">
                            {log.user_email || 'System'}
                          </div>
                          {log.user_id && (
                            <div className="text-xs text-gray-500 font-mono">{log.user_id.substring(0, 8)}...</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {getModuleIcon(log.module)}
                            <span className="capitalize">{log.module}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {log.ip_address || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {auditLogs.length === 0 ? t('audit.noLogsYet') : t('audit.noLogsFound')}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {t('audit.systemActivities')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
