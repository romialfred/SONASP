import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InternationalPaymentConflictError,
  cancelInternationalPayment,
  createPaymentIdempotencyKey,
  decideInternationalPayment,
  executeInternationalPayment,
  getPaymentProofResumptions,
  getPaymentProofUrl,
  paymentProofIdempotencyKey,
  uploadPaymentProof,
} from './paymentService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  uploadSensitiveFile: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

vi.mock('@/services/sensitiveUploadGateway', () => ({
  uploadSensitiveFile: mocks.uploadSensitiveFile,
  SensitiveUploadGatewayError: class SensitiveUploadGatewayError extends Error {},
}));

const execution = {
  payment_id: '10000000-0000-4000-8000-000000000001',
  sale_id: '20000000-0000-4000-8000-000000000001',
  payment_status: 'processing' as const,
  sale_status: 'virtual_payment',
  version: 4,
  idempotency_key: '30000000-0000-4000-8000-000000000001',
  replayed: false,
  processed_at: '2026-08-25T00:00:00Z',
  fx_rate: 655.957,
  fx_rate_date: '2026-08-25',
  fx_rate_source: 'BCEAO',
};

const executionInput = {
  saleId: execution.sale_id,
  expectedSaleStatus: 'waiting_for_payment' as const,
  expectedPaymentVersion: 3,
  paidAmount: 1_000,
  paymentCurrency: ' eur ',
  customerBankId: '40000000-0000-4000-8000-000000000001',
  sellerBankId: '50000000-0000-4000-8000-000000000001',
  paymentDate: '2026-08-25',
  referenceNumber: '  BANK-2026-0001 ',
  transactionId: '  TX-42 ',
  notes: '  Reçu bancaire contrôlé  ',
  idempotencyKey: execution.idempotency_key,
};

describe('paymentService — frontière RPC 4H', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  });

  it('exécute le paiement sans DML, acteur, statut, FX ni preuve forgés', async () => {
    mocks.rpc.mockResolvedValue({ data: execution, error: null });

    await expect(executeInternationalPayment(executionInput)).resolves.toEqual(execution);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_paiement_international_executer', {
      p_sale_id: execution.sale_id,
      p_expected_sale_status: 'waiting_for_payment',
      p_expected_payment_version: 3,
      p_paid_amount: 1_000,
      p_payment_currency: 'EUR',
      p_customer_bank_id: executionInput.customerBankId,
      p_seller_bank_id: executionInput.sellerBankId,
      p_payment_date: '2026-08-25',
      p_reference_number: 'BANK-2026-0001',
      p_transaction_id: 'TX-42',
      p_proof_path: null,
      p_notes: 'Reçu bancaire contrôlé',
      p_idempotency_key: execution.idempotency_key,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('accepte le rejeu idempotent confirmé par le serveur', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...execution, replayed: true }, error: null });

    await expect(executeInternationalPayment(executionInput)).resolves.toMatchObject({
      payment_status: 'processing',
      replayed: true,
      idempotency_key: execution.idempotency_key,
    });
  });

  it('convertit SQLSTATE 40001 en conflit métier', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'Conflit optimiste paiement.' },
    });

    await expect(executeInternationalPayment(executionInput))
      .rejects.toBeInstanceOf(InternationalPaymentConflictError);
  });

  it('propage les refus AAL2/capability/SoD sans fallback PostgREST', async () => {
    const denied = { code: '42501', message: 'Double contrôle requis.' };
    mocks.rpc.mockResolvedValue({ data: null, error: denied });

    await expect(decideInternationalPayment({
      paymentId: execution.payment_id,
      expectedVersion: execution.version,
      decision: 'approve',
      reason: 'Pièce bancaire conforme',
      idempotencyKey: '60000000-0000-4000-8000-000000000001',
    })).rejects.toBe(denied);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('délègue le rejet et l’annulation avec versions attendues', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          ...execution,
          payment_status: 'rejected',
          sale_status: 'waiting_for_payment',
          decision: 'reject',
          version: 5,
          idempotency_key: '70000000-0000-4000-8000-000000000001',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ...execution,
          payment_status: 'cancelled',
          sale_status: 'waiting_for_payment',
          version: 5,
          idempotency_key: '80000000-0000-4000-8000-000000000001',
        },
        error: null,
      });

    await decideInternationalPayment({
      paymentId: execution.payment_id,
      expectedVersion: 4,
      decision: 'reject',
      reason: '  Référence bancaire incohérente  ',
      idempotencyKey: '70000000-0000-4000-8000-000000000001',
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'snp_paiement_international_decider', {
      p_payment_id: execution.payment_id,
      p_expected_status: 'processing',
      p_expected_version: 4,
      p_decision: 'reject',
      p_reason: 'Référence bancaire incohérente',
      p_idempotency_key: '70000000-0000-4000-8000-000000000001',
    });

    await cancelInternationalPayment({
      paymentId: execution.payment_id,
      expectedStatus: 'processing',
      expectedVersion: 4,
      reason: '  Virement rappelé par la banque  ',
      idempotencyKey: '80000000-0000-4000-8000-000000000001',
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'snp_paiement_international_annuler', {
      p_payment_id: execution.payment_id,
      p_expected_status: 'processing',
      p_expected_version: 4,
      p_reason: 'Virement rappelé par la banque',
      p_idempotency_key: '80000000-0000-4000-8000-000000000001',
    });
  });

  it('accepte les statuts agrégés des avances et annulations partielles', async () => {
    const approvalKey = '71000000-0000-4000-8000-000000000001';
    const cancellationKey = '81000000-0000-4000-8000-000000000001';
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          ...execution,
          payment_status: 'approved',
          sale_status: 'virtual_payment',
          version: 5,
          idempotency_key: approvalKey,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ...execution,
          payment_status: 'cancelled',
          sale_status: 'virtual_payment',
          version: 6,
          idempotency_key: cancellationKey,
        },
        error: null,
      });

    await expect(decideInternationalPayment({
      paymentId: execution.payment_id,
      expectedVersion: 4,
      decision: 'approve',
      reason: 'Avance bancaire conforme',
      idempotencyKey: approvalKey,
    })).resolves.toMatchObject({ sale_status: 'virtual_payment' });

    await expect(cancelInternationalPayment({
      paymentId: execution.payment_id,
      expectedStatus: 'processing',
      expectedVersion: 5,
      reason: 'Annulation partielle justifiée',
      idempotencyKey: cancellationKey,
    })).resolves.toMatchObject({ sale_status: 'virtual_payment' });
  });

  it('refuse une réponse RPC qui ne confirme pas le nouvel état', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...execution, payment_status: 'pending' }, error: null });
    await expect(executeInternationalPayment(executionInput)).rejects.toThrow('n’a pas confirmé');
  });

  it('génère une clé de rejeu avec le CSPRNG du navigateur', () => {
    const randomUUID = vi.fn(() => '90000000-0000-4000-8000-000000000001');
    vi.stubGlobal('crypto', { randomUUID });
    expect(createPaymentIdempotencyKey()).toBe('90000000-0000-4000-8000-000000000001');
    expect(randomUUID).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('dépose la preuve par le profil privé fermé sans DML ni URL publique', async () => {
    const proofKey = '60000000-0000-4000-8000-000000000001';
    const file = new File(['%PDF-1.7\n%%EOF'], 'preuve.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000001',
      payment_id: execution.payment_id,
      sale_id: execution.sale_id,
      customer_id: '80000000-0000-4000-8000-000000000001',
      file_path: `payment-proofs/${execution.payment_id}/${proofKey}.pdf`,
      file_name: 'preuve.pdf',
      file_size: file.size,
      mime_type: 'application/pdf',
      sha256: 'a'.repeat(64),
      idempotency_key: proofKey,
      uploaded_by: '90000000-0000-4000-8000-000000000001',
      created_at: '2026-08-25T00:00:00Z',
      replayed: false,
    });

    await expect(uploadPaymentProof(file, execution.payment_id, proofKey))
      .resolves.toMatchObject({ success: true, data: { payment_id: execution.payment_id } });
    expect(mocks.uploadSensitiveFile).toHaveBeenCalledWith(
      'international-payment-proof',
      file,
      { fileName: 'preuve.pdf', paymentId: execution.payment_id, idempotencyKey: proofKey },
      { mimeType: 'application/pdf' },
    );
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });

  it('refuse une confirmation gateway qui change le paiement ou le chemin', async () => {
    const proofKey = '60000000-0000-4000-8000-000000000001';
    mocks.uploadSensitiveFile.mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000001',
      payment_id: '80000000-0000-4000-8000-000000000001',
      sale_id: execution.sale_id,
      customer_id: '90000000-0000-4000-8000-000000000001',
      file_path: 'https://public.example/forged.pdf',
      file_name: 'preuve.pdf', file_size: 12, mime_type: 'application/pdf',
      sha256: 'b'.repeat(64), idempotency_key: proofKey,
      uploaded_by: '90000000-0000-4000-8000-000000000001',
      created_at: '2026-08-25T00:00:00Z', replayed: false,
    });
    const result = await uploadPaymentProof(
      new File(['%PDF-1.7\n%%EOF'], 'preuve.pdf', { type: 'application/pdf' }),
      execution.payment_id,
      proofKey,
    );
    expect(result.success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('ouvre la preuve exclusivement par une URL signée courte du bucket privé', async () => {
    const path = `payment-proofs/${execution.payment_id}/60000000-0000-4000-8000-000000000001.pdf`;
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://project.supabase.co/storage/v1/object/sign/payment-proofs/private' },
      error: null,
    });
    await expect(getPaymentProofUrl(path)).resolves.toContain('/object/sign/payment-proofs/');
    expect(mocks.storageFrom).toHaveBeenCalledWith('payment-proofs');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      `${execution.payment_id}/60000000-0000-4000-8000-000000000001.pdf`,
      300,
    );
  });

  it('liste les reprises par RPC sans accepter acteur ni payment_id client', async () => {
    const proofKey = '60000000-0000-4000-8000-000000000001';
    mocks.rpc.mockResolvedValue({
      data: [{
        payment_id: execution.payment_id,
        sale_id: execution.sale_id,
        sale_number: 'VENTE-001',
        customer_id: '80000000-0000-4000-8000-000000000001',
        amount: 1_000,
        currency: 'USD',
        payment_version: 4,
        reference_number: 'BANK-001',
        executed_at: '2026-08-25T00:00:00Z',
        proof_path: `payment-proofs/${execution.payment_id}/${proofKey}.pdf`,
        proof_idempotency_key: proofKey,
        proof_file_name: 'preuve.pdf',
      }],
      error: null,
    });

    await expect(getPaymentProofResumptions()).resolves.toMatchObject({
      success: true,
      data: [{ payment_id: execution.payment_id, proof_idempotency_key: proofKey }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_paiements_preuve_reprise_lister');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('refuse une reprise dont le chemin ne correspond pas au paiement serveur', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        payment_id: execution.payment_id,
        sale_id: execution.sale_id,
        sale_number: 'VENTE-001',
        customer_id: '80000000-0000-4000-8000-000000000001',
        amount: 1_000,
        currency: 'USD',
        payment_version: 4,
        reference_number: null,
        executed_at: '2026-08-25T00:00:00Z',
        proof_path: 'https://legacy.invalid/proof.pdf',
        proof_idempotency_key: '60000000-0000-4000-8000-000000000001',
        proof_file_name: 'preuve.pdf',
      }],
      error: null,
    });
    await expect(getPaymentProofResumptions()).resolves.toMatchObject({ success: false });
  });

  it('extrait une clé seulement d’un chemin canonique lié au paiement attendu', () => {
    const key = '60000000-0000-4000-8000-000000000001';
    expect(paymentProofIdempotencyKey(
      `payment-proofs/${execution.payment_id}/${key}.pdf`,
      execution.payment_id,
    )).toBe(key);
    expect(paymentProofIdempotencyKey(
      `payment-proofs/ffffffff-ffff-4fff-8fff-ffffffffffff/${key}.pdf`,
      execution.payment_id,
    )).toBeNull();
    expect(paymentProofIdempotencyKey('https://legacy.invalid/proof.pdf', execution.payment_id)).toBeNull();
  });
});
