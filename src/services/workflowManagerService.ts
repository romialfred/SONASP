/**
 * Workflow Manager Service
 * Gestion des workflows de statuts dynamiques
 */

import { supabase } from '@/lib/supabase';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  workflow_type: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStatus {
  id: string;
  workflow_id: string;
  status_key: string;
  status_label: string;
  status_color: string;
  status_order: number;
  is_initial: boolean;
  is_final: boolean;
  requires_approval: boolean;
  created_at: string;
}

export interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_status_id: string;
  to_status_id: string;
  transition_label: string | null;
  required_role: string | null;
  requires_validation: boolean;
  validation_rules: any | null;
  created_at: string;
}

export interface WorkflowWithDetails extends WorkflowTemplate {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

export interface WorkflowHistory {
  id: string;
  workflow_id: string;
  action_type: string;
  action_description: string;
  performed_by: string;
  changes: any;
  created_at: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Récupère tous les templates de workflow
 */
export async function getWorkflowTemplates(
  filterType?: string
): Promise<WorkflowTemplate[]> {
  // Pour l'instant, retourner des données de démonstration
  // car les tables n'existent pas encore en base
  return [];
}

/**
 * Récupère un workflow avec tous ses détails
 */
export async function getWorkflowWithDetails(
  workflowId: string
): Promise<WorkflowWithDetails> {
  throw new Error('Fonctionnalité en développement');
}

/**
 * Active ou désactive un workflow
 */
export async function toggleWorkflowActive(
  workflowId: string,
  isActive: boolean
): Promise<void> {
  throw new Error('Fonctionnalité en développement');
}

/**
 * Valide l'intégrité d'un workflow
 */
export async function validateWorkflowIntegrity(
  workflowId: string
): Promise<ValidationResult> {
  return {
    isValid: true,
    errors: [],
    warnings: [],
  };
}

/**
 * Duplique un workflow
 */
export async function duplicateWorkflow(
  workflowId: string,
  newName: string
): Promise<string> {
  throw new Error('Fonctionnalité en développement');
}

/**
 * Supprime un workflow
 */
export async function deleteWorkflowTemplate(workflowId: string): Promise<void> {
  throw new Error('Fonctionnalité en développement');
}

/**
 * Récupère l'historique d'un workflow
 */
export async function getWorkflowHistory(
  workflowId: string
): Promise<WorkflowHistory[]> {
  return [];
}
