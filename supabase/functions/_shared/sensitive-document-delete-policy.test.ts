import { describe, expect, it } from 'vitest';
import {
  autoriserSuppressionDocumentSensible,
  cheminObjetLieAuParent,
  normaliserReferenceObjetStorage,
} from './sensitive-document-delete-policy.ts';

const ACTOR = '271124cb-b8cd-43be-9c31-b7f5ed9ca24e';
const PARENT = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';

describe('politique de suppression documentaire sensible', () => {
  it('exige session active, AAL2, parent, tenant, capability et propriétaire', () => {
    const base = {
      actorId: ACTOR,
      parentId: PARENT,
      tenantId: PARENT,
      uploadedBy: ACTOR,
      activeSession: true,
      aal2: true,
      parentExists: true,
      parentPermission: true,
      hasWriteCapability: true,
      mayDeleteAnyUploader: false,
      mutable: true,
    };
    expect(autoriserSuppressionDocumentSensible(base)).toBe(true);
    expect(autoriserSuppressionDocumentSensible({ ...base, aal2: false })).toBe(false);
    expect(autoriserSuppressionDocumentSensible({ ...base, parentPermission: false })).toBe(false);
    expect(autoriserSuppressionDocumentSensible({ ...base, uploadedBy: null })).toBe(false);
    expect(autoriserSuppressionDocumentSensible({
      ...base, uploadedBy: null, mayDeleteAnyUploader: true,
    })).toBe(true);
  });

  it('normalise une ancienne URL publique sans effectuer de requête', () => {
    const url = `https://project.supabase.co/storage/v1/object/public/shipping-documents/shipping-documents/${PARENT}/document.pdf?download=1`;
    expect(normaliserReferenceObjetStorage(url, 'shipping-documents'))
      .toBe(`${PARENT}/document.pdf`);
  });

  it('refuse traversal, bucket étranger et objet hors parent', () => {
    expect(cheminObjetLieAuParent(`${PARENT}/format-validated/2026/08/doc.pdf`, 'shipping-documents', PARENT))
      .toBe(`${PARENT}/format-validated/2026/08/doc.pdf`);
    expect(cheminObjetLieAuParent(`${PARENT}/%2e%2e/secret.pdf`, 'shipping-documents', PARENT)).toBeNull();
    expect(cheminObjetLieAuParent(`${ACTOR}/doc.pdf`, 'shipping-documents', PARENT)).toBeNull();
    expect(normaliserReferenceObjetStorage(
      `https://project.supabase.co/storage/v1/object/public/other/${PARENT}/doc.pdf`,
      'shipping-documents',
    )).toBeNull();
  });
});
