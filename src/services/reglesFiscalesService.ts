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
/** Qui vend. Un profil nommé l'emporte sur la règle générale « tous ». */
export type ProfilVendeur =
  | 'tous' | 'comptoir' | 'mine_industrielle' | 'mine_semi_mecanisee' | 'artisan';

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
  profil_vendeur: ProfilVendeur;
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
  profil_vendeur?: ProfilVendeur;
  categorie_acheteur?: string;
  date_effet: string;
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

export const LIBELLES_PROFILS: Record<ProfilVendeur, string> = {
  tous: 'Tous les vendeurs',
  comptoir: "Comptoir d'achat",
  mine_industrielle: 'Mine industrielle',
  mine_semi_mecanisee: 'Mine semi-mécanisée',
  artisan: 'Artisan minier',
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
   * Crée une règle en projet. L'écriture directe est fermée à `authenticated` :
   * seule la procédure écrit, après avoir vérifié l'authentification forte et la
   * capacité `tax.rules.manage`.
   */
  async creer(brouillon: BrouillonRegle): Promise<RegleFiscale> {
    const { data, error } = await supabase.rpc('snp_regle_fiscale_creer', {
      p_code_taxe: brouillon.code_taxe,
      p_libelle: brouillon.libelle,
      p_assiette: brouillon.assiette,
      p_mode_calcul: brouillon.mode_calcul,
      p_taux: brouillon.taux ?? null,
      p_montant_forfaitaire: brouillon.montant_forfaitaire ?? null,
      p_seuil_min: brouillon.seuil_min ?? null,
      p_seuil_max: brouillon.seuil_max ?? null,
      p_unite_seuil: brouillon.unite_seuil ?? null,
      p_devise_seuil: brouillon.devise_seuil ?? null,
      p_profil_vendeur: brouillon.profil_vendeur ?? 'tous',
      p_categorie_acheteur: brouillon.categorie_acheteur ?? 'standard',
      p_date_effet: brouillon.date_effet,
      p_reference_reglementaire: brouillon.reference_reglementaire ?? null,
      p_commentaire: brouillon.commentaire ?? null,
    });

    if (error) throw error;
    return data as unknown as RegleFiscale;
  },

  /**
   * Approuve une règle. La procédure refuse qu'un acteur approuve la sienne, et
   * la base refuse que deux règles se disputent la même période.
   */
  async approuver(id: string): Promise<RegleFiscale> {
    const { data, error } = await supabase.rpc('snp_regle_fiscale_approuver', {
      p_id: id,
    });

    if (error) throw error;
    return data as unknown as RegleFiscale;
  },

  /**
   * Abroge une règle sans l'effacer : elle témoigne du passé et reste opposable
   * aux opérations qu'elle a servi à calculer.
   */
  async abroger(id: string): Promise<RegleFiscale> {
    const { data, error } = await supabase.rpc('snp_regle_fiscale_abroger', {
      p_id: id,
    });

    if (error) throw error;
    return data as unknown as RegleFiscale;
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
    profilVendeur: ProfilVendeur = 'tous',
  ): Promise<RegleFiscale | null> {
    const { data, error } = await supabase.rpc('snp_resoudre_regle_fiscale', {
      p_code_taxe: codeTaxe,
      p_date: date,
      p_valeur_seuil: valeurSeuil ?? undefined,
      p_categorie_acheteur: categorieAcheteur,
      p_profil_vendeur: profilVendeur,
    });

    if (error) throw error;
    // La procédure renvoie une ligne composite : aucune règle applicable donne
    // une ligne vide, dont l'identifiant est nul.
    const ligne = data as unknown as RegleFiscale | null;
    return ligne?.id ? ligne : null;
  },
};
