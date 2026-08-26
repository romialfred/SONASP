import { supabase } from '@/lib/supabase';

/**
 * Taux fiscaux applicables à un achat, lus au référentiel.
 *
 * Les écrans d'achat appliquaient jusqu'ici des taux écrits en dur — 18 % de TVA
 * et 1 % de taxe de développement communal — sans consulter quoi que ce soit.
 * Une même opération pouvait donc porter deux TVA différentes selon l'écran qui
 * la traitait, celle du code et celle du barème approuvé.
 *
 * Ce module interroge `snp_resoudre_regle_fiscale`, la même procédure que la
 * conciliation. Le taux dépend du profil du vendeur et de la date de
 * l'opération : une règle nommant le profil l'emporte sur une règle générale.
 *
 * **Une taxe sans règle n'est pas une taxe à zéro.** Lorsqu'aucune règle
 * n'existe, le taux vaut `null` et l'écran doit le dire, plutôt que de calculer
 * un montant nul qui passerait pour un calcul juste.
 */

/** Profils reconnus par le référentiel fiscal. */
export type ProfilVendeurAchat =
  | 'tous'
  | 'comptoir'
  | 'mine_industrielle'
  | 'mine_semi_mecanisee'
  | 'artisan';

export interface TauxAchat {
  /** Taux de TVA en pourcentage, ou `null` si aucune règle n'est en vigueur. */
  tvaPourcent: number | null;
  /** Taxe de développement communal en pourcentage, ou `null`. */
  taxeCommunalePourcent: number | null;
  /** Codes des taxes pour lesquelles aucune règle n'a été trouvée. */
  taxesSansRegle: string[];
  /** Libellés des règles retenues, pour justifier un montant à l'écran. */
  reglesRetenues: Record<string, string>;
}

interface LigneRegle {
  id: string | null;
  libelle: string | null;
  taux: number | null;
}

/**
 * Le référentiel stocke un taux en fraction : 0,18 pour 18 %. Les écrans
 * raisonnent en pourcentage.
 */
function versPourcentage(taux: number | null | undefined): number | null {
  if (taux === null || taux === undefined) return null;
  const valeur = Number(taux);
  return Number.isFinite(valeur) ? valeur * 100 : null;
}

async function resoudre(
  codeTaxe: string,
  date: string,
  profilVendeur: ProfilVendeurAchat,
): Promise<LigneRegle | null> {
  const { data, error } = await supabase.rpc('snp_resoudre_regle_fiscale', {
    p_code_taxe: codeTaxe,
    p_date: date,
    p_categorie_acheteur: 'standard',
    p_profil_vendeur: profilVendeur,
  });

  if (error) throw error;
  const ligne = data as unknown as LigneRegle | null;
  return ligne?.id ? ligne : null;
}

export const tauxAchatService = {
  /**
   * Résout la TVA et la taxe communale pour un achat.
   *
   * @param profilVendeur profil de celui qui vend l'or à la SONASP
   * @param date date de l'opération, au format `AAAA-MM-JJ`
   */
  async pourAchat(
    profilVendeur: ProfilVendeurAchat,
    date: string,
  ): Promise<TauxAchat> {
    const [tva, communale] = await Promise.all([
      resoudre('tva', date, profilVendeur),
      resoudre('taxe_communale', date, profilVendeur),
    ]);

    const taxesSansRegle: string[] = [];
    if (!tva) taxesSansRegle.push('tva');
    if (!communale) taxesSansRegle.push('taxe_communale');

    const reglesRetenues: Record<string, string> = {};
    if (tva?.libelle) reglesRetenues.tva = tva.libelle;
    if (communale?.libelle) reglesRetenues.taxe_communale = communale.libelle;

    return {
      tvaPourcent: versPourcentage(tva?.taux),
      taxeCommunalePourcent: versPourcentage(communale?.taux),
      taxesSansRegle,
      reglesRetenues,
    };
  },
};
