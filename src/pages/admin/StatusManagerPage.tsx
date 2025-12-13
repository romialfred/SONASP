/**
 * Status Manager Page
 * Interface ergonomique pour gérer les workflows dynamiques
 */

import React, { useState, useEffect } from 'react';
import { Plus, Settings, History, Copy, Trash2, Power, PowerOff, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  getWorkflowTemplates,
  getWorkflowWithDetails,
  toggleWorkflowActive,
  deleteWorkflowTemplate,
  duplicateWorkflow,
  validateWorkflowIntegrity,
  WorkflowTemplate,
  WorkflowWithDetails,
} from '../../services/workflowManagerService';
import { WorkflowEditor } from '../../components/admin/WorkflowEditor';
import { WorkflowHistoryPanel } from '../../components/admin/WorkflowHistoryPanel';

export default function StatusManagerPage() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'history'>('list');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadWorkflows();
  }, [filterType]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await getWorkflowTemplates(filterType === 'all' ? undefined : filterType);
      setWorkflows(data);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkflow = async (workflow: WorkflowTemplate) => {
    try {
      const fullWorkflow = await getWorkflowWithDetails(workflow.id);
      setSelectedWorkflow(fullWorkflow);
      setView('edit');
    } catch (error) {
      console.error('Error loading workflow details:', error);
    }
  };

  const handleToggleActive = async (workflowId: string, currentState: boolean) => {
    try {
      if (!currentState) {
        const validation = await validateWorkflowIntegrity(workflowId);
        if (!validation.isValid) {
          alert(`Impossible d'activer ce workflow:\n${validation.errors.join('\n')}`);
          return;
        }
      }

      await toggleWorkflowActive(workflowId, !currentState);
      await loadWorkflows();
    } catch (error: any) {
      console.error('Error toggling workflow:', error);
      alert(error.message || 'Erreur lors de l\'activation du workflow');
    }
  };

  const handleDuplicate = async (workflow: WorkflowTemplate) => {
    const newName = prompt('Nom du nouveau workflow:', `${workflow.name} (Copie)`);
    if (!newName) return;

    try {
      await duplicateWorkflow(workflow.id, newName);
      await loadWorkflows();
    } catch (error) {
      console.error('Error duplicating workflow:', error);
      alert('Erreur lors de la duplication du workflow');
    }
  };

  const handleDelete = async (workflowId: string, workflowName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${workflowName}"?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      await deleteWorkflowTemplate(workflowId);
      await loadWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Erreur lors de la suppression du workflow');
    }
  };

  const getWorkflowTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      production: 'Production',
      shipping: 'Expédition',
      payment: 'Paiement',
      refining: 'Raffinage',
      sales: 'Ventes',
    };
    return labels[type] || type;
  };

  const getWorkflowTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      production: 'bg-blue-100 text-blue-800',
      shipping: 'bg-purple-100 text-purple-800',
      payment: 'bg-green-100 text-green-800',
      refining: 'bg-orange-100 text-orange-800',
      sales: 'bg-teal-100 text-teal-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (view === 'edit' && selectedWorkflow) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => {
                  setView('list');
                  setSelectedWorkflow(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 mb-2"
              >
                ← Retour à la liste
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{selectedWorkflow.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{selectedWorkflow.description}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                icon={History}
                onClick={() => setView('history')}
              >
                Historique
              </Button>
              <span className={`px-4 py-2 rounded-lg font-medium ${
                selectedWorkflow.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedWorkflow.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <WorkflowEditor
            workflow={selectedWorkflow}
            onSave={async () => {
              await loadWorkflows();
              const updated = await getWorkflowWithDetails(selectedWorkflow.id);
              setSelectedWorkflow(updated);
            }}
          />
        </div>
      </div>
    );
  }

  if (view === 'history' && selectedWorkflow) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setView('edit')}
                className="text-sm text-gray-600 hover:text-gray-900 mb-2"
              >
                ← Retour à l'éditeur
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Historique: {selectedWorkflow.name}</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <WorkflowHistoryPanel workflowId={selectedWorkflow.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Gestionnaire de Workflows</h1>
            <p className="text-teal-100">
              Personnalisez les workflows de statuts pour chaque processus métier
            </p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              // TODO: Open create workflow modal
              alert('Fonctionnalité en développement');
            }}
            className="bg-white text-teal-600 hover:bg-teal-50"
          >
            Nouveau Workflow
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 mt-6">
          {['all', 'production', 'shipping', 'payment', 'refining', 'sales'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === type
                  ? 'bg-white text-teal-700'
                  : 'bg-teal-500 text-white hover:bg-teal-400'
              }`}
            >
              {type === 'all' ? 'Tous' : getWorkflowTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : workflows.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun workflow trouvé
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre premier workflow pour personnaliser vos processus métier
            </p>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => alert('Fonctionnalité en développement')}
            >
              Créer un workflow
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleSelectWorkflow(workflow)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        getWorkflowTypeColor(workflow.workflow_type)
                      }`}>
                        {getWorkflowTypeLabel(workflow.workflow_type)}
                      </span>
                      {workflow.is_active && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Actif
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                      {workflow.name}
                    </h3>
                    {workflow.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {workflow.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Version {workflow.version}</span>
                    <span>
                      {new Date(workflow.updated_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleActive(workflow.id, workflow.is_active)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                      workflow.is_active
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={workflow.is_active ? 'Désactiver' : 'Activer'}
                  >
                    {workflow.is_active ? (
                      <>
                        <PowerOff className="w-4 h-4" />
                        <span className="text-xs">Désactiver</span>
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4" />
                        <span className="text-xs">Activer</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDuplicate(workflow)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="Dupliquer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(workflow.id, workflow.name)}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title="Supprimer"
                    disabled={workflow.is_active}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
