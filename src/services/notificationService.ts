import { supabase } from '@/lib/supabase';

export interface EmailNotification {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface NotificationLog {
  id: string;
  notification_type: string;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string;
  error_message?: string;
}

async function sendEmail(notification: EmailNotification): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: notification,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error invoking email function:', error);
    return { success: false, error: error.message };
  }
}

export async function sendSaleApprovalRequest(
  saleId: string,
  saleNumber: string,
  customerName: string,
  quantityOz: number,
  finalProceeds: number,
  approverEmail: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: approverEmail,
    subject: `Sale Approval Request: ${saleNumber}`,
    template: 'sale_approval_request',
    data: {
      saleId,
      saleNumber,
      customerName,
      quantityOz,
      finalProceeds,
      approvalLink: `${window.location.origin}/sales/${saleId}`,
    },
  };

  return sendEmail(notification);
}

export async function sendSaleApprovedNotification(
  saleNumber: string,
  customerEmail: string,
  customerName: string,
  quantityOz: number,
  londonAMRate: number,
  finalProceeds: number,
  saleId: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: customerEmail,
    subject: `Sale Approved: ${saleNumber}`,
    template: 'sale_approved',
    data: {
      customerName,
      saleNumber,
      quantityOz,
      londonAMRate,
      finalProceeds,
      approvalLink: `${window.location.origin}/customer/sales/${saleId}/approve`,
      rejectLink: `${window.location.origin}/customer/sales/${saleId}/reject`,
    },
  };

  return sendEmail(notification);
}

export async function sendSaleRejectedNotification(
  saleNumber: string,
  customerEmail: string,
  customerName: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: customerEmail,
    subject: `Sale Rejected: ${saleNumber}`,
    template: 'sale_rejected',
    data: {
      customerName,
      saleNumber,
      reason,
    },
  };

  return sendEmail(notification);
}

export async function sendCustomerApprovalNotification(
  saleNumber: string,
  salesTeamEmail: string,
  customerName: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: salesTeamEmail,
    subject: `Customer Approved Sale: ${saleNumber}`,
    template: 'customer_approved',
    data: {
      saleNumber,
      customerName,
    },
  };

  return sendEmail(notification);
}

export async function sendPaymentConfirmationRequest(
  paymentNumber: string,
  saleNumber: string,
  amount: number,
  currency: string,
  approverEmail: string,
  paymentId: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: approverEmail,
    subject: `Payment Confirmation Required: ${paymentNumber}`,
    template: 'payment_confirmation_request',
    data: {
      paymentNumber,
      saleNumber,
      amount,
      currency,
      paymentLink: `${window.location.origin}/payments/${paymentId}`,
    },
  };

  return sendEmail(notification);
}

export async function sendPaymentReceivedNotification(
  paymentNumber: string,
  customerEmail: string,
  customerName: string,
  amount: number,
  currency: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: customerEmail,
    subject: `Payment Received: ${paymentNumber}`,
    template: 'payment_received',
    data: {
      customerName,
      paymentNumber,
      amount,
      currency,
    },
  };

  return sendEmail(notification);
}

export async function sendBatchStatusNotification(
  batchNumber: string,
  status: string,
  recipientEmail: string,
  recipientName: string,
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: recipientEmail,
    subject: `Batch Status Update: ${batchNumber} - ${status}`,
    template: 'batch_status_update',
    data: {
      recipientName,
      batchNumber,
      status,
      batchLink: `${window.location.origin}/batches/${batchId}`,
    },
  };

  return sendEmail(notification);
}

export async function sendVarianceAlert(
  batchNumber: string,
  expectedWeight: number,
  actualWeight: number,
  variance: number,
  recipientEmail: string,
  recipientName: string,
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: recipientEmail,
    subject: `Variance Alert: ${batchNumber}`,
    template: 'variance_alert',
    data: {
      recipientName,
      batchNumber,
      expectedWeight,
      actualWeight,
      variance,
      batchLink: `${window.location.origin}/batches/${batchId}`,
    },
  };

  return sendEmail(notification);
}

export async function sendQualityCheckAlert(
  batchNumber: string,
  checkType: string,
  passed: boolean,
  recipientEmail: string,
  recipientName: string,
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: recipientEmail,
    subject: `Quality Check ${passed ? 'Passed' : 'Failed'}: ${batchNumber}`,
    template: 'quality_check_alert',
    data: {
      recipientName,
      batchNumber,
      checkType,
      passed,
      batchLink: `${window.location.origin}/batches/${batchId}`,
    },
  };

  return sendEmail(notification);
}

export async function getNotificationLogs(filters?: {
  notification_type?: string;
  recipient_email?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ success: boolean; data?: NotificationLog[]; error?: string }> {
  try {
    let query = supabase
      .from('notification_logs')
      .select('*')
      .order('sent_at', { ascending: false });

    if (filters?.notification_type) {
      query = query.eq('notification_type', filters.notification_type);
    }

    if (filters?.recipient_email) {
      query = query.eq('recipient_email', filters.recipient_email);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.date_from) {
      query = query.gte('sent_at', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('sent_at', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function logNotification(
  notificationType: string,
  recipientEmail: string,
  subject: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('notification_logs')
      .insert({
        notification_type: notificationType,
        recipient_email: recipientEmail,
        subject,
        status,
        error_message: errorMessage,
        sent_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendBulkNotifications(
  notifications: EmailNotification[]
): Promise<{ success: boolean; results?: Array<{ to: string; success: boolean; error?: string }>; error?: string }> {
  try {
    const results = await Promise.all(
      notifications.map(async (notification) => {
        const result = await sendEmail(notification);
        return {
          to: notification.to,
          success: result.success,
          error: result.error,
        };
      })
    );

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      results,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendTestEmail(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  const notification: EmailNotification = {
    to: recipientEmail,
    subject: 'Test Email from Gold Shipper',
    template: 'test_email',
    data: {
      message: 'This is a test email to verify the email notification system is working correctly.',
      timestamp: new Date().toISOString(),
    },
  };

  return sendEmail(notification);
}
