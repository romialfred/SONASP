/**
 * Batch Number Generator
 * Format: CC-YYYY-MM-XXX
 * CC = Country Code (GN=Guinea, ML=Mali, LB=Liberia)
 * YYYY = Year
 * MM = Month
 * XXX = Sequential number (3 digits, padded with zeros)
 */

import { supabase } from '@/lib/supabase';

export type CountryCode = 'GN' | 'ML' | 'LB';

export interface BatchNumberOptions {
  country: CountryCode;
  date?: Date;
}

/**
 * Get country code from country name
 */
export function getCountryCode(country: string): CountryCode {
  const normalized = country.toLowerCase().trim();

  if (normalized.includes('guin') || normalized === 'guinea') {
    return 'GN';
  }
  if (normalized.includes('mali') || normalized === 'mali') {
    return 'ML';
  }
  if (normalized.includes('liber') || normalized === 'liberia') {
    return 'LB';
  }

  // Default to Guinea if unknown
  return 'GN';
}

/**
 * Generate the next batch number for a given country and month
 */
export async function generateBatchNumber(options: BatchNumberOptions): Promise<string> {
  const { country, date = new Date() } = options;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `${country}-${year}-${month}`;

  try {
    // Query existing batches for this month and country
    const { data, error } = await supabase
      .from('batches')
      .select('batch_number')
      .like('batch_number', `${prefix}%`)
      .order('batch_number', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching batch numbers:', error);
      // If error, start from 001
      return `${prefix}-001`;
    }

    if (!data || data.length === 0) {
      // No existing batches for this month, start from 001
      return `${prefix}-001`;
    }

    // Extract the sequence number from the last batch
    const lastBatchNumber = data[0].batch_number;
    const parts = lastBatchNumber.split('-');

    if (parts.length < 4) {
      // Invalid format, start from 001
      return `${prefix}-001`;
    }

    const lastSequence = parseInt(parts[3], 10);

    if (isNaN(lastSequence)) {
      // Invalid sequence, start from 001
      return `${prefix}-001`;
    }

    // Increment and format
    const nextSequence = String(lastSequence + 1).padStart(3, '0');
    return `${prefix}-${nextSequence}`;

  } catch (error) {
    console.error('Error generating batch number:', error);
    // Fallback to 001 on any error
    return `${prefix}-001`;
  }
}

/**
 * Validate a batch number format
 */
export function validateBatchNumber(batchNumber: string): boolean {
  // Format: CC-YYYY-MM-XXX
  const pattern = /^(GN|ML|LB)-\d{4}-(0[1-9]|1[0-2])-\d{3}$/;
  return pattern.test(batchNumber);
}

/**
 * Parse a batch number into its components
 */
export function parseBatchNumber(batchNumber: string): {
  country: CountryCode;
  year: number;
  month: number;
  sequence: number;
} | null {
  if (!validateBatchNumber(batchNumber)) {
    return null;
  }

  const parts = batchNumber.split('-');

  return {
    country: parts[0] as CountryCode,
    year: parseInt(parts[1], 10),
    month: parseInt(parts[2], 10),
    sequence: parseInt(parts[3], 10),
  };
}

/**
 * Get display name for country code
 */
export function getCountryName(code: CountryCode): string {
  const names: Record<CountryCode, string> = {
    GN: 'Guinea',
    ML: 'Mali',
    LB: 'Liberia',
  };
  return names[code] || code;
}

/**
 * Format batch number for display with country name
 */
export function formatBatchNumberDisplay(batchNumber: string): string {
  const parsed = parseBatchNumber(batchNumber);
  if (!parsed) {
    return batchNumber;
  }

  const countryName = getCountryName(parsed.country);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthName = monthNames[parsed.month - 1];

  return `${batchNumber} (${countryName}, ${monthName} ${parsed.year})`;
}
