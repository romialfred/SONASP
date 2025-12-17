import { useEffect, useState } from 'react';
import { Download, Filter, Activity as ActivityIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { userActivityService, ActivityLog, ActivityFilters } from '@/services/userActivityService';

interface ActivityHistoryTabProps {
  userId: string;
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  view: 'bg-slate-100 text-slate-700',
  export: 'bg-purple-100 text-purple-700',
  approve: 'bg-green-100 text-green-700',
  reject: 'bg-orange-100 text-orange-700'
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  view: 'Consultation',
  export: 'Export',
  approve: 'Approbation',
  reject: 'Rejet'
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de Bord',
  production: 'Production',
  shipping: 'Expédition',
  freight: 'Fret & Transport',
  freight_customs: 'Douanes & Documents',
  documents: 'Documents',
  inventory: 'Inventaire',
  receiving: 'Réception',
  refining: 'Raffinage',
  sales: 'Ventes',
  presales: 'Pré-Ventes',
  customers: 'Clients',
  payments: 'Paiements',
  analytics: 'Analytique',
  reports: 'Rapports',
  licenses: 'Licences d\'Export',
  performance: 'Performance & Budget',
  prices: 'Prix & Taux de Change',
  stakeholders: 'Parties Prenantes',
  users: 'Gestion Utilisateurs',
  settings: 'Paramètres Système',
  audit: 'Audit & Conformité',
  approvals: 'Approbations'
};

export default function ActivityHistoryTab({ userId }: ActivityHistoryTabProps) {
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<ActivityFilters>({
    limit: 20,
    offset: 0
  });

  const limit = 20;

  useEffect(() => {
    fetchHistory();
  }, [userId, page, filters.moduleNames, filters.actionTypes]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await userActivityService.getActivityHistory(userId, {
        ...filters,
        limit,
        offset: page * limit
      });
      setHistory(data);
      setHasMore(data.length === limit);
    } catch (error) {
      console.error('Error fetching activity history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const csv = await userActivityService.exportActivityLogs({
        ...filters,
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-history-${userId}-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting activity history:', error);
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

  const handleModuleFilter = (value: string) => {
    setPage(0);
    if (value === 'all') {
      setFilters(f => ({ ...f, moduleNames: undefined }));
    } else {
      setFilters(f => ({ ...f, moduleNames: [value] }));
    }
  };

  const handleActionFilter = (value: string) => {
    setPage(0);
    if (value === 'all') {
      setFilters(f => ({ ...f, actionTypes: undefined }));
    } else {
      setFilters(f => ({ ...f, actionTypes: [value] }));
    }
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Date & Heure',
      render: (log: ActivityLog) => (
        <div className="text-sm text-slate-900">{formatDate(log.created_at)}</div>
      )
    },
    {
      key: 'action_type',
      label: 'Action',
      render: (log: ActivityLog) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            ACTION_TYPE_COLORS[log.action_type] || 'bg-slate-100 text-slate-700'
          }`}
        >
          {ACTION_TYPE_LABELS[log.action_type] || log.action_type}
        </span>
      )
    },
    {
      key: 'module_name',
      label: 'Module',
      render: (log: ActivityLog) => (
        <span className="text-sm font-medium text-slate-900">
          {MODULE_LABELS[log.module_name] || log.module_name}
        </span>
      )
    },
    {
      key: 'resource',
      label: 'Ressource',
      render: (log: ActivityLog) => (
        <div>
          <div className="text-sm text-slate-900 capitalize">{log.resource_type}</div>
          {log.resource_id && (
            <div className="text-xs text-slate-500 font-mono">{log.resource_id}</div>
          )}
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (log: ActivityLog) => (
        <div className="max-w-md">
          <div className="text-sm text-slate-900 truncate">{log.description}</div>
          {log.changes_summary && Object.keys(log.changes_summary).length > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              {Object.keys(log.changes_summary).length} changement(s)
            </div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (log: ActivityLog) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            log.status === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {log.status === 'success' ? 'Succès' : 'Erreur'}
        </span>
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Historique des Actions
          </h3>
          <p className="text-sm text-slate-600">
            {history.length} enregistrement{history.length > 1 ? 's' : ''} affichés
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <Card className="p-4 bg-slate-50 border-slate-200">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-900">Filtres:</span>
          </div>
          <Select
            value={filters.moduleNames?.[0] || 'all'}
            onChange={(e) => handleModuleFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">Tous les modules</option>
            {Object.entries(MODULE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
          <Select
            value={filters.actionTypes?.[0] || 'all'}
            onChange={(e) => handleActionFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">Toutes les actions</option>
            {Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {history.length === 0 ? (
        <Card className="p-12 text-center">
          <ActivityIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Aucune activité trouvée</p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table
              columns={columns}
              data={history}
              emptyMessage="Aucune activité trouvée"
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
