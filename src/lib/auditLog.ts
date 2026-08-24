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

const MAX_CLIENT_DETAIL_CHARS = 8_000;

function auditEventType(module: string, action: string): string {
  const segment = (value: string) => value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
  return `client_observation:${segment(module)}:${segment(action)}`.slice(0, 100);
}

function boundedDetails(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return null;
    if (serialized.length > MAX_CLIENT_DETAIL_CHARS) {
      return { truncated: true, serialized_length: serialized.length };
    }
    return JSON.parse(serialized) as unknown;
  } catch {
    return { serialization_failed: true };
  }
}

async function recordClientObservation(
  eventType: string,
  userId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc('log_security_event', {
    // La fonction SQL remplace cette valeur par auth.uid() et rejette toute
    // tentative d'usurpation. NULL est volontaire quand l'appelant ne connaît
    // pas encore l'identité (par exemple une tentative de connexion échouée).
    p_user_id: userId,
    p_event_type: eventType,
    p_ip_address: null,
    p_user_agent: null,
    p_details: details,
  } as never);
  if (error) console.error('[audit] client observation rejected');
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await recordClientObservation(
      auditEventType(entry.module, entry.action),
      entry.user_id ?? null,
      {
        source: 'browser_observation',
        module: entry.module.slice(0, 100),
        action: entry.action.slice(0, 100),
        declared_status: entry.status,
        details: entry.details.slice(0, MAX_CLIENT_DETAIL_CHARS),
      },
    );
  } catch {
    // Une observation navigateur reste secondaire : les transitions sensibles
    // doivent être auditées par trigger/RPC serveur et non dépendre de cet appel.
    console.error('[audit] client observation unavailable');
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
  details: Record<string, unknown>;
  user_email: string;
}

export async function logAuditAction(entry: AuditActionEntry): Promise<void> {
  try {
    await recordClientObservation(
      auditEventType(entry.table_name, entry.action),
      null,
      {
        source: 'browser_observation',
        table_name: entry.table_name.slice(0, 100),
        action: entry.action.slice(0, 100),
        record_id: entry.record_id.slice(0, 128),
        details: boundedDetails(entry.details),
      },
    );
  } catch {
    console.error('[audit] client observation unavailable');
  }
}
