/**
 * Generate batch number with format: CC-YYYY-MM-XXX
 * CC = Country Code (GN=Guinea, ML=Mali, LB=Liberia)
 * YYYY = Year
 * MM = Month
 * XXX = Sequential number (001, 002, etc.)
 *
 * @deprecated Use generateBatchNumber from batchNumberGenerator.ts instead
 */
export function generateBatchNumber(site: string, date: Date = new Date()): string {
  // Map site/country to country code
  const normalized = site.toLowerCase().trim();
  let countryCode = 'GN'; // Default to Guinea

  if (normalized.includes('guin') || normalized === 'guinea' || normalized === 'gn') {
    countryCode = 'GN';
  } else if (normalized.includes('mali') || normalized === 'mali' || normalized === 'ml') {
    countryCode = 'ML';
  } else if (normalized.includes('liber') || normalized === 'liberia' || normalized === 'lb') {
    countryCode = 'LB';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Generate a random sequence for now (will be replaced by database lookup)
  const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');

  return `${countryCode}-${year}-${month}-${sequence}`;
}

export interface VarianceResult {
  difference: number;
  percentage: number;
  isSignificant: boolean;
  threshold: number;
}

export function calculateVariance(
  expected: number,
  actual: number,
  threshold: number = 2
): VarianceResult {
  if (expected === 0) {
    return {
      difference: actual,
      percentage: 0,
      isSignificant: actual !== 0,
      threshold,
    };
  }

  const difference = actual - expected;
  const percentage = (difference / expected) * 100;
  const isSignificant = Math.abs(percentage) > threshold;

  return {
    difference: parseFloat(difference.toFixed(2)),
    percentage: parseFloat(percentage.toFixed(2)),
    isSignificant,
    threshold,
  };
}

export function isVarianceWithinThreshold(variance: number, threshold: number = 2): boolean {
  return Math.abs(variance) <= threshold;
}

export function convertGramsToOunces(grams: number): number {
  return grams / 31.1035;
}

export function convertOuncesToGrams(ounces: number): number {
  return ounces * 31.1035;
}

export function calculateFinalFine(
  postMeltingWeight: number,
  fineness: number,
  metalRetained: number
): number {
  return postMeltingWeight * (fineness / 100) * (metalRetained / 100);
}

export function formatBatchStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'created': 'Created',
    'shipped': 'Shipped to Airport',
    'received_airport': 'Received at Airport',
    'shipped_refinery': 'Shipped to Refinery',
    'received_refinery': 'Received at Refinery',
    'processing': 'Processing',
    'quality_check': 'Quality Check',
    'ready_for_sale': 'Ready for Sale',
    'completed': 'Completed',
  };

  return statusMap[status] || status;
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'created': 'bg-gray-100 text-gray-800',
    'shipped': 'bg-blue-100 text-blue-800',
    'received_airport': 'bg-indigo-100 text-indigo-800',
    'shipped_refinery': 'bg-blue-100 text-blue-800',
    'received_refinery': 'bg-purple-100 text-purple-800',
    'processing': 'bg-yellow-100 text-yellow-800',
    'quality_check': 'bg-orange-100 text-orange-800',
    'ready_for_sale': 'bg-green-100 text-green-800',
    'completed': 'bg-emerald-100 text-emerald-800',
  };

  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

export interface BatchTimeline {
  status: string;
  timestamp: Date;
  user: string;
  notes?: string;
}

export function generateBatchTimeline(batch: any): BatchTimeline[] {
  const timeline: BatchTimeline[] = [];

  if (batch.created_at) {
    timeline.push({
      status: 'created',
      timestamp: new Date(batch.created_at),
      user: batch.created_by || 'System',
      notes: 'Batch created',
    });
  }

  return timeline;
}

export function formatWeight(grams: number, unit: 'g' | 'oz' = 'g'): string {
  if (unit === 'oz') {
    const ounces = convertGramsToOunces(grams);
    return `${ounces.toFixed(2)} oz`;
  }
  return `${grams.toFixed(2)} g`;
}

export function gramsToOunces(grams: number): number {
  return grams / 31.1035;
}

export function ouncesToGrams(ounces: number): number {
  return ounces * 31.1035;
}
