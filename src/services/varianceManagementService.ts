import { supabase } from '@/lib/supabase';
import { logBatchAction } from '@/lib/auditLog';
import { batchEnhancedService } from './batchEnhancedService';

export interface VarianceAnalysis {
  variance_grams: number;
  variance_percentage: number;
  is_significant: boolean;
  severity: 'minor' | 'moderate' | 'significant' | 'critical';
  requires_investigation: boolean;
  automatic_approval_allowed: boolean;
}

export interface VarianceInvestigation {
  receiving_record_id: string;
  batch_id: string;
  investigation_type: 'shortage' | 'overage' | 'damage' | 'theft' | 'measurement_error' | 'other';
  assigned_investigator_id?: string;
  findings?: string;
  evidence_collected?: Record<string, any>;
  responsible_party?: string;
  financial_impact?: number;
}

export interface VarianceTrendData {
  route?: string;
  transporter?: string;
  site?: string;
  period: string;
  total_batches: number;
  total_variance_grams: number;
  average_variance_percentage: number;
  significant_variances: number;
}

export const varianceManagementService = {
  async analyzeVariance(
    expectedWeight: number,
    actualWeight: number,
    metalType: string = 'gold'
  ): Promise<VarianceAnalysis> {
    const varianceGrams = actualWeight - expectedWeight;
    const variancePercentage = (varianceGrams / expectedWeight) * 100;
    const absVariancePercentage = Math.abs(variancePercentage);

    const thresholds = {
      gold: {
        minor: 0.1,
        moderate: 0.5,
        significant: 1.0,
        critical: 2.0,
      },
      silver: {
        minor: 0.2,
        moderate: 1.0,
        significant: 2.0,
        critical: 3.0,
      },
    };

    const threshold = thresholds[metalType as keyof typeof thresholds] || thresholds.gold;

    let severity: 'minor' | 'moderate' | 'significant' | 'critical';
    if (absVariancePercentage <= threshold.minor) {
      severity = 'minor';
    } else if (absVariancePercentage <= threshold.moderate) {
      severity = 'moderate';
    } else if (absVariancePercentage <= threshold.significant) {
      severity = 'significant';
    } else {
      severity = 'critical';
    }

    const isSignificant = absVariancePercentage > threshold.moderate;
    const requiresInvestigation = absVariancePercentage > threshold.significant;
    const automaticApprovalAllowed = absVariancePercentage <= threshold.minor;

    return {
      variance_grams: varianceGrams,
      variance_percentage: variancePercentage,
      is_significant: isSignificant,
      severity,
      requires_investigation: requiresInvestigation,
      automatic_approval_allowed: automaticApprovalAllowed,
    };
  },

  async recordVariance(
    batchId: string,
    receivingSiteId: string,
    expectedWeight: number,
    actualWeight: number,
    receivedBy: string,
    receivedByEmail: string,
    comments?: string
  ) {
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('metal_type, batch_number')
      .eq('id', batchId)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) throw new Error('Batch not found');

    const analysis = await this.analyzeVariance(
      expectedWeight,
      actualWeight,
      batch.metal_type
    );

    const { data: receivingRecord, error: recordError } = await supabase
      .from('receiving_records')
      .insert({
        batch_id: batchId,
        receiving_site_id: receivingSiteId,
        expected_weight_grams: expectedWeight,
        actual_weight_grams: actualWeight,
        variance_grams: analysis.variance_grams,
        variance_percentage: analysis.variance_percentage,
        is_significant_variance: analysis.is_significant,
        received_by: receivedBy,
        reconciliation_comments: comments,
      })
      .select()
      .maybeSingle();

    if (recordError) throw recordError;

    if (analysis.requires_investigation) {
      await this.createInvestigation({
        receiving_record_id: receivingRecord.id,
        batch_id: batchId,
        investigation_type: analysis.variance_grams < 0 ? 'shortage' : 'overage',
      });
    }

    if (analysis.is_significant) {
      await batchEnhancedService.createAlert({
        batch_id: batchId,
        alert_type: 'variance',
        severity: analysis.severity === 'critical' ? 'critical' : 'high',
        message: `Significant variance detected: ${analysis.variance_percentage.toFixed(2)}%`,
        details: {
          expected_weight: expectedWeight,
          actual_weight: actualWeight,
          variance_grams: analysis.variance_grams,
          severity: analysis.severity,
        },
      });
    }

    await logBatchAction(
      receivedBy,
      receivedByEmail,
      'RECORD_VARIANCE',
      batch.batch_number,
      `Variance recorded: ${analysis.variance_grams.toFixed(2)}g (${analysis.variance_percentage.toFixed(2)}%)`
    );

    return { receivingRecord, analysis };
  },

  async createInvestigation(investigation: VarianceInvestigation) {
    const { data, error } = await supabase
      .from('variance_investigations')
      .insert({
        ...investigation,
        investigation_status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    await batchEnhancedService.createAlert({
      batch_id: investigation.batch_id,
      alert_type: 'variance',
      severity: 'high',
      message: 'Variance investigation opened',
      details: {
        investigation_id: data.id,
        investigation_type: investigation.investigation_type,
      },
    });

    return data;
  },

  async assignInvestigator(
    investigationId: string,
    investigatorId: string,
    assignedBy: string,
    assignedByEmail: string
  ) {
    const { data: investigation, error: fetchError } = await supabase
      .from('variance_investigations')
      .select('batch_id')
      .eq('id', investigationId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!investigation) throw new Error('Investigation not found');

    const { error } = await supabase
      .from('variance_investigations')
      .update({
        assigned_investigator_id: investigatorId,
        investigation_status: 'in_progress',
      })
      .eq('id', investigationId);

    if (error) throw error;

    await logBatchAction(
      assignedBy,
      assignedByEmail,
      'ASSIGN_INVESTIGATOR',
      investigation.batch_id,
      `Investigator assigned for variance investigation`
    );

    return true;
  },

  async updateInvestigation(
    investigationId: string,
    updates: {
      findings?: string;
      evidence_collected?: Record<string, any>;
      responsible_party?: string;
      financial_impact?: number;
    },
    updatedBy: string,
    updatedByEmail: string
  ) {
    const { data: investigation, error: fetchError } = await supabase
      .from('variance_investigations')
      .select('batch_id')
      .eq('id', investigationId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!investigation) throw new Error('Investigation not found');

    const { error } = await supabase
      .from('variance_investigations')
      .update(updates)
      .eq('id', investigationId);

    if (error) throw error;

    await logBatchAction(
      updatedBy,
      updatedByEmail,
      'UPDATE_INVESTIGATION',
      investigation.batch_id,
      'Variance investigation updated'
    );

    return true;
  },

  async resolveInvestigation(
    investigationId: string,
    resolution: string,
    resolvedBy: string,
    resolvedByEmail: string
  ) {
    const { data: investigation, error: fetchError } = await supabase
      .from('variance_investigations')
      .select('batch_id, receiving_record_id')
      .eq('id', investigationId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!investigation) throw new Error('Investigation not found');

    const { error: updateError } = await supabase
      .from('variance_investigations')
      .update({
        investigation_status: 'resolved',
        resolution,
        closed_at: new Date().toISOString(),
      })
      .eq('id', investigationId);

    if (updateError) throw updateError;

    const { error: reconciliationError } = await supabase
      .from('receiving_records')
      .update({
        reconciliation_approved_by: resolvedBy,
        reconciliation_approved_at: new Date().toISOString(),
      })
      .eq('id', investigation.receiving_record_id);

    if (reconciliationError) throw reconciliationError;

    await logBatchAction(
      resolvedBy,
      resolvedByEmail,
      'RESOLVE_INVESTIGATION',
      investigation.batch_id,
      `Variance investigation resolved: ${resolution}`
    );

    return true;
  },

  async getInvestigations(filters?: {
    batch_id?: string;
    status?: string;
    investigator_id?: string;
  }) {
    let query = supabase
      .from('variance_investigations')
      .select(`
        *,
        batch:batches(batch_number, status),
        receiving_record:receiving_records(
          expected_weight_grams,
          actual_weight_grams,
          variance_grams,
          variance_percentage
        ),
        investigator:user_profiles(full_name, email)
      `)
      .order('opened_at', { ascending: false });

    if (filters?.batch_id) {
      query = query.eq('batch_id', filters.batch_id);
    }

    if (filters?.status) {
      query = query.eq('investigation_status', filters.status);
    }

    if (filters?.investigator_id) {
      query = query.eq('assigned_investigator_id', filters.investigator_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getVarianceTrends(filters?: {
    from_date?: string;
    to_date?: string;
    site_id?: string;
    transportation_company?: string;
  }): Promise<VarianceTrendData[]> {
    let query = supabase
      .from('receiving_records')
      .select(`
        *,
        batch:batches(
          batch_number,
          transportation_company,
          origin_site_id,
          current_site_id
        ),
        receiving_site:sites(name)
      `);

    if (filters?.from_date) {
      query = query.gte('received_at', filters.from_date);
    }

    if (filters?.to_date) {
      query = query.lte('received_at', filters.to_date);
    }

    if (filters?.site_id) {
      query = query.eq('receiving_site_id', filters.site_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const trends: { [key: string]: VarianceTrendData } = {};

    data?.forEach((record: any) => {
      const key = filters?.transportation_company
        ? record.batch.transportation_company
        : record.receiving_site.name;

      if (!trends[key]) {
        trends[key] = {
          period: `${filters?.from_date || 'all'} to ${filters?.to_date || 'now'}`,
          total_batches: 0,
          total_variance_grams: 0,
          average_variance_percentage: 0,
          significant_variances: 0,
        };

        if (filters?.transportation_company) {
          trends[key].transporter = key;
        } else {
          trends[key].site = key;
        }
      }

      trends[key].total_batches += 1;
      trends[key].total_variance_grams += Math.abs(record.variance_grams);

      if (record.is_significant_variance) {
        trends[key].significant_variances += 1;
      }
    });

    Object.values(trends).forEach(trend => {
      trend.average_variance_percentage =
        (trend.total_variance_grams / trend.total_batches) * 100;
    });

    return Object.values(trends);
  },

  async getVarianceStatistics(batchId?: string) {
    let query = supabase
      .from('receiving_records')
      .select('variance_grams, variance_percentage, is_significant_variance');

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        total_records: 0,
        total_variance: 0,
        average_variance: 0,
        significant_count: 0,
        significant_percentage: 0,
      };
    }

    const totalVariance = data.reduce(
      (sum, record) => sum + Math.abs(record.variance_grams),
      0
    );
    const significantCount = data.filter(
      record => record.is_significant_variance
    ).length;

    return {
      total_records: data.length,
      total_variance: totalVariance,
      average_variance: totalVariance / data.length,
      significant_count: significantCount,
      significant_percentage: (significantCount / data.length) * 100,
    };
  },

  async predictVariance(
    route: string,
    transportationCompany: string,
    weightGrams: number
  ): Promise<{
    predicted_variance_grams: number;
    confidence: number;
    historical_average: number;
  }> {
    const { data, error } = await supabase
      .from('receiving_records')
      .select(`
        variance_grams,
        batch:batches!inner(transportation_company)
      `)
      .eq('batch.transportation_company', transportationCompany)
      .limit(50);

    if (error) throw error;

    if (!data || data.length < 5) {
      return {
        predicted_variance_grams: 0,
        confidence: 0,
        historical_average: 0,
      };
    }

    const variances = data.map(r => r.variance_grams);
    const historicalAverage =
      variances.reduce((sum, v) => sum + v, 0) / variances.length;

    const predictedVariance = (historicalAverage / 1000) * weightGrams;
    const confidence = Math.min((data.length / 50) * 100, 95);

    return {
      predicted_variance_grams: predictedVariance,
      confidence,
      historical_average: historicalAverage,
    };
  },
};
