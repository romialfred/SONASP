import { supabase } from '@/lib/supabase';

/**
 * Numérotation des cartes professionnelles d'artisan minier.
 *
 * Format : `BF-AM-AAAA-XZTM-NNNN`
 * - `BF`   : Burkina Faso
 * - `AM`   : artisan minier
 * - `AAAA` : année d'émission
 * - `XZTM` : empreinte de l'instant d'émission — X le jour, Z le mois, T l'heure,
 *            M la minute, chacun sur **un seul caractère**
 * - `NNNN` : compteur incrémental, **propre à un `XZTM` donné**
 *
 * Le couple (`XZTM`, `NNNN`) est donc unique : deux cartes émises la même minute
 * portent le même `XZTM` et des compteurs distincts.
 *
 * L'ancien format `SONASP/AM/2025/000063` comportait des barres obliques, mal
 * commodes dans une URL ou un nom de fichier, et son compteur était global à l'année.
 */

/** Jour, mois et heure tiennent dans 36 symboles sans ambiguïté de casse. */
export const ALPHABET_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Les minutes vont jusqu'à 59 : l'alphabet est étendu par des minuscules, en écartant
 * `l` et `o` qui se confondent avec `1` et `0` sur une carte imprimée. 36 + 24 = 60.
 */
export const ALPHABET_60 = `${ALPHABET_36}abcdefghijkmnpqrstuvwxyz`.slice(0, 60);

export const PREFIXE_CARTE = 'BF-AM';

/**
 * Empreinte de l'instant d'émission, sur quatre caractères.
 * Le jour et le mois sont pris tels quels (1 à 31, 1 à 12) ; l'heure et la minute
 * démarrent à zéro.
 */
export function encoderInstant(date: Date): string {
  const jour = ALPHABET_36[date.getDate()];
  const mois = ALPHABET_36[date.getMonth() + 1];
  const heure = ALPHABET_36[date.getHours()];
  const minute = ALPHABET_60[date.getMinutes()];
  return `${jour}${mois}${heure}${minute}`;
}

/** Préfixe commun à toutes les cartes émises la même minute. */
export const prefixePourInstant = (date: Date): string =>
  `${PREFIXE_CARTE}-${date.getFullYear()}-${encoderInstant(date)}`;

export function composerNumero(date: Date, compteur: number): string {
  return `${prefixePourInstant(date)}-${String(compteur).padStart(4, '0')}`;
}

/** Reconnaît un numéro au format en vigueur. */
export const EXPRESSION_NUMERO = /^BF-AM-\d{4}-[0-9A-Za-z]{4}-\d{4}$/;

export const estNumeroValide = (numero: string): boolean => EXPRESSION_NUMERO.test(numero.trim());

/**
 * Décompose un numéro. Renvoie `null` s'il ne respecte pas le format — les numéros
 * hérités (`SONASP/AM/...`) restent lisibles à l'écran mais ne se décomposent pas.
 */
export function decomposerNumero(numero: string): {
  annee: number;
  instant: string;
  compteur: number;
} | null {
  if (!estNumeroValide(numero)) return null;
  const [, , annee, instant, compteur] = numero.trim().split('-');
  return { annee: Number(annee), instant, compteur: Number(compteur) };
}

/** Compteur suivant pour un préfixe donné, à partir des numéros déjà attribués. */
export function compteurSuivant(numerosExistants: string[], prefixe: string): number {
  const compteurs = numerosExistants
    .filter((numero) => numero?.startsWith(`${prefixe}-`))
    .map((numero) => Number(numero.slice(prefixe.length + 1)))
    .filter((valeur) => Number.isFinite(valeur));
  return compteurs.length === 0 ? 1 : Math.max(...compteurs) + 1;
}

/**
 * Attribue le prochain numéro disponible.
 * Le compteur est recherché sur le seul préfixe de la minute courante : deux cartes
 * émises à des minutes différentes repartent chacune de 0001.
 */
export async function genererNumeroCarte(maintenant = new Date()): Promise<string> {
  const prefixe = prefixePourInstant(maintenant);

  const { data, error } = await supabase
    .from('snp_artisans_miniers')
    .select('numero_carte')
    .like('numero_carte', `${prefixe}-%`);

  if (error) throw error;

  const numerosExistants = (data || [])
    .map((ligne) => ligne.numero_carte)
    .filter((numero): numero is string => typeof numero === 'string');
  return composerNumero(maintenant, compteurSuivant(numerosExistants, prefixe));
}
