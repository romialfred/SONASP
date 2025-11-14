/**
 * Utilities pour manipuler les nombres de manière sûre
 * Évite les erreurs "Cannot read properties of undefined"
 */

/**
 * Formate un nombre avec toFixed() de manière sécurisée
 * Retourne "0.00" si la valeur est undefined/null/NaN
 *
 * @param value - La valeur à formater
 * @param decimals - Nombre de décimales (défaut: 2)
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée
 *
 * @example
 * safeToFixed(undefined, 2) // "0.00"
 * safeToFixed(123.456, 2) // "123.46"
 * safeToFixed(null, 2) // "0.00"
 * safeToFixed(NaN, 2) // "0.00"
 */
export function safeToFixed(
  value: number | undefined | null,
  decimals: number = 2,
  defaultValue: number = 0
): string {
  // Vérifier si la valeur est valide
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue.toFixed(decimals);
  }

  return value.toFixed(decimals);
}

/**
 * Formate un nombre en locale française de manière sécurisée
 *
 * @param value - La valeur à formater
 * @param options - Options de formatage Intl.NumberFormat
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée
 *
 * @example
 * safeToLocaleString(1234.56, { maximumFractionDigits: 2 }) // "1 234,56"
 * safeToLocaleString(undefined) // "0"
 */
export function safeToLocaleString(
  value: number | undefined | null,
  options?: Intl.NumberFormatOptions,
  defaultValue: number = 0
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue.toLocaleString('fr-FR', options);
  }

  return value.toLocaleString('fr-FR', options);
}

/**
 * S'assure qu'une valeur est un nombre valide
 *
 * @param value - La valeur à valider
 * @param defaultValue - Valeur par défaut si invalide (défaut: 0)
 * @returns Nombre valide
 *
 * @example
 * ensureNumber(undefined) // 0
 * ensureNumber(123) // 123
 * ensureNumber(null, 10) // 10
 */
export function ensureNumber(
  value: number | undefined | null,
  defaultValue: number = 0
): number {
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue;
  }

  return value;
}

/**
 * Calcule une moyenne de manière sécurisée
 *
 * @param values - Tableau de valeurs
 * @param defaultValue - Valeur par défaut si tableau vide (défaut: 0)
 * @returns Moyenne des valeurs
 */
export function safeAverage(
  values: (number | undefined | null)[],
  defaultValue: number = 0
): number {
  const validValues = values.filter(v => v !== undefined && v !== null && !isNaN(v)) as number[];

  if (validValues.length === 0) {
    return defaultValue;
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return sum / validValues.length;
}

/**
 * Calcule une somme de manière sécurisée
 *
 * @param values - Tableau de valeurs
 * @param defaultValue - Valeur par défaut si toutes les valeurs sont invalides (défaut: 0)
 * @returns Somme des valeurs valides
 */
export function safeSum(
  values: (number | undefined | null)[],
  defaultValue: number = 0
): number {
  const validValues = values.filter(v => v !== undefined && v !== null && !isNaN(v)) as number[];

  if (validValues.length === 0) {
    return defaultValue;
  }

  return validValues.reduce((acc, val) => acc + val, 0);
}

/**
 * Arrondit un nombre AU SUPÉRIEUR avec un nombre précis de décimales
 *
 * @param value - La valeur à arrondir
 * @param decimals - Nombre de décimales (défaut: 2)
 * @returns Nombre arrondi au supérieur
 *
 * @example
 * roundUpToDecimals(343.5298, 2) // 343.53
 * roundUpToDecimals(10.001, 2) // 10.01
 * roundUpToDecimals(10.999, 2) // 11.00
 * roundUpToDecimals(5.2, 2) // 5.20
 */
export function roundUpToDecimals(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.ceil(value * multiplier) / multiplier;
}

/**
 * Arrondit un nombre AU SUPÉRIEUR et retourne une chaîne avec le nombre exact de décimales
 *
 * @param value - La valeur à arrondir
 * @param decimals - Nombre de décimales (défaut: 2)
 * @returns Chaîne formatée avec exactement le nombre de décimales spécifié
 *
 * @example
 * roundUpToFixed(343.5298, 2) // "343.53"
 * roundUpToFixed(10.001, 2) // "10.01"
 * roundUpToFixed(10.999, 2) // "11.00"
 * roundUpToFixed(5.2, 2) // "5.20"
 */
export function roundUpToFixed(value: number, decimals: number = 2): string {
  return roundUpToDecimals(value, decimals).toFixed(decimals);
}

/**
 * Arrondit de manière sécurisée AU SUPÉRIEUR avec gestion des valeurs undefined/null
 *
 * @param value - La valeur à arrondir
 * @param decimals - Nombre de décimales (défaut: 2)
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée avec exactement le nombre de décimales spécifié
 *
 * @example
 * safeRoundUpToFixed(343.5298, 2) // "343.53"
 * safeRoundUpToFixed(undefined, 2) // "0.00"
 * safeRoundUpToFixed(null, 2, 0) // "0.00"
 */
export function safeRoundUpToFixed(
  value: number | undefined | null,
  decimals: number = 2,
  defaultValue: number = 0
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue.toFixed(decimals);
  }

  return roundUpToFixed(value, decimals);
}
