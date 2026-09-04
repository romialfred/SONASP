import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

import {
  calculateSaleCreationSummary,
  normalizeSaleWorkspaceError,
  quantityToOunces,
  saveSaleDraft,
  submitSaleDraft,
  validateSaleCreationInputs,
  type SaleCreationInputs,
} from './saleCreationWorkspaceService';

const inputs: SaleCreationInputs = {
  customerId: 'customer-1',
  sellerId: 'seller-1',
  quantity: 100,
  unit: 'oz',
  proposedPriceUsdOz: 3_000,
  fixingDate: '2026-09-04',
  settlementCurrency: 'USD',
  freightCostUsd: 8_000,
  otherCostsUsd: 2_000,
  fixingMethod: 'spot',
  paymentTermDays: 15,
  customerContractId: 'contract-1',
  inProcessRefineryId: null,
};

describe('saleCreationWorkspaceService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('convertit les grammes avec la constante canonique de l’once troy', () => {
    expect(quantityToOunces(31.1034768, 'g')).toBeCloseTo(1, 10);
    expect(quantityToOunces(12.5, 'oz')).toBe(12.5);
  });

  it('reproduit le calcul serveur : frais puis redevance sur le produit restant', () => {
    const result = calculateSaleCreationSummary(inputs, 3, 600);
    expect(result.grossUsd).toBe(300_000);
    expect(result.costsUsd).toBe(10_000);
    expect(result.royaltyUsd).toBe(8_700);
    expect(result.netUsd).toBe(281_300);
    expect(result.netXof).toBe(168_780_000);
  });

  it('refuse les frais qui absorbent entièrement la valeur commerciale', () => {
    expect(() => calculateSaleCreationSummary({ ...inputs, freightCostUsd: 300_000 }, 3, 600))
      .toThrow('strictement positif');
  });

  it('contrôle le stock, le plafond contractuel et la raffinerie', () => {
    const errors = validateSaleCreationInputs({
      ...inputs,
      quantity: 120,
      fixingMethod: 'in_process',
    }, 150, {
      id: 'contract-1', contractNumber: 'CTR-1', contractType: 'sale', pricingModel: 'LBMA',
      priceAdjustmentPct: null, maximumOrderOz: 100, minimumOrderOz: 10,
      annualVolumeCommitmentOz: null, creditLimitUsd: null, paymentTerms: '15 jours',
      validFrom: '2026-01-01', validUntil: '2026-12-31', status: 'active',
    });
    expect(errors.quantity).toContain('plafond');
    expect(errors.inProcessRefineryId).toContain('raffinerie');
  });

  it('enregistre le brouillon sans appeler directement la table des ventes', async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: 'draft-1', draft_number: 'BRV-2026-000001', version: 1, status: 'draft', submitted_sale_id: null, updated_at: '2026-09-04T12:00:00Z' },
      error: null,
    });
    const result = await saveSaleDraft({
      draftId: null,
      expectedVersion: null,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      inputs,
      snapshot: { stockAvailableOz: 150 },
    });
    expect(result.draftNumber).toBe('BRV-2026-000001');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_enregistrer_brouillon_vente_export', expect.objectContaining({
      p_draft_id: null,
      p_expected_version: null,
      p_payload: inputs,
    }));
  });

  it('soumet le brouillon avec version optimiste et lots normalisés', async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: 'sale-1', sale_number: 'SL-2026-000001', status: 'pending_management_approval', approval_request_id: 'approval-1', replayed: false },
      error: null,
    });
    const lots = [{ source_type: 'achat_mine', source_id: 'lot-1', quantite_oz: 100 }];
    const result = await submitSaleDraft({ draftId: 'draft-1', expectedVersion: 2, lots });
    expect(result.saleNumber).toBe('SL-2026-000001');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_soumettre_brouillon_vente_export', {
      p_draft_id: 'draft-1', p_expected_version: 2, p_lots: lots,
    });
  });

  it('associe les refus structurés au champ concerné', () => {
    expect(normalizeSaleWorkspaceError({ code: '23514', message: 'La quantité dépasse le stock disponible.' }))
      .toEqual({ code: '23514', message: 'La quantité dépasse le stock disponible.', field: 'quantity' });
  });
});
