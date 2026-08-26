import { supabase } from '@/lib/supabase';

/**
 * Référentiel fiscal versionné.
 *
 * Aucun taux n'est écrit dans le code : TVA, redevances et FNDL sont des règles
 * saisies, datées et justifiées par une référence réglementaire. Une règle reste
 * en projet tant qu'un second acteur ne l'a pas approuvée, et nul n'approuve la
 * sienne — la base le refuse.
 *
 * Une opération passée reste recalculable : la règle applicable se retrouve par
 * sa date d'effet, jamais par la règle courante. Modifier un barème en 2027 ne
 * change donc rien à une facture de 2026.
 */

export type CodeTaxe = 'tva' | 'royalties' | 'fndl' | 'retenue_source' | 'taxe_communale';
export type Assiette = 'ca_ht' | 'produit_net' | 'montant_brut' | 'quantite_or_fin';
export type ModeCalcul = 'taux' | 'tranche' | 'forfait' | 'exoneration';
export type StatutRegle = 'projet' | 'approuvee' | 'abrogee';

export interface RegleFiscale {
  id: string;
  code_taxe: CodeTaxe;
  libelle: string;
  assiette: Assiette;
  mode_calcul: ModeCalcul;
  taux: number | null;
  montant_forfaitaire: number | null;
  seuil_min: number | null;
  seuil_max: number | null;
  unite_seuil: string | null;
  devise_seuil: string | null;
  categorie_acheteur: string;
  date_effet: string;
  date_fin: string | null;
  reference_reglementaire: string | null;
  commentaire: string | null;
  statut: StatutRegle;
  cree_par: string | null;
  cree_le: string;
  approuve_par: string | null;
  approuve_le: string | null;
  abroge_par: string | null;
  abroge_le: string | null;
  updated_at: string;
}

export interface BrouillonRegle {
  code_taxe: CodeTaxe;
  libelle: string;
  assiette: Assiette;
  mode_calcul: ModeCalcul;
  taux?: number | null;
  montant_forfaitaire?: number | null;
  seuil_min?: number | null;
  seuil_max?: number | null;
  unite_seuil?: string | null;
  devise_seuil?: string | null;
  categorie_acheteur?: string;
  date_effet: string;
  date_fin?: string | null;
  reference_reglementaire?: string | null;
  commentaire?: string | null;
}

export const LIBELLES_TAXES: Record<CodeTaxe, string> = {
  tva: 'Taxe sur la valeur ajoutée',
  royalties: 'Redevance proportionnelle',
  fndl: 'Fonds national de développement local',
  retenue_source: 'Retenue à la source',
  taxe_communale: 'Taxe de développement communal',
};

export const LIBELLES_ASSIETTES: Record<Assiette, string> = {
  ca_ht: "Chiffre d'affaires hors taxes",
  produit_net: 'Produit net de la vente',
  montant_brut: 'Montant brut',
  quantite_or_fin: "Quantité d'or fin",
};

export const LIBELLES_MODES: Record<ModeCalcul, string> = {
  taux: 'Taux unique',
  tranche: 'Barème par tranches',
  forfait: 'Montant forfaitaire',
  exoneration: 'Exonération',
};

export const LIBELLES_STATUTS: Record<StatutRegle, string> = {
  projet: 'Projet',
  approuvee: 'Approuvée',
  abrogee: 'Abrogée',
};

export const reglesFiscalesService = {
  /** Toutes les règles, la plus récemment applicable en tête. */
  async lister(): Promise<RegleFiscale[]> {
    const { data, error } = await supabase
      .from('snp_regles_fiscales')
      .select('*')
      .order('code_taxe', { ascending: true })
      .order('date_effet', { ascending: false })
      .order('seuil_min', { ascending: true, nullsFirst: true });

    if (error) throw error;
    return (data ?? []) as RegleFiscale[];
  },

  /**
   * Crée une règle en projet. Elle n'entre en vigueur qu'une fois approuvée par
   * un autre acteur.
   */
  async creer(brouillon: BrouillonRegle): Promise<RegleFiscale> {
    const { data: session } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_regles_fiscales')
      .insert({
        ...brouillon,
        categorie_acheteur: brouillon.categorie_acheteur || 'standard',
        statut: 'projet',
        cree_par: session.user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as RegleFiscale;
  },

  /**
   * Approuve une règle. La base refuse qu'un acteur approuve la sienne, et que
   * deux règles se disputent la même période pour la même taxe.
   */
  async approuver(id: string): Promise<RegleFiscale> {
    const { data: session } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_regles_fiscales')
      .update({
        statut: 'approuvee',
        approuve_par: session.user?.id ?? null,
        approuve_le: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as RegleFiscale;
  },

  /**
   * Abroge une règle sans l'effacer : elle témoigne du passé et reste opposable
   * aux opérations qu'elle a servi à calculer.
   */
  async abroger(id: string): Promise<RegleFiscale> {
    const { data: session } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_regles_fiscales')
      .update({
        statut: 'abrogee',
        abroge_par: session.user?.id ?? null,
        abroge_le: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as RegleFiscale;
  },

  /**
   * Règle applicable à une date donnée, en tenant compte du barème par tranches
   * lorsque la taxe en comporte un.
   */
  async resoudre(
    codeTaxe: CodeTaxe,
    date: string,
    valeurSeuil?: number,
    categorieAcheteur = 'standard',
  ): Promise<RegleFiscale | null> {
    const { data, error } = await supabase.rpc('snp_resoudre_regle_fiscale', {
      p_code_taxe: codeTaxe,
      p_date: date,
      p_valeur_seuil: valeurSeuil ?? undefined,
      p_categorie_acheteur: categorieAcheteur,
    });

    if (error) throw error;
    const lignes = (data ?? []) as unknown as RegleFiscale[];
    return lignes.length > 0 ? lignes[0] : null;
  },
};
