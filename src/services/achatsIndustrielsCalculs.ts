/**
 * Calculs du module d'achat d'or industriel.
 *
 * ══ AUTORITÉ ══
 * Ces fonctions ne décident de rien. Elles servent à afficher un aperçu pendant
 * que l'utilisateur saisit — répartition, totaux, ancienneté — et sont écrites
 * pour donner exactement le même résultat que les fonctions PL/pgSQL du même
 * nom (`snp_repartir_plan`, `snp_affecter_fifo`, `snp_balance_agee`).
 *
 * La valeur qui compte est TOUJOURS celle que la base renvoie après écriture.
 * Il n'y a pas de serveur applicatif dans cette plateforme : le navigateur parle
 * directement à PostgREST, et un contrôle écrit ici s'obtient en ouvrant la
 * console. Les invariants financiers sont donc posés en base, et ce fichier en
 * est le reflet, jamais la source.
 *
 * Les tests vérifient que les deux implémentations concordent.
 */

/** Quantités et montants sont arrondis à la même précision qu'en base. */
export const DECIMALES_QUANTITE = 4;
export const DECIMALES_MONTANT = 2;

export const arrondir = (valeur: number, decimales: number): number => {
  if (!Number.isFinite(valeur)) return 0;
  const facteur = 10 ** decimales;
  return Math.round((valeur + Number.EPSILON) * facteur) / facteur;
};

export const arrondirQuantite = (valeur: number) => arrondir(valeur, DECIMALES_QUANTITE);
export const arrondirMontant = (valeur: number) => arrondir(valeur, DECIMALES_MONTANT);

/* ------------------------------------------------------------------ Types */

export interface LigneRepartissable {
  mining_company_id: string;
  production_eligible_oz: number;
}

export interface Repartition {
  mining_company_id: string;
  quantite_proposee_oz: number;
  pourcentage_applique: number | null;
}

export interface FactureOuverte {
  id: string;
  date_echeance: string;
  date_emission: string;
  numero_facture: string;
  reste_du_fcfa: number;
}

export interface AffectationPrevue {
  facture_id: string;
  numero_facture: string;
  montant_affecte_fcfa: number;
}

/* ------------------------------------------------------- Répartition ----- */

/**
 * Répartition par pourcentage : chaque mine reçoit la même part de sa propre
 * production éligible. Aucun reliquat à replacer — le total n'est pas une cible
 * mais une conséquence.
 */
export function repartirParPourcentage(
  lignes: LigneRepartissable[],
  pourcentage: number
): Repartition[] {
  const taux = Math.max(0, Math.min(100, Number(pourcentage) || 0));
  return lignes.map((ligne) => {
    const eligible = Math.max(0, Number(ligne.production_eligible_oz) || 0);
    return {
      mining_company_id: ligne.mining_company_id,
      quantite_proposee_oz: arrondirQuantite((eligible * taux) / 100),
      pourcentage_applique: eligible > 0 ? taux : null,
    };
  });
}

/**
 * Répartition d'une quantité nationale, au prorata de la production éligible.
 *
 * L'arrondi de chaque part laisse un reliquat. Il est versé à la plus grosse
 * ligne plutôt que dispersé : la somme des lignes retombe alors exactement sur
 * la cible. Sans cela, l'écart — quelques centièmes d'once — se propagerait aux
 * demandes, puis aux factures, et le plan ne se boucherait jamais.
 */
export function repartirParQuantiteCible(
  lignes: LigneRepartissable[],
  quantiteCible: number
): Repartition[] {
  const cible = Math.max(0, Number(quantiteCible) || 0);
  const total = lignes.reduce(
    (somme, ligne) => somme + Math.max(0, Number(ligne.production_eligible_oz) || 0),
    0
  );

  if (total <= 0 || cible <= 0) {
    return lignes.map((ligne) => ({
      mining_company_id: ligne.mining_company_id,
      quantite_proposee_oz: 0,
      pourcentage_applique: null,
    }));
  }

  const parts = lignes.map((ligne) => {
    const eligible = Math.max(0, Number(ligne.production_eligible_oz) || 0);
    const quantite = arrondirQuantite((cible * eligible) / total);
    return {
      mining_company_id: ligne.mining_company_id,
      quantite_proposee_oz: quantite,
      pourcentage_applique: eligible > 0 ? arrondir((quantite * 100) / eligible, DECIMALES_QUANTITE) : null,
      eligible,
    };
  });

  const reliquat = arrondirQuantite(
    cible - parts.reduce((somme, part) => somme + part.quantite_proposee_oz, 0)
  );

  if (reliquat !== 0) {
    let indexPlusGrosse = 0;
    parts.forEach((part, index) => {
      if (part.quantite_proposee_oz > parts[indexPlusGrosse].quantite_proposee_oz) {
        indexPlusGrosse = index;
      }
    });
    const cumul = parts[indexPlusGrosse];
    cumul.quantite_proposee_oz = arrondirQuantite(Math.max(0, cumul.quantite_proposee_oz + reliquat));
    cumul.pourcentage_applique = cumul.eligible > 0
      ? arrondir((cumul.quantite_proposee_oz * 100) / cumul.eligible, DECIMALES_QUANTITE)
      : null;
  }

  return parts.map(({ eligible: _eligible, ...reste }) => reste);
}

/** Montant estimé d'une ligne. La base applique la même règle par déclencheur. */
export const valoriserLigne = (quantiteOz: number, prixOnceFcfa: number): number =>
  arrondirMontant(Math.max(0, quantiteOz || 0) * Math.max(0, prixOnceFcfa || 0));

/* -------------------------------------------------------- Affectation ---- */

/**
 * Aperçu d'une affectation automatique, de la facture la plus ancienne à la
 * plus récente. L'ordre — échéance, puis émission, puis numéro — est celui de
 * `snp_affecter_fifo`.
 */
export function simulerAffectationFifo(
  montantReglement: number,
  factures: FactureOuverte[]
): { affectations: AffectationPrevue[]; soldeNonAffecte: number } {
  let solde = arrondirMontant(Math.max(0, montantReglement || 0));
  const affectations: AffectationPrevue[] = [];

  const ordonnees = [...factures].sort((a, b) => {
    if (a.date_echeance !== b.date_echeance) return a.date_echeance < b.date_echeance ? -1 : 1;
    if (a.date_emission !== b.date_emission) return a.date_emission < b.date_emission ? -1 : 1;
    return a.numero_facture.localeCompare(b.numero_facture, 'fr');
  });

  for (const facture of ordonnees) {
    if (solde <= 0.005) break;
    const reste = Math.max(0, Number(facture.reste_du_fcfa) || 0);
    if (reste <= 0.005) continue;

    const part = arrondirMontant(Math.min(solde, reste));
    affectations.push({
      facture_id: facture.id,
      numero_facture: facture.numero_facture,
      montant_affecte_fcfa: part,
    });
    solde = arrondirMontant(solde - part);
  }

  return { affectations, soldeNonAffecte: solde };
}

/* --------------------------------------------------------- Ancienneté ---- */

export type TrancheAge = 'non_echu' | 'j1_30' | 'j31_60' | 'j61_90' | 'j91_180' | 'plus_180';

export const LIBELLES_TRANCHE: Record<TrancheAge, string> = {
  non_echu: 'Non échu',
  j1_30: '1 à 30 jours',
  j31_60: '31 à 60 jours',
  j61_90: '61 à 90 jours',
  j91_180: '91 à 180 jours',
  plus_180: 'Plus de 180 jours',
};

export const TRANCHES: TrancheAge[] = ['non_echu', 'j1_30', 'j31_60', 'j61_90', 'j91_180', 'plus_180'];

/** Nombre de jours entiers écoulés depuis l'échéance ; 0 si elle n'est pas passée. */
export function joursDeRetard(dateEcheance: string, aujourdhui: string): number {
  const echeance = Date.parse(`${dateEcheance}T00:00:00Z`);
  const jour = Date.parse(`${aujourdhui}T00:00:00Z`);
  if (Number.isNaN(echeance) || Number.isNaN(jour)) return 0;
  return Math.max(0, Math.round((jour - echeance) / 86_400_000));
}

/**
 * Tranche d'ancienneté d'une facture.
 * Le non-échu forme une tranche à part : le confondre avec du retard ferait
 * passer un délai contractuel pour un impayé.
 */
export function trancheAnciennete(dateEcheance: string, aujourdhui: string): TrancheAge {
  const echeance = Date.parse(`${dateEcheance}T00:00:00Z`);
  const jour = Date.parse(`${aujourdhui}T00:00:00Z`);
  if (!Number.isNaN(echeance) && !Number.isNaN(jour) && echeance >= jour) return 'non_echu';

  const jours = joursDeRetard(dateEcheance, aujourdhui);
  if (jours <= 30) return 'j1_30';
  if (jours <= 60) return 'j31_60';
  if (jours <= 90) return 'j61_90';
  if (jours <= 180) return 'j91_180';
  return 'plus_180';
}

export interface FactureAgee {
  date_echeance: string;
  reste_du_fcfa: number;
}

export type BalanceAgee = Record<TrancheAge, number> & { total: number; nbFactures: number };

/** Agrégation d'un portefeuille de factures par tranche d'ancienneté. */
export function agregerBalanceAgee(factures: FactureAgee[], aujourdhui: string): BalanceAgee {
  const balance = TRANCHES.reduce(
    (accumulateur, tranche) => ({ ...accumulateur, [tranche]: 0 }),
    {} as Record<TrancheAge, number>
  );
  let total = 0;
  let nbFactures = 0;

  factures.forEach((facture) => {
    const reste = Number(facture.reste_du_fcfa) || 0;
    if (reste <= 0.005) return;
    balance[trancheAnciennete(facture.date_echeance, aujourdhui)] += reste;
    total += reste;
    nbFactures += 1;
  });

  TRANCHES.forEach((tranche) => {
    balance[tranche] = arrondirMontant(balance[tranche]);
  });

  return { ...balance, total: arrondirMontant(total), nbFactures };
}

/* ------------------------------------------------------- Validations ----- */

export interface LigneAValider {
  quantite_proposee_oz: number;
  production_eligible_oz: number;
  prix_once_fcfa: number;
}

/**
 * Contrôles d'une ligne avant soumission. Les mêmes règles sont posées en base
 * par `snp_soumettre_plan` : celles-ci évitent un aller-retour, elles ne le
 * remplacent pas.
 */
export function validerLigne(ligne: LigneAValider): string | null {
  const quantite = Number(ligne.quantite_proposee_oz) || 0;
  if (quantite < 0) return 'La quantité ne peut pas être négative.';
  if (quantite === 0) return null;
  if (quantite > (Number(ligne.production_eligible_oz) || 0) + 1e-4) {
    return 'La quantité dépasse la production éligible de la mine.';
  }
  if (!((Number(ligne.prix_once_fcfa) || 0) > 0)) return 'Le prix à l’once doit être renseigné.';
  return null;
}
