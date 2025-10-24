import { supabase } from '@/lib/supabase';
import { exchangeRateService } from './exchangeRateService';
import { goldPriceService } from './goldPriceService';
import { notificationService } from './notificationService';
import { workflowService } from './workflowService';
import { analyticsService } from './analyticsService';

export interface ScheduledTask {
  id: string;
  task_name: string;
  task_type: string;
  schedule: string;
  is_active: boolean;
  last_run?: string;
  next_run?: string;
  last_status?: string;
  last_error?: string;
  execution_count: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const scheduledTaskService = {
  async getTask(taskName: string): Promise<ScheduledTask | null> {
    try {
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('task_name', taskName)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  },

  async getAllActiveTasks(): Promise<ScheduledTask[]> {
    try {
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('is_active', true)
        .order('task_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching active tasks:', error);
      return [];
    }
  },

  async updateTaskStatus(
    taskName: string,
    status: 'success' | 'failed',
    error?: string
  ): Promise<boolean> {
    try {
      const updateData: any = {
        last_run: new Date().toISOString(),
        last_status: status,
        execution_count: supabase.rpc('increment', { column: 'execution_count' }),
      };

      if (error) {
        updateData.last_error = error;
      }

      const { error: updateError } = await supabase
        .from('scheduled_tasks')
        .update(updateData)
        .eq('task_name', taskName);

      if (updateError) throw updateError;
      return true;
    } catch (err) {
      console.error('Error updating task status:', err);
      return false;
    }
  },

  async executeFetchExchangeRates(): Promise<boolean> {
    try {
      const task = await this.getTask('fetch_exchange_rates');
      if (!task) return false;

      const currencies = task.settings.currencies || ['XOF', 'GNF'];
      const success = await exchangeRateService.fetchECBRates(currencies);

      await this.updateTaskStatus(
        'fetch_exchange_rates',
        success ? 'success' : 'failed',
        success ? undefined : 'Failed to fetch rates from ECB'
      );

      return success;
    } catch (error) {
      console.error('Error executing fetch_exchange_rates:', error);
      await this.updateTaskStatus(
        'fetch_exchange_rates',
        'failed',
        String(error)
      );
      return false;
    }
  },

  async executeFetchGoldPrices(): Promise<boolean> {
    try {
      const task = await this.getTask('fetch_gold_prices');
      if (!task) return false;

      const { data: config } = await supabase
        .from('api_configurations')
        .select('api_key')
        .eq('api_name', 'alphavantage')
        .single();

      const success = await goldPriceService.fetchAlphaVantagePrice(
        config?.api_key
      );

      await this.updateTaskStatus(
        'fetch_gold_prices',
        success ? 'success' : 'failed',
        success ? undefined : 'Failed to fetch gold prices'
      );

      return success;
    } catch (error) {
      console.error('Error executing fetch_gold_prices:', error);
      await this.updateTaskStatus(
        'fetch_gold_prices',
        'failed',
        String(error)
      );
      return false;
    }
  },

  async executeProcessEmailQueue(): Promise<boolean> {
    try {
      const task = await this.getTask('process_email_queue');
      if (!task) return false;

      const batchSize = task.settings.batch_size || 50;
      const emails = await notificationService.getPendingEmails(batchSize);

      let successCount = 0;
      let failureCount = 0;

      for (const email of emails) {
        const success = await this.sendEmail(email);

        if (success) {
          await notificationService.updateEmailStatus(email.id, 'sent');
          successCount++;
        } else {
          if (email.retry_count < 3) {
            await supabase
              .from('email_queue')
              .update({
                retry_count: email.retry_count + 1,
                scheduled_for: new Date(
                  Date.now() + 15 * 60 * 1000
                ).toISOString(),
              })
              .eq('id', email.id);
          } else {
            await notificationService.updateEmailStatus(
              email.id,
              'failed',
              'Max retry attempts reached'
            );
          }
          failureCount++;
        }
      }

      await this.updateTaskStatus(
        'process_email_queue',
        'success',
        `Processed ${emails.length} emails: ${successCount} sent, ${failureCount} failed`
      );

      return true;
    } catch (error) {
      console.error('Error executing process_email_queue:', error);
      await this.updateTaskStatus(
        'process_email_queue',
        'failed',
        String(error)
      );
      return false;
    }
  },

  async executeCleanupOldCache(): Promise<boolean> {
    try {
      const task = await this.getTask('cleanup_old_cache');
      if (!task) return false;

      const { error } = await supabase.rpc('cleanup_expired_cache');

      if (error) throw error;

      await this.updateTaskStatus('cleanup_old_cache', 'success');
      return true;
    } catch (error) {
      console.error('Error executing cleanup_old_cache:', error);
      await this.updateTaskStatus(
        'cleanup_old_cache',
        'failed',
        String(error)
      );
      return false;
    }
  },

  async executeGenerateDailyReports(): Promise<boolean> {
    try {
      const task = await this.getTask('generate_daily_reports');
      if (!task) return false;

      await analyticsService.refreshMaterializedViews();

      const metrics = await analyticsService.getDashboardMetrics();

      const { data: managementUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'management');

      if (managementUsers) {
        for (const user of managementUsers) {
          await notificationService.createNotification({
            user_id: user.user_id,
            notification_type: 'daily_report',
            title: 'Daily Performance Report',
            message: `Total Revenue: $${metrics.totalRevenue.toFixed(2)} | Sales: ${metrics.totalSales} | Active Customers: ${metrics.activeCustomers}`,
            priority: 'normal',
          });
        }
      }

      await this.updateTaskStatus('generate_daily_reports', 'success');
      return true;
    } catch (error) {
      console.error('Error executing generate_daily_reports:', error);
      await this.updateTaskStatus(
        'generate_daily_reports',
        'failed',
        String(error)
      );
      return false;
    }
  },

  async executeCheckWorkflowTimeouts(): Promise<boolean> {
    try {
      const task = await this.getTask('check_workflow_timeouts');
      if (!task) return false;

      await workflowService.checkTimeouts();

      await this.updateTaskStatus('check_workflow_timeouts', 'success');
      return true;
    } catch (error) {
      console.error('Error executing check_workflow_timeouts:', error);
      await this.updateTaskStatus(
        'check_workflow_timeouts',
        'failed',
        String(error)
      );
      return false;
    }
  },

  async sendEmail(email: any): Promise<boolean> {
    console.log('Sending email:', {
      to: email.recipient_email,
      subject: email.subject,
    });
    return true;
  },

  async executeTask(taskName: string): Promise<boolean> {
    switch (taskName) {
      case 'fetch_exchange_rates':
        return this.executeFetchExchangeRates();
      case 'fetch_gold_prices':
        return this.executeFetchGoldPrices();
      case 'process_email_queue':
        return this.executeProcessEmailQueue();
      case 'cleanup_old_cache':
        return this.executeCleanupOldCache();
      case 'generate_daily_reports':
        return this.executeGenerateDailyReports();
      case 'check_workflow_timeouts':
        return this.executeCheckWorkflowTimeouts();
      default:
        console.error('Unknown task:', taskName);
        return false;
    }
  },

  async createTask(task: Partial<ScheduledTask>): Promise<boolean> {
    try {
      const { error } = await supabase.from('scheduled_tasks').insert([task]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  },

  async updateTask(
    taskName: string,
    updates: Partial<ScheduledTask>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('scheduled_tasks')
        .update(updates)
        .eq('task_name', taskName);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
    }
  },

  async deleteTask(taskName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('task_name', taskName);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  },
};
