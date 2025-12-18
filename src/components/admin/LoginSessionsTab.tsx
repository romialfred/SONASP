import { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone, Tablet, CheckCircle, XCircle, Shield, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { supabase } from '@/lib/supabase';

interface LoginSessionsTabProps {
  userId: string;
}

interface LoginEntry {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  location_city: string | null;
  location_country: string | null;
  session_duration: number | null;
  success: boolean;
  failure_reason: string | null;
  two_factor_used: boolean;
}

export default function LoginSessionsTab({ userId }: LoginSessionsTabProps) {
  const [history, setHistory] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const limit = 20;

  useEffect(() => {
    fetchHistory();
  }, [userId, page]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_login_history')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;
      setHistory(data || []);
      setHasMore((data || []).length === limit);
    } catch (error) {
      console.error('Error fetching login history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from('user_login_history')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const csv = [
        ['Date', 'Status', 'IP', 'Device', 'Browser', 'Location', 'Duration (min)'].join(','),
        ...(data || []).map(entry => [
          new Date(entry.login_at).toLocaleString('fr-FR'),
          entry.success ? 'Succès' : 'Échec',
          entry.ip_address || 'N/A',
          entry.device_type || 'Unknown',
          entry.browser || 'Unknown',
          entry.location_country || 'N/A',
          entry.session_duration ? Math.round(entry.session_duration / 60) : 'N/A'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `login-history-${userId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-blue-600" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-purple-600" />;
      default:
        return <Monitor className="w-4 h-4 text-slate-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStats = () => {
    const total = history.length;
    const successful = history.filter(h => h.success).length;
    const failed = history.filter(h => !h.success).length;
    const with2FA = history.filter(h => h.two_factor_used).length;

    const devices = history.reduce((acc, h) => {
      const device = h.device_type || 'Desktop';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const locations = history.reduce((acc, h) => {
      const country = h.location_country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, successful, failed, with2FA, devices, locations };
  };

  const stats = getStats();

  const columns = [
    {
      key: 'login_at',
      label: 'Date & Heure',
      render: (entry: LoginEntry) => (
        <div>
          <div className="text-sm font-medium text-slate-900">
            {formatDate(entry.login_at)}
          </div>
          {entry.logout_at && (
            <div className="text-xs text-slate-500">
              Déco: {formatDate(entry.logout_at)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'success',
      label: 'Statut',
      render: (entry: LoginEntry) => (
        <div className="flex items-center gap-2">
          {entry.success ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">Succès</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Échec</span>
            </>
          )}
          {entry.two_factor_used && (
            <Shield className="w-4 h-4 text-blue-600" title="2FA utilisé" />
          )}
        </div>
      )
    },
    {
      key: 'device',
      label: 'Appareil',
      render: (entry: LoginEntry) => (
        <div className="flex items-center gap-2">
          {getDeviceIcon(entry.device_type)}
          <div>
            <div className="text-sm text-slate-900 capitalize">
              {entry.device_type || 'Desktop'}
            </div>
            <div className="text-xs text-slate-500">
              {entry.browser || 'Unknown'} • {entry.operating_system || 'Unknown'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'location',
      label: 'Localisation',
      render: (entry: LoginEntry) => (
        <div>
          <div className="text-sm text-slate-900">
            {entry.location_country || 'Non disponible'}
          </div>
          {entry.location_city && (
            <div className="text-xs text-slate-500">{entry.location_city}</div>
          )}
        </div>
      )
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (entry: LoginEntry) => (
        <div className="text-sm font-mono text-slate-600">
          {entry.ip_address || 'N/A'}
        </div>
      )
    },
    {
      key: 'session_duration',
      label: 'Durée',
      render: (entry: LoginEntry) => (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-900">
            {formatDuration(entry.session_duration)}
          </span>
        </div>
      )
    }
  ];

  if (loading && page === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-96 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Historique des Connexions & Sessions
          </h3>
          <p className="text-sm text-slate-600">
            {history.length} enregistrement{history.length > 1 ? 's' : ''} sur cette page
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={fetchHistory}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exporter
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Historique Détaillé
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Statistiques
        </button>
      </div>

      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <Card className="p-12 text-center">
              <Monitor className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Aucun historique de connexion disponible</p>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <Table
                  columns={columns}
                  data={history}
                  emptyMessage="Aucun historique trouvé"
                />
              </Card>

              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Précédent
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page + 1}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                >
                  Suivant
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="text-3xl font-bold text-blue-900 mb-1">
                {stats.total}
              </div>
              <div className="text-sm text-blue-700">Total Connexions</div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <div className="text-3xl font-bold text-emerald-900 mb-1">
                {stats.successful}
              </div>
              <div className="text-sm text-emerald-700">Réussies</div>
              <div className="text-xs text-emerald-600 mt-1">
                {stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0}%
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="text-3xl font-bold text-red-900 mb-1">
                {stats.failed}
              </div>
              <div className="text-sm text-red-700">Échouées</div>
              <div className="text-xs text-red-600 mt-1">
                {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}%
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="text-3xl font-bold text-purple-900 mb-1">
                {stats.with2FA}
              </div>
              <div className="text-sm text-purple-700">Avec 2FA</div>
              <div className="text-xs text-purple-600 mt-1">
                {stats.total > 0 ? Math.round((stats.with2FA / stats.total) * 100) : 0}%
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-600" />
                Appareils Utilisés
              </h4>
              <div className="space-y-3">
                {Object.entries(stats.devices).map(([device, count]) => (
                  <div key={device} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(device)}
                      <span className="text-sm text-slate-900 capitalize">{device}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-slate-900 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="text-base font-semibold text-slate-900 mb-4">
                Localisations
              </h4>
              <div className="space-y-3">
                {Object.entries(stats.locations).slice(0, 5).map(([location, count]) => (
                  <div key={location} className="flex items-center justify-between">
                    <span className="text-sm text-slate-900">{location}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-emerald-600 h-2 rounded-full"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-slate-900 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  À propos de l'Historique
                </h4>
                <p className="text-sm text-blue-700">
                  L'historique des connexions permet de suivre toutes les tentatives de connexion
                  de l'utilisateur, incluant les appareils utilisés, les localisations et les
                  durées de session. Les données sont conservées pour l'audit de sécurité.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
