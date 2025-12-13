/**
 * Transition Editor Modal
 * Modal pour créer une transition entre statuts
 */

import React, { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { WorkflowStatus, WorkflowTransition } from '../../services/workflowManagerService';

interface Props {
  fromStatusId: string;
  availableStatuses: WorkflowStatus[];
  existingTransitions: WorkflowTransition[];
  onSave: (transition: Partial<WorkflowTransition>) => void;
  onClose: () => void;
}

export function TransitionEditorModal({
  fromStatusId,
  availableStatuses,
  existingTransitions,
  onSave,
  onClose,
}: Props) {
  const [formData, setFormData] = useState({
    to_status_id: '',
    transition_label: '',
    requires_approval: false,
    approval_roles: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filtrer les statuts déjà liés
  const alreadyLinkedIds = existingTransitions.map((t) => t.to_status_id);
  const availableTargets = availableStatuses.filter(
    (s) => !alreadyLinkedIds.includes(s.id)
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.to_status_id) {
      newErrors.to_status_id = 'Sélectionnez un statut de destination';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const selectedStatus = availableStatuses.find((s) => s.id === formData.to_status_id);

  return (
    <Modal isOpen onClose={onClose} title="Créer une transition">
      <form onSubmit={handleSubmit} className="space-y-6">
        {availableTargets.length === 0 ? (
          <div className="p-6 text-center bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              Toutes les transitions possibles depuis ce statut ont déjà été créées.
            </p>
          </div>
        ) : (
          <>
            {/* Target Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut de destination *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {availableTargets.map((status) => (
                  <label
                    key={status.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.to_status_id === status.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="to_status"
                      value={status.id}
                      checked={formData.to_status_id === status.id}
                      onChange={(e) => handleChange('to_status_id', e.target.value)}
                      className="w-5 h-5 text-teal-600"
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: status.status_color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{status.status_label}</div>
                      {status.description && (
                        <div className="text-sm text-gray-600">{status.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {errors.to_status_id && (
                <p className="text-sm text-red-600 mt-1">{errors.to_status_id}</p>
              )}
            </div>

            {/* Transition Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Libellé de l'action
                <span className="ml-2 text-xs text-gray-500">(optionnel)</span>
              </label>
              <Input
                value={formData.transition_label}
                onChange={(e) => handleChange('transition_label', e.target.value)}
                placeholder="ex: Valider et envoyer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Texte affiché sur le bouton d'action dans l'interface
              </p>
            </div>

            {/* Requires Approval */}
            <div>
              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.requires_approval}
                  onChange={(e) => handleChange('requires_approval', e.target.checked)}
                  className="mt-1 w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-5 h-5 text-orange-600" />
                    <span className="font-medium text-gray-900">Approbation requise</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Cette transition nécessite une validation par un administrateur ou gestionnaire
                  </p>
                </div>
              </label>
            </div>

            {/* Approval Roles */}
            {formData.requires_approval && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôles autorisés à approuver
                </label>
                <div className="space-y-2">
                  {['admin', 'manager', 'supervisor'].map((role) => (
                    <label
                      key={role}
                      className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.approval_roles.includes(role)}
                        onChange={(e) => {
                          const roles = e.target.checked
                            ? [...formData.approval_roles, role]
                            : formData.approval_roles.filter((r) => r !== role);
                          handleChange('approval_roles', roles);
                        }}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      <span className="capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {selectedStatus && (
              <div className="border-t pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Aperçu de la transition
                </label>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm text-gray-600">Statut actuel</span>
                    <ArrowRight className="w-5 h-5 text-teal-600" />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedStatus.status_color }}
                    />
                    <span className="font-medium text-gray-900">
                      {selectedStatus.status_label}
                    </span>
                  </div>
                  {formData.requires_approval && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                      Approbation requise
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          {availableTargets.length > 0 && (
            <Button type="submit" variant="primary">
              Créer la transition
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
