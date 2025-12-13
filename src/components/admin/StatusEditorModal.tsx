/**
 * Status Editor Modal
 * Modal pour créer/éditer un statut de workflow
 */

import React, { useState, useEffect } from 'react';
import { X, Flag, CheckCircle, Circle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { WorkflowStatus } from '../../services/workflowManagerService';

interface Props {
  status: WorkflowStatus | null;
  onSave: (status: Partial<WorkflowStatus>) => void;
  onClose: () => void;
}

const PREDEFINED_COLORS = [
  { value: '#3B82F6', label: 'Bleu' },
  { value: '#10B981', label: 'Vert' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Rouge' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#EC4899', label: 'Rose' },
  { value: '#6B7280', label: 'Gris' },
];

const PREDEFINED_ICONS = [
  'Package', 'Lock', 'FileCheck', 'Truck', 'CheckCircle', 'Clock',
  'AlertCircle', 'Archive', 'Send', 'ShieldCheck', 'Flag', 'Circle'
];

export function StatusEditorModal({ status, onSave, onClose }: Props) {
  const [formData, setFormData] = useState({
    status_key: status?.status_key || '',
    status_label: status?.status_label || '',
    status_color: status?.status_color || '#6B7280',
    description: status?.description || '',
    is_initial: status?.is_initial || false,
    is_final: status?.is_final || false,
    icon: status?.icon || 'Circle',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.status_key.trim()) {
      newErrors.status_key = 'La clé du statut est obligatoire';
    } else if (!/^[a-z_]+$/.test(formData.status_key)) {
      newErrors.status_key = 'La clé doit contenir uniquement des minuscules et underscores';
    }

    if (!formData.status_label.trim()) {
      newErrors.status_label = 'Le libellé du statut est obligatoire';
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

  return (
    <Modal isOpen onClose={onClose} title={status ? 'Modifier le statut' : 'Nouveau statut'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clé du statut *
            <span className="ml-2 text-xs text-gray-500">
              (minuscules et underscores uniquement)
            </span>
          </label>
          <Input
            value={formData.status_key}
            onChange={(e) => handleChange('status_key', e.target.value.toLowerCase())}
            placeholder="ex: en_attente_validation"
            disabled={!!status}
            className={errors.status_key ? 'border-red-500' : ''}
          />
          {errors.status_key && (
            <p className="text-sm text-red-600 mt-1">{errors.status_key}</p>
          )}
          {status && (
            <p className="text-xs text-gray-500 mt-1">
              La clé ne peut pas être modifiée après création
            </p>
          )}
        </div>

        {/* Status Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Libellé du statut *
          </label>
          <Input
            value={formData.status_label}
            onChange={(e) => handleChange('status_label', e.target.value)}
            placeholder="ex: En attente de validation"
            className={errors.status_label ? 'border-red-500' : ''}
          />
          {errors.status_label && (
            <p className="text-sm text-red-600 mt-1">{errors.status_label}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
            <span className="ml-2 text-xs text-gray-500">
              (apparaît au survol dans l'interface)
            </span>
          </label>
          <TextArea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Décrivez ce que signifie ce statut..."
            rows={3}
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Couleur
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PREDEFINED_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => handleChange('status_color', color.value)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  formData.status_color === color.value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: color.value }}
                />
                <span className="text-sm font-medium">{color.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="color"
              value={formData.status_color}
              onChange={(e) => handleChange('status_color', e.target.value)}
              className="w-20 h-10"
            />
            <Input
              value={formData.status_color}
              onChange={(e) => handleChange('status_color', e.target.value)}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Icône
          </label>
          <div className="grid grid-cols-6 gap-2">
            {PREDEFINED_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => handleChange('icon', icon)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.icon === icon
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={icon}
              >
                <Circle className="w-5 h-5 mx-auto" />
              </button>
            ))}
          </div>
        </div>

        {/* Type Flags */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de statut
          </label>

          <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.is_initial}
              onChange={(e) => handleChange('is_initial', e.target.checked)}
              className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Flag className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900">Statut de départ</span>
              </div>
              <p className="text-sm text-gray-600">
                Point d'entrée du workflow. Les nouveaux éléments démarrent avec ce statut.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.is_final}
              onChange={(e) => handleChange('is_final', e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Statut final</span>
              </div>
              <p className="text-sm text-gray-600">
                Point de sortie du workflow. Les éléments terminés atteignent ce statut.
              </p>
            </div>
          </label>
        </div>

        {/* Preview */}
        <div className="border-t pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Aperçu
          </label>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
            style={{
              backgroundColor: `${formData.status_color}20`,
              color: formData.status_color,
            }}
          >
            {formData.is_initial && <Flag className="w-4 h-4" />}
            {formData.is_final && <CheckCircle className="w-4 h-4" />}
            {!formData.is_initial && !formData.is_final && <Circle className="w-4 h-4" />}
            <span>{formData.status_label || 'Nouveau Statut'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary">
            {status ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
