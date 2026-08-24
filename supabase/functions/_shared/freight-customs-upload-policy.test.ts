import { describe, expect, it } from 'vitest';
import { autoriserDocumentFret, parseMetadonneesDocumentFret } from './freight-customs-upload-policy.ts';

const ACTOR = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const OPERATION = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const TENANT = '30d25b87-c4bf-4ca6-9582-6a736be3ba8c';

describe('politique upload fret', () => {
  it('accepte uniquement le contrat fermé de la RPC 4F', () => {
    const metadata = {
      fileName: 'declaration.pdf', operationId: OPERATION,
      documentType: 'customs_declaration', title: 'Déclaration douanière', description: null,
    };
    expect(parseMetadonneesDocumentFret(metadata)).toEqual(metadata);
    expect(parseMetadonneesDocumentFret({ ...metadata, bucket: 'public' })).toBeNull();
    expect(parseMetadonneesDocumentFret({ ...metadata, documentType: 'executable' })).toBeNull();
  });

  const contexte = {
    actorId: ACTOR, operationId: OPERATION, tenantId: TENANT,
    activeSession: true, aal2: true, operationExists: true,
    tenantReadable: true, canPrepareFreight: true, mutableStatus: true,
  };

  it('dérive le tenant de l’opération autorisée', () => {
    expect(autoriserDocumentFret(contexte)).toEqual({ actorId: ACTOR, tenantId: TENANT });
  });

  it.each([
    { activeSession: false }, { aal2: false }, { operationExists: false },
    { tenantReadable: false }, { canPrepareFreight: false }, { mutableStatus: false },
  ])('échoue fermé si une preuve manque: %o', (override) => {
    expect(autoriserDocumentFret({ ...contexte, ...override })).toBeNull();
  });
});
