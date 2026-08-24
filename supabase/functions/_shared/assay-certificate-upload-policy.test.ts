import { describe, expect, it } from 'vitest';
import {
  autoriserCertificatAnalyse,
  parseMetadonneesCertificatAnalyse,
} from './assay-certificate-upload-policy.ts';

const ACTOR_ID = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const SHIPPING_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';

describe('parseMetadonneesCertificatAnalyse', () => {
  it('n’accepte que le parent Shipping et le nom du fichier', () => {
    expect(parseMetadonneesCertificatAnalyse({
      shippingPreparationId: SHIPPING_ID,
      fileName: 'analyse.pdf',
    })).toEqual({ shippingPreparationId: SHIPPING_ID, fileName: 'analyse.pdf' });
  });

  it.each([
    null,
    [],
    { shippingPreparationId: 'not-a-uuid', fileName: 'analyse.pdf' },
    { shippingPreparationId: SHIPPING_ID, fileName: '' },
    { shippingPreparationId: SHIPPING_ID, fileName: 'analyse.pdf', uploadedBy: ACTOR_ID },
    { shippingPreparationId: SHIPPING_ID, fileName: 'analyse.pdf', bucket: 'public' },
  ])('rejette les métadonnées ambiguës ou extensibles: %o', (metadata) => {
    expect(parseMetadonneesCertificatAnalyse(metadata)).toBeNull();
  });
});

describe('autoriserCertificatAnalyse', () => {
  const contexte = {
    actorId: ACTOR_ID,
    activeSession: true,
    canPrepareShipping: true,
    shippingPreparationId: SHIPPING_ID,
    targetExists: true,
  };

  it('utilise le parent Shipping autorisé comme tenant Storage', () => {
    expect(autoriserCertificatAnalyse(contexte)).toEqual({
      actorId: ACTOR_ID,
      tenantId: SHIPPING_ID,
    });
  });

  it.each([
    { activeSession: false },
    { canPrepareShipping: false },
    { targetExists: false },
    { actorId: 'not-a-uuid' },
    { shippingPreparationId: 'not-a-uuid' },
  ])('échoue fermé si une preuve serveur manque: %o', (override) => {
    expect(autoriserCertificatAnalyse({ ...contexte, ...override })).toBeNull();
  });
});
