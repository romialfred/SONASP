import { describe, expect, it } from 'vitest';
import {
  createSaleInventoryTransactions,
  validateInventoryForSale,
} from './inventoryTransactionService';

describe('inventoryTransactionService historique', () => {
  it('refuse toute écriture cliente hors du workflow canonique', async () => {
    await expect(
      createSaleInventoryTransactions('sale-1','seller-1','mining_company','customer-1',10),
    ).resolves.toMatchObject({ success: false, error: expect.stringMatching(/atomique/) });
  });

  it('ne prétend jamais qu’un solde d’entité inexistant est suffisant', async () => {
    await expect(validateInventoryForSale('seller-1','mining_company',10)).resolves.toMatchObject({
      valid: false,
      availableOz: 0,
    });
  });
});
