import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveRequest, approveSale, rejectRequest } from './approvalService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

describe('approvalService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confie une approbation à la transaction serveur sans envoyer le courriel de l’acteur', async () => {
    mocks.rpc.mockResolvedValue({
      data: { request_id: 'req-1', entity_id: 'sale-1', decision: 'approve', status: 'pending_for_customer_approval' },
      error: null,
    });

    const result = await approveRequest('req-1', 'valideur@example.bf', 'Dossier conforme');

    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_decider_approbation', {
      p_demande_id: 'req-1',
      p_decision: 'approve',
      p_motif: 'Dossier conforme',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('refuse localement un rejet sans motif exploitable', async () => {
    const result = await rejectRequest('req-1', 'valideur@example.bf', 'non');

    expect(result).toEqual({
      success: false,
      error: 'Le motif de rejet doit comporter au moins 5 caractères.',
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('ne masque pas un refus du serveur', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Cette demande a déjà reçu une décision.' } });

    const result = await approveRequest('req-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cette demande a déjà reçu une décision.');
  });

  it('résout la demande active avant de décider une vente depuis sa fiche', async () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'req-sale' }, error: null });
    mocks.from.mockReturnValue(builder);
    mocks.rpc.mockResolvedValue({ data: { request_id: 'req-sale' }, error: null });

    const result = await approveSale('sale-1', 'email-non-fiable@example.bf');

    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'snp_decider_approbation',
      expect.objectContaining({ p_demande_id: 'req-sale', p_decision: 'approve' })
    );
  });
});
