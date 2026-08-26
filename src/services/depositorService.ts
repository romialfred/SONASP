/**
 * Depositor Service
 * Manages depositor contacts (signatories and approvers) for mining companies
 * Les catégories sont génériques et ne présélectionnent aucun partenaire externe.
 */

import { supabase } from '@/lib/supabase';

export type DepositorCategory =
  | 'general_management'
  | 'general_management_backup'
  | 'finance'
  | 'finance_backup'
  | 'bullion_dispatch'
  | 'sale_of_gold'
  | 'pmr_assay'
  | 'security'
  | 'security_backup'
  | 'legal'
  | 'legal_backup';

export interface Depositor {
  id: string;
  mining_company_id: string;
  category: DepositorCategory;
  full_name: string;
  job_title: string;
  telephone: string | null;
  cellphone: string | null;
  email: string;
  is_primary: boolean | null;
  is_backup: boolean;
  group_email: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositorContactSummary extends Depositor {
  mining_company_name: string;
  contacts_in_category: number;
}

export interface CreateDepositorInput {
  mining_company_id: string;
  category: DepositorCategory;
  full_name: string;
  job_title: string;
  telephone?: string;
  cellphone?: string;
  email: string;
  is_primary?: boolean;
  is_backup?: boolean;
  group_email?: string;
  notes?: string;
}

export interface UpdateDepositorInput extends Partial<CreateDepositorInput> {
  is_active?: boolean;
}

export const DEPOSITOR_CATEGORIES: Record<DepositorCategory, string> = {
  general_management: 'Direction générale',
  general_management_backup: 'Suppléance de la direction',
  finance: 'Finance et facturation',
  finance_backup: 'Suppléance finance',
  bullion_dispatch: 'Expéditions et logistique',
  sale_of_gold: 'Vente d’or et trésorerie',
  pmr_assay: 'Analyse et contrôle de teneur',
  security: 'Sécurité',
  security_backup: 'Suppléance sécurité',
  legal: 'Affaires juridiques',
  legal_backup: 'Suppléance juridique',
};

class DepositorService {
  /**
   * Get all depositors with optional filters
   */
  async getDepositors(filters?: {
    mining_company_id?: string;
    category?: DepositorCategory;
    is_active?: boolean;
  }): Promise<{ data: Depositor[] | null; error: any }> {
    let query = supabase
      .from('depositors')
      .select('*')
      .order('category')
      .order('is_primary', { ascending: false })
      .order('is_backup')
      .order('created_at');

    if (filters?.mining_company_id) {
      query = query.eq('mining_company_id', filters.mining_company_id);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    return await query;
  }
  /**
   * Get depositor by ID
   */
  async getDepositorById(id: string): Promise<{ data: Depositor | null; error: any }> {
    return await supabase
      .from('depositors')
      .select('*')
      .eq('id', id)
      .single();
  }

  /**
   * Get depositors by mining company
   */
  async getDepositorsByCompany(
    mining_company_id: string
  ): Promise<{ data: Depositor[] | null; error: any }> {
    return await supabase
      .from('depositors')
      .select('*')
      .eq('mining_company_id', mining_company_id)
      .eq('is_active', true)
      .order('category')
      .order('is_primary', { ascending: false })
      .order('created_at');
  }

  /**
   * Get depositors by category
   */
  async getDepositorsByCategory(
    mining_company_id: string,
    category: DepositorCategory
  ): Promise<{ data: Depositor[] | null; error: any }> {
    return await supabase
      .from('depositors')
      .select('*')
      .eq('mining_company_id', mining_company_id)
      .eq('category', category)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('is_backup')
      .order('created_at');
  }

  /**
   * Get primary contact for a category
   */
  async getPrimaryContact(
    mining_company_id: string,
    category: DepositorCategory
  ): Promise<{ data: Depositor | null; error: any }> {
    return await supabase
      .from('depositors')
      .select('*')
      .eq('mining_company_id', mining_company_id)
      .eq('category', category)
      .eq('is_primary', true)
      .eq('is_active', true)
      .maybeSingle();
  }

  /**
   * Create a new depositor
   */
  async createDepositor(
    input: CreateDepositorInput
  ): Promise<{ data: Depositor | null; error: any }> {
    return await supabase
      .from('depositors')
      .insert({
        ...input,
        is_primary: input.is_primary || false,
        is_backup: input.is_backup || false,
      })
      .select()
      .single();
  }

  /**
   * Update a depositor
   */
  async updateDepositor(
    id: string,
    input: UpdateDepositorInput
  ): Promise<{ data: Depositor | null; error: any }> {
    return await supabase
      .from('depositors')
      .update(input)
      .eq('id', id)
      .select()
      .single();
  }

  /**
   * Delete a depositor (soft delete by setting is_active to false)
   */
  async deleteDepositor(id: string): Promise<{ data: null; error: any }> {
    return await supabase
      .from('depositors')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
  }

  /**
   * Hard delete a depositor
   */
  async hardDeleteDepositor(id: string): Promise<{ data: null; error: any }> {
    return await supabase
      .from('depositors')
      .delete()
      .eq('id', id);
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Get all depositors grouped by category
   */
  async getDepositorsGroupedByCategory(
    mining_company_id: string
  ): Promise<{
    data: Record<DepositorCategory, Depositor[]> | null;
    error: any;
  }> {
    const { data, error } = await this.getDepositorsByCompany(mining_company_id);

    if (error || !data) {
      return { data: null, error };
    }

    const grouped = data.reduce((acc, depositor) => {
      if (!acc[depositor.category]) {
        acc[depositor.category] = [];
      }
      acc[depositor.category].push(depositor);
      return acc;
    }, {} as Record<DepositorCategory, Depositor[]>);

    return { data: grouped, error: null };
  }

  /**
   * Export depositors to CSV format
   */
  exportToCSV(depositors: Depositor[]): string {
    const headers = [
      'Category',
      'Full Name',
      'Job Title',
      'Email',
      'Telephone',
      'Cellphone',
      'Primary',
      'Backup',
      'Group Email',
      'Active',
      'Notes',
    ];

    const rows = depositors.map((d) => [
      DEPOSITOR_CATEGORIES[d.category],
      d.full_name,
      d.job_title,
      d.email,
      d.telephone || '',
      d.cellphone || '',
      d.is_primary ? 'Yes' : 'No',
      d.is_backup ? 'Yes' : 'No',
      d.group_email || '',
      d.is_active ? 'Active' : 'Inactive',
      d.notes || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }
}

export const depositorService = new DepositorService();
