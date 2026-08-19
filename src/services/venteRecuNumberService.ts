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
 * Attribue le prochain numéro de reçu.
 *
 * Une erreur de lecture est remontée plutôt qu'avalée : attribuer un numéro sans
 * connaître ceux déjà pris produirait un doublon sur une pièce comptable.
 */
export async function genererNumeroRecu(maintenant = new Date()): Promise<string> {
  const prefixe = prefixePourPeriode(maintenant);

  const { data, error } = await supabase
    .from('snp_artisan_ventes_or')
    .select('numero_recu')
    .like('numero_recu', `${prefixe}-%`);

  if (error) throw error;

  const existants = (data || [])
    .map((ligne) => (ligne as { numero_recu?: string | null }).numero_recu)
    .filter((numero): numero is string => Boolean(numero));

  return composerNumeroRecu(maintenant, compteurSuivant(existants, prefixe));
}
