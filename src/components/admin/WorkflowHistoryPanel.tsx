/**
 * Workflow History Panel Component
 * Affiche l'historique des modifications d'un workflow
 */

import React, { useEffect, useState } from 'react';
import {
  getWorkflowHistory,
  WorkflowHistory,
} from '../../services/workflowManagerService';
import { Card } from '../ui/Card';
import { Clock, AlertCircle } from 'lucide-react';

interface WorkflowHistoryPanelProps {
  workflowId: string;
}

export function WorkflowHistoryPanel({ workflowId }: WorkflowHistoryPanelProps) {
  const [history, setHistory] = useState<WorkflowHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [workflowId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getWorkflowHistory(workflowId);
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3 text-gray-500">
          <AlertCircle className="w-6 h-6" />
          <p>Aucun historique disponible pour ce workflow</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <Card key={entry.id} className="p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">
                  {entry.action_description}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-600">Type: {entry.action_type}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
