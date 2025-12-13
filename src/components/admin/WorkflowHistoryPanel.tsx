/**
 * Workflow History Panel
 * Affiche l'historique complet des modifications d'un workflow
 */

import React, { useState, useEffect } from 'react';
import { Clock, User, FileText, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { getWorkflowHistory, WorkflowHistory } from '../../services/workflowManagerService';

interface Props {
  workflowId: string;
}

export function WorkflowHistoryPanel({ workflowId }: Props) {
  const [history, setHistory] = useState<WorkflowHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [workflowId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getWorkflowHistory(workflowId);
      setHistory(data);
    } catch (err: any) {
      console.error('Error loading history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeLabel = (changeType: string) => {
    const labels: Record<string, string> = {
      created: 'Création',
      status_added: 'Statut ajouté',
      status_removed: 'Statut supprimé',
      status_updated: 'Statut modifié',
      transition_added: 'Transition ajoutée',
      transition_removed: 'Transition supprimée',
      workflow_activated: 'Workflow activé',
      workflow_deactivated: 'Workflow désactivé',
    };
    return labels[changeType] || changeType;
  };

  const getChangeTypeColor = (changeType: string) => {
    const colors: Record<string, string> = {
      created: 'bg-blue-100 text-blue-800',
      status_added: 'bg-green-100 text-green-800',
      status_removed: 'bg-red-100 text-red-800',
      status_updated: 'bg-orange-100 text-orange-800',
      transition_added: 'bg-purple-100 text-purple-800',
      transition_removed: 'bg-red-100 text-red-800',
      workflow_activated: 'bg-green-100 text-green-800',
      workflow_deactivated: 'bg-gray-100 text-gray-800',
    };
    return colors[changeType] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <div>
            <h3 className="font-semibold">Erreur de chargement</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Aucun historique disponible
        </h3>
        <p className="text-gray-600">
          Les modifications de ce workflow apparaîtront ici
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Historique des modifications
        </h2>
        <span className="text-sm text-gray-600">
          {history.length} modification{history.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* History items */}
        <div className="space-y-6">
          {history.map((item, index) => (
            <div key={item.id} className="relative flex gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-white border-4 border-teal-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-teal-600" />
                </div>
              </div>

              {/* Content */}
              <Card className="flex-1 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      getChangeTypeColor(item.change_type)
                    }`}>
                      {getChangeTypeLabel(item.change_type)}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono">
                      v{item.version}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(item.changed_at)}
                  </span>
                </div>

                {item.changes_summary && (
                  <p className="text-sm text-gray-700 mb-3">
                    {item.changes_summary}
                  </p>
                )}

                {item.changed_by_user && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span>
                      {(item as any).changed_by_user?.full_name || 'Utilisateur inconnu'}
                    </span>
                  </div>
                )}

                {/* Show config changes if available */}
                {(item.previous_config || item.new_config) && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                      Voir les détails techniques
                    </summary>
                    <div className="mt-2 space-y-2">
                      {item.previous_config && (
                        <div>
                          <div className="text-gray-600 font-semibold mb-1">Avant:</div>
                          <pre className="bg-gray-50 p-2 rounded overflow-auto text-xs">
                            {JSON.stringify(item.previous_config, null, 2)}
                          </pre>
                        </div>
                      )}
                      {item.new_config && (
                        <div>
                          <div className="text-gray-600 font-semibold mb-1">Après:</div>
                          <pre className="bg-gray-50 p-2 rounded overflow-auto text-xs">
                            {JSON.stringify(item.new_config, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
