import { supabase } from '@/lib/supabase';

/**
 * Analyses de teneur : instruction contradictoire d'un lot.
 *
 * ══ CE QUE CE MODULE GARANTIT ══
 *
 * Aucun résultat n'est écrasé. La teneur déclarée par la mine, le résultat du
 * premier laboratoire, celui de la contre-analyse et celui du laboratoire
 * indépendant vivent chacun dans leur ligne, avec leur date, leur certificat et
 * leur auteur. Un déclencheur de base refuse toute modification ou suppression
 * dans `snp_analyses_resultats` : un résultat faux se corrige en enregistrant
 * le suivant, jamais en effaçant le précédent.
 *
 * La décision — accepter, demander une contre-analyse, saisir le laboratoire
 * indépendant, ouvrir une non-conformité — vient des règles du contrat, quand
 * il y en a un. Un lot acheté au comptant n'a pas de contrat, et il faut tout
 * de même pouvoir trancher : l'analyse reste alors à l'appréciation motivée.
 */

/* ------------------------------------------------------------------ Types */

export type StatutAnalyse =
  | 'en_attente' | 'analysee' | 'contre_analyse_requise'
  | 'laboratoire_independant_requis' | 'tranchee' | 'non_conforme' | 'annulee';

export type DecisionTeneur =
  | 'acceptee' | 'contre_analyse' | 'laboratoire_independant' | 'non_conformite';

export type OrigineResultat =
  | 'analyse_initiale' | 'contre_analyse' | 'laboratoire_independant' | 'arbitrage';

export const LIBELLES_STATUT_ANALYSE: Record<StatutAnalyse, string> = {
  en_attente: 'En attente d’analyse',
  analysee: 'Analysée',
  contre_analyse_requise: 'Contre-analyse requise',
  laboratoire_independant_requis: 'Laboratoire indépendant requis',
  tranchee: 'Teneur arrêtée',
  non_conforme: 'Non conforme',
  annulee: 'Annulée',
};

export type Ton = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONS_STATUT_ANALYSE: Record<StatutAnalyse, Ton> = {
  en_attente: 'neutral',
  analysee: 'info',
  contre_analyse_requise: 'warning',
  laboratoire_independant_requis: 'warning',
  tranchee: 'success',
  non_conforme: 'danger',
  annulee: 'neutral',
};

export const LIBELLES_ORIGINE: Record<OrigineResultat, string> = {
  analyse_initiale: 'Première analyse',
  contre_analyse: 'Contre-analyse',
  laboratoire_independant: 'Laboratoire indépendant',
  arbitrage: 'Arbitrage',
};

export const LIBELLES_DECISION: Record<DecisionTeneur, string> = {
  acceptee: 'Livraison acceptée',
  contre_analyse: 'Contre-analyse requise',
  laboratoire_independant: 'Laboratoire indépendant à saisir',
  non_conformite: 'Non-conformité contractuelle',
};

export interface AnalyseTeneur {
  id: string;
  reference: string;
  mining_company_id: string | null;
  contrat_id: string | null;
  requisition_id: string | null;
  enlevement_id: string | null;
  achat_id: string | null;
  numero_echantillon: string | null;
  date_prelevement: string | null;
  masse_echantillon_g: number | null;
  masse_lot_oz: number | null;
  methode_echantillonnage: string | null;
  lieu_prelevement: string | null;
  teneur_declaree_pct: number;
  declaree_par: string | null;
  date_declaration: string | null;
  teneur_retenue_pct: number | null;
  justification_retenue: string | null;
  retenue_le: string | null;
  decision: DecisionTeneur | null;
  statut: StatutAnalyse;
  motif_statut: string | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
  mining_company?: { id: string; name: string } | null;
}

export type NouvelleAnalyseTeneur = Pick<
  AnalyseTeneur,
  'reference' | 'teneur_declaree_pct'
> & Partial<Omit<AnalyseTeneur, 'id' | 'reference' | 'teneur_declaree_pct' | 'created_at' | 'updated_at' | 'mining_company'>>;

export interface ResultatAnalyse {
  id: string;
  analyse_id: string;
  rang: number;
  origine: OrigineResultat;
  laboratoire: string;
  laboratoire_independant: boolean;
  methode: string | null;
  teneur_pct: number;
  argent_pct: number | null;
  certificat_reference: string | null;
  date_analyse: string | null;
  analyste: string | null;
  document_chemin: string | null;
  observations: string | null;
  created_at: string;
}

export interface LigneSynthese {
  rang: number;
  origine: OrigineResultat;
  laboratoire: string;
  laboratoire_independant: boolean;
  teneur_pct: number;
  ecart_a_la_declaration: number;
  certificat_reference: string | null;
  date_analyse: string | null;
  analyste: string | null;
  observations: string | null;
}

/**
 * Les états où l'instruction attend un geste. Un lot analysé mais non tranché
 * bloque la facturation : il ne se laisse pas oublier.
 */
export const ETATS_A_TRAITER: StatutAnalyse[] = [
  'en_attente', 'analysee', 'contre_analyse_requise',
  'laboratoire_independant_requis', 'non_conforme',
];

/**
 * L'écart d'un résultat à la teneur déclarée, en points.
 * Le signe compte : une analyse au-dessus de la déclaration n'appelle pas la
 * même conversation qu'une analyse en dessous.
 */
export const ecartEnPoints = (teneurAnalysee: number, teneurDeclaree: number) =>
  Math.round((teneurAnalysee - teneurDeclaree) * 1000) / 1000;

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const analysesTeneurService = {
  async lister(filtres?: { contratId?: string; requisitionId?: string; statut?: string }) {
    let requete = supabase
      .from('snp_analyses_teneur')
      .select('*, mining_company:mining_companies(id, name)')
      .order('created_at', { ascending: false });

    if (filtres?.contratId) requete = requete.eq('contrat_id', filtres.contratId);
    if (filtres?.requisitionId) requete = requete.eq('requisition_id', filtres.requisitionId);
    if (filtres?.statut && filtres.statut !== 'all') requete = requete.eq('statut', filtres.statut);
    return (lancerSiErreur(await requete) || []) as AnalyseTeneur[];
  },

  async analyse(id: string): Promise<AnalyseTeneur | null> {
    const reponse = await supabase
      .from('snp_analyses_teneur')
      .select('*, mining_company:mining_companies(id, name)')
      .eq('id', id)
      .maybeSingle();
    return (lancerSiErreur(reponse) as AnalyseTeneur) || null;
  },

  async ouvrir(analyse: NouvelleAnalyseTeneur): Promise<AnalyseTeneur> {
    const reponse = await supabase.from('snp_analyses_teneur').insert(analyse).select().single();
    return lancerSiErreur(reponse) as AnalyseTeneur;
  },

  async resultats(analyseId: string): Promise<ResultatAnalyse[]> {
    const reponse = await supabase
      .from('snp_analyses_resultats')
      .select('*')
      .eq('analyse_id', analyseId)
      .order('rang');
    return (lancerSiErreur(reponse) || []) as ResultatAnalyse[];
  },

  async synthese(analyseId: string): Promise<LigneSynthese[]> {
    const reponse = await supabase.rpc('snp_analyse_synthese', { p_analyse_id: analyseId });
    return (lancerSiErreur(reponse) || []) as LigneSynthese[];
  },

  /**
   * Enregistre un résultat. Le rang et l'origine se déduisent de ce qui existe
   * déjà : première analyse, contre-analyse, laboratoire indépendant.
   */
  async enregistrerResultat(entree: {
    analyseId: string;
    laboratoire: string;
    teneurPct: number;
    methode?: string | null;
    certificat?: string | null;
    dateAnalyse?: string | null;
    analyste?: string | null;
    laboratoireIndependant?: boolean;
    argentPct?: number | null;
    documentChemin?: string | null;
    observations?: string | null;
  }): Promise<ResultatAnalyse> {
    const reponse = await supabase.rpc('snp_enregistrer_resultat_analyse', {
      p_analyse_id: entree.analyseId,
      p_laboratoire: entree.laboratoire,
      p_teneur_pct: entree.teneurPct,
      p_methode: entree.methode || null,
      p_certificat: entree.certificat || null,
      p_date_analyse: entree.dateAnalyse || null,
      p_analyste: entree.analyste || null,
      p_laboratoire_independant: entree.laboratoireIndependant ?? false,
      p_argent_pct: entree.argentPct ?? null,
      p_document_chemin: entree.documentChemin || null,
      p_observations: entree.observations || null,
    });
    return lancerSiErreur(reponse) as ResultatAnalyse;
  },

  /** Arrête la teneur qui servira à facturer. Réservé aux rôles de validation. */
  async trancher(
    analyseId: string, teneurRetenue: number, justification: string
  ): Promise<AnalyseTeneur> {
    const reponse = await supabase.rpc('snp_trancher_teneur', {
      p_analyse_id: analyseId,
      p_teneur_retenue: teneurRetenue,
      p_justification: justification,
    });
    return lancerSiErreur(reponse) as AnalyseTeneur;
  },
};

export default analysesTeneurService;
