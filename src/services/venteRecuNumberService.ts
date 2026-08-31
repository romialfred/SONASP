import { supabase } from '@/lib/supabase';

/**
 * Numérotation des ventes d'or artisanale.
 *
 * Format retenu : `VE-OR-AAAA-NNNNN`
 *   VE    : vente
 *   OR    : or
 *   AAAA  : année d'émission
 *   NNNNN : compteur incrémental propre à l'année
 *
 * C'est ce numéro qui identifie la vente jusqu'au paiement, en passant par la
 * facture. L'ancien format `VENTE/OR/2025/12/0002` comportait des barres
 * obliques, peu commodes en URL, en nom de fichier et dans un export CSV.
 */
export const PREFIXE_RECU = 'VE-OR';
export const LONGUEUR_COMPTEUR = 5;

/** Année d'émission, seul segment temporel du numéro. */
export function periodeRecu(date: Date): string {
  return String(date.getFullYear());
}

export const prefixePourPeriode = (date: Date) => `${PREFIXE_RECU}-${periodeRecu(date)}`;

export function composerNumeroRecu(date: Date, compteur: number): string {
  return `${prefixePourPeriode(date)}-${String(compteur).padStart(LONGUEUR_COMPTEUR, '0')}`;
}

export const EXPRESSION_RECU = /^VE-OR-\d{4}-\d{5}$/;

export const estNumeroRecuValide = (numero: string) => EXPRESSION_RECU.test(numero);

export function decomposerNumeroRecu(numero: string): { periode: string; compteur: number } | null {
  if (!estNumeroRecuValide(numero)) return null;
  const [, , periode, compteur] = numero.split('-');
  return { periode, compteur: Number(compteur) };
}

/**
 * Converti un numéro hérité vers le nouveau format.
 * `VENTE/OR/2025/12/0002` → `VE-OR-2025-00002`. Le mois disparaît : le compteur
 * est désormais annuel. Retourne `null` si la forme n'est pas reconnue — mieux
 * vaut laisser le numéro tel quel que le déformer.
 */
export function convertirNumeroHerite(numero: string): string | null {
  const correspondance = /^VENTE\/OR\/(\d{4})\/\d{1,2}\/(\d+)$/.exec(numero.trim());
  if (!correspondance) return null;
  const [, annee, compteur] = correspondance;
  return `${PREFIXE_RECU}-${annee}-${compteur.padStart(LONGUEUR_COMPTEUR, '0')}`;
}

/** Compteur suivant pour un préfixe donné, déduit du plus grand déjà attribué. */
export function compteurSuivant(numerosExistants: string[], prefixe: string): number {
  let maximum = 0;
  numerosExistants.forEach((numero) => {
    if (!numero.startsWith(`${prefixe}-`)) return;
    const valeur = Number(numero.slice(prefixe.length + 1));
    if (Number.isFinite(valeur) && valeur > maximum) maximum = valeur;
  });
  return maximum + 1;
}

/**
 * Réserve le prochain numéro auprès de la base.
 *
 * Le compteur atomique côté serveur garantit que deux écrans ouverts au même
 * instant ne peuvent pas annoncer la même référence. Une réservation abandonnée
 * peut créer un trou, mais jamais un doublon sur une pièce comptable.
 */
export async function genererNumeroRecu(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_numero_recu_vente_or');
  if (error) throw error;

  const numero = typeof data === 'string' ? data : '';
  if (!estNumeroRecuValide(numero)) {
    throw new Error('La base a renvoyé une référence de vente invalide.');
  }
  return numero;
}
