import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { BankAccount } from '@/components/customers/BankAccountForm';

export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type CustomerSale = Pick<Database['public']['Tables']['sales']['Row'], 'id' | 'customer_id' | 'sale_number' | 'created_at' | 'status' | 'quantity_oz' | 'currency'> & { final_proceeds: number | null };
export interface CustomerDossier { customer: CustomerRow; banks: BankAccount[] }
const saleColumns = 'id,customer_id,sale_number,created_at,status,quantity_oz,final_proceeds,currency' as const;
// Same existing approved-sale perimeter in the directory and individual detail.
const approvedStatuses = new Set(['management_approved', 'customer_approved', 'payment_received', 'completed']);
export const paymentTermLabels: Record<string, string> = {
  'Net 15 days': 'Paiement à 15 jours', 'Net 30 days': 'Paiement à 30 jours',
  'Net 45 days': 'Paiement à 45 jours', 'Net 60 days': 'Paiement à 60 jours', Immediate: 'Paiement immédiat',
};
export const customerStatusLabels: Record<string, string> = { active: 'Actif', inactive: 'Inactif', pending: 'En attente' };

export function customerActivity(sales: CustomerSale[]) {
  const approved = sales.filter(sale => approvedStatuses.has(sale.status ?? ''));
  const currencies = new Set(approved.map(sale => sale.currency));
  const currency = currencies.size === 1 ? approved[0].currency : null;
  const completeAmounts = approved.every(sale => typeof sale.final_proceeds === 'number' && Number.isFinite(sale.final_proceeds));
  const total = completeAmounts && currency ? approved.reduce((sum, sale) => sum + sale.final_proceeds!, 0) : null;
  return {
    count: approved.length, total, currency, approved,
    average: approved.length && total !== null ? total / approved.length : null,
    paidCount: approved.filter(sale => ['payment_received', 'completed'].includes(sale.status ?? '')).length,
    lastDate: approved.map(sale => sale.created_at).filter((date): date is string => !!date).sort().at(-1) ?? null,
  };
}

export async function loadCustomerDossier(id: string): Promise<CustomerDossier> {
  const [customerResult, banksResult] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase.from('customer_banks').select('*').eq('customer_id', id).eq('is_active', true).order('is_primary', { ascending: false }).order('id'),
  ]);
  if (customerResult.error) throw customerResult.error;
  if (banksResult.error) throw banksResult.error;
  if (!customerResult.data) throw new Error('Le client est introuvable ou inaccessible.');
  return { customer: customerResult.data, banks: (banksResult.data ?? []).map(bank => ({
    id: bank.id, bankName: bank.bank_name, country: bank.country, city: bank.city,
    accountNumber: bank.account_number ?? '', iban: bank.iban ?? '', swiftCode: bank.swift_code ?? '',
    currency: bank.currency, isPrimary: bank.is_primary ?? false, isActive: bank.is_active ?? true,
  })) };
}

export async function loadCustomerSales(customerId?: string): Promise<CustomerSale[]> {
  const sales: CustomerSale[] = [];
  for (let offset = 0; ; ) {
    let query = supabase.from('sales').select(saleColumns, { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error, count } = await query;
    if (error) throw error;
    sales.push(...(data ?? []));
    offset += data?.length ?? 0;
    if (!data?.length || (count !== null ? offset >= count : data.length < 500)) break;
  }
  return sales;
}

export async function loadCustomerDirectory(): Promise<CustomerRow[]> {
  const customers: CustomerRow[] = [];
  for (let offset = 0; ; ) {
    const { data, error, count } = await supabase.from('customers').select('*', { count: 'exact' }).order('name').order('id').range(offset, offset + 499);
    if (error) throw error;
    customers.push(...(data ?? []));
    offset += data?.length ?? 0;
    if (!data?.length || (count !== null ? offset >= count : data.length < 500)) break;
  }
  return customers;
}

export async function saveCustomerDossier(id: string | null, customer: Database['public']['Tables']['customers']['Insert'], banks: BankAccount[]) {
  if (banks.some(bank => !bank.bankName.trim() || bank.bankName === '__other__' || !bank.country.trim() || !bank.city.trim() || !bank.currency.trim())) {
    throw new Error('Chaque compte bancaire doit comporter un nom de banque, un pays, une ville et une devise.');
  }
  const { data, error } = await supabase.rpc('save_customer_dossier', {
    p_customer_id: id, p_customer: customer,
    p_banks: banks.map(bank => ({
      ...(bank.id ? { id: bank.id } : {}), bank_name: bank.bankName.trim(), country: bank.country.trim(), city: bank.city.trim(),
      currency: bank.currency, account_number: bank.accountNumber.trim() || null, iban: bank.iban.trim() || null,
      swift_code: bank.swiftCode.trim() || null, is_primary: bank.isPrimary, is_active: bank.isActive,
    })),
  });
  if (error) throw error;
  if (!data) throw new Error('Aucun dossier enregistré. Rechargez la page avant de réessayer.');
  return data;
}
