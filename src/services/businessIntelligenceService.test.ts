import { describe, expect, it } from 'vitest';
import {
  buildBusinessIntelligenceModel,
  filterBIRecords,
  optionsForDimension,
  type BIDataSnapshot,
  type BIRecord,
} from './businessIntelligenceService';

const record = (overrides: Partial<BIRecord>): BIRecord => ({
  id: 'row-1',
  date: '2026-01-15',
  category: 'production',
  reference: 'REF-1',
  source: 'industriel',
  region: 'Centre-Nord',
  province: 'Sanmatenga',
  siteId: 'site-a',
  siteName: 'Mine A',
  actorId: 'operator-a',
  actorName: 'Opérateur A',
  status: 'Validé',
  quantityOz: 10,
  amount: 0,
  currency: 'FCFA',
  taxes: 0,
  qualityPct: 90,
  ...overrides,
});

const snapshot = (records: BIRecord[]): BIDataSnapshot => ({
  records,
  unavailable: [],
  loadedAt: '2026-08-23T10:00:00.000Z',
});

describe('businessIntelligenceService', () => {
  it('calcule une teneur pondérée par les volumes', () => {
    const model = buildBusinessIntelligenceModel(
      snapshot([
        record({ id: 'light', quantityOz: 10, qualityPct: 80 }),
        record({ id: 'heavy', quantityOz: 30, qualityPct: 100 }),
      ]),
      'production',
    );

    expect(model.averageQualityPct).toBe(95);
    expect(model.totalQuantityOz).toBe(40);
  });

  it('ne mélange pas les devises dans les agrégats financiers', () => {
    const model = buildBusinessIntelligenceModel(
      snapshot([
        record({ id: 'fcfa-1', category: 'sale', amount: 1_000, currency: 'FCFA' }),
        record({ id: 'fcfa-2', category: 'sale', amount: 2_000, currency: 'FCFA' }),
        record({ id: 'usd-1', category: 'sale', amount: 500, currency: 'USD' }),
      ]),
      'sales',
    );

    expect(model.primaryCurrency).toBe('FCFA');
    expect(model.totalAmount).toBe(3_000);
    expect(model.otherCurrencies).toEqual(['USD']);
  });

  it('ne double-compte pas les règlements dans le total institutionnel facturé', () => {
    const model = buildBusinessIntelligenceModel(
      snapshot([
        record({ id: 'invoice', category: 'invoice', amount: 8_000, currency: 'FCFA' }),
        record({ id: 'settlement', category: 'settlement', amount: 6_000, currency: 'FCFA' }),
        record({ id: 'contract', category: 'contract', amount: 0, currency: 'FCFA' }),
      ]),
      'institutional',
    );

    expect(model.totalAmount).toBe(8_000);
    expect(model.operations).toBe(3);
  });

  it('sépare la production nationale des flux de vente dans ses indicateurs', () => {
    const model = buildBusinessIntelligenceModel(
      snapshot([
        record({ id: 'industrial', category: 'production', source: 'industriel', quantityOz: 12 }),
        record({ id: 'semi', category: 'production', source: 'semi-mecanise', quantityOz: 8 }),
        record({ id: 'sale', category: 'sale', quantityOz: 20, amount: 5_000_000, currency: 'FCFA' }),
      ]),
      'national',
    );

    expect(model.totalQuantityOz).toBe(20);
    expect(model.totalAmount).toBe(5_000_000);
    expect(model.operations).toBe(3);
  });

  it('applique les filtres en cascade sans transformer une erreur en zéro', () => {
    const rows = [
      record({ id: 'a', region: 'Centre-Nord', siteId: 'site-a' }),
      record({ id: 'b', region: 'Sahel', siteId: 'site-b', siteName: 'Mine B' }),
    ];

    expect(filterBIRecords(rows, { region: 'Sahel' }).map((item) => item.id)).toEqual(['b']);
    expect(optionsForDimension(rows, 'site')).toEqual([
      { value: 'site-a', label: 'Mine A' },
      { value: 'site-b', label: 'Mine B' },
    ]);
  });

  it('conserve les sources indisponibles dans le modèle de restitution', () => {
    const model = buildBusinessIntelligenceModel(
      { ...snapshot([]), unavailable: ['ventes artisanales'] },
      'national',
    );

    expect(model.totalAmount).toBe(0);
    expect(model.unavailable).toEqual(['ventes artisanales']);
  });
});
