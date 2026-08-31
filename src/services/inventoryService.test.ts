import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addInventoryEntry, checkInventorySufficient } from './inventoryService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

describe('inventoryService.addInventoryEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confie atomiquement l’entrée et la transition de l’expédition au serveur', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'inventory-1' }, error: null });

    const result = await addInventoryEntry({
      entry_date: '2026-08-29',
      freight_shipment_id: '11111111-1111-4111-8111-111111111111',
      weight_before_melting_grams: 1_010,
      weight_after_melting_grams: 1_000,
      fineness_percentage: 99.9,
      metal_retained_percentage: 100,
      transaction_type: 'entry',
      certificate_number: 'CERT-001',
    });

    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_register_gold_inventory_entry', {
      p_freight_shipment_id: '11111111-1111-4111-8111-111111111111',
      p_weight_before_melting_grams: 1_010,
      p_weight_after_melting_grams: 1_000,
      p_fineness_percentage: 99.9,
      p_metal_retained_percentage: 100,
      p_silver_percentage: 0,
      p_processing_location: '',
      p_certificate_number: 'CERT-001',
      p_notes: '',
    });
  });

  it('ne tente aucune écriture cliente de repli en cas de conflit', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'Cette expédition possède déjà une entrée incompatible.' },
    });

    const result = await addInventoryEntry({
      entry_date: '2026-08-29',
      freight_shipment_id: '11111111-1111-4111-8111-111111111111',
      weight_before_melting_grams: 1_010,
      weight_after_melting_grams: 1_000,
      fineness_percentage: 99.9,
      metal_retained_percentage: 100,
      transaction_type: 'entry',
    });

    expect(result.success).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('refuse localement une entrée sans expédition au lieu d’envoyer un UUID vide', async () => {
    const result = await addInventoryEntry({
      entry_date: '2026-08-29',
      weight_before_melting_grams: 1_010,
      weight_after_melting_grams: 1_000,
      fineness_percentage: 99.9,
      metal_retained_percentage: 100,
      transaction_type: 'entry',
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('expédition traitée');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('n’appelle plus les anciennes RPC d’allocation absentes du schéma', async () => {
    await expect(checkInventorySufficient(10)).resolves.toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
