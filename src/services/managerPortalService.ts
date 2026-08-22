import { supabase } from '@/lib/supabase';

export type ManagerCompany = { id: string; name: string; abbreviation: string | null; code: string | null };
export type ManagerProduction = { id: string; mining_company_id: string; production_date: string; estimated_oz: number; estimated_fineness_pct: number; status: string };
export type ManagerBudget = { id: string; mining_company_id: string; year: number };
export type ManagerForecast = { id: string; mining_company_id: string; annual_budget_id: string; month: number; quarter: number; forecast_oz: number; revision_date: string };
export type ManagerRequest = { id: string; mining_company_id: string; numero_demande: string; statut: string; quantite_demandee_oz: number; montant_estime_fcfa: number; date_limite_reponse: string | null; created_at: string };
export type ManagerContract = { id: string; mining_company_id: string; numero_contrat: string; intitule: string; statut: string; date_fin: string; quantite_totale: number | null; unite: string };
export type ManagerInvoice = { id: string; mining_company_id: string; numero_facture: string; statut: string; montant_ttc_fcfa: number; montant_paye_fcfa: number; date_echeance: string; devise: string };
export type ManagerPayment = { id: string; mining_company_id: string; reference_reglement: string; statut: string; montant_fcfa: number; date_reglement: string; devise: string };
export type ManagerAnalysis = { id: string; mining_company_id: string; reference: string; statut: string; teneur_declaree_pct: number; teneur_retenue_pct: number | null; created_at: string };

export interface ManagerPortalSnapshot {
  companies: ManagerCompany[];
  productions: ManagerProduction[];
  budgets: ManagerBudget[];
  forecasts: ManagerForecast[];
  requests: ManagerRequest[];
  contracts: ManagerContract[];
  invoices: ManagerInvoice[];
  payments: ManagerPayment[];
  analyses: ManagerAnalysis[];
}

export class ManagerPortalDataError extends Error {}

type Result<T> = { data: T | null; error: { message?: string } | null };

function rows<T>(result: Result<T[]>, label: string): T[] {
  if (result.error) throw new ManagerPortalDataError(`Impossible de charger ${label}.`);
  return result.data || [];
}

let managerSnapshotRequest: Promise<ManagerPortalSnapshot> | null = null;

export const managerPortalService = {
  async load(): Promise<ManagerPortalSnapshot> {
    if (managerSnapshotRequest) return managerSnapshotRequest;

    const request = (async () => {
      const results = await Promise.all([
      supabase.from('mining_companies').select('id, name, abbreviation, code').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('daily_production').select('id, mining_company_id, production_date, estimated_oz, estimated_fineness_pct, status').order('production_date', { ascending: false }).limit(300),
      supabase.from('annual_budgets').select('id, mining_company_id, year').order('year', { ascending: false }).limit(100),
      supabase.from('quarterly_forecasts').select('id, mining_company_id, annual_budget_id, month, quarter, forecast_oz, revision_date').order('revision_date', { ascending: false }).limit(200),
      supabase.from('snp_demandes_achat').select('id, mining_company_id, numero_demande, statut, quantite_demandee_oz, montant_estime_fcfa, date_limite_reponse, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('snp_contrats').select('id, mining_company_id, numero_contrat, intitule, statut, date_fin, quantite_totale, unite').order('date_fin', { ascending: true }).limit(200),
      supabase.from('snp_factures_achat').select('id, mining_company_id, numero_facture, statut, montant_ttc_fcfa, montant_paye_fcfa, date_echeance, devise').order('date_echeance', { ascending: false }).limit(200),
      supabase.from('snp_reglements_achat').select('id, mining_company_id, reference_reglement, statut, montant_fcfa, date_reglement, devise').order('date_reglement', { ascending: false }).limit(200),
      supabase.from('snp_analyses_teneur').select('id, mining_company_id, reference, statut, teneur_declaree_pct, teneur_retenue_pct, created_at').order('created_at', { ascending: false }).limit(200),
    ]) as [
      Result<ManagerCompany[]>, Result<ManagerProduction[]>, Result<ManagerBudget[]>,
      Result<ManagerForecast[]>, Result<ManagerRequest[]>, Result<ManagerContract[]>,
      Result<ManagerInvoice[]>, Result<ManagerPayment[]>, Result<ManagerAnalysis[]>,
    ];

      return {
        companies: rows(results[0], 'les sociétés minières'),
        productions: rows(results[1], 'la production nationale'),
        budgets: rows(results[2], 'les budgets'),
        forecasts: rows(results[3], 'les prévisions'),
        requests: rows(results[4], 'les demandes d’achat'),
        contracts: rows(results[5], 'les contrats'),
        invoices: rows(results[6], 'les factures'),
        payments: rows(results[7], 'les paiements'),
        analyses: rows(results[8], 'les analyses'),
      };
    })();

    managerSnapshotRequest = request;
    try {
      return await request;
    } finally {
      if (managerSnapshotRequest === request) managerSnapshotRequest = null;
    }
  },
};
