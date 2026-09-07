// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
import { affiliationService } from './affiliationService';
describe('Paiement des droits d’affiliation', () => {
  beforeEach(() => vi.clearAllMocks());
  it('transmet les informations requises sans réduire le contrôle serveur', async () => {
    const args = { p_id: 'receipt', p_droit: 'dues', p_montant: 100, p_reference: 'REF-01', p_mode: 'cash', p_date: '2026-09-06', p_annee: 2026, p_lieu: 'Ouagadougou', p_preuve: 'member/dues/receipt.pdf' };
    mocks.rpc.mockResolvedValue({ data: { id: 'receipt', statut: 'en_attente' }, error: null });
    expect(await affiliationService.recordReceipt(args)).toEqual({ id: 'receipt', statut: 'en_attente' });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_enregistrer_adhesion_encaissement', args);
  });
  it('ne valide pas un dépôt si le serveur retourne la preuve d’un autre paiement', async () => {
    const file = new File(['%PDF-1.7'], 'proof.pdf', { type: 'application/pdf' });
    mocks.invoke.mockResolvedValue({ data: { proof: { path: 'member/other/receipt.pdf', file_size: file.size, mime_type: file.type, sha256: 'a'.repeat(64) } }, error: null });
    await expect(affiliationService.uploadPaymentProof(file, 'dues', 'receipt')).rejects.toThrow('preuve');
  });
  it('refuse les formats ou tailles non autorisés avant le réseau', async () => {
    await expect(affiliationService.uploadPaymentProof(new File(['script'], 'proof.svg', { type: 'image/svg+xml' }), 'dues', 'receipt')).rejects.toThrow('PDF');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('remonte le refus métier explicite sans annoncer le paiement réussi', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Joignez une preuve de paiement vérifiée pour ce dossier.' } });
    await expect(affiliationService.recordReceipt({ p_id: 'r', p_droit: 'd', p_montant: 100, p_reference: 'REF', p_mode: 'cash', p_date: '2026-09-06', p_annee: 2026, p_lieu: 'Ouaga', p_preuve: 'bad' })).rejects.toThrow('preuve de paiement vérifiée');
  });
});
