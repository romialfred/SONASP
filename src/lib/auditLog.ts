import { supabase } from './supabase';

export interface AuditLogEntry {
  user_id?: string;
  user_email?: string;
  action: string;
  module: string;
  details: string;
  ip_address?: string;
  status: 'success' | 'failed' | 'warning';
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.user_id || null,
      user_email: entry.user_email || null,
      action: entry.action,
      module: entry.module,
      details: entry.details,
      ip_address: entry.ip_address || null,
      status: entry.status,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

export async function logBatchAction(
  userId: string,
  userEmail: string,
  action: string,
  batchNumber: string,
  details?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    user_email: userEmail,
    action,
    module: 'Batches',
    details: `Batch ${batchNumber}: ${details || action}`,
    status: 'success',
  });
}

export async function logSalesAction(
  userId: string,
  userEmail: string,
  action: string,
  saleNumber: string,
  details?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    user_email: userEmail,
    action,
    module: 'Sales',
    details: `Sale ${saleNumber}: ${details || action}`,
    status: 'success',
  });
}

export async function logCustomerAction(
  userId: string,
  userEmail: string,
  action: string,
  customerName: string,
  details?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    user_email: userEmail,
    action,
    module: 'Customers',
    details: `Customer ${customerName}: ${details || action}`,
    status: 'success',
  });
}

export async function logUserAction(
  userId: string,
  userEmail: string,
  action: string,
  targetUserEmail: string,
  details?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    user_email: userEmail,
    action,
    module: 'Users',
    details: `User ${targetUserEmail}: ${details || action}`,
    status: 'success',
  });
}

export async function logSystemAction(
  userId: string,
  userEmail: string,
  action: string,
  details: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    user_email: userEmail,
    action,
    module: 'System',
    details,
    status: 'success',
  });
}
