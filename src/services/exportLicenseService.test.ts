import { describe, expect, it } from 'vitest';
import {
  normalizeExportLicenseQuota,
  type ExportLicense,
} from './exportLicenseService';

const license = (overrides: Partial<ExportLicense> = {}): ExportLicense => ({
  id: 'license-1',
  license_number: 'EXP-SOPAMIB-2026-001',
  mining_company_id: 'mine-1',
  request_date: '2026-01-01',
  start_date: '2026-01-02',
  end_date: '2026-12-30',
  issuing_institution: 'Ministère chargé des Mines',
  authorized_quantity_grams: 5_000_000,
  used_quantity_grams: 0,
  remaining_quantity_grams: 5_000_000,
  average_sale_price: null,
  status: 'active',
  comments: null,
  notes: null,
  created_at: '2026-08-24T06:03:20Z',
  updated_at: '2026-08-24T06:03:20Z',
  created_by: null,
  updated_by: null,
  ...overrides,
});

describe('reliquat des licences d’exportation', () => {
  it('recalcule un reliquat NULL à partir du volume autorisé et consommé', () => {
    const normalized = normalizeExportLicenseQuota(license({
      used_quantity_grams: 125_000,
      remaining_quantity_grams: null as unknown as number,
    }));

    expect(normalized.remaining_quantity_grams).toBe(4_875_000);
  });

  it('conserve un reliquat stocké lorsqu’il est disponible', () => {
    const normalized = normalizeExportLicenseQuota(license({
      used_quantity_grams: 125_000,
      remaining_quantity_grams: 4_800_000,
    }));

    expect(normalized.remaining_quantity_grams).toBe(4_800_000);
  });

  it('ne présente jamais un reliquat négatif', () => {
    const normalized = normalizeExportLicenseQuota(license({
      authorized_quantity_grams: 100,
      used_quantity_grams: 120,
      remaining_quantity_grams: null as unknown as number,
    }));

    expect(normalized.remaining_quantity_grams).toBe(0);
  });
});
