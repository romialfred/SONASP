import { supabase } from '@/lib/supabase';
import { notificationService } from './notificationService';

export interface Workflow {
  id: string;
  workflow_name: string;
  workflow_type: string;
  entity_type: string;
  trigger_event: string;
  steps: WorkflowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  step: string;
  role: string;
  action: string;
  timeout_hours: number;
  conditions?: Record<string, any>;
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  entity_id: string;
  entity_type: string;
  current_step?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowInstanceParams {
  workflow_name: string;
  entity_id: string;
  entity_type: string;
  data?: Record<string, any>;
}

export const workflowService = {
  async getWorkflowByName(workflowName: string): Promise<Workflow | null> {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('workflow_name', workflowName)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching workflow:', error);
      return null;
    }
  },

  async createWorkflowInstance(
    params: CreateWorkflowInstanceParams
  ): Promise<WorkflowInstance | null> {
    try {
      const workflow = await this.getWorkflowByName(params.workflow_name);
      if (!workflow) {
        console.error('Workflow not found:', params.workflow_name);
        return null;
      }

      const firstStep = workflow.steps[0]?.step;

      const { data, error } = await supabase
        .from('workflow_instances')
        .insert([
          {
            workflow_id: workflow.id,
            entity_id: params.entity_id,
            entity_type: params.entity_type,
            current_step: firstStep,
            status: 'pending',
            data: params.data || {},
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await this.notifyStepAssignee(data.id, firstStep);

      return data;
    } catch (error) {
      console.error('Error creating workflow instance:', error);
      return null;
    }
  },

  async getWorkflowInstance(instanceId: string): Promise<WorkflowInstance | null> {
    try {
      const { data, error } = await supabase
        .from('workflow_instances')
        .select('*')
        .eq('id', instanceId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching workflow instance:', error);
      return null;
    }
  },

  async advanceWorkflow(
    instanceId: string,
    action: string,
    userId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const instance = await this.getWorkflowInstance(instanceId);
      if (!instance) return false;

      const workflow = await this.getWorkflowByName(instance.workflow_id);
      if (!workflow) return false;

      const currentStepIndex = workflow.steps.findIndex(
        (s) => s.step === instance.current_step
      );

      if (currentStepIndex === -1) return false;

      const currentStep = workflow.steps[currentStepIndex];
      if (currentStep.action !== action) {
        console.error('Invalid action for current step');
        return false;
      }

      const updatedData = {
        ...instance.data,
        [`${currentStep.step}_completed_by`]: userId,
        [`${currentStep.step}_completed_at`]: new Date().toISOString(),
        [`${currentStep.step}_notes`]: notes,
      };

      const nextStepIndex = currentStepIndex + 1;
      const isLastStep = nextStepIndex >= workflow.steps.length;

      const updateParams: any = {
        data: updatedData,
        updated_at: new Date().toISOString(),
      };

      if (isLastStep) {
        updateParams.status = 'completed';
        updateParams.completed_at = new Date().toISOString();
        updateParams.current_step = null;
      } else {
        updateParams.status = 'in_progress';
        updateParams.current_step = workflow.steps[nextStepIndex].step;
      }

      const { error } = await supabase
        .from('workflow_instances')
        .update(updateParams)
        .eq('id', instanceId);

      if (error) throw error;

      if (!isLastStep) {
        await this.notifyStepAssignee(
          instanceId,
          workflow.steps[nextStepIndex].step
        );
      }

      return true;
    } catch (error) {
      console.error('Error advancing workflow:', error);
      return false;
    }
  },

  async cancelWorkflow(instanceId: string, reason: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workflow_instances')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          data: supabase.rpc('jsonb_set', {
            target: 'data',
            path: '{cancellation_reason}',
            value: reason,
          }),
        })
        .eq('id', instanceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error cancelling workflow:', error);
      return false;
    }
  },

  async getActiveWorkflows(
    entityType?: string
  ): Promise<WorkflowInstance[]> {
    try {
      let query = supabase
        .from('workflow_instances')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching active workflows:', error);
      return [];
    }
  },

  async checkTimeouts(): Promise<void> {
    try {
      const activeWorkflows = await this.getActiveWorkflows();

      for (const instance of activeWorkflows) {
        if (!instance.current_step) continue;

        const workflow = await this.getWorkflowByName(instance.workflow_id);
        if (!workflow) continue;

        const currentStep = workflow.steps.find(
          (s) => s.step === instance.current_step
        );
        if (!currentStep) continue;

        const stepStartTime = instance.data[`${currentStep.step}_started_at`] ||
          instance.started_at;

        const elapsedHours =
          (new Date().getTime() - new Date(stepStartTime).getTime()) /
          (1000 * 60 * 60);

        if (elapsedHours > currentStep.timeout_hours) {
          await this.escalateWorkflow(instance.id, currentStep.step);
        }
      }
    } catch (error) {
      console.error('Error checking workflow timeouts:', error);
    }
  },

  async escalateWorkflow(instanceId: string, step: string): Promise<boolean> {
    try {
      const instance = await this.getWorkflowInstance(instanceId);
      if (!instance) return false;

      const { error } = await supabase
        .from('workflow_instances')
        .update({
          data: {
            ...instance.data,
            [`${step}_escalated`]: true,
            [`${step}_escalated_at`]: new Date().toISOString(),
          },
        })
        .eq('id', instanceId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error escalating workflow:', error);
      return false;
    }
  },

  async notifyStepAssignee(
    instanceId: string,
    stepName: string
  ): Promise<void> {
    try {
      const instance = await this.getWorkflowInstance(instanceId);
      if (!instance) return;

      const workflow = await this.getWorkflowByName(instance.workflow_id);
      if (!workflow) return;

      const step = workflow.steps.find((s) => s.step === stepName);
      if (!step) return;

      const { data: users } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', step.role);

      if (users) {
        for (const user of users) {
          await notificationService.createNotification({
            user_id: user.user_id,
            notification_type: 'workflow_task',
            title: `Workflow Task: ${stepName}`,
            message: `A ${workflow.workflow_type} workflow requires your attention for ${instance.entity_type} ${instance.entity_id}`,
            entity_type: instance.entity_type,
            entity_id: instance.entity_id,
            priority: 'high',
          });
        }
      }
    } catch (error) {
      console.error('Error notifying step assignee:', error);
    }
  },

  async getUserWorkflowTasks(userId: string): Promise<WorkflowInstance[]> {
    try {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!userRoles || userRoles.length === 0) return [];

      const roles = userRoles.map((r) => r.role);

      const activeWorkflows = await this.getActiveWorkflows();

      const userTasks: WorkflowInstance[] = [];

      for (const instance of activeWorkflows) {
        if (!instance.current_step) continue;

        const workflow = await this.getWorkflowByName(instance.workflow_id);
        if (!workflow) continue;

        const currentStep = workflow.steps.find(
          (s) => s.step === instance.current_step
        );

        if (currentStep && roles.includes(currentStep.role)) {
          userTasks.push(instance);
        }
      }

      return userTasks;
    } catch (error) {
      console.error('Error fetching user workflow tasks:', error);
      return [];
    }
  },

  async getWorkflowHistory(
    entityType: string,
    entityId: string
  ): Promise<WorkflowInstance[]> {
    try {
      const { data, error } = await supabase
        .from('workflow_instances')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching workflow history:', error);
      return [];
    }
  },
};
