import { supabase } from '@/lib/supabase';
import { logBatchAction } from '@/lib/auditLog';

export interface QualityCheck {
  batch_id: string;
  check_type: 'initial' | 'intermediate' | 'final' | 'random' | 'customs';
  purity_percentage?: number;
  appearance_grade?: 'A' | 'B' | 'C' | 'ungraded';
  test_method?: string;
  test_results?: Record<string, any>;
  inspector_id: string;
  passed: boolean;
  notes?: string;
}

export interface BatchSplit {
  parent_batch_id: string;
  split_weight_grams: number;
  split_reason: string;
  split_by: string;
}

export interface BatchMerge {
  source_batch_ids: string[];
  merge_reason: string;
  merged_by: string;
}

export interface TransportationDetails {
  batch_id: string;
  vehicle_id?: string;
  driver_name?: string;
  driver_phone?: string;
  license_plate?: string;
  departure_time?: string;
  estimated_arrival?: string;
  route_description?: string;
  seal_number?: string;
  gps_tracking_enabled?: boolean;
}

export interface BatchAlert {
  batch_id: string;
  alert_type: 'variance' | 'delay' | 'quality' | 'security' | 'customs' | 'approval_pending' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
}

export interface BatchReservation {
  batch_id: string;
  customer_id: string;
  reserved_weight_grams: number;
  reservation_expires_at: string;
  reserved_by: string;
  notes?: string;
}

export const batchEnhancedService = {
  async addQualityCheck(check: QualityCheck, userEmail: string) {
    const { data, error } = await supabase
      .from('batch_quality_checks')
      .insert({
        ...check,
        inspection_date: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    await logBatchAction(
      check.inspector_id,
      userEmail,
      'QUALITY_CHECK',
      check.batch_id,
      `Quality check: ${check.check_type} - ${check.passed ? 'Passed' : 'Failed'}`
    );

    if (!check.passed) {
      await this.createAlert({
        batch_id: check.batch_id,
        alert_type: 'quality',
        severity: 'high',
        message: `Quality check failed: ${check.check_type}`,
        details: { check_type: check.check_type, notes: check.notes },
      });
    }

    return data;
  },

  async getQualityChecks(batchId: string) {
    const { data, error } = await supabase
      .from('batch_quality_checks')
      .select(`
        *,
        inspector:user_profiles!batch_quality_checks_inspector_id_fkey(full_name, email)
      `)
      .eq('batch_id', batchId)
      .order('inspection_date', { ascending: false });

    if (error) {
      console.error('[batchEnhancedService] Error loading quality checks:', error);
      throw error;
    }
    return data;
  },

  async splitBatch(split: BatchSplit, userEmail: string) {
    const { data: parentBatch, error: fetchError } = await supabase
      .from('batches')
      .select('batch_number, weight_grams, origin_site_id, metal_type')
      .eq('id', split.parent_batch_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!parentBatch) throw new Error('Parent batch not found');

    if (split.split_weight_grams >= parentBatch.weight_grams) {
      throw new Error('Split weight cannot exceed parent batch weight');
    }

    const childBatchNumber = `${parentBatch.batch_number}-S${Date.now().toString().slice(-4)}`;
    const remainingWeight = parentBatch.weight_grams - split.split_weight_grams;

    const { data: childBatch, error: createError } = await supabase
      .from('batches')
      .insert({
        batch_number: childBatchNumber,
        weight_grams: split.split_weight_grams,
        weight_ounces: split.split_weight_grams / 31.1035,
        origin_site_id: parentBatch.origin_site_id,
        current_site_id: parentBatch.origin_site_id,
        metal_type: parentBatch.metal_type,
        status: 'created',
        created_by: split.split_by,
        comments: `Split from ${parentBatch.batch_number}: ${split.split_reason}`,
        shipping_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .maybeSingle();

    if (createError) throw createError;

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        weight_grams: remainingWeight,
        weight_ounces: remainingWeight / 31.1035,
      })
      .eq('id', split.parent_batch_id);

    if (updateError) throw updateError;

    const { error: splitRecordError } = await supabase
      .from('batch_splits')
      .insert({
        parent_batch_id: split.parent_batch_id,
        child_batch_id: childBatch.id,
        split_weight_grams: split.split_weight_grams,
        split_percentage: (split.split_weight_grams / parentBatch.weight_grams) * 100,
        split_reason: split.split_reason,
        split_by: split.split_by,
      });

    if (splitRecordError) throw splitRecordError;

    await logBatchAction(
      split.split_by,
      userEmail,
      'SPLIT_BATCH',
      split.parent_batch_id,
      `Batch split: Created ${childBatchNumber} with ${split.split_weight_grams}g`
    );

    return { parent: parentBatch, child: childBatch };
  },

  async mergeBatches(merge: BatchMerge, userEmail: string) {
    const { data: sourceBatches, error: fetchError } = await supabase
      .from('batches')
      .select('id, batch_number, weight_grams, origin_site_id, metal_type, status')
      .in('id', merge.source_batch_ids);

    if (fetchError) throw fetchError;
    if (!sourceBatches || sourceBatches.length === 0) {
      throw new Error('Source batches not found');
    }

    const metalTypes = [...new Set(sourceBatches.map(b => b.metal_type))];
    if (metalTypes.length > 1) {
      throw new Error('Cannot merge batches of different metal types');
    }

    const totalWeight = sourceBatches.reduce((sum, b) => sum + Number(b.weight_grams), 0);
    const targetBatchNumber = `MRG-${Date.now().toString().slice(-8)}`;

    const { data: targetBatch, error: createError } = await supabase
      .from('batches')
      .insert({
        batch_number: targetBatchNumber,
        weight_grams: totalWeight,
        weight_ounces: totalWeight / 31.1035,
        origin_site_id: sourceBatches[0].origin_site_id,
        current_site_id: sourceBatches[0].origin_site_id,
        metal_type: sourceBatches[0].metal_type,
        status: 'created',
        created_by: merge.merged_by,
        comments: `Merged from: ${sourceBatches.map(b => b.batch_number).join(', ')}. Reason: ${merge.merge_reason}`,
        shipping_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .maybeSingle();

    if (createError) throw createError;

    const { error: mergeRecordError } = await supabase
      .from('batch_merges')
      .insert({
        source_batch_ids: merge.source_batch_ids,
        target_batch_id: targetBatch.id,
        merge_reason: merge.merge_reason,
        total_weight_grams: totalWeight,
        merged_by: merge.merged_by,
      });

    if (mergeRecordError) throw mergeRecordError;

    const { error: updateError } = await supabase
      .from('batches')
      .update({ status: 'merged' })
      .in('id', merge.source_batch_ids);

    if (updateError) throw updateError;

    await logBatchAction(
      merge.merged_by,
      userEmail,
      'MERGE_BATCHES',
      targetBatch.id,
      `Batches merged: ${sourceBatches.map(b => b.batch_number).join(', ')}`
    );

    return targetBatch;
  },

  async addTransportationDetails(details: TransportationDetails) {
    const { data, error } = await supabase
      .from('transportation_details')
      .insert(details)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateTransportationDetails(
    batchId: string,
    updates: Partial<TransportationDetails>
  ) {
    const { data, error } = await supabase
      .from('transportation_details')
      .update(updates)
      .eq('batch_id', batchId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getTransportationDetails(batchId: string) {
    const { data, error } = await supabase
      .from('transportation_details')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createAlert(alert: BatchAlert) {
    const { data, error } = await supabase
      .from('batch_alerts')
      .insert(alert)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getAlerts(batchId?: string, severity?: string) {
    let query = supabase
      .from('batch_alerts')
      .select(`
        *,
        batch:batches(batch_number, status)
      `)
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async acknowledgeAlert(alertId: string, userId: string, userEmail: string) {
    const { error } = await supabase
      .from('batch_alerts')
      .update({
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) throw error;
    return true;
  },

  async resolveAlert(
    alertId: string,
    userId: string,
    userEmail: string,
    resolutionNotes: string
  ) {
    const { error } = await supabase
      .from('batch_alerts')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq('id', alertId);

    if (error) throw error;
    return true;
  },

  async createReservation(reservation: BatchReservation) {
    const availableWeight = await supabase.rpc('get_batch_available_weight', {
      p_batch_id: reservation.batch_id,
    });

    if (availableWeight.error) throw availableWeight.error;

    if (reservation.reserved_weight_grams > (availableWeight.data || 0)) {
      throw new Error('Insufficient available weight for reservation');
    }

    const { data, error } = await supabase
      .from('batch_reservations')
      .insert({
        ...reservation,
        reserved_weight_ounces: reservation.reserved_weight_grams / 31.1035,
        status: 'active',
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getReservations(batchId: string) {
    const { data, error } = await supabase
      .from('batch_reservations')
      .select(`
        *,
        reserved_by_user:user_profiles!batch_reservations_reserved_by_fkey(full_name, email)
      `)
      .eq('batch_id', batchId)
      .eq('status', 'active')
      .order('reserved_at', { ascending: false });

    if (error) {
      console.error('[batchEnhancedService] Error loading reservations:', error);
      throw error;
    }
    return data;
  },

  async releaseReservation(reservationId: string, userId: string, userEmail: string) {
    const { error } = await supabase
      .from('batch_reservations')
      .update({
        status: 'cancelled',
        released_at: new Date().toISOString(),
      })
      .eq('id', reservationId);

    if (error) throw error;
    return true;
  },

  async addBatchTag(batchId: string, tagName: string, tagCategory: string, userId: string) {
    const { data, error } = await supabase
      .from('batch_tags')
      .insert({
        batch_id: batchId,
        tag_name: tagName,
        tag_category: tagCategory,
        created_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getBatchTags(batchId: string) {
    const { data, error } = await supabase
      .from('batch_tags')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async removeBatchTag(tagId: string) {
    const { error } = await supabase
      .from('batch_tags')
      .delete()
      .eq('id', tagId);

    if (error) throw error;
    return true;
  },

  async putBatchOnHold(
    batchId: string,
    holdReason: string,
    userId: string,
    userEmail: string
  ) {
    const { error } = await supabase
      .from('batches')
      .update({
        is_on_hold: true,
        hold_reason: holdReason,
      })
      .eq('id', batchId);

    if (error) throw error;

    await this.createAlert({
      batch_id: batchId,
      alert_type: 'security',
      severity: 'high',
      message: `Batch placed on hold: ${holdReason}`,
    });

    await logBatchAction(
      userId,
      userEmail,
      'HOLD_BATCH',
      batchId,
      `Batch placed on hold: ${holdReason}`
    );

    return true;
  },

  async releaseBatchHold(batchId: string, userId: string, userEmail: string) {
    const { error } = await supabase
      .from('batches')
      .update({
        is_on_hold: false,
        hold_released_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    if (error) throw error;

    await logBatchAction(
      userId,
      userEmail,
      'RELEASE_HOLD',
      batchId,
      'Batch hold released'
    );

    return true;
  },

  async expireReservations() {
    const { error } = await supabase.rpc('expire_batch_reservations');
    if (error) throw error;
    return true;
  },
};
