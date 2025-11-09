/**
 * Weight Conversion Utilities
 * Default unit: Troy Ounces (oz)
 * 1 troy oz = 31.1034768 grams
 * 1 regular oz = 28.3495 grams
 */

export const GRAMS_PER_TROY_OZ = 31.1034768;
export const GRAMS_PER_OZ = 28.3495;
export const GRAMS_PER_OZ_TROY = GRAMS_PER_TROY_OZ; // Alias for clarity

export type WeightUnit = 'g' | 'oz' | 'ozt';

export const WEIGHT_UNITS: { value: WeightUnit; label: string; abbreviation: string }[] = [
  { value: 'g', label: 'Grams', abbreviation: 'g' },
  { value: 'oz', label: 'Ounces', abbreviation: 'oz' },
  { value: 'ozt', label: 'Troy Ounces', abbreviation: 'oz t' },
];

/**
 * Convert grams to troy ounces
 */
export function gramsToOz(grams: number): number {
  return grams / GRAMS_PER_TROY_OZ;
}

/**
 * Convert troy ounces to grams
 */
export function ozToGrams(oz: number): number {
  return oz * GRAMS_PER_TROY_OZ;
}

/**
 * Convert between any weight units
 */
export function convertWeight(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) return value;

  // First convert to grams
  let grams: number;
  switch (fromUnit) {
    case 'g':
      grams = value;
      break;
    case 'oz':
      grams = value * GRAMS_PER_OZ;
      break;
    case 'ozt':
      grams = value * GRAMS_PER_TROY_OZ;
      break;
    default:
      grams = value;
  }

  // Then convert from grams to target unit
  switch (toUnit) {
    case 'g':
      return grams;
    case 'oz':
      return grams / GRAMS_PER_OZ;
    case 'ozt':
      return grams / GRAMS_PER_TROY_OZ;
    default:
      return grams;
  }
}

/**
 * Get all conversions for a given weight
 */
export function getAllConversions(value: number, unit: WeightUnit): {
  grams: number;
  ounces: number;
  troyOunces: number;
} {
  return {
    grams: convertWeight(value, unit, 'g'),
    ounces: convertWeight(value, unit, 'oz'),
    troyOunces: convertWeight(value, unit, 'ozt'),
  };
}

/**
 * Format weight in troy ounces with optional precision
 */
export function formatOz(oz: number, precision: number = 3): string {
  return oz.toFixed(precision);
}

/**
 * Format weight in grams with optional precision
 */
export function formatGrams(grams: number, precision: number = 2): string {
  return grams.toFixed(precision);
}

/**
 * Format weight display: "X oz (Y g)"
 */
export function formatWeightWithConversion(
  oz: number,
  options?: {
    ozPrecision?: number;
    gramsPrecision?: number;
    showUnit?: boolean;
  }
): string {
  const ozPrecision = options?.ozPrecision ?? 3;
  const gramsPrecision = options?.gramsPrecision ?? 2;
  const showUnit = options?.showUnit ?? true;

  const ozFormatted = formatOz(oz, ozPrecision);
  const gramsFormatted = formatGrams(ozToGrams(oz), gramsPrecision);

  if (showUnit) {
    return `${ozFormatted} oz (${gramsFormatted} g)`;
  }

  return `${ozFormatted} (${gramsFormatted})`;
}

/**
 * Parse weight input and convert to oz
 * Accepts both oz and grams input
 */
export function parseWeightToOz(
  value: string | number,
  unit: 'oz' | 'g' = 'oz'
): number | null {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue) || numValue < 0) {
    return null;
  }

  if (unit === 'g') {
    return gramsToOz(numValue);
  }

  return numValue;
}

/**
 * Format weight for database storage (always in grams)
 */
export function formatWeightForDB(oz: number): number {
  return ozToGrams(oz);
}

/**
 * Format weight from database (always stored in grams, convert to oz)
 */
export function formatWeightFromDB(grams: number | null): number {
  if (grams === null || grams === undefined) {
    return 0;
  }
  return gramsToOz(grams);
}

/**
 * Validate weight value
 */
export function isValidWeight(value: number | null): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return !isNaN(value) && value >= 0;
}

/**
 * Format weight for display in tables (compact format)
 */
export function formatWeightCompact(oz: number): string {
  return `${formatOz(oz, 2)} oz`;
}

/**
 * Calculate percentage difference between weights
 */
export function calculateWeightDifference(
  weight1Oz: number,
  weight2Oz: number
): {
  differenceOz: number;
  differenceGrams: number;
  percentageDifference: number;
} {
  const differenceOz = weight1Oz - weight2Oz;
  const differenceGrams = ozToGrams(differenceOz);
  const percentageDifference = weight2Oz !== 0
    ? ((differenceOz / weight2Oz) * 100)
    : 0;

  return {
    differenceOz,
    differenceGrams,
    percentageDifference,
  };
}
