import { supabase } from '@/lib/supabase';

export type AccessLevel = 'read' | 'write' | 'admin' | 'full';

export interface MiningCompanyAccess {
  id: string;
  user_id: string;
  mining_company_id: string;
  access_level: AccessLevel;
  is_primary: boolean;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Relations
  mining_company?: {
    id: string;
    name: string;
    code: string;
    country: string;
  };
  granted_by_user?: {
    full_name: string;
    email: string;
  };
}

export interface GrantAccessParams {
  userId: string;
  miningCompanyId: string;
  accessLevel: AccessLevel;
  isPrimary?: boolean;
  expiresAt?: string;
  notes?: string;
}

export const userMiningAccessService = {
  /**
   * Get all mining company accesses for a user
   */
  async getUserAccess(
    userId: string,
    activeOnly: boolean = true
  ): Promise<MiningCompanyAccess[]> {
    let query = supabase
      .from('user_mining_company_access')
      .select(`
        *,
        mining_company:mining_companies!inner(id, name, code, country),
        granted_by_user:user_profiles!user_mining_company_access_granted_by_fkey(full_name, email)
      `)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
      // Also filter out expired accesses
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[userMiningAccessService] Error fetching user access:', error);
      throw error;
    }

    return (data || []).map(access => ({
      ...access,
      mining_company: access.mining_company || undefined,
      granted_by_user: access.granted_by_user || undefined,
    }));
  },

  /**
   * Get all users with access to a mining company
   */
  async getCompanyUsers(miningCompanyId: string): Promise<Array<{
    access: MiningCompanyAccess;
    user: {
      id: string;
      full_name: string;
      email: string;
      role: string;
      is_active: boolean;
    };
  }>> {
    const { data, error } = await supabase
      .from('user_mining_company_access')
      .select(`
        *,
        user:user_profiles!inner(id, full_name, email, role, is_active)
      `)
      .eq('mining_company_id', miningCompanyId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('[userMiningAccessService] Error fetching company users:', error);
      throw error;
    }

    return (data || []).map(item => ({
      access: item as MiningCompanyAccess,
      user: item.user,
    }));
  },

  /**
   * Grant access to a user for a mining company
   */
  async grantAccess(params: GrantAccessParams): Promise<MiningCompanyAccess> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // If setting as primary, first remove primary status from other accesses
    if (params.isPrimary) {
      await supabase
        .from('user_mining_company_access')
        .update({ is_primary: false })
        .eq('user_id', params.userId)
        .eq('is_active', true);
    }

    const { data, error } = await supabase
      .from('user_mining_company_access')
      .insert({
        user_id: params.userId,
        mining_company_id: params.miningCompanyId,
        access_level: params.accessLevel,
        is_primary: params.isPrimary || false,
        expires_at: params.expiresAt || null,
        notes: params.notes || null,
        granted_by: currentUser.id,
        is_active: true,
      })
      .select(`
        *,
        mining_company:mining_companies!inner(id, name, code, country)
      `)
      .single();

    if (error) {
      console.error('[userMiningAccessService] Error granting access:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update an existing access
   */
  async updateAccess(
    accessId: string,
    updates: {
      accessLevel?: AccessLevel;
      isPrimary?: boolean;
      expiresAt?: string | null;
      notes?: string | null;
    }
  ): Promise<MiningCompanyAccess> {
    const updateData: any = {};

    if (updates.accessLevel !== undefined) {
      updateData.access_level = updates.accessLevel;
    }
    if (updates.isPrimary !== undefined) {
      updateData.is_primary = updates.isPrimary;

      // If setting as primary, first get the user_id to remove primary from others
      if (updates.isPrimary) {
        const { data: currentAccess } = await supabase
          .from('user_mining_company_access')
          .select('user_id')
          .eq('id', accessId)
          .single();

        if (currentAccess) {
          await supabase
            .from('user_mining_company_access')
            .update({ is_primary: false })
            .eq('user_id', currentAccess.user_id)
            .eq('is_active', true)
            .neq('id', accessId);
        }
      }
    }
    if (updates.expiresAt !== undefined) {
      updateData.expires_at = updates.expiresAt;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    const { data, error } = await supabase
      .from('user_mining_company_access')
      .update(updateData)
      .eq('id', accessId)
      .select(`
        *,
        mining_company:mining_companies!inner(id, name, code, country)
      `)
      .single();

    if (error) {
      console.error('[userMiningAccessService] Error updating access:', error);
      throw error;
    }

    return data;
  },

  /**
   * Revoke access (soft delete - set is_active to false)
   */
  async revokeAccess(accessId: string): Promise<void> {
    const { error } = await supabase
      .from('user_mining_company_access')
      .update({ is_active: false })
      .eq('id', accessId);

    if (error) {
      console.error('[userMiningAccessService] Error revoking access:', error);
      throw error;
    }
  },

  /**
   * Check if user has access to a mining company
   */
  async hasAccess(
    userId: string,
    miningCompanyId: string,
    minimumLevel?: AccessLevel
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_mining_company_access')
      .select('access_level')
      .eq('user_id', userId)
      .eq('mining_company_id', miningCompanyId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (error) {
      console.error('[userMiningAccessService] Error checking access:', error);
      return false;
    }

    if (!data) return false;

    // If no minimum level specified, any access is sufficient
    if (!minimumLevel) return true;

    // Check access level hierarchy: read < write < admin < full
    const levels: AccessLevel[] = ['read', 'write', 'admin', 'full'];
    const userLevelIndex = levels.indexOf(data.access_level);
    const requiredLevelIndex = levels.indexOf(minimumLevel);

    return userLevelIndex >= requiredLevelIndex;
  },

  /**
   * Get user's primary mining company
   */
  async getPrimaryMiningCompany(userId: string): Promise<MiningCompanyAccess | null> {
    const { data, error } = await supabase
      .from('user_mining_company_access')
      .select(`
        *,
        mining_company:mining_companies!inner(id, name, code, country)
      `)
      .eq('user_id', userId)
      .eq('is_primary', true)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (error) {
      console.error('[userMiningAccessService] Error fetching primary mining company:', error);
      throw error;
    }

    return data;
  },

  /**
   * Set a mining company as primary for a user
   */
  async setPrimaryMiningCompany(userId: string, miningCompanyId: string): Promise<void> {
    // First, remove primary status from all user's accesses
    await supabase
      .from('user_mining_company_access')
      .update({ is_primary: false })
      .eq('user_id', userId);

    // Then set the specified one as primary
    const { error } = await supabase
      .from('user_mining_company_access')
      .update({ is_primary: true })
      .eq('user_id', userId)
      .eq('mining_company_id', miningCompanyId)
      .eq('is_active', true);

    if (error) {
      console.error('[userMiningAccessService] Error setting primary mining company:', error);
      throw error;
    }
  },

  /**
   * Get access statistics for a mining company
   */
  async getCompanyAccessStatistics(miningCompanyId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    byAccessLevel: Record<AccessLevel, number>;
    byRole: Record<string, number>;
    expiringIn30Days: number;
  }> {
    const { data, error } = await supabase
      .from('user_mining_company_access')
      .select(`
        *,
        user:user_profiles!inner(role, is_active)
      `)
      .eq('mining_company_id', miningCompanyId)
      .eq('is_active', true);

    if (error) {
      console.error('[userMiningAccessService] Error fetching company statistics:', error);
      throw error;
    }

    const accesses = data || [];

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalUsers: accesses.length,
      activeUsers: accesses.filter((a: any) => a.user?.is_active).length,
      byAccessLevel: {
        read: 0,
        write: 0,
        admin: 0,
        full: 0,
      } as Record<AccessLevel, number>,
      byRole: {} as Record<string, number>,
      expiringIn30Days: 0,
    };

    accesses.forEach((access: any) => {
      // By access level
      stats.byAccessLevel[access.access_level as AccessLevel]++;

      // By role
      const role = access.user?.role || 'unknown';
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;

      // Expiring soon
      if (access.expires_at) {
        const expiresAt = new Date(access.expires_at);
        if (expiresAt <= in30Days && expiresAt > now) {
          stats.expiringIn30Days++;
        }
      }
    });

    return stats;
  },

  /**
   * Bulk grant access to multiple users
   */
  async bulkGrantAccess(
    userIds: string[],
    miningCompanyId: string,
    accessLevel: AccessLevel,
    expiresAt?: string,
    notes?: string
  ): Promise<void> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const accesses = userIds.map(userId => ({
      user_id: userId,
      mining_company_id: miningCompanyId,
      access_level: accessLevel,
      is_primary: false,
      expires_at: expiresAt || null,
      notes: notes || null,
      granted_by: currentUser.id,
      is_active: true,
    }));

    const { error } = await supabase
      .from('user_mining_company_access')
      .insert(accesses);

    if (error) {
      console.error('[userMiningAccessService] Error bulk granting access:', error);
      throw error;
    }
  },
};
