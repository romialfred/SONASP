import { supabase } from '@/lib/supabase';

/**
 * Service for managing stakeholder data with active/inactive filtering
 * Ensures only active entities are displayed in dropdowns across the platform
 */

export interface MiningCompany {
  id: string;
  name: string;
  /** Nom usuel court (affiché dans les onglets/listes). */
  abbreviation?: string | null;
  code: string;
  country: string;
  is_active: boolean | null;
  company_type?: string | null;
  region?: string | null;
  province?: string | null;
  localite?: string | null;
}

/** Libellé d'affichage d'une société minière : nom usuel si présent, sinon nom officiel. */
export function miningCompanyLabel(company: { abbreviation?: string | null; name: string }): string {
  return company.abbreviation?.trim() || company.name;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  status: "pending" | "active" | "inactive" | null;
}

export interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
  is_active: boolean | null;
}

export interface TransportCompany {
  id: string;
  name: string;
  company_type: 'mine_to_airport' | 'airport_to_refinery' | 'both';
  is_active: boolean | null;
}

/**
 * Get all active mining companies for dropdowns
 * Only returns companies where is_active = true
 */
export async function getActiveMiningCompanies(): Promise<MiningCompany[]> {
  const { data, error } = await supabase
    .from('mining_companies')
    .select('id, name, abbreviation, code, country, is_active, company_type, region, province, localite')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching mining companies:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all active customers for dropdowns
 * Only returns customers where status = 'active'
 */
export async function getActiveCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, country, status')
    .eq('status', 'active')
    .order('name');

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all active refineries for dropdowns
 * Only returns refineries where is_active = true
 */
export async function getActiveRefineries(): Promise<Refinery[]> {
  const { data, error } = await supabase
    .from('refineries')
    .select('id, name, location, country, is_active')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching refineries:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active transport companies by type
 * @param type - Filter by company type, or 'all' for all types
 * @param includeInactive - Include inactive companies (default: false)
 */
export async function getActiveTransportCompanies(
  type: 'mine_to_airport' | 'airport_to_refinery' | 'both' | 'all' = 'all',
  includeInactive = false
): Promise<TransportCompany[]> {
  let query = supabase
    .from('transport_companies')
    .select('id, name, company_type, is_active')
    .order('name');

  // Filter by active status
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  // Filter by company type
  if (type !== 'all') {
    if (type === 'mine_to_airport') {
      query = query.in('company_type', ['mine_to_airport', 'both']);
    } else if (type === 'airport_to_refinery') {
      query = query.in('company_type', ['airport_to_refinery', 'both']);
    } else {
      query = query.eq('company_type', type);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching transport companies:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all active stakeholders in one call (for multi-dropdown forms)
 */
export async function getAllActiveStakeholders() {
  const [miningCompanies, customers, refineries, transportCompanies] = await Promise.all([
    getActiveMiningCompanies(),
    getActiveCustomers(),
    getActiveRefineries(),
    getActiveTransportCompanies(),
  ]);

  return {
    miningCompanies,
    customers,
    refineries,
    transportCompanies,
  };
}

/**
 * Toggle stakeholder active status
 */
export async function toggleMiningCompanyStatus(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('mining_companies')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function toggleCustomerStatus(id: string, status: 'active' | 'inactive') {
  const { error } = await supabase
    .from('customers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function toggleRefineryStatus(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('refineries')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function toggleTransportCompanyStatus(id: string, isActive: boolean) {
  const { error} = await supabase
    .from('transport_companies')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
