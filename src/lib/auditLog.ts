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

// Generic audit action logger compatible with salesService
export interface AuditActionEntry {
  action: string;
  table_name: string;
  record_id: string;
  details: Record<string, any>;
  user_email: string;
}

export async function logAuditAction(entry: AuditActionEntry): Promise<void> {
  try {
    // Try inserting into audit_trail table (new schema)
    const { error: trailError } = await supabase
      .from('audit_trail')
      .insert({
        action: entry.action,
        table_name: entry.table_name,
        record_id: entry.record_id,
        details: entry.details,
        user_email: entry.user_email,
        created_at: new Date().toISOString()
      });

    if (trailError) {
      console.warn('audit_trail insert failed, trying audit_logs fallback:', trailError);

      // Fallback to audit_logs table (legacy schema)
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          user_email: entry.user_email,
          action: entry.action,
          module: entry.table_name,
          details: JSON.stringify({
            record_id: entry.record_id,
            ...entry.details
          }),
          status: 'success'
        });

      if (logError) {
        console.error('Error logging audit action (both attempts failed):', logError);
        // Don't throw - audit logging shouldn't break main flow
      }
    }
  } catch (err) {
    console.error('Unexpected error in logAuditAction:', err);
    // Don't throw - audit logging shouldn't break main flow
  }
}
