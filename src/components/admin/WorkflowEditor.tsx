/**
 * Workflow Editor Component
 * Éditeur visuel de workflow avec drag-and-drop
 */

import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  ArrowRight,
  Circle,
  CheckCircle,
  Flag,
  Save,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  WorkflowWithDetails,
  WorkflowStatus,
  WorkflowTransition,
  createWorkflowStatus,
  updateWorkflowStatus,
  deleteWorkflowStatus,
  createWorkflowTransition,
  deleteWorkflowTransition,
  validateWorkflowIntegrity,
} from '../../services/workflowManagerService';
import { StatusEditorModal } from './StatusEditorModal';
import { TransitionEditorModal } from './TransitionEditorModal';

interface Props {
  workflow: WorkflowWithDetails;
  onSave: () => void;
}

export function WorkflowEditor({ workflow, onSave }: Props) {
  const [statuses, setStatuses] = useState<WorkflowStatus[]>(workflow.statuses);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>(workflow.transitions);
  const [selectedStatus, setSelectedStatus] = useState<WorkflowStatus | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionFrom, setTransitionFrom] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleAddStatus = () => {
    setSelectedStatus(null);
    setShowStatusModal(true);
  };

  const handleEditStatus = (status: WorkflowStatus) => {
    setSelectedStatus(status);
    setShowStatusModal(true);
  };

  const handleSaveStatus = async (statusData: Partial<WorkflowStatus>) => {
    try {
      if (selectedStatus) {
        const updated = await updateWorkflowStatus(selectedStatus.id, statusData);
        setStatuses(statuses.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const newStatus = await createWorkflowStatus({
          ...statusData,
          workflow_template_id: workflow.id,
          order_index: statuses.length,
        });
        setStatuses([...statuses, newStatus]);
      }
      setShowStatusModal(false);
      await validateWorkflow();
      onSave();
    } catch (error) {
      console.error('Error saving status:', error);
      alert('Erreur lors de la sauvegarde du statut');
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce statut ?')) {
      return;
    }

    try {
      await deleteWorkflowStatus(statusId);
      setStatuses(statuses.filter((s) => s.id !== statusId));
      setTransitions(transitions.filter(
        (t) => t.from_status_id !== statusId && t.to_status_id !== statusId
      ));
      await validateWorkflow();
      onSave();
    } catch (error) {
      console.error('Error deleting status:', error);
      alert('Erreur lors de la suppression du statut');
    }
  };

  const handleAddTransition = (fromStatusId: string) => {
    setTransitionFrom(fromStatusId);
    setShowTransitionModal(true);
  };

  const handleSaveTransition = async (transitionData: Partial<WorkflowTransition>) => {
    try {
      const newTransition = await createWorkflowTransition({
        ...transitionData,
        workflow_template_id: workflow.id,
        from_status_id: transitionFrom!,
      });
      setTransitions([...transitions, newTransition]);
      setShowTransitionModal(false);
      setTransitionFrom(null);
      await validateWorkflow();
      onSave();
    } catch (error) {
      console.error('Error saving transition:', error);
      alert('Erreur lors de la sauvegarde de la transition');
    }
  };

  const handleDeleteTransition = async (transitionId: string) => {
    try {
      await deleteWorkflowTransition(transitionId);
      setTransitions(transitions.filter((t) => t.id !== transitionId));
      await validateWorkflow();
      onSave();
    } catch (error) {
      console.error('Error deleting transition:', error);
      alert('Erreur lors de la suppression de la transition');
    }
  };

  const validateWorkflow = async () => {
    const result = await validateWorkflowIntegrity(workflow.id);
    setValidationErrors(result.errors);
  };

  const getStatusIcon = (status: WorkflowStatus) => {
    if (status.is_initial) return <Flag className="w-5 h-5 text-green-600" />;
    if (status.is_final) return <CheckCircle className="w-5 h-5 text-blue-600" />;
    return <Circle className="w-5 h-5 text-gray-400" />;
  };

  const getTransitionsForStatus = (statusId: string) => {
    return transitions.filter((t) => t.from_status_id === statusId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-2">
                Problèmes de validation détectés:
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm text-red-800">{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-blue-900">
            <p className="font-semibold mb-1">Comment utiliser l'éditeur:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Cliquez sur <strong>"Ajouter un statut"</strong> pour créer un nouveau statut dans le workflow</li>
              <li>Utilisez l'icône <Edit2 className="w-4 h-4 inline" /> pour modifier les propriétés d'un statut (nom, couleur, description)</li>
              <li>Cliquez sur <strong>"+ Transition"</strong> pour créer une liaison entre deux statuts</li>
              <li>Un statut <Flag className="w-4 h-4 inline text-green-600" /> est un point de départ, un statut <CheckCircle className="w-4 h-4 inline text-blue-600" /> est une fin</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Statuts du Workflow</h2>
        <Button
          variant="primary"
          icon={Plus}
          onClick={handleAddStatus}
        >
          Ajouter un statut
        </Button>
      </div>

      {/* Workflow Visualization */}
      <div className="space-y-4">
        {statuses.length === 0 ? (
          <Card className="p-12 text-center">
            <Circle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun statut défini
            </h3>
            <p className="text-gray-600 mb-6">
              Commencez par créer le premier statut de votre workflow
            </p>
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleAddStatus}
            >
              Créer le premier statut
            </Button>
          </Card>
        ) : (
          statuses.map((status, index) => {
            const statusTransitions = getTransitionsForStatus(status.id);

            return (
              <Card
                key={status.id}
                className="p-6"
                style={{ borderLeft: `4px solid ${status.status_color}` }}
              >
                {/* Status Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${status.status_color}20` }}
                    >
                      {getStatusIcon(status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {status.status_label}
                        </h3>
                        <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700">
                          {status.status_key}
                        </code>
                        {status.is_initial && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                            Départ
                          </span>
                        )}
                        {status.is_final && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            Arrivée
                          </span>
                        )}
                      </div>
                      {status.description && (
                        <p className="text-sm text-gray-600">{status.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStatus(status)}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStatus(status.id)}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Transitions */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Transitions possibles depuis ce statut:
                    </h4>
                    <button
                      onClick={() => handleAddTransition(status.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Transition
                    </button>
                  </div>

                  {statusTransitions.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      Aucune transition définie
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {statusTransitions.map((transition) => {
                        const toStatus = statuses.find((s) => s.id === transition.to_status_id);
                        if (!toStatus) return null;

                        return (
                          <div
                            key={transition.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: toStatus.status_color }}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {toStatus.status_label}
                                  </span>
                                  {transition.transition_label && (
                                    <span className="text-sm text-gray-600">
                                      ({transition.transition_label})
                                    </span>
                                  )}
                                  {transition.requires_approval && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                                      Approbation requise
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteTransition(transition.id)}
                              className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Supprimer la transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showStatusModal && (
        <StatusEditorModal
          status={selectedStatus}
          onSave={handleSaveStatus}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedStatus(null);
          }}
        />
      )}

      {showTransitionModal && transitionFrom && (
        <TransitionEditorModal
          fromStatusId={transitionFrom}
          availableStatuses={statuses.filter((s) => s.id !== transitionFrom)}
          existingTransitions={transitions.filter((t) => t.from_status_id === transitionFrom)}
          onSave={handleSaveTransition}
          onClose={() => {
            setShowTransitionModal(false);
            setTransitionFrom(null);
          }}
        />
      )}
    </div>
  );
}
