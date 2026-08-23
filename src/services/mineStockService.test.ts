import { describe, expect, it } from 'vitest';
import { calculateMineExportableStock } from './mineStockService';

describe('reliquat exportable d’une mine', () => {
  it('soustrait uniquement les achats et ventes qui immobilisent réellement le stock', () => {
    const stock = calculateMineExportableStock(
      [
        { estimated_oz: 100, status: 'prepared' },
        { estimated_oz: 20, status: 'cancelled' },
      ],
      [
        { quantite_oz: 35, statut: 'validee' },
        { quantite_oz: 9, statut: 'annulee' },
      ],
      [
        { quantity_oz: 15, status: 'pending_management_approval' },
        { quantity_oz: 7, status: 'management_rejected' },
      ]
    );

    expect(stock).toMatchObject({
      productionOz: 100,
      purchasedBySonaspOz: 35,
      soldByMineOz: 15,
      availableOz: 50,
      overAllocated: false,
    });
  });

  it('ne présente jamais un disponible négatif et signale la surallocation', () => {
    const stock = calculateMineExportableStock(
      [{ estimated_oz: 10, status: 'prepared' }],
      [{ quantite_oz: 12, statut: 'payee' }],
      [{ quantity_oz: 2, status: 'completed' }]
    );
    expect(stock.availableOz).toBe(0);
    expect(stock.availableGrams).toBe(0);
    expect(stock.overAllocated).toBe(true);
  });
});
