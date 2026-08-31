import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

type ScheduledReportRow = Database['public']['Tables']['scheduled_reports']['Row'];
type ReportHistoryRow = Database['public']['Tables']['report_history']['Row'];

export interface ScheduledReport extends Omit<ScheduledReportRow, 'frequency' | 'format'> {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  format: 'pdf' | 'excel';
}

export interface ReportHistory extends Omit<ReportHistoryRow, 'format' | 'status'> {
  format: 'pdf' | 'excel' | 'csv';
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface CreateScheduledReportData {
  report_type: ScheduledReport['report_type'];
  frequency: ScheduledReport['frequency'];
  schedule_time: string;
  schedule_day?: number;
  schedule_weekday?: number;
  recipients: string[];
  format: 'pdf' | 'excel';
}

export interface CreateReportHistoryData {
  report_type: string;
  report_name: string;
  file_size?: string;
  format: 'pdf' | 'excel' | 'csv';
  download_url?: string;
  parameters?: Json;
}

const FREQUENCES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;
const FORMATS_PLANIFIES = ['pdf', 'excel'] as const;
const FORMATS_HISTORIQUE = ['pdf', 'excel', 'csv'] as const;
const STATUTS_HISTORIQUE = ['pending', 'generating', 'completed', 'failed'] as const;

function appartientA<T extends string>(value: string, valeurs: readonly T[]): value is T {
  return valeurs.some((candidate) => candidate === value);
}

function normaliserRapportPlanifie(row: ScheduledReportRow): ScheduledReport {
  if (!appartientA(row.frequency, FREQUENCES)) {
    throw new Error(`Fréquence de rapport inconnue : ${row.frequency}`);
  }
  if (!appartientA(row.format, FORMATS_PLANIFIES)) {
    throw new Error(`Format de rapport planifié inconnu : ${row.format}`);
  }
  return { ...row, frequency: row.frequency, format: row.format };
}

function normaliserHistorique(row: ReportHistoryRow): ReportHistory {
  if (!appartientA(row.format, FORMATS_HISTORIQUE)) {
    throw new Error(`Format d'historique inconnu : ${row.format}`);
  }
  if (!appartientA(row.status, STATUTS_HISTORIQUE)) {
    throw new Error(`Statut d'historique inconnu : ${row.status}`);
  }
  return { ...row, format: row.format, status: row.status };
}

export const reportSchedulingService = {
  async getScheduledReports(): Promise<ScheduledReport[]> {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scheduled reports:', error);
      throw error;
    }

    return (data || []).map(normaliserRapportPlanifie);
  },

  async getActiveScheduledReports(): Promise<ScheduledReport[]> {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('is_active', true)
      .order('next_run_at', { ascending: true });

    if (error) {
      console.error('Error fetching active scheduled reports:', error);
      throw error;
    }

    return (data || []).map(normaliserRapportPlanifie);
  },

  async createScheduledReport(reportData: CreateScheduledReportData): Promise<ScheduledReport> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('scheduled_reports')
      .insert({
        ...reportData,
        created_by: user?.id,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scheduled report:', error);
      throw error;
    }

    return normaliserRapportPlanifie(data);
  },

  async updateScheduledReport(id: string, updates: Partial<CreateScheduledReportData>): Promise<ScheduledReport> {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating scheduled report:', error);
      throw error;
    }

    return normaliserRapportPlanifie(data);
  },

  async toggleScheduledReport(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('scheduled_reports')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      console.error('Error toggling scheduled report:', error);
      throw error;
    }
  },

  async deleteScheduledReport(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting scheduled report:', error);
      throw error;
    }
  },

  async updateLastRunTime(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating last run time:', error);
      throw error;
    }
  },

  async getReportHistory(limit: number = 50): Promise<ReportHistory[]> {
    const { data, error } = await supabase
      .from('report_history')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching report history:', error);
      throw error;
    }

    return (data || []).map(normaliserHistorique);
  },

  async getReportHistoryByType(reportType: string, limit: number = 20): Promise<ReportHistory[]> {
    const { data, error } = await supabase
      .from('report_history')
      .select('*')
      .eq('report_type', reportType)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching report history by type:', error);
      throw error;
    }

    return (data || []).map(normaliserHistorique);
  },

  async createReportHistory(historyData: CreateReportHistoryData): Promise<ReportHistory> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('report_history')
      .insert({
        ...historyData,
        generated_by: user?.id,
        status: 'completed'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report history:', error);
      throw error;
    }

    return normaliserHistorique(data);
  },

  async updateReportHistoryStatus(
    id: string,
    status: ReportHistory['status'],
    errorMessage?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('report_history')
      .update({
        status,
        error_message: errorMessage
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating report history status:', error);
      throw error;
    }
  }
};
