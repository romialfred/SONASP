import { supabase } from '@/lib/supabase';

/**
 * Contrats de fourniture d'or : accès aux données et opérations métier.
 *
 * ══ RÈGLE DE CE SERVICE ══
 *
 * Les lectures passent par PostgREST, sous le contrôle des politiques RLS. Un
 * partenaire ne voit son contrat qu'à partir de sa signature ; les états de
 * négociation interne ne le regardent pas, et cela ne dépend d'aucun filtre
 * écrit ici.
 *
 * Les décisions — changer d'état, composer un échéancier, trancher une teneur,
 * qualifier un dépassement — passent par des fonctions PL/pgSQL appelées en
 * RPC. Elles vérifient elles-mêmes l'habilitation, la séparation des fonctions
 * et la complétude du dossier. Masquer un bouton ne protège rien.
 *
 * Aucune figure d'exécution n'est calculée ici : quantités livrées, imputées,
 * facturées et payées viennent de `snp_contrat_execution()`, qui les recompose
 * depuis les achats et les factures. Un total calculé ne peut pas diverger.
 */

/* ------------------------------------------------------------------ Types */

export type PartenaireType =
  | 'mine_industrielle' | 'mine_semi_mecanisee' | 'site_artisanal' | 'artisan';

export type TypeContrat =
  | 'cadre' | 'quantite_fixe' | 'quantite_periodique' | 'execution_progressive' | 'avenant';

export type StatutContrat =
  | 'brouillon' | 'soumis' | 'revue_juridique' | 'validation_metier'
  | 'validation_financiere' | 'approuve' | 'signe' | 'actif'
  | 'suspendu' | 'echu' | 'resilie' | 'cloture' | 'rejete' | 'annule';

export type Periodicite =
  | 'unique' | 'hebdomadaire' | 'mensuelle' | 'trimestrielle' | 'personnalisee';

export type MethodePrix =
  | 'cours_marche' | 'cours_date_reference' | 'moyenne_periode'
  | 'negocie' | 'fixe' | 'indexe' | 'formule';

export type CategorieDocument =
  | 'contrat_signe' | 'projet' | 'avenant' | 'annexe' | 'echeancier'
  | 'document_legal' | 'autorisation' | 'coordonnees_bancaires' | 'attestation'
  | 'laboratoire' | 'proces_verbal' | 'correspondance' | 'decision' | 'autre';

export type NatureDefaut =
  | 'absence_livraison' | 'livraison_tardive' | 'quantite_insuffisante'
  | 'depassement' | 'teneur_inferieure' | 'divergence_analyse'
  | 'document_manquant' | 'obligation_non_respectee' | 'mise_a_disposition_refusee'
  | 'retard_enlevement_sonasp' | 'retard_paiement_sonasp' | 'incident_logistique' | 'autre';

export type StatutDefaut =
  | 'detecte' | 'a_qualifier' | 'confirme' | 'conteste' | 'en_traitement'
  | 'action_corrective' | 'regularise' | 'non_regularise' | 'clos' | 'annule';

export const LIBELLES_PARTENAIRE: Record<PartenaireType, string> = {
  mine_industrielle: 'Mine industrielle',
  mine_semi_mecanisee: 'Mine semi-mécanisée',
  site_artisanal: 'Site ou comptoir artisanal',
  artisan: 'Artisan minier',
};

export const LIBELLES_TYPE_CONTRAT: Record<TypeContrat, string> = {
  cadre: 'Contrat-cadre',
  quantite_fixe: 'Quantité fixe',
  quantite_periodique: 'Quantité périodique',
  execution_progressive: 'Exécution progressive',
  avenant: 'Avenant',
};

export const LIBELLES_STATUT_CONTRAT: Record<StatutContrat, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis pour revue',
  revue_juridique: 'En revue juridique',
  validation_metier: 'En validation métier',
  validation_financiere: 'En validation financière',
  approuve: 'Approuvé, en attente de signature',
  signe: 'Signé',
  actif: 'Actif',
  suspendu: 'Suspendu',
  echu: 'Arrivé à échéance',
  resilie: 'Résilié',
  cloture: 'Clôturé',
  rejete: 'Rejeté',
  annule: 'Annulé',
};

export type Ton = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONS_STATUT_CONTRAT: Record<StatutContrat, Ton> = {
  brouillon: 'neutral',
  soumis: 'info',
  revue_juridique: 'info',
  validation_metier: 'info',
  validation_financiere: 'info',
  approuve: 'warning',
  signe: 'warning',
  actif: 'success',
  suspendu: 'warning',
  echu: 'neutral',
  resilie: 'danger',
  cloture: 'neutral',
  rejete: 'danger',
  annule: 'danger',
};

export const LIBELLES_PERIODICITE: Record<Periodicite, string> = {
  unique: 'Livraison unique',
  hebdomadaire: 'Hebdomadaire',
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  personnalisee: 'Personnalisée',
};

export const LIBELLES_METHODE_PRIX: Record<MethodePrix, string> = {
  cours_marche: 'Cours du marché au jour de la transaction',
  cours_date_reference: 'Cours à une date de référence',
  moyenne_periode: 'Moyenne du cours sur la période',
  negocie: 'Prix négocié à la transaction',
  fixe: 'Prix fixe contractuel',
  indexe: 'Prix indexé',
  formule: 'Formule contractuelle',
};

export const LIBELLES_CATEGORIE_DOC: Record<CategorieDocument, string> = {
  contrat_signe: 'Contrat signé',
  projet: 'Projet de contrat',
  avenant: 'Avenant',
  annexe: 'Annexe',
  echeancier: 'Échéancier',
  document_legal: 'Document légal du partenaire',
  autorisation: 'Autorisation',
  coordonnees_bancaires: 'Coordonnées bancaires',
  attestation: 'Attestation',
  laboratoire: 'Document de laboratoire',
  proces_verbal: 'Procès-verbal',
  correspondance: 'Correspondance officielle',
  decision: 'Décision',
  autre: 'Autre pièce',
};

export const LIBELLES_NATURE_DEFAUT: Record<NatureDefaut, string> = {
  absence_livraison: 'Absence de livraison',
  livraison_tardive: 'Livraison tardive',
  quantite_insuffisante: 'Quantité insuffisante',
  depassement: 'Dépassement non autorisé',
  teneur_inferieure: 'Teneur inférieure au minimum',
  divergence_analyse: 'Divergence d’analyse',
  document_manquant: 'Document manquant',
  obligation_non_respectee: 'Obligation non respectée',
  mise_a_disposition_refusee: 'Mise à disposition refusée',
  retard_enlevement_sonasp: 'Retard d’enlèvement imputable à la SONASP',
  retard_paiement_sonasp: 'Retard de paiement',
  incident_logistique: 'Incident logistique',
  autre: 'Autre manquement',
};

export const LIBELLES_STATUT_DEFAUT: Record<StatutDefaut, string> = {
  detecte: 'Détecté',
  a_qualifier: 'À qualifier',
  confirme: 'Confirmé',
  conteste: 'Contesté',
  en_traitement: 'En traitement',
  action_corrective: 'Action corrective en cours',
  regularise: 'Régularisé',
  non_regularise: 'Non régularisé',
  clos: 'Clos',
  annule: 'Annulé',
};

export const LIBELLES_GRAVITE_DEFAUT: Record<'mineure' | 'majeure' | 'critique', string> = {
  mineure: 'Mineure',
  majeure: 'Majeure',
  critique: 'Critique',
};

export const TONS_STATUT_DEFAUT: Record<StatutDefaut, Ton> = {
  detecte: 'warning',
  a_qualifier: 'warning',
  confirme: 'danger',
  conteste: 'warning',
  en_traitement: 'info',
  action_corrective: 'info',
  regularise: 'success',
  non_regularise: 'danger',
  clos: 'neutral',
  annule: 'neutral',
};

export interface Contrat {
  id: string;
  numero_contrat: string;
  intitule: string;
  partenaire_type: PartenaireType;
  mining_company_id: string | null;
  artisan_id: string | null;
  site_id: string | null;
  partenaire_libelle: string | null;
  representant_partenaire: string | null;
  representant_contact: string | null;
  type_contrat: TypeContrat;
  contrat_parent_id: string | null;
  contrat_precedent_id: string | null;
  version: number;
  direction_responsable: string | null;
  gestionnaire_id: string | null;
  date_signature: string | null;
  date_debut: string;
  date_fin: string;
  reconduction: string;
  preavis_reconduction_jours: number | null;
  unite: string;
  quantite_totale: number | null;
  quantite_minimale: number | null;
  quantite_maximale: number | null;
  periodicite: Periodicite;
  tolerance_quantite_pct: number;
  report_reliquat: string;
  plafond_depassement_pct: number;
  livraison_anticipee_autorisee: boolean;
  teneur_reference_pct: number | null;
  teneur_minimale_pct: number | null;
  teneur_tolerance_pct: number;
  methode_echantillonnage: string | null;
  methode_analyse: string | null;
  laboratoire_initial: string | null;
  laboratoire_independant: string | null;
  delai_contestation_jours: number;
  frais_contre_expertise: string;
  teneur_faisant_foi: string;
  methode_prix: MethodePrix;
  source_cours: string | null;
  devise_cours: string;
  devise_reglement: string;
  prix_fixe_fcfa: number | null;
  prime_pct: number;
  decote_pct: number;
  formule_prix: string | null;
  prix_ajuste_sur_teneur: boolean;
  conditions_livraison: string | null;
  conditions_enlevement: string | null;
  modalites_pesee: string | null;
  transfert_propriete: string | null;
  conditions_paiement: string;
  delai_paiement_jours: number;
  penalites: string | null;
  force_majeure: string | null;
  reglement_differends: string | null;
  confidentialite: string | null;
  obligations_fournisseur: string | null;
  obligations_sonasp: string | null;
  statut: StatutContrat;
  motif_statut: string | null;
  observations: string | null;
  date_soumission: string | null;
  date_approbation: string | null;
  date_activation: string | null;
  date_cloture: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  mining_company?: { id: string; name: string; code: string | null } | null;
}

export interface EcheanceContrat {
  id: string;
  contrat_id: string;
  periode_debut: string;
  periode_fin: string;
  annee: number;
  mois: number | null;
  rang: number;
  quantite_prevue: number;
  quantite_minimale: number | null;
  nature: 'ferme' | 'prevision' | 'option';
  observations: string | null;
}

export interface DocumentContrat {
  id: string;
  contrat_id: string;
  categorie: CategorieDocument;
  intitule: string;
  version: number;
  chemin: string;
  type_mime: string | null;
  taille_octets: number | null;
  date_document: string | null;
  date_expiration: string | null;
  statut: 'actif' | 'remplace' | 'supprime';
  observations: string | null;
  created_at: string;
}

export interface DefautContrat {
  id: string;
  reference: string;
  contrat_id: string;
  periode_debut: string | null;
  periode_fin: string | null;
  nature: NatureDefaut;
  obligation: string | null;
  partie_responsable: string;
  gravite: 'mineure' | 'majeure' | 'critique';
  date_detection: string;
  description: string;
  quantite_concernee: number | null;
  montant_concerne_fcfa: number | null;
  actions_correctives: string | null;
  echeance_correction: string | null;
  statut: StatutDefaut;
  decision_finale: string | null;
  motif: string | null;
  created_at: string;
}

export interface ExecutionContrat {
  quantite_totale: number;
  quantite_planifiee: number;
  quantite_livree: number;
  quantite_imputee: number;
  quantite_requisitionnee: number;
  quantite_requisitionnee_imputee: number;
  quantite_hors_contrat: number;
  quantite_restante: number;
  quantite_en_retard: number;
  taux_execution: number | null;
  montant_achats_fcfa: number;
  montant_facture_fcfa: number;
  montant_paye_fcfa: number;
  solde_a_payer_fcfa: number;
  nb_livraisons: number;
  nb_defauts_ouverts: number;
  prochaine_echeance: string | null;
  prochaine_quantite: number | null;
}

export interface ContratActifPeriode {
  contrat_id: string;
  numero_contrat: string;
  intitule: string;
  partenaire_type: PartenaireType;
  mining_company_id: string | null;
  artisan_id: string | null;
  site_id: string | null;
  partenaire: string;
  unite: string;
  quantite_periode: number;
  nature: string;
  reliquat_anterieur: number;
  deja_livre_periode: number;
  restant_a_collecter: number;
  tolerance_quantite_pct: number;
  plafond_depassement_pct: number;
  report_reliquat: string;
  date_fin: string;
}

export interface BilanApplication {
  lignes_rattachees: number;
  lignes_creees: number;
  lignes_preservees: number;
  quantite_contractuelle: number;
  quantite_reliquat: number;
}

export interface EvaluationTeneur {
  ecart_absolu: number;
  ecart_relatif_pct: number | null;
  dans_tolerance: boolean;
  sous_minimum: boolean;
  decision: 'acceptee' | 'contre_analyse' | 'laboratoire_independant' | 'non_conformite';
  teneur_retenue: number;
  prix_a_recalculer: boolean;
  explication: string;
}

export interface EvaluationDepassement {
  quantite_prevue: number;
  reliquat_anterieur: number;
  plafond: number;
  depassement: number;
  autorise: boolean;
  report_possible: boolean;
  decision: 'conforme' | 'depassement_tolere' | 'imputation_periode_suivante'
    | 'avenant_requis' | 'autorisation_exceptionnelle';
  explication: string;
}

export interface HistoriqueContrat {
  id: string;
  statut_avant: string | null;
  statut_apres: string;
  motif: string | null;
  commentaire: string | null;
  survenu_le: string;
}

/* ------------------------------------------------------------- Formatage */

const formateurEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const formateurQuantite = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2, maximumFractionDigits: 4,
});

export const formaterQuantite = (valeur: number | null | undefined, unite = 'oz') =>
  valeur === null || valeur === undefined || Number.isNaN(Number(valeur))
    ? '—'
    : `${formateurQuantite.format(Number(valeur))} ${unite}`;

export const formaterFcfa = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined || Number.isNaN(Number(valeur))
    ? '—'
    : `${formateurEntier.format(Number(valeur))} FCFA`;

export const formaterNombre = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined || Number.isNaN(Number(valeur))
    ? '—'
    : formateurEntier.format(Number(valeur));

/**
 * Un contrat qui approche de son terme sans être clos demande une décision.
 * Le seuil est celui du préavis quand il est stipulé, soixante jours sinon.
 */
export const joursAvantEcheance = (contrat: Pick<Contrat, 'date_fin'>) => {
  const fin = new Date(`${contrat.date_fin}T00:00:00`);
  if (Number.isNaN(fin.getTime())) return null;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((fin.getTime() - aujourdhui.getTime()) / 86_400_000);
};

export const ETATS_VIVANTS: StatutContrat[] = ['actif', 'suspendu'];

/* ------------------------------------------------------------- Opérations */

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const contratsService = {
  async lister(filtres?: {
    statut?: string;
    partenaireType?: string;
    societe?: string;
    recherche?: string;
  }): Promise<Contrat[]> {
    let requete = supabase
      .from('snp_contrats')
      .select('*, mining_company:mining_companies(id, name, code)')
      .order('date_debut', { ascending: false });

    if (filtres?.statut && filtres.statut !== 'all') requete = requete.eq('statut', filtres.statut);
    if (filtres?.partenaireType && filtres.partenaireType !== 'all') {
      requete = requete.eq('partenaire_type', filtres.partenaireType);
    }
    if (filtres?.societe && filtres.societe !== 'all') {
      requete = requete.eq('mining_company_id', filtres.societe);
    }
    if (filtres?.recherche?.trim()) {
      const terme = `%${filtres.recherche.trim()}%`;
      requete = requete.or(`numero_contrat.ilike.${terme},intitule.ilike.${terme}`);
    }
    return (lancerSiErreur(await requete) || []) as Contrat[];
  },

  async contrat(id: string, miningCompanyId?: string | null): Promise<Contrat | null> {
    let requete = supabase
      .from('snp_contrats')
      .select('*, mining_company:mining_companies(id, name, code)')
      .eq('id', id);
    if (miningCompanyId) requete = requete.eq('mining_company_id', miningCompanyId);
    return (lancerSiErreur(await requete.maybeSingle()) as Contrat) || null;
  },

  async creer(contrat: Partial<Contrat>): Promise<Contrat> {
    const reponse = await supabase.from('snp_contrats').insert(contrat).select().single();
    return lancerSiErreur(reponse) as Contrat;
  },

  /**
   * Proposition émise par la société minière connectée.
   *
   * Le déclencheur en base remplace toujours la société, le statut et l'auteur
   * par les valeurs du compte authentifié. Les valeurs passées par l'écran ne
   * constituent donc jamais une frontière de sécurité.
   */
  async proposerMine(contrat: Partial<Contrat>): Promise<Contrat> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const reponse = await supabase
      .from('snp_contrats')
      .insert({ ...contrat, statut: 'soumis', created_by: data.user.id, updated_by: data.user.id })
      .select()
      .single();
    return lancerSiErreur(reponse) as Contrat;
  },

  async modifier(id: string, champs: Partial<Contrat>): Promise<Contrat> {
    const reponse = await supabase
      .from('snp_contrats').update(champs).eq('id', id).select().single();
    return lancerSiErreur(reponse) as Contrat;
  },

  /* ------------------------------------------------------- Échéancier -- */

  async echeancier(contratId: string): Promise<EcheanceContrat[]> {
    const reponse = await supabase
      .from('snp_contrats_echeancier')
      .select('*')
      .eq('contrat_id', contratId)
      .order('rang');
    return (lancerSiErreur(reponse) || []) as EcheanceContrat[];
  },

  /** Compose l'échéancier depuis la périodicité et la quantité totale. */
  async genererEcheancier(contratId: string, ecraser = false): Promise<number> {
    const reponse = await supabase.rpc('snp_generer_echeancier', {
      p_contrat_id: contratId, p_ecraser: ecraser,
    });
    return Number(lancerSiErreur(reponse) || 0);
  },

  async ajusterEcheance(id: string, champs: Partial<EcheanceContrat>): Promise<EcheanceContrat> {
    const reponse = await supabase
      .from('snp_contrats_echeancier').update(champs).eq('id', id).select().single();
    return lancerSiErreur(reponse) as EcheanceContrat;
  },

  /* -------------------------------------------------------- Exécution -- */

  async execution(contratId: string): Promise<ExecutionContrat | null> {
    const reponse = await supabase.rpc('snp_contrat_execution', { p_contrat_id: contratId });
    const lignes = (lancerSiErreur(reponse) || []) as ExecutionContrat[];
    return lignes[0] ?? null;
  },

  /**
   * Porte les engagements du mois sur les lignes du plan d'achat.
   * Une ligne ajustée à la main est préservée, sauf ordre explicite : un
   * arbitrage individuel ne s'efface pas parce qu'un contrat existe.
   */
  async appliquerAuPlan(planId: string, ecraser = false): Promise<BilanApplication | null> {
    const reponse = await supabase.rpc('snp_appliquer_contrats_au_plan', {
      p_plan_id: planId, p_ecraser_ajustements: ecraser,
    });
    const lignes = (lancerSiErreur(reponse) || []) as BilanApplication[];
    return lignes[0] ?? null;
  },

  async actifsSurPeriode(debut: string, fin: string): Promise<ContratActifPeriode[]> {
    const reponse = await supabase.rpc('snp_contrats_actifs_periode', {
      p_debut: debut, p_fin: fin,
    });
    return (lancerSiErreur(reponse) || []) as ContratActifPeriode[];
  },

  /* --------------------------------------------------------- Décisions -- */

  async transitions(statut: StatutContrat): Promise<StatutContrat[]> {
    const reponse = await supabase.rpc('snp_transitions_contrat', { p_statut: statut });
    return (lancerSiErreur(reponse) || []) as StatutContrat[];
  },

  async changerStatut(
    contratId: string, statut: StatutContrat, motif?: string, commentaire?: string
  ): Promise<Contrat> {
    const reponse = await supabase.rpc('snp_changer_statut_contrat', {
      p_contrat_id: contratId,
      p_statut: statut,
      p_motif: motif || null,
      p_commentaire: commentaire || null,
    });
    return lancerSiErreur(reponse) as Contrat;
  },

  /**
   * Tranche un écart de teneur selon les règles du contrat.
   * Les seuils viennent du contrat, jamais d'ici : deux contrats du même mois
   * peuvent poser des tolérances différentes.
   */
  async evaluerTeneur(
    contratId: string, teneurDeclaree: number, teneurAnalysee: number
  ): Promise<EvaluationTeneur | null> {
    const reponse = await supabase.rpc('snp_evaluer_teneur', {
      p_contrat_id: contratId,
      p_teneur_declaree: teneurDeclaree,
      p_teneur_analysee: teneurAnalysee,
    });
    const lignes = (lancerSiErreur(reponse) || []) as EvaluationTeneur[];
    return lignes[0] ?? null;
  },

  async evaluerDepassement(
    contratId: string, debut: string, fin: string, quantite: number
  ): Promise<EvaluationDepassement | null> {
    const reponse = await supabase.rpc('snp_evaluer_depassement', {
      p_contrat_id: contratId, p_debut: debut, p_fin: fin, p_quantite: quantite,
    });
    const lignes = (lancerSiErreur(reponse) || []) as EvaluationDepassement[];
    return lignes[0] ?? null;
  },

  /* --------------------------------------------------------- Documents -- */

  async documents(contratId: string): Promise<DocumentContrat[]> {
    const reponse = await supabase
      .from('snp_contrats_documents')
      .select('*')
      .eq('contrat_id', contratId)
      .neq('statut', 'supprime')
      .order('created_at', { ascending: false });
    return (lancerSiErreur(reponse) || []) as DocumentContrat[];
  },

  async ajouterDocument(document: Partial<DocumentContrat>): Promise<DocumentContrat> {
    const reponse = await supabase
      .from('snp_contrats_documents').insert(document).select().single();
    return lancerSiErreur(reponse) as DocumentContrat;
  },

  /* ----------------------------------------------------------- Défauts -- */

  async defauts(contratId: string): Promise<DefautContrat[]> {
    const reponse = await supabase
      .from('snp_contrats_defauts')
      .select('*')
      .eq('contrat_id', contratId)
      .order('date_detection', { ascending: false });
    return (lancerSiErreur(reponse) || []) as DefautContrat[];
  },

  async ouvrirDefaut(defaut: Partial<DefautContrat>): Promise<DefautContrat> {
    const reponse = await supabase.from('snp_contrats_defauts').insert(defaut).select().single();
    return lancerSiErreur(reponse) as DefautContrat;
  },

  async modifierDefaut(id: string, champs: Partial<DefautContrat>): Promise<DefautContrat> {
    const reponse = await supabase
      .from('snp_contrats_defauts').update(champs).eq('id', id).select().single();
    return lancerSiErreur(reponse) as DefautContrat;
  },

  /* -------------------------------------------------------- Historique -- */

  async historique(contratId: string): Promise<HistoriqueContrat[]> {
    const reponse = await supabase
      .from('snp_contrats_historique')
      .select('*')
      .eq('contrat_id', contratId)
      .order('survenu_le', { ascending: false });
    return (lancerSiErreur(reponse) || []) as HistoriqueContrat[];
  },
};

export default contratsService;
