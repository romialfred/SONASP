/**
 * Workflow Editor Component
 * Éditeur visuel pour les workflows de statuts
 */

import React from 'react';
import { WorkflowWithDetails } from '../../services/workflowManagerService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AlertCircle } from 'lucide-react';

interface WorkflowEditorProps {
  workflow: WorkflowWithDetails;
  onSave: () => Promise<void>;
}

export function WorkflowEditor({ workflow, onSave }: WorkflowEditorProps) {
  return (
    <div className="p-6">
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="w-8 h-8 text-amber-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Fonctionnalité en développement
            </h3>
            <p className="text-sm text-gray-600">
              L'éditeur de workflow sera disponible prochainement
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-gray-700">Type:</span>{' '}
              <span className="text-gray-900">{workflow.workflow_type}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Version:</span>{' '}
              <span className="text-gray-900">{workflow.version}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Statuts:</span>{' '}
              <span className="text-gray-900">{workflow.statuses?.length || 0}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Transitions:</span>{' '}
              <span className="text-gray-900">{workflow.transitions?.length || 0}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" disabled>
            Enregistrer
          </Button>
        </div>
      </Card>
    </div>
  );
}
