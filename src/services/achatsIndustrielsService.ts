import { supabase } from '@/lib/supabase';

/**
 * Achats d'or industriel : accès aux données et appel des opérations métier.
 *
 * ══ RÈGLE DE CE SERVICE ══
 * Les lectures passent par PostgREST, sous le contrôle des politiques RLS : une
 * société minière ne reçoit que ses propres lignes, et cela ne dépend d'aucun
 * filtre écrit ici.
 *
 * Les écritures sensibles — répartir, soumettre, répondre, régler, affecter —
 * passent par des fonctions PL/pgSQL appelées en RPC. Elles s'exécutent d'un
 * bloc et vérifient elles-mêmes l'habilitation. Enchaîner plusieurs requêtes
 * REST à la place laisserait, à la moindre coupure, une approbation sans
 * facture ou un règlement sans affectation.
 *
 * Aucun montant n'est calculé puis enregistré depuis ici : les totaux
 * reviennent de la base après écriture.
 */

/* ------------------------------------------------------------------ Types */

export type StatutPlan =
  | 'brouillon' | 'pret_soumission' | 'soumis'
  | 'partiellement_approuve' | 'approuve' | 'rejete'
  | 'en_execution' | 'cloture' | 'annule';

export type StatutDemande =
  | 'brouillon' | 'validee_interne' | 'soumise'
  | 'approuvee' | 'rejetee' | 'modification_demandee' | 'expiree' | 'annulee';

export type StatutFacture =
  | 'brouillon' | 'emise' | 'certifiee' | 'echec_certification'
  | 'partiellement_payee' | 'payee' | 'contestee' | 'suspendue' | 'annulee';

export type StatutCertification = 'non_requise' | 'en_attente' | 'certifiee' | 'echec';

export type StatutReglement = 'enregistre' | 'valide' | 'rejete' | 'annule';

export const LIBELLES_STATUT_PLAN: Record<StatutPlan, string> = {
  brouillon: 'Brouillon',
  pret_soumission: 'Prêt à soumettre',
  soumis: 'Soumis aux mines',
  partiellement_approuve: 'Partiellement approuvé',
  approuve: 'Approuvé',
  rejete: 'Rejeté',
  en_execution: 'En exécution',
  cloture: 'Clôturé',
  annule: 'Annulé',
};

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemande, string> = {
  brouillon: 'Brouillon',
  validee_interne: 'Validée en interne',
  soumise: 'En attente de réponse',
  approuvee: 'Approuvée',
  rejetee: 'Rejetée',
  modification_demandee: 'Modification demandée',
  expiree: 'Expirée',
  annulee: 'Annulée',
};

export const LIBELLES_STATUT_FACTURE: Record<StatutFacture, string> = {
  brouillon: 'Brouillon',
  emise: 'Émise',
  certifiee: 'Certifiée',
  echec_certification: 'Échec de certification',
  partiellement_payee: 'Partiellement payée',
  payee: 'Payée',
  contestee: 'Contestée',
  suspendue: 'Suspendue',
  annulee: 'Annulée',
};

export const LIBELLES_CERTIFICATION: Record<StatutCertification, string> = {
  non_requise: 'Non requise',
  en_attente: 'En attente de certification',
  certifiee: 'Certifiée',
  echec: 'Échec de certification',
};

export const LIBELLES_STATUT_REGLEMENT: Record<StatutReglement, string> = {
  enregistre: 'Enregistré',
  valide: 'Validé',
  rejete: 'Rejeté',
  annule: 'Annulé',
};

export const CONDITIONS_PAIEMENT = [
  { valeur: 'comptant', libelle: 'Comptant' },
  { valeur: 'differe_30j', libelle: 'Différé 30 jours' },
  { valeur: 'differe_60j', libelle: 'Différé 60 jours' },
  { valeur: 'differe_90j', libelle: 'Différé 90 jours' },
  { valeur: 'echelonne', libelle: 'Échelonné' },
] as const;

export const MODES_REGLEMENT = [
  { valeur: 'virement', libelle: 'Virement bancaire' },
  { valeur: 'cheque', libelle: 'Chèque' },
  { valeur: 'compensation', libelle: 'Compensation' },
  { valeur: 'especes', libelle: 'Espèces' },
] as const;

export interface Societe {
  id: string;
  name: string;
  code?: string | null;
}

export interface PlanAchat {
  id: string;
  numero_plan: string;
  annee: number;
  mois: number;
  mode_repartition: 'pourcentage' | 'quantite_cible';
  pourcentage_global: number | null;
  quantite_cible_oz: number | null;
  prix_once_global_fcfa: number | null;
  devise: string;
  unite: string;
  quantite_repartie_oz: number;
  montant_previsionnel_fcfa: number;
  statut: StatutPlan;
  observations: string | null;
  date_soumission: string | null;
  created_at: string;
}

export interface LignePlan {
  id: string;
  plan_id: string;
  mining_company_id: string;
  periode_debut: string;
  periode_fin: string;
  production_declaree_oz: number;
  production_validee_oz: number;
  deja_engage_oz: number;
  production_eligible_oz: number;
  titre_moyen_pct: number | null;
  pourcentage_applique: number | null;
  quantite_proposee_oz: number;
  prix_once_fcfa: number;
  montant_estime_fcfa: number;
  ajustee_manuellement: boolean;
  statut: string;
  observations: string | null;
  mining_company?: Societe | null;
}

export interface DemandeAchat {
  id: string;
  numero_demande: string;
  plan_id: string | null;
  mining_company_id: string;
  periode_debut: string;
  periode_fin: string;
  production_reference_oz: number;
  quantite_demandee_oz: number;
  pourcentage_applique: number | null;
  titre_pct: number | null;
  prix_once_fcfa: number;
  devise: string;
  montant_estime_fcfa: number;
  conditions_paiement: string;
  date_limite_reponse: string | null;
  statut: StatutDemande;
  observations: string | null;
  motif_rejet: string | null;
  motif_modification: string | null;
  date_soumission: string | null;
  date_reponse: string | null;
  mining_company?: Societe | null;
}

export interface FactureAchat {
  id: string;
  numero_facture: string;
  achat_id: string;
  mining_company_id: string;
  date_emission: string;
  periode_debut: string;
  periode_fin: string;
  quantite_oz: number;
  titre_pct: number | null;
  prix_once_fcfa: number;
  montant_ht_fcfa: number;
  tva_montant_fcfa: number;
  taxe_dev_comm_montant_fcfa: number;
  montant_ttc_fcfa: number;
  montant_ajustements_fcfa: number;
  montant_paye_fcfa: number;
  devise: string;
  conditions_paiement: string;
  date_echeance: string;
  statut: StatutFacture;
  statut_certification: StatutCertification;
  certification_reference: string | null;
  certification_date: string | null;
  mining_company?: Societe | null;
  /** Reste dû, calculé en base. Jamais recalculé côté écran. */
  reste_du_fcfa?: number;
}

export interface ReglementAchat {
  id: string;
  reference_reglement: string;
  mining_company_id: string;
  date_reglement: string;
  montant_fcfa: number;
  montant_affecte_fcfa: number;
  devise: string;
  mode_reglement: string;
  banque: string | null;
  reference_bancaire: string | null;
  statut: StatutReglement;
  observations: string | null;
  mining_company?: Societe | null;
}

export interface Affectation {
  id: string;
  reglement_id: string;
  facture_id: string;
  montant_affecte_fcfa: number;
  mode_affectation: 'manuelle' | 'automatique_fifo';
  statut: 'active' | 'annulee';
  date_affectation: string;
  motif_annulation: string | null;
}

export interface LigneBalanceAgee {
  mining_company_id: string;
  societe: string;
  devise: string;
  non_echu: number;
  j1_30: number;
  j31_60: number;
  j61_90: number;
  j91_180: number;
  plus_180: number;
  total: number;
  nb_factures: number;
  plus_ancienne: string | null;
  anciennete_moyenne: number | null;
}

export interface LigneReleve {
  ligne_date: string;
  type_operation: 'facture' | 'reglement' | 'avoir';
  reference: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
  statut: string;
  piece_id: string;
}

export interface SituationSociete {
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

export const MOIS_LIBELLES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const libelleMois = (mois: number) => MOIS_LIBELLES[mois - 1] || `Mois ${mois}`;

/* --------------------------------------------------------------- Service */

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const achatsIndustrielsService = {
  /* ------------------------------------------------------------- Plans -- */

  async listerPlans(): Promise<PlanAchat[]> {
    const reponse = await supabase
      .from('snp_plans_achat')
      .select('*')
      .order('annee', { ascending: false })
      .order('mois', { ascending: false });
    return (lancerSiErreur(reponse) || []) as PlanAchat[];
  },

  async plan(id: string): Promise<PlanAchat | null> {
    const reponse = await supabase.from('snp_plans_achat').select('*').eq('id', id).maybeSingle();
    return (lancerSiErreur(reponse) as PlanAchat) || null;
  },

  async creerPlan(entree: {
    annee: number;
    mois: number;
    mode_repartition: 'pourcentage' | 'quantite_cible';
    pourcentage_global?: number | null;
    quantite_cible_oz?: number | null;
    prix_once_global_fcfa?: number | null;
    observations?: string | null;
  }): Promise<PlanAchat> {
    const { data: session } = await supabase.auth.getUser();
    const numero = `PA-${entree.annee}-${String(entree.mois).padStart(2, '0')}`;

    const reponse = await supabase
      .from('snp_plans_achat')
      .insert([{
        numero_plan: numero,
        annee: entree.annee,
        mois: entree.mois,
        mode_repartition: entree.mode_repartition,
        pourcentage_global: entree.mode_repartition === 'pourcentage' ? entree.pourcentage_global : null,
        quantite_cible_oz: entree.mode_repartition === 'quantite_cible' ? entree.quantite_cible_oz : null,
        prix_once_global_fcfa: entree.prix_once_global_fcfa ?? null,
        observations: entree.observations ?? null,
        statut: 'brouillon',
        created_by: session?.user?.id ?? null,
      }])
      .select('*')
      .single();
    return lancerSiErreur(reponse) as PlanAchat;
  },

  async majPlan(id: string, champs: Partial<PlanAchat>): Promise<PlanAchat> {
    const { data: session } = await supabase.auth.getUser();
    const reponse = await supabase
      .from('snp_plans_achat')
      .update({ ...champs, updated_by: session?.user?.id ?? null })
      .eq('id', id)
      .select('*')
      .single();
    return lancerSiErreur(reponse) as PlanAchat;
  },

  /** Répartition : c'est la base qui lit la production et calcule les parts. */
  async repartir(planId: string, ecraserAjustements = false) {
    const reponse = await supabase.rpc('snp_repartir_plan', {
      p_plan_id: planId,
      p_ecraser_ajustements: ecraserAjustements,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      lignes_creees: number; lignes_mises_a_jour: number; lignes_preservees: number;
    }>;
    return lignes?.[0] ?? { lignes_creees: 0, lignes_mises_a_jour: 0, lignes_preservees: 0 };
  },

  async lignesDuPlan(planId: string): Promise<LignePlan[]> {
    const reponse = await supabase
      .from('snp_plans_achat_lignes')
      .select('*, mining_company:mining_companies(id, name, code)')
      .eq('plan_id', planId)
      .order('quantite_proposee_oz', { ascending: false });
    return (lancerSiErreur(reponse) || []) as LignePlan[];
  },

  /**
   * Modification d'une ligne. `ajustee_manuellement` bascule à vrai : une
   * nouvelle application globale ne l'écrasera pas sans ordre explicite.
   */
  async ajusterLigne(
    ligneId: string,
    champs: { quantite_proposee_oz?: number; prix_once_fcfa?: number; observations?: string | null }
  ): Promise<LignePlan> {
    const reponse = await supabase
      .from('snp_plans_achat_lignes')
      .update({ ...champs, ajustee_manuellement: true })
      .eq('id', ligneId)
      .select('*, mining_company:mining_companies(id, name, code)')
      .single();
    return lancerSiErreur(reponse) as LignePlan;
  },

  async soumettrePlan(planId: string): Promise<number> {
    const reponse = await supabase.rpc('snp_soumettre_plan', { p_plan_id: planId });
    const lignes = lancerSiErreur(reponse) as Array<{ demandes_creees: number }>;
    return lignes?.[0]?.demandes_creees ?? 0;
  },

  /* ---------------------------------------------------------- Demandes -- */

  async listerDemandes(filtres?: { statut?: string; societe?: string }): Promise<DemandeAchat[]> {
    let requete = supabase
      .from('snp_demandes_achat')
      .select('*, mining_company:mining_companies(id, name, code)')
      .order('date_soumission', { ascending: false, nullsFirst: false });

    if (filtres?.statut && filtres.statut !== 'all') requete = requete.eq('statut', filtres.statut);
    if (filtres?.societe && filtres.societe !== 'all') {
      requete = requete.eq('mining_company_id', filtres.societe);
    }
    return (lancerSiErreur(await requete) || []) as DemandeAchat[];
  },

  async demande(id: string): Promise<DemandeAchat | null> {
    const reponse = await supabase
      .from('snp_demandes_achat')
      .select('*, mining_company:mining_companies(id, name, code)')
      .eq('id', id)
      .maybeSingle();
    return (lancerSiErreur(reponse) as DemandeAchat) || null;
  },

  async historiqueDemande(demandeId: string) {
    const reponse = await supabase
      .from('snp_demandes_achat_historique')
      .select('*')
      .eq('demande_id', demandeId)
      .order('created_at', { ascending: false });
    return lancerSiErreur(reponse) || [];
  },

  /**
   * Réponse de la mine. En cas d'approbation, la base crée d'un même bloc la
   * transaction et la facture : la fonction est idempotente, une seconde
   * approbation renvoie les mêmes identifiants sans rien dupliquer.
   */
  async repondreDemande(demandeId: string, decision: 'approuvee' | 'rejetee' | 'modification_demandee', motif?: string) {
    const reponse = await supabase.rpc('snp_repondre_demande', {
      p_demande_id: demandeId,
      p_decision: decision,
      p_motif: motif ?? null,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      r_demande_id: string; r_achat_id: string | null;
      r_facture_id: string | null; r_numero_facture: string | null;
    }>;
    return lignes?.[0] ?? null;
  },

  /* ---------------------------------------------------------- Factures -- */

  async listerFactures(filtres?: { societe?: string; statut?: string }): Promise<FactureAchat[]> {
    let requete = supabase
      .from('snp_factures_achat')
      .select('*, mining_company:mining_companies(id, name, code)')
      .order('date_echeance', { ascending: true });

    if (filtres?.societe && filtres.societe !== 'all') {
      requete = requete.eq('mining_company_id', filtres.societe);
    }
    if (filtres?.statut && filtres.statut !== 'all') requete = requete.eq('statut', filtres.statut);

    const factures = (lancerSiErreur(await requete) || []) as FactureAchat[];
    // Le reste dû se déduit des montants tenus par la base ; aucune règle de
    // calcul n'est réécrite ici.
    return factures.map((facture) => ({
      ...facture,
      reste_du_fcfa: Math.max(
        0,
        Number(facture.montant_ttc_fcfa || 0)
          - Number(facture.montant_ajustements_fcfa || 0)
          - Number(facture.montant_paye_fcfa || 0)
      ),
    }));
  },

  async facture(id: string): Promise<FactureAchat | null> {
    const reponse = await supabase
      .from('snp_factures_achat')
      .select('*, mining_company:mining_companies(id, name, code)')
      .eq('id', id)
      .maybeSingle();
    const facture = lancerSiErreur(reponse) as FactureAchat | null;
    if (!facture) return null;
    return {
      ...facture,
      reste_du_fcfa: Math.max(
        0,
        Number(facture.montant_ttc_fcfa || 0)
          - Number(facture.montant_ajustements_fcfa || 0)
          - Number(facture.montant_paye_fcfa || 0)
      ),
    };
  },

  async lignesFacture(factureId: string) {
    const reponse = await supabase
      .from('snp_factures_achat_lignes')
      .select('*')
      .eq('facture_id', factureId)
      .order('rang');
    return lancerSiErreur(reponse) || [];
  },

  /* -------------------------------------------------------- Règlements -- */

  async listerReglements(societeId?: string): Promise<ReglementAchat[]> {
    let requete = supabase
      .from('snp_reglements_achat')
      .select('*, mining_company:mining_companies(id, name, code)')
      .order('date_reglement', { ascending: false });
    if (societeId && societeId !== 'all') requete = requete.eq('mining_company_id', societeId);
    return (lancerSiErreur(await requete) || []) as ReglementAchat[];
  },

  async enregistrerReglement(entree: {
    mining_company_id: string;
    montant_fcfa: number;
    date_reglement: string;
    mode_reglement: string;
    banque?: string | null;
    reference_bancaire?: string | null;
    observations?: string | null;
    affecter_fifo?: boolean;
  }) {
    const reponse = await supabase.rpc('snp_enregistrer_reglement', {
      p_mining_company_id: entree.mining_company_id,
      p_montant: entree.montant_fcfa,
      p_date: entree.date_reglement,
      p_mode: entree.mode_reglement,
      p_banque: entree.banque ?? null,
      p_reference_bancaire: entree.reference_bancaire ?? null,
      p_observations: entree.observations ?? null,
      p_affecter_fifo: entree.affecter_fifo ?? false,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      reglement_id: string; reference: string;
      montant_affecte: number; solde_non_affecte: number;
    }>;
    return lignes?.[0] ?? null;
  },

  async affecter(reglementId: string, factureId: string, montant: number, observations?: string) {
    const reponse = await supabase.rpc('snp_affecter_reglement', {
      p_reglement_id: reglementId,
      p_facture_id: factureId,
      p_montant: montant,
      p_observations: observations ?? null,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      affectation_id: string; reste_facture: number; solde_reglement: number;
    }>;
    return lignes?.[0] ?? null;
  },

  async affecterFifo(reglementId: string) {
    const reponse = await supabase.rpc('snp_affecter_fifo', { p_reglement_id: reglementId });
    const lignes = lancerSiErreur(reponse) as Array<{
      factures_soldees: number; montant_affecte: number; solde_non_affecte: number;
    }>;
    return lignes?.[0] ?? { factures_soldees: 0, montant_affecte: 0, solde_non_affecte: 0 };
  },

  async annulerAffectation(affectationId: string, motif: string) {
    const reponse = await supabase.rpc('snp_annuler_affectation', {
      p_affectation_id: affectationId,
      p_motif: motif,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      affectation_id: string; reste_facture: number; solde_reglement: number;
    }>;
    return lignes?.[0] ?? null;
  },

  async affectationsDuReglement(reglementId: string): Promise<Affectation[]> {
    const reponse = await supabase
      .from('snp_reglements_affectations')
      .select('*')
      .eq('reglement_id', reglementId)
      .order('date_affectation', { ascending: false });
    return (lancerSiErreur(reponse) || []) as Affectation[];
  },

  async affectationsDeLaFacture(factureId: string): Promise<Affectation[]> {
    const reponse = await supabase
      .from('snp_reglements_affectations')
      .select('*')
      .eq('facture_id', factureId)
      .order('date_affectation', { ascending: false });
    return (lancerSiErreur(reponse) || []) as Affectation[];
  },

  /* ------------------------------------------------ Suivi et comptabilité */

  async balanceAgee(societeId?: string, date?: string): Promise<LigneBalanceAgee[]> {
    const reponse = await supabase.rpc('snp_balance_agee', {
      p_date: date ?? new Date().toISOString().slice(0, 10),
      p_mining_company_id: societeId && societeId !== 'all' ? societeId : null,
    });
    return (lancerSiErreur(reponse) || []) as LigneBalanceAgee[];
  },

  async releve(societeId: string, debut?: string, fin?: string): Promise<LigneReleve[]> {
    const reponse = await supabase.rpc('snp_releve_societe', {
      p_mining_company_id: societeId,
      p_debut: debut ?? null,
      p_fin: fin ?? new Date().toISOString().slice(0, 10),
    });
    return (lancerSiErreur(reponse) || []) as LigneReleve[];
  },

  async situation(societeId: string): Promise<SituationSociete | null> {
    const reponse = await supabase.rpc('snp_situation_societe', { p_mining_company_id: societeId });
    const lignes = lancerSiErreur(reponse) as SituationSociete[];
    return lignes?.[0] ?? null;
  },

  async societesProductrices(): Promise<Societe[]> {
    const reponse = await supabase
      .from('mining_companies')
      .select('id, name, code, company_type')
      .eq('is_active', true)
      .order('name');
    const societes = (lancerSiErreur(reponse) || []) as Array<Societe & { company_type?: string }>;
    return societes.filter((societe) => !societe.company_type || societe.company_type === 'production_mine');
  },

  async journalAudit(objetId?: string, limite = 100) {
    let requete = supabase
      .from('snp_achats_audit')
      .select('*')
      .order('survenu_le', { ascending: false })
      .limit(limite);
    if (objetId) requete = requete.eq('objet_id', objetId);
    return lancerSiErreur(await requete) || [];
  },
};
