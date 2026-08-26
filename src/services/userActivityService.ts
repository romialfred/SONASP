import { supabase } from '@/lib/supabase';

export interface LogActivityParams {
  actionType: 'create' | 'update' | 'delete' | 'view' | 'export' | 'approve' | 'reject';
  moduleName: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  changesSummary?: Record<string, any>;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  module_name: string;
  resource_type: string;
  resource_id: string | null;
  description: string;
  changes_summary: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ActivityFilters {
  moduleNames?: string[];
  actionTypes?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivitySummary {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  total_actions: number;
  actions_last_7_days: number;
  actions_last_30_days: number;
  create_actions: number;
  update_actions: number;
  delete_actions: number;
  view_actions: number;
  approve_actions: number;
  top_modules_30_days: Array<{ module: string; count: number }> | null;
  last_action_at: string | null;
}

export const userActivityService = {
  /**
   * Log a user activity
   */
  async logActivity(params: LogActivityParams): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[userActivityService] No authenticated user found');
        return '';
      }

      // Get IP and user agent from browser
      const userAgent = navigator.userAgent;

      const { data, error } = await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_action_type: params.actionType,
        p_module_name: params.moduleName,
        p_resource_type: params.resourceType,
        p_resource_id: params.resourceId || null,
        p_description: params.description,
        p_changes_summary: params.changesSummary || null,
        p_ip_address: null, // IP will be captured server-side if needed
        p_user_agent: userAgent,
      });

      if (error) {
        console.error('[userActivityService] Error logging activity:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[userActivityService] Failed to log activity:', error);
      // Don't throw - logging should not break the main operation
      return '';
    }
  },

  /**
   * Get activity history for a user
   */
  async getActivityHistory(
    userId: string,
    filters?: ActivityFilters
  ): Promise<ActivityLog[]> {
    let query = supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.moduleNames?.length) {
      query = query.in('module_name', filters.moduleNames);
    }

    if (filters?.actionTypes?.length) {
      query = query.in('action_type', filters.actionTypes);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[userActivityService] Error fetching activity history:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get activity summary for all users
   */
  /**
   * Get activity statistics for a specific module
   */
  async getModuleStatistics(moduleName: string, days: number = 30): Promise<{
    totalActions: number;
    byActionType: Record<string, number>;
    byUser: Array<{ userId: string; fullName: string; count: number }>;
    timeline: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_activity_logs')
      .select(`
        id,
        action_type,
        user_id,
        created_at,
        user_profiles!inner(full_name)
      `)
      .eq('module_name', moduleName)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('[userActivityService] Error fetching module statistics:', error);
      throw error;
    }

    const logs = data || [];

    // Calculate statistics
    const byActionType: Record<string, number> = {};
    const byUserMap = new Map<string, { fullName: string; count: number }>();
    const byDateMap = new Map<string, number>();

    logs.forEach((log: any) => {
      // By action type
      byActionType[log.action_type] = (byActionType[log.action_type] || 0) + 1;

      // By user
      const userKey = log.user_id;
      if (!byUserMap.has(userKey)) {
        byUserMap.set(userKey, {
          fullName: log.user_profiles?.full_name || 'Unknown',
          count: 0,
        });
      }
      const userStats = byUserMap.get(userKey)!;
      userStats.count++;

      // By date
      const dateKey = new Date(log.created_at).toISOString().split('T')[0];
      byDateMap.set(dateKey, (byDateMap.get(dateKey) || 0) + 1);
    });

    const byUser = Array.from(byUserMap.entries())
      .map(([userId, stats]) => ({
        userId,
        fullName: stats.fullName,
        count: stats.count,
      }))
      .sort((a, b) => b.count - a.count);

    const timeline = Array.from(byDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalActions: logs.length,
      byActionType,
      byUser,
      timeline,
    };
  },

  /**
   * Export activity logs to CSV
   */
  async exportActivityLogs(filters?: ActivityFilters): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('user_activity_logs')
      .select(`
        *,
        user_profiles!inner(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (filters?.moduleNames?.length) {
      query = query.in('module_name', filters.moduleNames);
    }

    if (filters?.actionTypes?.length) {
      query = query.in('action_type', filters.actionTypes);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Convert to CSV
    const headers = [
      'Date',
      'User',
      'Email',
      'Action',
      'Module',
      'Resource',
      'Description',
      'Status',
    ];

    const rows = (data || []).map((log: any) => [
      new Date(log.created_at).toLocaleString(),
      log.user_profiles?.full_name || 'N/A',
      log.user_profiles?.email || 'N/A',
      log.action_type,
      log.module_name,
      `${log.resource_type}${log.resource_id ? ` (${log.resource_id})` : ''}`,
      log.description,
      log.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  },
};
