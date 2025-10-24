import { supabase } from '@/lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  priority: 'high' | 'normal' | 'low';
  created_at: string;
  read_at?: string;
}

export interface CreateNotificationParams {
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailQueueItem {
  id: string;
  template_id?: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body: string;
  variables: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  priority: 'high' | 'normal' | 'low';
  scheduled_for: string;
  sent_at?: string;
  error_message?: string;
  retry_count: number;
}

export interface EmailTemplate {
  id: string;
  template_name: string;
  template_type: string;
  subject_en: string;
  subject_fr: string;
  body_en: string;
  body_fr: string;
  variables: string[];
  version: number;
  is_active: boolean;
}

export const notificationService = {
  async createNotification(
    params: CreateNotificationParams
  ): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            ...params,
            priority: params.priority || 'normal',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  },

  async getUserNotifications(
    userId: string,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  },

  async getEmailTemplate(
    templateName: string,
    language: 'en' | 'fr' = 'en'
  ): Promise<EmailTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_name', templateName)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching email template:', error);
      return null;
    }
  },

  async queueEmail(params: {
    templateName: string;
    recipientEmail: string;
    recipientName?: string;
    variables: Record<string, any>;
    language?: 'en' | 'fr';
    priority?: 'high' | 'normal' | 'low';
    scheduledFor?: string;
  }): Promise<boolean> {
    try {
      const template = await this.getEmailTemplate(
        params.templateName,
        params.language || 'en'
      );

      if (!template) {
        console.error('Template not found:', params.templateName);
        return false;
      }

      const lang = params.language || 'en';
      let subject = lang === 'en' ? template.subject_en : template.subject_fr;
      let body = lang === 'en' ? template.body_en : template.body_fr;

      Object.entries(params.variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, String(value));
        body = body.replace(regex, String(value));
      });

      const { error } = await supabase.from('email_queue').insert([
        {
          template_id: template.id,
          recipient_email: params.recipientEmail,
          recipient_name: params.recipientName,
          subject,
          body,
          variables: params.variables,
          priority: params.priority || 'normal',
          scheduled_for: params.scheduledFor || new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error queueing email:', error);
      return false;
    }
  },

  async getPendingEmails(limit: number = 50): Promise<EmailQueueItem[]> {
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('scheduled_for', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pending emails:', error);
      return [];
    }
  },

  async updateEmailStatus(
    emailId: string,
    status: 'sent' | 'failed' | 'bounced',
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await supabase
        .from('email_queue')
        .update(updateData)
        .eq('id', emailId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating email status:', error);
      return false;
    }
  },

  async notifyBatchStatusChange(
    userId: string,
    batchNumber: string,
    oldStatus: string,
    newStatus: string,
    details: string = ''
  ): Promise<boolean> {
    const notification = await this.createNotification({
      user_id: userId,
      notification_type: 'batch_status',
      title: `Batch ${batchNumber} Status Update`,
      message: `Status changed from ${oldStatus} to ${newStatus}. ${details}`,
      entity_type: 'batch',
      entity_id: batchNumber,
      priority: 'normal',
    });

    return notification !== null;
  },

  async notifySaleApproval(
    userId: string,
    saleNumber: string,
    customerName: string,
    amount: number
  ): Promise<boolean> {
    const notification = await this.createNotification({
      user_id: userId,
      notification_type: 'sale_approval',
      title: `Sale Approval Required`,
      message: `Sale ${saleNumber} for ${customerName} requires approval. Amount: $${amount.toFixed(2)}`,
      entity_type: 'sale',
      entity_id: saleNumber,
      priority: 'high',
    });

    return notification !== null;
  },

  async notifyVarianceAlert(
    userId: string,
    batchNumber: string,
    variance: number,
    expectedWeight: number,
    actualWeight: number
  ): Promise<boolean> {
    const notification = await this.createNotification({
      user_id: userId,
      notification_type: 'variance_alert',
      title: `Weight Variance Alert`,
      message: `Batch ${batchNumber}: ${variance}% variance detected. Expected: ${expectedWeight}g, Received: ${actualWeight}g`,
      entity_type: 'batch',
      entity_id: batchNumber,
      priority: 'high',
    });

    return notification !== null;
  },
};
