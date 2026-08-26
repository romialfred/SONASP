import { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone, Tablet, CheckCircle, XCircle, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { userLoginService, LoginHistoryEntry } from '@/services/userLoginService';

interface LoginHistoryTabProps {
  userId: string;
}

export default function LoginHistoryTab({ userId }: LoginHistoryTabProps) {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    fetchHistory();
  }, [userId, page]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await userLoginService.getLoginHistory(userId, {
        limit,
        offset: page * limit
      });
      setHistory(data);
      setHasMore(data.length === limit);
    } catch (error) {
      console.error('Error fetching login history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const csv = await userLoginService.exportLoginHistory(userId, 90);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `login-history-${userId}-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting login history:', error);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const columns = [
    {
      key: 'login_timestamp',
      label: 'Date & Heure',
      render: (_valeur: unknown, entry: LoginHistoryEntry) => (
        <div>
          <div className="text-sm font-medium text-slate-900">
            {formatDate(entry.login_timestamp)}
          </div>
          {entry.logout_timestamp && (
            <div className="text-xs text-slate-500">
              Révoquée : {formatDate(entry.logout_timestamp)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'etat',
      label: 'État',
      render: (_valeur: unknown, entry: LoginHistoryEntry) => (
        <div className="flex items-center gap-2">
          {entry.logout_timestamp ? (
            <>
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Révoquée</span>
            </>
          ) : entry.is_active ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">Active</span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600 font-medium">Expirée</span>
            </>
          )}
          {entry.is_current && (
            <span className="text-xs text-blue-700">session courante</span>
          )}
        </div>
      )
    },
    {
      key: 'device',
      label: 'Appareil',
      render: (_valeur: unknown, entry: LoginHistoryEntry) => (
        <div className="flex items-center gap-2">
          {getDeviceIcon(entry.device_type)}
          <div>
            <div className="text-sm text-slate-900">{entry.device_type || 'Poste fixe'}</div>
            <div className="text-xs text-slate-500">
              {entry.browser || 'Navigateur non identifié'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'location',
      label: 'Pays',
      render: (_valeur: unknown, entry: LoginHistoryEntry) => (
        <div className="text-sm text-slate-900">
          {entry.location_country || 'Non renseigné'}
        </div>
      )
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (_valeur: unknown, entry: LoginHistoryEntry) => (
        <div className="text-sm font-mono text-slate-600">
          {entry.ip_address || 'Non renseignée'}
        </div>
      )
    },
    {
      key: 'session_duration',
      label: 'Durée',
      render: (_valeur: unknown, entry: LoginHistoryEntry) => (
        <div className="text-sm text-slate-900">
          {formatDuration(entry.session_duration_seconds)}
        </div>
      )
    }
  ];

  if (loading && page === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Historique des Connexions
          </h3>
          <p className="text-sm text-slate-600">
            {history.length} enregistrement{history.length > 1 ? 's' : ''} affichés
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleExport}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exporter (CSV)
        </Button>
      </div>

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
    </div>
  );
}
