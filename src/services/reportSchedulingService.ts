import { supabase } from '@/lib/supabase';

export interface ScheduledReport {
  id: string;
  report_type: 'executive' | 'sales' | 'batch' | 'customer' | 'financial' | 'operations';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  schedule_time: string;
  schedule_day?: number;
  schedule_weekday?: number;
  recipients: string[];
  format: 'pdf' | 'excel';
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  next_run_at?: string;
}

export interface ReportHistory {
  id: string;
  report_type: string;
  report_name: string;
  generated_by?: string | null;
  generated_at: string;
  file_size?: string;
  format: 'pdf' | 'excel' | 'csv';
  download_url?: string;
  parameters?: Record<string, any>;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string;
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
  parameters?: Record<string, any>;
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

    return data || [];
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

    return data || [];
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

    return data;
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

    return data;
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
      .select(`
        *,
        user:generated_by (
          full_name,
          email
        )
      `)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching report history:', error);
      throw error;
    }

    return data || [];
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

    return data || [];
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

    return data;
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
