import { supabase } from '@/lib/supabase';

/**
 * Réquisitions de production d'or.
 *
 * ══ PRUDENCE JURIDIQUE ══
 *
 * Le régime d'une réquisition n'est pas supposé : il est porté par la pièce
 * elle-même. Trois valeurs, qui ne se confondent pas :
 *
 *   `executoire_sans_accord`  l'acte habilitant rend la réquisition exécutoire.
 *                             La mine en accuse réception ; elle ne l'approuve pas.
 *   `accord_requis`           le cadre applicable exige l'accord de la mine.
 *   `a_qualifier`             le régime n'est pas établi. La pièce ne peut pas
 *                             devenir exécutoire tant qu'il ne l'est pas.
 *
 * Accusé de réception, observations, contestation et accord sont quatre faits
 * distincts, portés par quatre champs. Les confondre ferait dire au système
 * soit qu'une mine a consenti quand elle n'a fait qu'accuser réception, soit
 * qu'une décision d'autorité était facultative.
 *
 * La base applique ces règles : `snp_changer_statut_requisition` refuse le
 * passage à « exécutoire » sous un régime non qualifié, et exige l'accord
 * lorsque le régime le demande.
 */

/* ------------------------------------------------------------------ Types */

export type RegimeJuridique = 'executoire_sans_accord' | 'accord_requis' | 'a_qualifier';

export type TypeRequisition = 'totale' | 'partielle' | 'pourcentage';

export type StatutRequisition =
  | 'brouillon' | 'verification_juridique' | 'validation_metier' | 'validation_direction'
  | 'autorisee' | 'notifiee' | 'accusee' | 'contestee' | 'executoire'
  | 'enlevement_planifie' | 'en_cours_enlevement' | 'collectee' | 'en_analyse'
  | 'acceptee' | 'facturee' | 'payee' | 'cloturee' | 'suspendue' | 'annulee';

export type CanalNotification =
  | 'plateforme' | 'courriel' | 'sms' | 'courrier_officiel' | 'remise_en_main_propre';

export type ImputationContractuelle =
  | 'totale' | 'partielle' | 'hors_contrat' | 'periode_future' | 'avenant' | 'exclue';

export type StatutEnlevement = 'planifie' | 'en_cours' | 'realise' | 'partiel' | 'annule';

export const LIBELLES_REGIME: Record<RegimeJuridique, string> = {
  executoire_sans_accord: 'Exécutoire sans accord de la mine',
  accord_requis: 'Accord de la mine requis',
  a_qualifier: 'Régime à qualifier',
};

/** Ce que chaque régime implique, en une phrase, pour l'agent qui prépare. */
export const PORTEE_REGIME: Record<RegimeJuridique, string> = {
  executoire_sans_accord:
    'L’acte habilitant suffit. La mine accuse réception et peut formuler des observations ; son accord n’est pas requis.',
  accord_requis:
    'Le cadre applicable subordonne l’exécution à l’accord de la mine. Sans cet accord, la réquisition ne devient pas exécutoire.',
  a_qualifier:
    'Le régime reste à établir. La réquisition ne peut être ni autorisée ni rendue exécutoire en l’état.',
};

export const LIBELLES_TYPE_REQUISITION: Record<TypeRequisition, string> = {
  totale: 'Totalité de la production',
  partielle: 'Quantité déterminée',
  pourcentage: 'Pourcentage de la production',
};

export const LIBELLES_STATUT_REQUISITION: Record<StatutRequisition, string> = {
  brouillon: 'Brouillon',
  verification_juridique: 'En vérification juridique',
  validation_metier: 'En validation métier',
  validation_direction: 'En validation de la direction',
  autorisee: 'Autorisée',
  notifiee: 'Notifiée à la mine',
  accusee: 'Accusé de réception reçu',
  contestee: 'Contestée',
  executoire: 'Exécutoire',
  enlevement_planifie: 'Enlèvement programmé',
  en_cours_enlevement: 'Enlèvement en cours',
  collectee: 'Quantité collectée',
  en_analyse: 'En cours d’analyse',
  acceptee: 'Quantité acceptée',
  facturee: 'Facturée',
  payee: 'Payée',
  cloturee: 'Clôturée',
  suspendue: 'Suspendue',
  annulee: 'Annulée',
};

export type Ton = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONS_STATUT_REQUISITION: Record<StatutRequisition, Ton> = {
  brouillon: 'neutral',
  verification_juridique: 'info',
  validation_metier: 'info',
  validation_direction: 'info',
  autorisee: 'warning',
  notifiee: 'warning',
  accusee: 'info',
  contestee: 'danger',
  executoire: 'success',
  enlevement_planifie: 'info',
  en_cours_enlevement: 'info',
  collectee: 'info',
  en_analyse: 'info',
  acceptee: 'success',
  facturee: 'warning',
  payee: 'success',
  cloturee: 'neutral',
  suspendue: 'warning',
  annulee: 'danger',
};

export const LIBELLES_CANAL: Record<CanalNotification, string> = {
  plateforme: 'Notification dans la plateforme',
  courriel: 'Courrier électronique',
  sms: 'SMS',
  courrier_officiel: 'Courrier officiel',
  remise_en_main_propre: 'Remise en main propre',
};

export const LIBELLES_IMPUTATION: Record<ImputationContractuelle, string> = {
  totale: 'Imputée en totalité sur l’engagement contractuel',
  partielle: 'Imputée partiellement sur l’engagement',
  hors_contrat: 'Quantité exceptionnelle, hors contrat',
  periode_future: 'Imputée sur une période future',
  avenant: 'Traitée par avenant',
  exclue: 'Exclue du calcul contractuel',
};

export const LIBELLES_STATUT_ENLEVEMENT: Record<StatutEnlevement, string> = {
  planifie: 'Programmé',
  en_cours: 'En cours',
  realise: 'Réalisé',
  partiel: 'Partiellement réalisé',
  annule: 'Annulé',
};

export interface Requisition {
  id: string;
  reference: string;
  objet: string;
  partenaire_type: string;
  mining_company_id: string | null;
  site_id: string | null;
  contrat_id: string | null;
  type_requisition: TypeRequisition;
  regime_juridique: RegimeJuridique;
  autorite_origine: string | null;
  nature_acte: string | null;
  reference_acte: string | null;
  date_signature_acte: string | null;
  date_effet: string | null;
  periode_debut: string | null;
  periode_fin: string | null;
  quantite_oz: number | null;
  unite: string;
  pourcentage_production: number | null;
  produits_concernes: string | null;
  teneur_estimee_pct: number | null;
  lieu_stockage: string | null;
  lieu_enlevement: string | null;
  delai_mise_a_disposition_jours: number | null;
  modalites_enlevement: string | null;
  conditions_transport: string | null;
  conditions_analyse: string | null;
  methode_prix: string;
  prix_once_fcfa: number | null;
  modalites_paiement: string;
  responsable_id: string | null;
  equipe: string | null;
  confidentialite: string;
  observations: string | null;
  accuse_reception_le: string | null;
  accuse_reception_par: string | null;
  observations_mine: string | null;
  observations_recues_le: string | null;
  contestation_motif: string | null;
  contestation_recue_le: string | null;
  accord_mine: boolean | null;
  accord_recu_le: string | null;
  imputation_contractuelle: ImputationContractuelle | null;
  imputation_motif: string | null;
  imputation_decidee_le: string | null;
  statut: StatutRequisition;
  motif_statut: string | null;
  date_autorisation: string | null;
  date_notification: string | null;
  date_executoire: string | null;
  date_cloture: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  mining_company?: { id: string; name: string; code: string | null } | null;
  contrat?: { id: string; numero_contrat: string; intitule: string } | null;
}

export interface NotificationRequisition {
  id: string;
  requisition_id: string;
  canal: CanalNotification;
  destinataires: string;
  objet: string;
  contenu: string;
  envoye_le: string;
  preuve_envoi: string | null;
  accuse_le: string | null;
  accuse_par: string | null;
  preuve_reception: string | null;
  relance_de: string | null;
}

export interface Enlevement {
  id: string;
  reference: string;
  requisition_id: string;
  quantite_prevue_oz: number | null;
  date_prevue: string | null;
  date_reelle: string | null;
  lieu: string | null;
  equipe_sonasp: string | null;
  representants_mine: string | null;
  moyens_transport: string | null;
  dispositifs_securite: string | null;
  nombre_colis: number | null;
  numeros_scelles: string | null;
  poids_declare_g: number | null;
  poids_brut_g: number | null;
  tare_g: number | null;
  poids_net_g: number | null;
  quantite_constatee_oz: number | null;
  teneur_constatee_pct: number | null;
  constat_contradictoire: boolean;
  reserves: string | null;
  incidents: string | null;
  arrivee_destination: string | null;
  statut: StatutEnlevement;
  created_at: string;
}

export interface ExecutionRequisition {
  quantite_requise: number;
  quantite_collectee: number;
  quantite_restante: number;
  nb_enlevements: number;
  quantite_achetee: number;
  quantite_imputee_contrat: number;
  montant_achats_fcfa: number;
  montant_facture_fcfa: number;
  montant_paye_fcfa: number;
  solde_a_payer_fcfa: number;
}

export interface HistoriqueRequisition {
  id: string;
  statut_avant: string | null;
  statut_apres: string;
  motif: string | null;
  commentaire: string | null;
  survenu_le: string;
}

/* ------------------------------------------------------------- Formatage */

export const GRAMMES_PAR_ONCE = 31.1034768;

export const grammesEnOnces = (grammes: number | null | undefined) =>
  grammes === null || grammes === undefined ? null : Number(grammes) / GRAMMES_PAR_ONCE;

/**
 * Poids net constaté depuis le brut et la tare. La base refuse une incohérence
 * entre les trois : le calcul se fait ici pour que la saisie l'anticipe.
 */
export const poidsNet = (brut: number | null, tare: number | null) =>
  brut === null || tare === null ? null : Math.round((brut - tare) * 1000) / 1000;

/* ------------------------------------------------------------- Opérations */

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const requisitionsService = {
  async lister(filtres?: { statut?: string; societe?: string; regime?: string }): Promise<Requisition[]> {
    let requete = supabase
      .from('snp_requisitions')
      .select('*, mining_company:mining_companies(id, name, code), contrat:snp_contrats(id, numero_contrat, intitule)')
      .order('created_at', { ascending: false });

    if (filtres?.statut && filtres.statut !== 'all') requete = requete.eq('statut', filtres.statut);
    if (filtres?.societe && filtres.societe !== 'all') {
      requete = requete.eq('mining_company_id', filtres.societe);
    }
    if (filtres?.regime && filtres.regime !== 'all') {
      requete = requete.eq('regime_juridique', filtres.regime);
    }
    return (lancerSiErreur(await requete) || []) as Requisition[];
  },

  async requisition(id: string): Promise<Requisition | null> {
    const reponse = await supabase
      .from('snp_requisitions')
      .select('*, mining_company:mining_companies(id, name, code), contrat:snp_contrats(id, numero_contrat, intitule)')
      .eq('id', id)
      .maybeSingle();
    return (lancerSiErreur(reponse) as Requisition) || null;
  },

  async creer(requisition: Partial<Requisition>): Promise<Requisition> {
    const reponse = await supabase.from('snp_requisitions').insert(requisition).select().single();
    return lancerSiErreur(reponse) as Requisition;
  },

  async modifier(id: string, champs: Partial<Requisition>): Promise<Requisition> {
    const reponse = await supabase
      .from('snp_requisitions').update(champs).eq('id', id).select().single();
    return lancerSiErreur(reponse) as Requisition;
  },

  async transitions(statut: StatutRequisition): Promise<StatutRequisition[]> {
    const reponse = await supabase.rpc('snp_transitions_requisition', { p_statut: statut });
    return (lancerSiErreur(reponse) || []) as StatutRequisition[];
  },

  async changerStatut(
    id: string, statut: StatutRequisition, motif?: string, commentaire?: string
  ): Promise<Requisition> {
    const reponse = await supabase.rpc('snp_changer_statut_requisition', {
      p_requisition_id: id,
      p_statut: statut,
      p_motif: motif || null,
      p_commentaire: commentaire || null,
    });
    return lancerSiErreur(reponse) as Requisition;
  },

  /** Réponse de la société minière destinataire, contrôlée et historisée en base. */
  async repondreMine(
    id: string,
    decision: 'approuver' | 'contester',
    commentaire: string
  ): Promise<Requisition> {
    const reponse = await supabase.rpc('snp_portail_mine_repondre_requisition', {
      p_requisition_id: id,
      p_decision: decision,
      p_commentaire: commentaire.trim(),
    });
    return lancerSiErreur(reponse) as Requisition;
  },

  /* ----------------------------------------------------- Notifications -- */

  async notifications(requisitionId: string): Promise<NotificationRequisition[]> {
    const reponse = await supabase
      .from('snp_requisitions_notifications')
      .select('*')
      .eq('requisition_id', requisitionId)
      .order('envoye_le', { ascending: false });
    return (lancerSiErreur(reponse) || []) as NotificationRequisition[];
  },

  /** Consigne l'envoi. Le contenu notifié est conservé tel quel : une
   *  notification dont on ne peut plus produire le texte ne prouve rien. */
  async notifier(entree: {
    requisitionId: string;
    canal: CanalNotification;
    destinataires: string;
    objet: string;
    contenu: string;
    preuveEnvoi?: string | null;
    relanceDe?: string | null;
  }): Promise<NotificationRequisition> {
    const reponse = await supabase.rpc('snp_notifier_requisition', {
      p_requisition_id: entree.requisitionId,
      p_canal: entree.canal,
      p_destinataires: entree.destinataires,
      p_objet: entree.objet,
      p_contenu: entree.contenu,
      p_preuve_envoi: entree.preuveEnvoi || null,
      p_relance_de: entree.relanceDe || null,
    });
    return lancerSiErreur(reponse) as NotificationRequisition;
  },

  /** Accuser réception n'est ni accepter ni consentir. */
  async accuserReception(
    notificationId: string, accusePar: string, preuve?: string
  ): Promise<NotificationRequisition> {
    const reponse = await supabase.rpc('snp_accuser_reception_requisition', {
      p_notification_id: notificationId,
      p_accuse_par: accusePar,
      p_preuve: preuve || null,
    });
    return lancerSiErreur(reponse) as NotificationRequisition;
  },

  /* ------------------------------------------------------- Enlèvements -- */

  async enlevements(requisitionId: string): Promise<Enlevement[]> {
    const reponse = await supabase
      .from('snp_requisitions_enlevements')
      .select('*')
      .eq('requisition_id', requisitionId)
      .order('date_prevue', { ascending: false, nullsFirst: false });
    return (lancerSiErreur(reponse) || []) as Enlevement[];
  },

  async planifierEnlevement(enlevement: Partial<Enlevement>): Promise<Enlevement> {
    const reponse = await supabase
      .from('snp_requisitions_enlevements').insert(enlevement).select().single();
    return lancerSiErreur(reponse) as Enlevement;
  },

  async modifierEnlevement(id: string, champs: Partial<Enlevement>): Promise<Enlevement> {
    const reponse = await supabase
      .from('snp_requisitions_enlevements').update(champs).eq('id', id).select().single();
    return lancerSiErreur(reponse) as Enlevement;
  },

  /* -------------------------------------------------------- Imputation -- */

  async deciderImputation(entree: {
    requisitionId: string;
    imputation: ImputationContractuelle;
    contratId?: string | null;
    motif?: string | null;
  }): Promise<Requisition> {
    const reponse = await supabase.rpc('snp_decider_imputation_requisition', {
      p_requisition_id: entree.requisitionId,
      p_imputation: entree.imputation,
      p_contrat_id: entree.contratId || null,
      p_motif: entree.motif || null,
    });
    return lancerSiErreur(reponse) as Requisition;
  },

  /** Transforme la quantité collectée en achat, avec sa règle d'imputation. */
  async convertirEnAchat(entree: {
    requisitionId: string;
    prixOnceFcfa: number;
    quantiteImputee?: number | null;
    observations?: string | null;
  }) {
    const reponse = await supabase.rpc('snp_convertir_requisition_en_achat', {
      p_requisition_id: entree.requisitionId,
      p_prix_once_fcfa: entree.prixOnceFcfa,
      p_quantite_imputee: entree.quantiteImputee ?? null,
      p_observations: entree.observations || null,
    });
    return lancerSiErreur(reponse);
  },

  async execution(requisitionId: string): Promise<ExecutionRequisition | null> {
    const reponse = await supabase.rpc('snp_requisition_execution', {
      p_requisition_id: requisitionId,
    });
    const lignes = (lancerSiErreur(reponse) || []) as ExecutionRequisition[];
    return lignes[0] ?? null;
  },

  async historique(requisitionId: string): Promise<HistoriqueRequisition[]> {
    const reponse = await supabase
      .from('snp_requisitions_historique')
      .select('*')
      .eq('requisition_id', requisitionId)
      .order('survenu_le', { ascending: false });
    return (lancerSiErreur(reponse) || []) as HistoriqueRequisition[];
  },

  async documents(requisitionId: string) {
    const reponse = await supabase
      .from('snp_requisitions_documents')
      .select('*')
      .eq('requisition_id', requisitionId)
      .neq('statut', 'supprime')
      .order('created_at', { ascending: false });
    return lancerSiErreur(reponse) || [];
  },

  async ajouterDocument(document: Record<string, unknown>) {
    const reponse = await supabase
      .from('snp_requisitions_documents').insert(document).select().single();
    return lancerSiErreur(reponse);
  },
};

export default requisitionsService;
