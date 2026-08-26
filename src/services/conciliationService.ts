import { supabase } from '@/lib/supabase';

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
  ca_initial: number | null;
  poids_final_g: number | null;
  teneur_finale_pct: number | null;
  or_fin_final_g: number | null;
  prix_final: number | null;
  devise_finale: string | null;
  date_fixing: string | null;
  ca_final: number | null;
  statut: StatutConciliation;
  motif_statut: string | null;
  observations: string | null;
  version: number;
  soumis_par: string | null;
  soumis_le: string | null;
  valide_par: string | null;
  valide_le: string | null;
  cloture_le: string | null;
  created_at: string;
  updated_at: string;
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
  status: string;
  customer_id: string | null;
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
  async lister(): Promise<Conciliation[]> {
    const { data, error } = await supabase
      .from('snp_conciliations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Conciliation[];
  },

  async parIdentifiant(id: string): Promise<Conciliation | null> {
    const { data, error } = await supabase
      .from('snp_conciliations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data as Conciliation) ?? null;
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
        .select('id, sale_number, sale_date, quantity_oz, london_am_rate, gross_proceeds, status, customer_id')
        .order('sale_date', { ascending: false })
        .limit(200),
      supabase.from('snp_conciliations').select('sale_id').neq('statut', 'annulee'),
    ]);

    if (ventes.error) throw ventes.error;
    if (dossiers.error) throw dossiers.error;

    const dejaConciliees = new Set((dossiers.data ?? []).map((d) => d.sale_id as string));
    return ((ventes.data ?? []) as VenteConciliable[]).filter((v) => !dejaConciliees.has(v.id));
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
