import { supabase } from '@/lib/supabase';
import { logCustomerAction } from '@/lib/auditLog';
import type { Database } from '@/types/database';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export const customerService = {
  async createCustomer(customer: Omit<CustomerInsert, 'id' | 'created_at' | 'updated_at'>, userId: string, userEmail: string) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create customer');

    await logCustomerAction(userId, userEmail, 'CREATE', data.name, 'Customer created');

    return data;
  },

  async getCustomerById(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        sales(count),
        payments(count)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listCustomers(filters?: {
    status?: string;
    country?: string;
    search?: string;
  }) {
    let query = supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.country) {
      query = query.eq('country', filters.country);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async updateCustomer(id: string, updates: CustomerUpdate, userId: string, userEmail: string) {
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('name')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!customer) throw new Error('Customer not found');

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    await logCustomerAction(userId, userEmail, 'UPDATE', customer.name, 'Customer updated');

    return data;
  },

  async getCustomerPerformance(customerId: string) {
    const { data, error } = await supabase
      .from('v_customer_performance')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async checkCreditLimit(customerId: string, newSaleAmount: number) {
    const { data: customer } = await supabase
      .from('customers')
      .select('credit_limit')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) return false;

    const { data: sales } = await supabase
      .from('sales')
      .select('final_proceeds')
      .eq('customer_id', customerId)
      .in('status', ['approved', 'customer_approved']);

    const outstanding = sales?.reduce((sum, s) => sum + Number(s.final_proceeds), 0) || 0;

    return (outstanding + newSaleAmount) <= Number(customer.credit_limit);
  },
};
