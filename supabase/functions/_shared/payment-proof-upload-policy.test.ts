import { describe, expect, it } from 'vitest';
import {
  autoriserPreuvePaiement,
  confirmerPersistancePreuvePaiement,
  parseMetadonneesPreuvePaiement,
} from './payment-proof-upload-policy.ts';

const ACTOR = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const PAYMENT = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const SALE = '30d25b87-c4bf-4ca6-9582-6a736be3ba8c';
const TENANT = '4b45f7d9-8761-4a6c-a693-4eb21f08a387';
const IDEMPOTENCY = 'c5a89af5-d524-41ad-8054-7f91a9950fd2';

describe('politique de preuve bancaire privée', () => {
  it('accepte uniquement le schéma fermé sans chemin ni tenant', () => {
    const metadata = {
      fileName: 'preuve-virement.pdf',
      paymentId: PAYMENT,
      idempotencyKey: IDEMPOTENCY,
    };
    expect(parseMetadonneesPreuvePaiement(metadata)).toEqual(metadata);
    expect(parseMetadonneesPreuvePaiement({ ...metadata, filePath: 'public/x.pdf' })).toBeNull();
    expect(parseMetadonneesPreuvePaiement({ ...metadata, paymentId: '../sale' })).toBeNull();
    expect(parseMetadonneesPreuvePaiement({ ...metadata, fileName: 'preuve.pdf.exe' })).toEqual({
      ...metadata,
      fileName: 'preuve.pdf.exe',
    });
  });

  const contexte = {
    actorId: ACTOR,
    paymentId: PAYMENT,
    saleId: SALE,
    tenantId: TENANT,
    activeSession: true,
    aal2: true,
    canExecuteFinance: true,
    canReadSale: true,
    paymentExists: true,
    paymentProcessing: true,
    saleVirtualPayment: true,
    actorExecutedPayment: true,
    paymentMatchesSaleAndTenant: true,
    sellerIsActiveSonasp: true,
  };

  it('dérive le tenant uniquement du parent autoritatif', () => {
    expect(autoriserPreuvePaiement(contexte)).toEqual({ actorId: ACTOR, tenantId: TENANT });
  });

  it.each([
    { activeSession: false }, { aal2: false }, { canExecuteFinance: false },
    { canReadSale: false }, { paymentExists: false }, { paymentProcessing: false },
    { saleVirtualPayment: false }, { actorExecutedPayment: false },
    { paymentMatchesSaleAndTenant: false }, { sellerIsActiveSonasp: false },
  ])('échoue fermé si une preuve d’autorisation manque: %o', (override) => {
    expect(autoriserPreuvePaiement({ ...contexte, ...override })).toBeNull();
  });

  it('nettoie un mauvais fichier recréé puis accepte le rejeu du fichier exact', () => {
    const attendu = {
      paymentId: PAYMENT,
      filePath: `payment-proofs/${PAYMENT}/${IDEMPOTENCY}.pdf`,
      fileName: 'preuve-virement.pdf',
      fileSize: 24,
      mimeType: 'application/pdf',
      sha256: 'a'.repeat(64),
      idempotencyKey: IDEMPOTENCY,
    };
    const metadataCommise = {
      payment_id: PAYMENT,
      file_path: attendu.filePath,
      file_name: attendu.fileName,
      file_size: attendu.fileSize,
      mime_type: attendu.mimeType,
      sha256: attendu.sha256,
      idempotency_key: IDEMPOTENCY,
    };

    expect(confirmerPersistancePreuvePaiement(metadataCommise, {
      ...attendu,
      sha256: 'b'.repeat(64),
    })).toEqual({ certain: true, resource: null });
    expect(confirmerPersistancePreuvePaiement(metadataCommise, attendu)).toEqual({
      certain: true,
      resource: { ...metadataCommise, replayed: true },
    });
    expect(confirmerPersistancePreuvePaiement(undefined, attendu))
      .toEqual({ certain: false, resource: null });
  });
});
