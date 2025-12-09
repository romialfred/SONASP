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

/**
 * Formate un nombre avec séparateur d'espace pour les milliers
 * Applique automatiquement le séparateur pour les nombres >= 1000
 *
 * @param value - La valeur à formater
 * @param decimals - Nombre de décimales (défaut: 2)
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée avec séparateur d'espace
 *
 * @example
 * formatNumberWithSpaces(498885.00, 2) // "498 885.00"
 * formatNumberWithSpaces(914378.99, 2) // "914 378.99"
 * formatNumberWithSpaces(1011.59, 2) // "1 011.59"
 * formatNumberWithSpaces(123.45, 2) // "123.45"
 * formatNumberWithSpaces(undefined, 2) // "0.00"
 */
export function formatNumberWithSpaces(
  value: number | undefined | null,
  decimals: number = 2,
  defaultValue: number = 0
): string {
  // Gérer les valeurs invalides
  if (value === undefined || value === null || isNaN(value)) {
    value = defaultValue;
  }

  // Formater avec le nombre de décimales
  const fixedValue = value.toFixed(decimals);

  // Séparer la partie entière et décimale
  const [integerPart, decimalPart] = fixedValue.split('.');

  // Ajouter des espaces tous les 3 chiffres (de droite à gauche)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Recombiner avec la partie décimale
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

/**
 * Formate un nombre avec séparateur d'espace et gère les valeurs négatives
 *
 * @param value - La valeur à formater
 * @param decimals - Nombre de décimales (défaut: 0 pour les variances)
 * @param showSign - Afficher le signe + pour les positifs (défaut: false)
 * @returns Chaîne formatée avec séparateur d'espace
 *
 * @example
 * formatVarianceWithSpaces(-497873, 0) // "-497 873"
 * formatVarianceWithSpaces(-913367, 0) // "-913 367"
 * formatVarianceWithSpaces(123456, 0, true) // "+123 456"
 */
export function formatVarianceWithSpaces(
  value: number | undefined | null,
  decimals: number = 0,
  showSign: boolean = false
): string {
  if (value === undefined || value === null || isNaN(value)) {
    value = 0;
  }

  const sign = value >= 0 ? (showSign ? '+' : '') : '';
  const absValue = Math.abs(value);
  const formatted = formatNumberWithSpaces(absValue, decimals, 0);

  return value >= 0 ? `${sign}${formatted}` : `-${formatted}`;
}

/**
 * Formate un pourcentage avec un nombre de décimales contrôlé
 * TOUJOURS utilisez cette fonction pour afficher des pourcentages
 *
 * @param value - La valeur du pourcentage (déjà en %, pas en décimal)
 * @param decimals - Nombre de décimales (défaut: 1)
 * @param showSign - Afficher le signe + pour les positifs (défaut: false)
 * @returns Chaîne formatée avec le symbole %
 *
 * @example
 * formatPercentage(99.83650692642811, 2) // "99.84%"
 * formatPercentage(-99.54203369537330, 2) // "-99.54%"
 * formatPercentage(15.7, 1) // "15.7%"
 * formatPercentage(5.0, 1) // "5.0%"
 * formatPercentage(10, 1, true) // "+10.0%"
 */
export function formatPercentage(
  value: number | undefined | null,
  decimals: number = 1,
  showSign: boolean = false
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.0%';
  }

  const sign = value >= 0 ? (showSign ? '+' : '') : '';
  const formatted = Math.abs(value).toFixed(decimals);

  return value >= 0 ? `${sign}${formatted}%` : `-${formatted}%`;
}

/**
 * Calcule et formate un pourcentage de variance
 * Gère automatiquement le cas où le budget est 0
 *
 * @param actual - Valeur actuelle/réelle
 * @param budget - Valeur budgétée/cible
 * @param decimals - Nombre de décimales (défaut: 1)
 * @param showSign - Afficher le signe + pour les positifs (défaut: false)
 * @returns Pourcentage formaté ou "-100%" si budget = 0
 *
 * @example
 * calculateVariancePercent(110, 100, 1) // "10.0%"
 * calculateVariancePercent(90, 100, 1) // "-10.0%"
 * calculateVariancePercent(50, 0, 1) // "-100.0%"
 */
export function calculateVariancePercent(
  actual: number,
  budget: number,
  decimals: number = 1,
  showSign: boolean = false
): string {
  if (budget === 0 || budget === null || budget === undefined) {
    return formatPercentage(-100, decimals, showSign);
  }

  const variance = actual - budget;
  const percentValue = (variance / budget) * 100;

  return formatPercentage(percentValue, decimals, showSign);
}

/**
 * STANDARD PLATEFORME: Formate TOUS les poids en grammes avec exactement 2 décimales
 * À utiliser pour l'affichage de tous les poids en grammes
 *
 * @param value - Poids en grammes
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée avec exactement 2 décimales
 *
 * @example
 * formatWeightGrams(11269.900) // "11269.90"
 * formatWeightGrams(33298.910) // "33298.91"
 * formatWeightGrams(undefined) // "0.00"
 */
export function formatWeightGrams(
  value: number | undefined | null,
  defaultValue: number = 0
): string {
  return safeToFixed(value, 2, defaultValue);
}

/**
 * STANDARD PLATEFORME: Formate TOUS les poids en onces avec exactement 2 décimales
 * À utiliser pour l'affichage de tous les poids en onces
 *
 * @param value - Poids en onces
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée avec exactement 2 décimales
 *
 * @example
 * formatWeightOunces(333.566000) // "333.57"
 * formatWeightOunces(737.018000) // "737.02"
 * formatWeightOunces(1070.58400) // "1070.58"
 * formatWeightOunces(undefined) // "0.00"
 */
export function formatWeightOunces(
  value: number | undefined | null,
  defaultValue: number = 0
): string {
  return safeToFixed(value, 2, defaultValue);
}

/**
 * STANDARD PLATEFORME: Formate TOUS les montants en USD avec exactement 2 décimales
 * À utiliser pour l'affichage de tous les montants financiers
 *
 * @param value - Montant en USD
 * @param useSpaces - Utiliser des espaces comme séparateur de milliers (défaut: true)
 * @param defaultValue - Valeur par défaut si undefined (défaut: 0)
 * @returns Chaîne formatée avec exactement 2 décimales
 *
 * @example
 * formatCurrency(2876543.21, true) // "2 876 543.21"
 * formatCurrency(1234.56, false) // "1234.56"
 * formatCurrency(undefined) // "0.00"
 */
export function formatCurrency(
  value: number | undefined | null,
  useSpaces: boolean = true,
  defaultValue: number = 0
): string {
  if (useSpaces) {
    return formatNumberWithSpaces(value, 2, defaultValue);
  }
  return safeToFixed(value, 2, defaultValue);
}
