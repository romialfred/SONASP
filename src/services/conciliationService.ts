import { supabase } from '@/lib/supabase';
import type { Affectation } from '@/services/tracabiliteVenteService';
import { chargerContexteConciliation } from './conciliationContext';

/**
 * Moteur de conciliation.
 *
 * Les écritures passent exclusivement par les procédures : les tables refusent
 * toute écriture directe. La validation produit en une seule transaction
 * l'ajustement commercial, les ajustements fiscaux, les écarts et le changement
 * d'état ; un échec sur l'un annule l'ensemble.
 */

export type StatutConciliation =
  | 'en_attente_analyse' | 'analyse_recue' | 'calculee' | 'ecart_a_verifier'
  | 'en_attente_validation' | 'contestee' | 'validee'
  | 'facture_definitive_generee' | 'cloturee' | 'annulee';

export type SourceAnalyse = 'certificat_acheteur' | 'analyse_teneur';

export interface Conciliation {
  id: string;
  reference: string;
  sale_id: string;
  contrat_id: string | null;
  mining_company_id: string | null;
  customer_id: string | null;
  source_analyse_type: SourceAnalyse | null;
  assay_certificate_id: string | null;
  analyse_teneur_id: string | null;
  poids_initial_g: number | null;
  teneur_initiale_pct: number | null;
  or_fin_initial_g: number | null;
  prix_initial: number | null;
  devise_initiale: string | null;
  taux_change_initial?: number | null;
  ca_initial: number | null;
  poids_final_g: number | null;
  teneur_finale_pct: number | null;
  or_fin_final_g: number | null;
  prix_final: number | null;
  devise_finale: string | null;
  taux_change_final?: number | null;
  date_fixing: string | null;
  ca_final: number | null;
  deductions_contractuelles?: number | null;
  statut: StatutConciliation;
  motif_statut: string | null;
  observations: string | null;
  version: number;
  soumis_par: string | null;
  soumis_le: string | null;
  valide_par: string | null;
  valide_le: string | null;
  cloture_le: string | null;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  validation_sans_second_regard?: boolean | null;
  /** Donnees de la vente et des contreparties, chargees avec le dossier. */
  sale: {
    id: string;
    sale_number: string;
    sale_date: string | null;
    quantity_oz: number;
    currency: string | null;
    seller_id: string | null;
    seller_type: string | null;
    gross_proceeds?: number;
    total_amount?: number;
    net_proceeds?: number;
    royalty_amount?: number;
    freight_cost?: number | null;
    other_costs?: number | null;
    discount_amount?: number | null;
    final_price_per_oz?: number | null;
    london_am_rate?: number;
    status?: string;
    metal_type?: string | null;
    mechanism_type?: string | null;
    order_type?: string | null;
    is_internal_sale?: boolean | null;
    shipping_preparation_id?: string | null;
    spot_value_date?: string | null;
    forward_value_date?: string | null;
    spot_pricing_date?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    internal_notes?: string | null;
    customer_notes?: string | null;
  } | null;
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    contact_person?: string | null;
    email?: string | null;
  } | null;
  mining_company: {
    id: string;
    name: string;
    code: string | null;
    contact_person_phone?: string | null;
    contact_person_name?: string | null;
    default_currency?: string | null;
  } | null;
}

export interface EcartConciliation {
  id: string;
  conciliation_id: string;
  parametre: 'poids' | 'teneur' | 'or_fin' | 'prix' | 'ca_ht' | 'taxe';
  code_taxe: string | null;
  valeur_initiale: number | null;
  valeur_definitive: number | null;
  ecart_absolu: number | null;
  ecart_relatif_pct: number | null;
  seuil_contractuel_pct: number | null;
  depasse_seuil: boolean;
  justification: string | null;
  unite: string | null;
}

export interface VenteConciliable {
  id: string;
  sale_number: string;
  sale_date: string;
  quantity_oz: number;
  london_am_rate: number;
  gross_proceeds: number;
  currency: string | null;
  status: string;
  customer_id: string | null;
}

export interface LigneVenteConciliation {
  id: string;
  line_number: number;
  metal_type: string;
  quantity_grams: number;
  quantity_oz: number;
  fine_weight_oz: number | null;
  fineness_percentage: number | null;
  unit_price: number;
  line_total: number;
}

export interface CertificatConciliation {
  id: string;
  certificate_number: string | null;
  certificate_date: string | null;
  issuing_laboratory: string | null;
  sample_id: string | null;
  sample_weight_grams: number | null;
  fineness: number | null;
  purity_percent: number | null;
  gold_content_percent: number | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  approval_status: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  shipping_preparation_id: string;
  created_at: string | null;
}

export interface DonneesCertificatConciliation {
  total_weight_g: number | null;
  gold_purity_percentage: number | null;
  is_verified: boolean | null;
  certificate_id?: string;
  fineness?: number | null;
}

export interface AnalyseTeneurConciliation {
  id: string;
  reference: string;
  numero_echantillon: string | null;
  teneur_declaree_pct: number;
  teneur_retenue_pct: number | null;
  masse_echantillon_g: number | null;
  masse_lot_oz: number | null;
  methode_echantillonnage: string | null;
  lieu_prelevement: string | null;
  date_prelevement: string | null;
  date_declaration: string | null;
  decision: string | null;
  statut: string;
  observations: string | null;
}

export interface ExpeditionConciliation {
  id: string;
  expedition_lot_number: string | null;
  refinery_id: string | null;
  shipped_to_company: string | null;
  shipped_to_country: string | null;
  total_gross_weight_grams: number | null;
  total_net_weight_grams: number | null;
  total_weight_oz: number | null;
  prepared_at: string | null;
  shipped_at: string | null;
  status: string;
}

export interface RaffinerieConciliation {
  id: string;
  name: string;
  country: string | null;
}

export interface PaiementConciliation {
  id: string;
  invoice_number: string | null;
  reference_number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created_at: string | null;
}

export interface ReceptionConciliation {
  received_at: string | null;
}

export interface ContexteConciliation {
  lignes: LigneVenteConciliation[];
  certificat: CertificatConciliation | null;
  donneesCertificat?: DonneesCertificatConciliation | null;
  analyseTeneur: AnalyseTeneurConciliation | null;
  expedition: ExpeditionConciliation | null;
  raffinerie: RaffinerieConciliation | null;
  paiement: PaiementConciliation | null;
  /** Lots d'achat réellement affectés à la vente (mine ou artisan). */
  origines?: Affectation[];
  reception?: ReceptionConciliation | null;
  certificats?: CertificatConciliation[];
  analysesMine?: AnalyseTeneurConciliation[];
  mesuresCertificats?: DonneesCertificatConciliation[];
  incidents?: Array<{ section: string; type: 'acces' | 'technique'; code: string }>;
  fiscalite?: MouvementFiscalConciliation[];
}

export interface MouvementFiscalConciliation {
  id: string; code_taxe: string; sens: string; montant: number; devise: string;
  type_mouvement: string; statut_credit: string | null; conciliation_id: string | null;
  created_at: string;
}

export interface ImpactFiscalConciliation {
  code_taxe: string; regle_id: string | null; assiette: string | null;
  taux: number | null; mode_calcul: string | null; devise: string;
  initial: number | null; definitif: number | null; ecart: number | null;
  versements: number | null;
  etat: 'calculable' | 'regle_absente' | 'conversion_requise' | 'assiette_incomplete' | 'base_initiale_absente';
}

export const LIBELLES_STATUTS_CONCILIATION: Record<StatutConciliation, string> = {
  en_attente_analyse: "En attente d'analyse",
  analyse_recue: 'Analyse reçue',
  calculee: 'Calculée',
  ecart_a_verifier: 'Écart à vérifier',
  en_attente_validation: 'En attente de validation',
  contestee: 'Contestée',
  validee: 'Validée',
  facture_definitive_generee: 'Facture définitive émise',
  cloturee: 'Clôturée',
  annulee: 'Annulée',
};

export const LIBELLES_PARAMETRES: Record<string, string> = {
  poids: 'Poids',
  teneur: 'Teneur',
  or_fin: 'Or fin',
  prix: 'Prix',
  ca_ht: "Chiffre d'affaires",
  taxe: 'Taxe',
};

/** Identifiant d'opération, pour qu'un double envoi ne produise pas de doublon. */
function cleIdempotence(): string {
  return crypto.randomUUID();
}

export const conciliationService = {
  async impactsFiscaux(id: string, ca: number | null, orFin: number | null, prix: number | null, date: string): Promise<ImpactFiscalConciliation[]> {
    const { data, error } = await supabase.rpc('snp_conciliation_impacts_fiscaux', {
      p_conciliation_id: id, p_ca_final: ca, p_or_fin_final_g: orFin, p_prix_final: prix,
      p_date_fixing: date || null,
    });
    if (error) throw error;
    return (data ?? []) as unknown as ImpactFiscalConciliation[];
  },
  async lister(): Promise<Conciliation[]> {
    const { data, error } = await supabase
      .from('snp_conciliations')
      .select(`
        *,
        sale:sales!snp_conciliations_sale_id_fkey(
          id, sale_number, sale_date, quantity_oz, currency, seller_id, seller_type
        ),
        customer:customers!snp_conciliations_customer_id_fkey(id, name),
        mining_company:mining_companies!snp_conciliations_mining_company_id_fkey(id, name, code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Conciliation[];
  },

  async parIdentifiant(id: string): Promise<Conciliation | null> {
    const { data, error } = await supabase
      .from('snp_conciliations')
      .select(`
        *,
        sale:sales!snp_conciliations_sale_id_fkey(
          id, sale_number, sale_date, quantity_oz, currency, seller_id, seller_type,
          gross_proceeds, total_amount, net_proceeds, royalty_amount, freight_cost,
          other_costs, discount_amount, final_price_per_oz, london_am_rate, status,
          metal_type, mechanism_type, order_type, shipping_preparation_id, spot_value_date, forward_value_date, spot_pricing_date,
          is_internal_sale, completed_at, created_at, updated_at, internal_notes, customer_notes
        ),
        customer:customers!snp_conciliations_customer_id_fkey(id, name, phone, contact_person, email),
        mining_company:mining_companies!snp_conciliations_mining_company_id_fkey(
          id, name, code, contact_person_phone, contact_person_name, default_currency
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data as Conciliation) ?? null;
  },

  /**
   * Contexte métier de la fiche : lignes de vente, expédition, résultat réel de
   * raffinage et référence financière. Chaque lecture reste soumise à la RLS.
   */
  async contexte(dossier: Conciliation): Promise<ContexteConciliation> {
    return chargerContexteConciliation(dossier);
  },


  async ecarts(conciliationId: string): Promise<EcartConciliation[]> {
    const { data, error } = await supabase
      .from('snp_conciliations_ecarts')
      .select('*')
      .eq('conciliation_id', conciliationId)
      .order('parametre', { ascending: true });

    if (error) throw error;
    return (data ?? []) as EcartConciliation[];
  },

  /**
   * Ventes pouvant encore être conciliées : celles qui ne portent pas déjà un
   * dossier vivant.
   */
  async ventesConciliables(): Promise<VenteConciliable[]> {
    const [ventes, dossiers] = await Promise.all([
      supabase
        .from('sales')
        .select('id, sale_number, sale_date, quantity_oz, london_am_rate, gross_proceeds, currency, status, customer_id, expedition:shipping_preparations!inner(id, shipped_at, refinery_id)')
        .not('expedition.shipped_at', 'is', null)
        .not('expedition.refinery_id', 'is', null)
        .order('sale_date', { ascending: false })
        .limit(200),
      supabase.from('snp_conciliations').select('sale_id').neq('statut', 'annulee'),
    ]);

    if (ventes.error) throw ventes.error;
    if (dossiers.error) throw dossiers.error;

    const dejaConciliees = new Set((dossiers.data ?? []).map((d) => d.sale_id as string));
    return ((ventes.data ?? []) as unknown as VenteConciliable[]).filter((v) => !dejaConciliees.has(v.id) && !['cancelled', 'canceled', 'rejected'].includes(v.status));
  },

  async ouvrir(saleId: string): Promise<{ id: string; reference: string; statut: string }> {
    const { data, error } = await supabase.rpc('snp_conciliation_ouvrir', {
      p_sale_id: saleId,
      p_idempotency_key: cleIdempotence(),
    });

    if (error) throw error;
    return data as { id: string; reference: string; statut: string };
  },

  async enregistrerAnalyse(params: {
    conciliationId: string;
    sourceType: SourceAnalyse;
    sourceId: string;
    poidsFinalG: number;
    teneurFinalePct: number;
    prixFinal: number;
    dateFixing: string;
  }): Promise<{ reference: string; or_fin_final_g: number; ca_final: number }> {
    const { data, error } = await supabase.rpc('snp_conciliation_enregistrer_analyse', {
      p_conciliation_id: params.conciliationId,
      p_source_type: params.sourceType,
      p_source_id: params.sourceId,
      p_poids_final_g: params.poidsFinalG,
      p_teneur_finale_pct: params.teneurFinalePct,
      p_prix_final: params.prixFinal,
      p_date_fixing: params.dateFixing,
      p_idempotency_key: cleIdempotence(),
    });

    if (error) throw error;
    return data as { reference: string; or_fin_final_g: number; ca_final: number };
  },

  /**
   * Arrête les valeurs définitives. La procédure refuse que l'acteur ayant
   * préparé le dossier le valide lui-même.
   */
  async valider(conciliationId: string): Promise<{
    reference: string;
    ecart_commercial: number;
    /** Champ historique : les nouvelles validations exigent un second acteur, y compris Owner. */
    sans_second_regard: boolean;
    taxes_ajustees: string[];
    taxes_sans_regle: string[];
  }> {
    const { data, error } = await supabase.rpc('snp_conciliation_valider', {
      p_conciliation_id: conciliationId,
      p_idempotency_key: cleIdempotence(),
    });

    if (error) throw error;
    return data as {
      reference: string;
      ecart_commercial: number;
      sans_second_regard: boolean;
      taxes_ajustees: string[];
      taxes_sans_regle: string[];
    };
  },

  /** Solde commercial d'une contrepartie, reconstruit depuis le grand livre. */
  async soldeClient(customerId: string): Promise<number> {
    const { data, error } = await supabase.rpc('snp_solde_commercial', {
      p_contrepartie_type: 'customer',
      p_contrepartie_id: customerId,
    });

    if (error) throw error;
    return Number(data ?? 0);
  },
};
