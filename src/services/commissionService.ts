import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type CommissionRule = Database['public']['Tables']['commission_rules']['Row'];
type CommissionRuleInsert = Database['public']['Tables']['commission_rules']['Insert'];
type SalesCommission = Database['public']['Tables']['sales_commissions']['Row'];
type SalesCommissionInsert = Database['public']['Tables']['sales_commissions']['Insert'];

export interface CommissionCalculationResult {
  commission_amount: number;
  commission_rate?: number;
  rule_applied?: CommissionRule;
  calculation_details: {
    basis_amount: number;
    rule_type: string;
    tier_applied?: string;
    notes?: string;
  };
}

export const commissionService = {
  /**
   * Create a new commission rule
   */
  async createRule(
    rule: Omit<CommissionRuleInsert, 'created_by'>,
    userId: string
  ): Promise<CommissionRule> {
    const { data, error } = await supabase
      .from('commission_rules')
      .insert({
        ...rule,
        created_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create commission rule');

    return data;
  },

  /**
   * Get all active commission rules
   */
  async getActiveRules(filters?: {
    customer_tier?: string;
    metal_type?: string;
    rule_type?: string;
  }): Promise<CommissionRule[]> {
    let query = supabase
      .from('commission_rules')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', new Date().toISOString().split('T')[0])
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().split('T')[0]}`)
      .order('priority', { ascending: false });

    if (filters?.customer_tier) {
      query = query.or(`customer_tier.eq.${filters.customer_tier},customer_tier.eq.all`);
    }
    if (filters?.metal_type) {
      query = query.or(`metal_type.eq.${filters.metal_type},metal_type.eq.all`);
    }
    if (filters?.rule_type) {
      query = query.eq('rule_type', filters.rule_type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  },

  /**
   * Calculate commission for a sale
   */
  async calculateCommission(
    saleAmount: number,
    quantityOz: number,
    metalType: string = 'gold',
    customerTier: string = 'standard'
  ): Promise<CommissionCalculationResult> {
    const rules = await this.getActiveRules({
      customer_tier: customerTier,
      metal_type: metalType,
    });

    for (const rule of rules) {
      const meetsQuantityReq =
        (!rule.min_quantity_oz || quantityOz >= rule.min_quantity_oz) &&
        (!rule.max_quantity_oz || quantityOz <= rule.max_quantity_oz);

      const meetsValueReq =
        (!rule.min_value_usd || saleAmount >= rule.min_value_usd) &&
        (!rule.max_value_usd || saleAmount <= rule.max_value_usd);

      if (meetsQuantityReq && meetsValueReq) {
        let commissionAmount = 0;
        let commissionRate = rule.commission_percentage;

        switch (rule.rule_type) {
          case 'percentage':
            commissionAmount = saleAmount * ((rule.commission_percentage || 0) / 100);
            break;

          case 'fixed':
            commissionAmount = rule.fixed_amount || 0;
            break;

          case 'tiered':
            const tierResult = this.calculateTieredCommission(
              saleAmount,
              quantityOz,
              rule.tier_config as any
            );
            commissionAmount = tierResult.amount;
            commissionRate = tierResult.rate;
            break;

          case 'hybrid':
            const baseFixed = rule.fixed_amount || 0;
            const percentageAmount = saleAmount * ((rule.commission_percentage || 0) / 100);
            commissionAmount = baseFixed + percentageAmount;
            break;
        }

        return {
          commission_amount: commissionAmount,
          commission_rate: commissionRate || undefined,
          rule_applied: rule,
          calculation_details: {
            basis_amount: saleAmount,
            rule_type: rule.rule_type,
            notes: `Applied rule: ${rule.rule_name}`,
          },
        };
      }
    }

    return {
      commission_amount: 0,
      calculation_details: {
        basis_amount: saleAmount,
        rule_type: 'none',
        notes: 'No applicable commission rule found',
      },
    };
  },

  /**
   * Calculate tiered commission based on tiers config
   */
  calculateTieredCommission(
    saleAmount: number,
    quantityOz: number,
    tierConfig: { tiers: { threshold: number; rate: number }[] }
  ): { amount: number; rate: number } {
    if (!tierConfig || !tierConfig.tiers) {
      return { amount: 0, rate: 0 };
    }

    const sortedTiers = tierConfig.tiers.sort((a, b) => b.threshold - a.threshold);

    for (const tier of sortedTiers) {
      if (saleAmount >= tier.threshold) {
        return {
          amount: saleAmount * (tier.rate / 100),
          rate: tier.rate,
        };
      }
    }

    return { amount: 0, rate: 0 };
  },

  /**
   * Create a commission record for a sale
   */
  async createCommission(
    saleId: string,
    salespersonId: string,
    commissionData: CommissionCalculationResult
  ): Promise<SalesCommission> {
    const { data: salesperson } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', salespersonId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('sales_commissions')
      .insert({
        sale_id: saleId,
        salesperson_id: salespersonId,
        salesperson_name: salesperson?.full_name || 'Unknown',
        commission_rule_id: commissionData.rule_applied?.id,
        commission_type: commissionData.rule_applied?.rule_type || 'manual',
        basis_amount: commissionData.calculation_details.basis_amount,
        commission_rate: commissionData.commission_rate,
        commission_amount: commissionData.commission_amount,
        calculation_details: commissionData.calculation_details,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create commission');

    return data;
  },

  /**
   * Get commissions for a salesperson
   */
  async getSalespersonCommissions(
    salespersonId: string,
    filters?: {
      status?: string;
      from_date?: string;
      to_date?: string;
    }
  ) {
    let query = supabase
      .from('sales_commissions')
      .select(`
        *,
        sale:sales(sale_number, customer:customers(name), final_proceeds)
      `)
      .eq('salesperson_id', salespersonId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  },

  /**
   * Approve a commission
   */
  async approveCommission(
    commissionId: string,
    approverId: string
  ): Promise<SalesCommission> {
    const { data, error } = await supabase
      .from('sales_commissions')
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', commissionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Commission not found');

    return data;
  },

  /**
   * Mark commission as paid
   */
  async markCommissionPaid(
    commissionId: string,
    paymentReference: string
  ): Promise<SalesCommission> {
    const { data, error } = await supabase
      .from('sales_commissions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_reference: paymentReference,
      })
      .eq('id', commissionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Commission not found');

    return data;
  },

  /**
   * Get commission summary for a period
   */
  async getCommissionSummary(filters?: {
    salesperson_id?: string;
    from_date?: string;
    to_date?: string;
  }) {
    let query = supabase
      .from('sales_commissions')
      .select('*');

    if (filters?.salesperson_id) {
      query = query.eq('salesperson_id', filters.salesperson_id);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      total_commissions: data.length,
      total_amount: data.reduce((sum, c) => sum + Number(c.commission_amount), 0),
      pending_amount: data
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + Number(c.commission_amount), 0),
      approved_amount: data
        .filter(c => c.status === 'approved')
        .reduce((sum, c) => sum + Number(c.commission_amount), 0),
      paid_amount: data
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.commission_amount), 0),
      by_status: {
        pending: data.filter(c => c.status === 'pending').length,
        approved: data.filter(c => c.status === 'approved').length,
        paid: data.filter(c => c.status === 'paid').length,
        rejected: data.filter(c => c.status === 'rejected').length,
        cancelled: data.filter(c => c.status === 'cancelled').length,
      },
    };
  },

  /**
   * Update commission rule status
   */
  async updateRuleStatus(
    ruleId: string,
    isActive: boolean,
    userId: string
  ): Promise<CommissionRule> {
    const { data, error } = await supabase
      .from('commission_rules')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', ruleId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Commission rule not found');

    return data;
  },

  /**
   * Delete commission rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await supabase
      .from('commission_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
  },
};
