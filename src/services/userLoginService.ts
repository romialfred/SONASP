import { supabase } from '@/lib/supabase';
import { userSessionService, type UserSessionSummary } from '@/services/userSessionService';

export interface LogLoginParams {
  userId?: string;
  success: boolean;
  failureReason?: string;
  twoFactorVerified?: boolean;
}

export interface LoginHistoryEntry {
  id: string;
  user_id: string;
  login_timestamp: string;
  logout_timestamp: string | null;
  session_duration_seconds: number | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  location_country: string | null;
  location_city: string | null;
  login_method: string;
  success: boolean;
  failure_reason: string | null;
  two_factor_verified: boolean;
  created_at: string;
}

export interface LoginStatistics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueDevices: number;
  uniqueLocations: number;
  mostUsedDevice: string;
  mostUsedBrowser: string;
  averageSessionDuration: number;
  recentLogins: LoginHistoryEntry[];
}

export const userLoginService = {
  /**
   * Log a user login attempt
   */
  async logLogin(params: LogLoginParams): Promise<string> {
    try {
      const userAgent = navigator.userAgent;

      // If userId is not provided and login was successful, get current user
      let userId = params.userId;
      if (!userId && params.success) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }

      if (!userId) {
        console.warn('[userLoginService] No userId provided for login log');
        return '';
      }

      const { data, error } = await supabase.rpc('log_user_login', {
        p_user_id: userId,
        p_ip_address: null, // IP will be captured server-side if needed
        p_user_agent: userAgent,
        p_success: params.success,
        p_failure_reason: params.failureReason || null,
        p_two_factor_verified: params.twoFactorVerified || false,
      });

      if (error) {
        console.error('[userLoginService] Error logging login:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[userLoginService] Failed to log login:', error);
      // Don't throw - logging should not break the main operation
      return '';
    }
  },

  /**
   * Get login history for a user
   */
  async getLoginHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      successOnly?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<LoginHistoryEntry[]> {
    let query = supabase
      .from('user_login_history')
      .select('*')
      .eq('user_id', userId)
      .order('login_timestamp', { ascending: false });

    if (options?.successOnly) {
      query = query.eq('success', true);
    }

    if (options?.startDate) {
      query = query.gte('login_timestamp', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('login_timestamp', options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('[userLoginService] Error fetching login history:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get login statistics for a user
   */
  async getLoginStatistics(userId: string, days: number = 30): Promise<LoginStatistics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_login_history')
      .select('*')
      .eq('user_id', userId)
      .gte('login_timestamp', startDate.toISOString());

    if (error) {
      console.error('[userLoginService] Error fetching login statistics:', error);
      throw error;
    }

    const logs = data || [];

    // Calculate statistics
    const successfulLogins = logs.filter(l => l.success);
    const failedLogins = logs.filter(l => !l.success);

    const devices = new Set(logs.map(l => l.device_type).filter(Boolean));
    const locations = new Set(
      logs.map(l => `${l.location_city}, ${l.location_country}`).filter(l => l !== ', ')
    );

    // Most used device
    const deviceCounts = new Map<string, number>();
    logs.forEach(l => {
      if (l.device_type) {
        deviceCounts.set(l.device_type, (deviceCounts.get(l.device_type) || 0) + 1);
      }
    });
    const mostUsedDevice = Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // Most used browser
    const browserCounts = new Map<string, number>();
    logs.forEach(l => {
      if (l.browser) {
        browserCounts.set(l.browser, (browserCounts.get(l.browser) || 0) + 1);
      }
    });
    const mostUsedBrowser = Array.from(browserCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // Average session duration
    const sessionsWithDuration = logs.filter(l => l.session_duration_seconds != null);
    const averageSessionDuration = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum, l) => sum + (l.session_duration_seconds || 0), 0) /
        sessionsWithDuration.length
      : 0;

    // Recent logins (last 10)
    const recentLogins = logs.slice(0, 10);

    return {
      totalLogins: logs.length,
      successfulLogins: successfulLogins.length,
      failedLogins: failedLogins.length,
      uniqueDevices: devices.size,
      uniqueLocations: locations.size,
      mostUsedDevice,
      mostUsedBrowser,
      averageSessionDuration,
      recentLogins,
    };
  },

  /**
   * Get failed login attempts for a user (for security monitoring)
   */
  async getFailedLoginAttempts(
    userId: string,
    hoursAgo: number = 24
  ): Promise<LoginHistoryEntry[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hoursAgo);

    const { data, error } = await supabase
      .from('user_login_history')
      .select('*')
      .eq('user_id', userId)
      .eq('success', false)
      .gte('login_timestamp', startDate.toISOString())
      .order('login_timestamp', { ascending: false });

    if (error) {
      console.error('[userLoginService] Error fetching failed login attempts:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<UserSessionSummary[]> {
    return userSessionService.list(userId, true);
  },

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<UserSessionSummary> {
    return userSessionService.revoke(sessionId);
  },

  /**
   * Terminate all sessions for a user (except current)
   */
  async terminateAllSessions(userId: string): Promise<number> {
    return userSessionService.revokeAll(userId, true);
  },

  /**
   * Export login history to CSV
   */
  async exportLoginHistory(userId: string, days: number = 30): Promise<string> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_login_history')
      .select('*')
      .eq('user_id', userId)
      .gte('login_timestamp', startDate.toISOString())
      .order('login_timestamp', { ascending: false });

    if (error) throw error;

    // Convert to CSV
    const headers = [
      'Date',
      'Success',
      'Device',
      'Browser',
      'OS',
      'Location',
      'IP Address',
      'Session Duration',
      '2FA Verified',
    ];

    const rows = (data || []).map(log => [
      new Date(log.login_timestamp).toLocaleString(),
      log.success ? 'Yes' : 'No',
      log.device_type || 'N/A',
      log.browser || 'N/A',
      log.operating_system || 'N/A',
      `${log.location_city || ''}, ${log.location_country || ''}`.trim().replace(/^,\s*/, '') || 'N/A',
      log.ip_address || 'N/A',
      log.session_duration_seconds
        ? `${Math.floor(log.session_duration_seconds / 60)}m ${log.session_duration_seconds % 60}s`
        : 'N/A',
      log.two_factor_verified ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  },
};
