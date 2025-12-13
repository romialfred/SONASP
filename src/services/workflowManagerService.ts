/**
 * Workflow Manager Service
 * Service pour gérer les workflows dynamiques et leurs statuts
 */

import { supabase } from '../lib/supabase';

export interface WorkflowTemplate {
  id: string;
  name: string;
  workflow_type: 'production' | 'shipping' | 'payment' | 'refining' | 'sales';
  description: string;
  is_active: boolean;
  mining_company_id: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStatus {
  id: string;
  workflow_template_id: string;
  status_key: string;
  status_label: string;
  status_color: string;
  description: string;
  order_index: number;
  is_initial: boolean;
  is_final: boolean;
  icon: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTransition {
  id: string;
  workflow_template_id: string;
  from_status_id: string;
  to_status_id: string;
  transition_label: string | null;
  requires_approval: boolean;
  approval_roles: string[];
  conditions: Record<string, any>;
  created_at: string;
}

export interface WorkflowHistory {
  id: string;
  workflow_template_id: string;
  version: number;
  change_type: string;
  changed_by: string;
  changes_summary: string;
  previous_config: any;
  new_config: any;
  changed_at: string;
}

export interface WorkflowWithDetails extends WorkflowTemplate {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

/**
 * Récupère tous les workflows templates
 */
export async function getWorkflowTemplates(workflowType?: string) {
  let query = supabase
    .from('workflow_templates')
    .select('*')
    .order('workflow_type')
    .order('created_at', { ascending: false });

  if (workflowType) {
    query = query.eq('workflow_type', workflowType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as WorkflowTemplate[];
}

/**
 * Récupère un workflow complet avec statuts et transitions
 */
export async function getWorkflowWithDetails(workflowId: string): Promise<WorkflowWithDetails> {
  const { data: workflow, error: workflowError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (workflowError) throw workflowError;

  const { data: statuses, error: statusesError } = await supabase
    .from('workflow_statuses')
    .select('*')
    .eq('workflow_template_id', workflowId)
    .order('order_index');

  if (statusesError) throw statusesError;

  const { data: transitions, error: transitionsError } = await supabase
    .from('workflow_transitions')
    .select('*')
    .eq('workflow_template_id', workflowId);

  if (transitionsError) throw transitionsError;

  return {
    ...workflow,
    statuses: statuses || [],
    transitions: transitions || [],
  } as WorkflowWithDetails;
}

/**
 * Récupère le workflow actif pour un type donné
 */
export async function getActiveWorkflow(workflowType: string, miningCompanyId?: string) {
  let query = supabase
    .from('workflow_templates')
    .select(`
      *,
      statuses:workflow_statuses(*, transitions_from:workflow_transitions!from_status_id(*))
    `)
    .eq('workflow_type', workflowType)
    .eq('is_active', true);

  if (miningCompanyId) {
    query = query.eq('mining_company_id', miningCompanyId);
  } else {
    query = query.is('mining_company_id', null);
  }

  const { data, error } = await query.single();

  if (error) throw error;
  return data;
}

/**
 * Crée un nouveau workflow template
 */
export async function createWorkflowTemplate(template: Partial<WorkflowTemplate>) {
  const { data, error } = await supabase
    .from('workflow_templates')
    .insert({
      name: template.name,
      workflow_type: template.workflow_type,
      description: template.description,
      is_active: template.is_active || false,
      mining_company_id: template.mining_company_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowTemplate;
}

/**
 * Met à jour un workflow template
 */
export async function updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>) {
  const { data, error } = await supabase
    .from('workflow_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowTemplate;
}

/**
 * Active/désactive un workflow
 */
export async function toggleWorkflowActive(id: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('workflow_templates')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowTemplate;
}

/**
 * Supprime un workflow template
 */
export async function deleteWorkflowTemplate(id: string) {
  const { error } = await supabase
    .from('workflow_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Crée un nouveau statut dans un workflow
 */
export async function createWorkflowStatus(status: Partial<WorkflowStatus>) {
  const { data, error } = await supabase
    .from('workflow_statuses')
    .insert({
      workflow_template_id: status.workflow_template_id,
      status_key: status.status_key,
      status_label: status.status_label,
      status_color: status.status_color || '#6B7280',
      description: status.description,
      order_index: status.order_index,
      is_initial: status.is_initial || false,
      is_final: status.is_final || false,
      icon: status.icon,
      metadata: status.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowStatus;
}

/**
 * Met à jour un statut
 */
export async function updateWorkflowStatus(id: string, updates: Partial<WorkflowStatus>) {
  const { data, error } = await supabase
    .from('workflow_statuses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowStatus;
}

/**
 * Supprime un statut
 */
export async function deleteWorkflowStatus(id: string) {
  const { error } = await supabase
    .from('workflow_statuses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Crée une transition entre deux statuts
 */
export async function createWorkflowTransition(transition: Partial<WorkflowTransition>) {
  const { data, error } = await supabase
    .from('workflow_transitions')
    .insert({
      workflow_template_id: transition.workflow_template_id,
      from_status_id: transition.from_status_id,
      to_status_id: transition.to_status_id,
      transition_label: transition.transition_label,
      requires_approval: transition.requires_approval || false,
      approval_roles: transition.approval_roles || [],
      conditions: transition.conditions || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowTransition;
}

/**
 * Supprime une transition
 */
export async function deleteWorkflowTransition(id: string) {
  const { error } = await supabase
    .from('workflow_transitions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Récupère l'historique d'un workflow
 */
export async function getWorkflowHistory(workflowId: string) {
  const { data, error } = await supabase
    .from('workflow_history')
    .select('*, changed_by_user:user_profiles!changed_by(full_name, email)')
    .eq('workflow_template_id', workflowId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return data as WorkflowHistory[];
}

/**
 * Valide l'intégrité d'un workflow
 */
export async function validateWorkflowIntegrity(workflowId: string): Promise<{
  isValid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  const { data: statuses } = await supabase
    .from('workflow_statuses')
    .select('*')
    .eq('workflow_template_id', workflowId);

  if (!statuses || statuses.length === 0) {
    errors.push('Le workflow doit contenir au moins un statut');
    return { isValid: false, errors };
  }

  const initialStatuses = statuses.filter((s: any) => s.is_initial);
  if (initialStatuses.length === 0) {
    errors.push('Le workflow doit avoir au moins un statut initial');
  }

  const finalStatuses = statuses.filter((s: any) => s.is_final);
  if (finalStatuses.length === 0) {
    errors.push('Le workflow doit avoir au moins un statut final');
  }

  const duplicateKeys = statuses.map((s: any) => s.status_key)
    .filter((key, index, self) => self.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    errors.push(`Clés de statut en double: ${duplicateKeys.join(', ')}`);
  }

  const { data: transitions } = await supabase
    .from('workflow_transitions')
    .select('*')
    .eq('workflow_template_id', workflowId);

  if (!transitions || transitions.length === 0) {
    errors.push('Le workflow doit avoir au moins une transition entre les statuts');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Duplique un workflow
 */
export async function duplicateWorkflow(sourceWorkflowId: string, newName: string) {
  const source = await getWorkflowWithDetails(sourceWorkflowId);

  const newWorkflow = await createWorkflowTemplate({
    name: newName,
    workflow_type: source.workflow_type,
    description: `Copie de: ${source.description}`,
    is_active: false,
    mining_company_id: source.mining_company_id,
  });

  const statusMap = new Map<string, string>();

  for (const status of source.statuses) {
    const newStatus = await createWorkflowStatus({
      workflow_template_id: newWorkflow.id,
      status_key: status.status_key,
      status_label: status.status_label,
      status_color: status.status_color,
      description: status.description,
      order_index: status.order_index,
      is_initial: status.is_initial,
      is_final: status.is_final,
      icon: status.icon,
      metadata: status.metadata,
    });
    statusMap.set(status.id, newStatus.id);
  }

  for (const transition of source.transitions) {
    const newFromId = statusMap.get(transition.from_status_id);
    const newToId = statusMap.get(transition.to_status_id);

    if (newFromId && newToId) {
      await createWorkflowTransition({
        workflow_template_id: newWorkflow.id,
        from_status_id: newFromId,
        to_status_id: newToId,
        transition_label: transition.transition_label,
        requires_approval: transition.requires_approval,
        approval_roles: transition.approval_roles,
        conditions: transition.conditions,
      });
    }
  }

  return newWorkflow;
}
