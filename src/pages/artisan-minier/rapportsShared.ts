import { artisanAnalyticsService } from '@/services/artisanAnalyticsService';

/** Montant entier au format français, sans décimale parasite. */
export const formatMontant = (montant?: number | null) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(montant || 0));

/** Poids en grammes avec deux décimales. */
export const formatGrammes = (grammes?: number | null) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(grammes || 0);

/**
 * Ratio en pourcentage, ou `null` si le dénominateur est nul.
 * Les récapitulatifs affichaient « NaN% » dès qu'une période ne portait aucune facture.
 */
export function tauxEffectif(numerateur: number, denominateur: number): number | null {
  if (!denominateur) return null;
  return (numerateur / denominateur) * 100;
}

export const formatTaux = (taux: number | null) => (taux === null ? '—' : `${taux.toFixed(2)} %`);

/** Bornes par défaut : du 1er janvier de l'année courante à aujourd'hui. */
export function defaultPeriode(today = new Date()): { debut: string; fin: string } {
  return {
    debut: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
    fin: today.toISOString().split('T')[0],
  };
}

/** Message d'erreur si la période saisie est incohérente, sinon `null`. */
export function validatePeriode(debut: string, fin: string): string | null {
  if (!debut || !fin) return 'Renseignez les deux bornes de la période.';
  if (debut > fin) return 'La date de début est postérieure à la date de fin.';
  return null;
}

/**
 * Télécharge un rapport au format Excel.
 * Renvoie un message d'erreur exploitable au lieu de laisser l'échec au journal,
 * où l'utilisateur ne voyait rien se passer.
 */
export async function telechargerRapport(
  nomFeuille: string,
  nomFichier: string,
  donnees: unknown[]
): Promise<string | null> {
  if (donnees.length === 0) return 'Aucune donnée à exporter sur cette période.';
  try {
    const blob = await artisanAnalyticsService.exporterRapportExcel(nomFeuille, donnees as Record<string, unknown>[]);
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
    URL.revokeObjectURL(url);
    return null;
  } catch (reason) {
    return reason instanceof Error ? reason.message : 'Échec de la génération du fichier Excel.';
  }
}
