import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import artisanPaiementsService, {
  ArtisanPaymentConflictError,
  createArtisanPaymentIdempotencyKey,
} from './artisanPaiementsService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

const KEY = '10000000-0000-4000-8000-000000000001';
const common = { idempotency_key: KEY, replayed: false, processed_at: '2026-08-25T12:00:00Z' };

const invoiceResult = {
  ...common,
  invoice_id: '20000000-0000-4000-8000-000000000001',
  sale_id: '30000000-0000-4000-8000-000000000001',
  invoice_number: 'FAC-2026-0001', invoice_status: 'emise', invoice_version: 1,
  sale_status: 'validee', sale_payment_status: 'facture_emise', sale_version: 4,
  gross_amount: 1_000_000, vat_amount: 180_000, withholding_amount: 15_000,
  other_tax_amount: 0, total_taxes: 195_000, net_payable: 805_000, tax_policy_version: 'BF-2026',
};

const paymentResult = {
  ...common,
  payment_id: '40000000-0000-4000-8000-000000000001',
  invoice_id: invoiceResult.invoice_id, sale_id: invoiceResult.sale_id,
  artisan_id: '50000000-0000-4000-8000-000000000001',
  payment_reference: 'PAY-2026-0001', payment_status: 'en_attente', payment_version: 1,
  invoice_status: 'en_paiement', invoice_version: 2,
  sale_status: 'validee', sale_payment_status: 'en_paiement', sale_version: 5,
  amount_paid: 805_000, taxes_withheld: 195_000,
  payment_method_id: '60000000-0000-4000-8000-000000000001', payment_type: 'virement_bancaire',
};

describe('artisanPaiementsService — frontière RPC 4I', () => {
  beforeEach(() => vi.clearAllMocks());

  it('émet facture et vente atomiquement sans montant, taxe, statut ni acteur client', async () => {
    mocks.rpc.mockResolvedValue({ data: invoiceResult, error: null });

    await expect(artisanPaiementsService.emettreFacture({
      saleId: invoiceResult.sale_id,
      expectedSaleStatus: 'validee',
      expectedSaleVersion: 3,
      idempotencyKey: KEY,
      notes: '  Dossier contrôlé  ',
    })).resolves.toEqual(invoiceResult);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_artisan_emettre_facture', {
      p_vente_id: invoiceResult.sale_id,
      p_expected_vente_statut: 'validee',
      p_expected_vente_version: 3,
      p_idempotency_key: KEY,
      p_date_echeance: null,
      p_notes: 'Dossier contrôlé',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('crée le paiement depuis la facture et le moyen serveur, sans coordonnées ni montants forgés', async () => {
    mocks.rpc.mockResolvedValue({ data: paymentResult, error: null });

    await artisanPaiementsService.creerPaiement({
      invoiceId: paymentResult.invoice_id,
      expectedInvoiceStatus: 'emise',
      expectedInvoiceVersion: 1,
      paymentMethodId: paymentResult.payment_method_id,
      idempotencyKey: KEY,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('snp_artisan_creer_paiement', {
      p_facture_id: paymentResult.invoice_id,
      p_expected_facture_statut: 'emise',
      p_expected_facture_version: 1,
      p_moyen_paiement_id: paymentResult.payment_method_id,
      p_idempotency_key: KEY,
      p_notes: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('transmet état/version/idempotence pour le double contrôle et accepte un rejeu serveur', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...paymentResult, payment_status: 'valide', payment_version: 3, replayed: true },
      error: null,
    });

    await expect(artisanPaiementsService.transitionPaiement({
      paymentId: paymentResult.payment_id,
      expectedStatus: 'en_traitement',
      expectedVersion: 2,
      newStatus: 'valide',
      idempotencyKey: KEY,
    })).resolves.toMatchObject({ payment_status: 'valide', replayed: true });

    expect(mocks.rpc).toHaveBeenCalledWith('snp_artisan_transition_paiement', {
      p_paiement_id: paymentResult.payment_id,
      p_expected_statut: 'en_traitement', p_expected_version: 2,
      p_nouveau_statut: 'valide', p_idempotency_key: KEY, p_notes: null,
    });
  });

  it('délègue le reversement fiscal sans date ni acteur navigateur', async () => {
    const taxResult = {
      ...common,
      tax_id: '70000000-0000-4000-8000-000000000001', payment_id: paymentResult.payment_id,
      invoice_id: invoiceResult.invoice_id, sale_id: invoiceResult.sale_id,
      tax_type: 'tva', tax_status: 'reverse', tax_version: 3,
      remittance_reference: 'DGI-2026-0042',
    };
    mocks.rpc.mockResolvedValue({ data: taxResult, error: null });

    await artisanPaiementsService.transitionTaxe({
      taxId: taxResult.tax_id,
      expectedStatus: 'en_cours', expectedVersion: 2, newStatus: 'reverse',
      idempotencyKey: KEY, remittanceReference: '  DGI-2026-0042  ',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('snp_artisan_transition_reversement_taxe', {
      p_taxe_id: taxResult.tax_id, p_expected_statut: 'en_cours', p_expected_version: 2,
      p_nouveau_statut: 'reverse', p_idempotency_key: KEY,
      p_reversement_reference: 'DGI-2026-0042', p_notes: null,
    });
  });

  it('convertit le conflit 40001 et propage les refus AAL2/tenant/SoD sans fallback', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'Conflit optimiste.' } });
    await expect(artisanPaiementsService.emettreFacture({
      saleId: invoiceResult.sale_id, expectedSaleStatus: 'validee', expectedSaleVersion: 3,
      idempotencyKey: KEY,
    })).rejects.toBeInstanceOf(ArtisanPaymentConflictError);

    const denied = { code: '42501', message: 'Double contrôle requis.' };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: denied });
    await expect(artisanPaiementsService.transitionPaiement({
      paymentId: paymentResult.payment_id, expectedStatus: 'en_traitement', expectedVersion: 2,
      newStatus: 'valide', idempotencyKey: KEY,
    })).rejects.toBe(denied);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('refuse localement les sauts de statut et les reversements sans référence', async () => {
    await expect(artisanPaiementsService.transitionPaiement({
      paymentId: paymentResult.payment_id, expectedStatus: 'en_attente', expectedVersion: 1,
      newStatus: 'complete', idempotencyKey: KEY,
    })).rejects.toThrow('Transition de paiement interdite');
    await expect(artisanPaiementsService.transitionTaxe({
      taxId: '70000000-0000-4000-8000-000000000001', expectedStatus: 'en_cours',
      expectedVersion: 2, newStatus: 'reverse', idempotencyKey: KEY,
    })).rejects.toThrow('référence de reversement');
    await expect(artisanPaiementsService.creerPaiement({
      invoiceId: paymentResult.invoice_id, expectedInvoiceStatus: 'emise',
      expectedInvoiceVersion: Number.NaN, paymentMethodId: paymentResult.payment_method_id,
      idempotencyKey: KEY,
    })).rejects.toThrow('version serveur');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuse une réponse qui ne confirme pas état, version et clé de rejeu', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...paymentResult, payment_status: 'en_traitement' }, error: null });
    await expect(artisanPaiementsService.creerPaiement({
      invoiceId: paymentResult.invoice_id, expectedInvoiceStatus: 'emise', expectedInvoiceVersion: 1,
      paymentMethodId: paymentResult.payment_method_id, idempotencyKey: KEY,
    })).rejects.toThrow("n'a pas confirmé");
  });

  it('ne conserve aucun ancien générateur, calcul fiscal client ou DML de mutation', () => {
    const source = readFileSync(`${process.cwd()}/src/services/artisanPaiementsService.ts`, 'utf8');
    const invoicePage = readFileSync(`${process.cwd()}/src/pages/artisan-minier/FactureVente.tsx`, 'utf8');
    expect(source).not.toMatch(/generer_numero_facture|generer_reference_paiement|calculer_taxes_vente/);
    expect(source).not.toMatch(/\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
    expect(invoicePage).not.toMatch(/certifierFactureDgi|p_document_path|Chemin du justificatif/);
  });

  it('génère la clé d’idempotence avec le CSPRNG navigateur', () => {
    const randomUUID = vi.fn(() => KEY);
    vi.stubGlobal('crypto', { randomUUID });
    expect(createArtisanPaymentIdempotencyKey()).toBe(KEY);
    expect(randomUUID).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
