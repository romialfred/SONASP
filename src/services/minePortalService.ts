import { supabase } from '@/lib/supabase';

export interface MinePortalCompany {
  id: string;
  name: string;
  code: string | null;
}

export interface MinePortalContract {
  id: string;
  numero_contrat: string;
  intitule: string;
  statut: string;
  date_fin: string;
  quantite_totale: number | null;
  unite: string;
  mining_company_id: string;
}

export interface MinePortalRequest {
  id: string;
  numero_demande: string;
  statut: string;
  quantite_demandee_oz: number;
  montant_estime_fcfa: number;
  date_limite_reponse: string | null;
  mining_company_id: string;
}

export interface MinePortalInvoice {
  id: string;
  numero_facture: string;
  statut: string;
  date_emission: string;
  date_echeance: string;
  montant_ttc_fcfa: number;
  montant_paye_fcfa: number;
  devise: string;
  mining_company_id: string;
}

export interface MinePortalPayment {
  id: string;
  reference_reglement: string;
  statut: string;
  date_reglement: string;
  montant_fcfa: number;
  devise: string;
  mining_company_id: string;
}

export interface MinePortalAnalysis {
  id: string;
  reference: string;
  statut: string;
  date_prelevement: string | null;
  teneur_declaree_pct: number;
  teneur_retenue_pct: number | null;
  mining_company_id: string;
}

export interface MinePortalRequisition {
  id: string;
  reference: string;
  objet: string;
  statut: string;
  date_notification: string | null;
  quantite_oz: number | null;
  unite: string;
  mining_company_id: string;
}

export interface MinePortalSituation {
  facture_total: number;
  facture_payee: number;
  reste_du: number;
  dette_echue: number;
  nb_factures: number;
  nb_ouvertes: number;
  nb_echues: number;
  plus_ancienne_echeance: string | null;
  anciennete_moyenne: number | null;
  reglements_total: number;
  non_affecte: number;
}

export interface MinePortalSnapshot {
  company: MinePortalCompany;
  contracts: MinePortalContract[];
  requests: MinePortalRequest[];
  invoices: MinePortalInvoice[];
  payments: MinePortalPayment[];
  analyses: MinePortalAnalysis[];
  requisitions: MinePortalRequisition[];
  situation: MinePortalSituation | null;
}

export class MinePortalDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MinePortalDataError';
  }
}

type SupabaseResult<T> = { data: T | null; error: { message?: string } | null };

function rowsForCompany<T extends { mining_company_id: string }>(
  result: SupabaseResult<T[]>,
  companyId: string,
  source: string,
): T[] {
  if (result.error) throw new MinePortalDataError(`Impossible de charger ${source}.`);
  // Filtre défensif : la RLS reste l'autorité, mais une réponse inattendue ne
  // doit jamais être rendue dans le portail d'une autre société.
  return (result.data || []).filter((row) => row.mining_company_id === companyId);
}

export const minePortalService = {
  async load(companyId: string): Promise<MinePortalSnapshot> {
    if (!companyId.trim()) throw new MinePortalDataError('Aucune société minière n’est rattachée à ce compte.');

    const [companyResult, contractsResult, requestsResult, invoicesResult, paymentsResult, analysesResult, requisitionsResult, situationResult] = await Promise.all([
      supabase.from('mining_companies').select('id, name, code, is_active').eq('id', companyId).eq('is_active', true).maybeSingle(),
      supabase.from('snp_contrats').select('id, numero_contrat, intitule, statut, date_fin, quantite_totale, unite, mining_company_id').eq('mining_company_id', companyId).order('date_fin', { ascending: true }).limit(6),
      supabase.from('snp_demandes_achat').select('id, numero_demande, statut, quantite_demandee_oz, montant_estime_fcfa, date_limite_reponse, mining_company_id').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(6),
      supabase.from('snp_factures_achat').select('id, numero_facture, statut, date_emission, date_echeance, montant_ttc_fcfa, montant_paye_fcfa, devise, mining_company_id').eq('mining_company_id', companyId).order('date_emission', { ascending: false }).limit(6),
      supabase.from('snp_reglements_achat').select('id, reference_reglement, statut, date_reglement, montant_fcfa, devise, mining_company_id').eq('mining_company_id', companyId).order('date_reglement', { ascending: false }).limit(6),
      supabase.from('snp_analyses_teneur').select('id, reference, statut, date_prelevement, teneur_declaree_pct, teneur_retenue_pct, mining_company_id').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(6),
      supabase.from('snp_requisitions').select('id, reference, objet, statut, date_notification, quantite_oz, unite, mining_company_id').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(6),
      supabase.rpc('snp_situation_societe', { p_mining_company_id: companyId }).maybeSingle(),
    ]) as [
      SupabaseResult<(MinePortalCompany & { is_active: boolean })>,
      SupabaseResult<MinePortalContract[]>,
      SupabaseResult<MinePortalRequest[]>,
      SupabaseResult<MinePortalInvoice[]>,
      SupabaseResult<MinePortalPayment[]>,
      SupabaseResult<MinePortalAnalysis[]>,
      SupabaseResult<MinePortalRequisition[]>,
      SupabaseResult<MinePortalSituation>,
    ];

    if (companyResult.error || !companyResult.data || companyResult.data.is_active === false) {
      throw new MinePortalDataError('La société minière rattachée est introuvable ou inactive.');
    }
    if (situationResult.error) throw new MinePortalDataError('Impossible de charger la situation financière.');

    const company: MinePortalCompany = {
      id: companyResult.data.id,
      name: companyResult.data.name,
      code: companyResult.data.code,
    };
    return {
      company,
      contracts: rowsForCompany(contractsResult, companyId, 'les contrats'),
      requests: rowsForCompany(requestsResult, companyId, 'les demandes'),
      invoices: rowsForCompany(invoicesResult, companyId, 'les factures'),
      payments: rowsForCompany(paymentsResult, companyId, 'les règlements'),
      analyses: rowsForCompany(analysesResult, companyId, 'les analyses'),
      requisitions: rowsForCompany(requisitionsResult, companyId, 'les réquisitions'),
      situation: situationResult.data || null,
    };
  },
};
