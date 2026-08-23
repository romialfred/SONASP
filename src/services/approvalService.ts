import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import type { Tables } from '@/types/database';

export type ApprovalRequest = Tables<'approval_requests'>;

export interface ApprovalDecision {
  request_id: string;
  entity_id: string;
  decision: 'approve' | 'reject';
  status: string;
}

type ServiceResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Point de passage unique pour une décision d'approbation.
 *
 * Le courriel de l'utilisateur n'est volontairement pas transmis au serveur :
 * l'identité, le rôle, le MFA, l'affectation et l'état courant sont contrôlés
 * dans la transaction à partir de auth.uid().
 */
async function decide(
  approvalRequestId: string,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<ServiceResult<ApprovalDecision>> {
  try {
    const { data, error } = await supabase.rpc('snp_decider_approbation', {
      p_demande_id: approvalRequestId,
      p_decision: decision,
      p_motif: reason?.trim() || null,
    });

    if (error) throw error;
    return { success: true, data: data as unknown as ApprovalDecision };
  } catch (reasonCaught) {
    return {
      success: false,
      error: errorMessage(reasonCaught, "La décision n'a pas pu être enregistrée."),
    };
  }
}

export async function approveRequest(
  approvalRequestId: string,
  _legacyApproverEmail?: string,
  comments?: string
): Promise<ServiceResult<ApprovalDecision>> {
  return decide(approvalRequestId, 'approve', comments);
}

export async function rejectRequest(
  approvalRequestId: string,
  _legacyApproverEmail: string | undefined,
  reason: string
): Promise<ServiceResult<ApprovalDecision>> {
  if (reason.trim().length < 5) {
    return { success: false, error: 'Le motif de rejet doit comporter au moins 5 caractères.' };
  }
  return decide(approvalRequestId, 'reject', reason);
}

async function findPendingSaleRequest(saleId: string): Promise<string> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('entity_id', saleId)
    .in('request_type', ['sale', 'sale_approval'])
    .in('status', ['pending', 'escalated'])
    .order('requested_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Aucune demande d'approbation active n'est rattachée à cette vente.");
  return data.id;
}

export async function approveSale(
  saleId: string,
  _legacyApproverEmail?: string,
  comments?: string
): Promise<ServiceResult<ApprovalDecision>> {
  try {
    return decide(await findPendingSaleRequest(saleId), 'approve', comments);
  } catch (reason) {
    return { success: false, error: errorMessage(reason, "La vente n'a pas pu être approuvée.") };
  }
}

export async function rejectSale(
  saleId: string,
  _legacyApproverEmail: string | undefined,
  reason: string
): Promise<ServiceResult<ApprovalDecision>> {
  if (reason.trim().length < 5) {
    return { success: false, error: 'Le motif de rejet doit comporter au moins 5 caractères.' };
  }
  try {
    return decide(await findPendingSaleRequest(saleId), 'reject', reason);
  } catch (reasonCaught) {
    return { success: false, error: errorMessage(reasonCaught, "La vente n'a pas pu être rejetée.") };
  }
}

export async function getApprovalRequestsByEntity(
  entityId: string,
  entityType: string
): Promise<ServiceResult<ApprovalRequest[]>> {
  try {
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (reason) {
    return {
      success: false,
      error: errorMessage(reason, "Impossible de charger l'historique des approbations."),
    };
  }
}

/** Le filtrage nominatif est effectué par RLS à partir de la session courante. */
export async function getPendingApprovals(
  _legacyApproverEmail?: string
): Promise<ServiceResult<ApprovalRequest[]>> {
  try {
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .in('status', ['pending', 'escalated'])
      .order('requested_at', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (reason) {
    return {
      success: false,
      error: errorMessage(reason, "Impossible de charger les approbations en attente."),
    };
  }
}

export async function getApprovalStatistics(): Promise<
  ServiceResult<{
    total_pending: number;
    total_approved: number;
    total_rejected: number;
    avg_approval_time_hours: number;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('approval_requests')
      .select('status, requested_at, approved_at');
    if (error) throw error;

    const rows = data || [];
    const durations = rows
      .filter((row) => row.status === 'approved' && row.requested_at && row.approved_at)
      .map(
        (row) =>
          (new Date(row.approved_at as string).getTime() -
            new Date(row.requested_at as string).getTime()) /
          3_600_000
      )
      .filter((duration) => Number.isFinite(duration) && duration >= 0);

    return {
      success: true,
      data: {
        total_pending: rows.filter((row) => ['pending', 'escalated'].includes(row.status || '')).length,
        total_approved: rows.filter((row) => row.status === 'approved').length,
        total_rejected: rows.filter((row) => row.status === 'rejected').length,
        avg_approval_time_hours:
          durations.length > 0
            ? durations.reduce((total, duration) => total + duration, 0) / durations.length
            : 0,
      },
    };
  } catch (reason) {
    return {
      success: false,
      error: errorMessage(reason, "Impossible de calculer les statistiques d'approbation."),
    };
  }
}
