import { describe, expect, it } from 'vitest';
import {
  autoriserDocumentSociete,
  parseMetadonneesDocumentSociete,
} from './company-document-upload-policy.ts';

const COMPANY_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';

const base = {
  actorId: 'actor-1',
  assurance: 'aal2' as const,
  actorActive: true,
  actorMiningCompanyId: null,
  capabilities: new Set(['sonasp.prepare']),
  targetCompanyId: 'company-1',
  targetCompanyActive: true,
};

describe('autoriserDocumentSociete', () => {
  it('renvoie le tenant cible validé pour un acteur interne AAL2 habilité', () => {
    expect(autoriserDocumentSociete(base)).toEqual({ actorId: 'actor-1', tenantId: 'company-1' });
  });

  it.each([
    { actorActive: false },
    { assurance: 'aal1' as const },
    { actorMiningCompanyId: 'company-2' },
    { capabilities: new Set<string>() },
    { targetCompanyActive: false },
  ])('échoue fermé si le contexte ne respecte pas le cloisonnement: %o', (override) => {
    expect(autoriserDocumentSociete({ ...base, ...override })).toBeNull();
  });

  it('accepte aussi la capacité dédiée aux référentiels', () => {
    expect(autoriserDocumentSociete({
      ...base,
      capabilities: new Set(['referentials.manage']),
    })).not.toBeNull();
  });
});

describe('parseMetadonneesDocumentSociete', () => {
  it('n’accepte que le schéma fermé attendu', () => {
    expect(parseMetadonneesDocumentSociete({
      companyId: COMPANY_ID,
      documentType: 'autorisation',
      fileName: 'permis.pdf',
    })).toEqual({
      companyId: COMPANY_ID,
      documentType: 'autorisation',
      fileName: 'permis.pdf',
    });
  });

  it.each([
    null,
    [],
    { companyId: 'company-1', documentType: 'autorisation', fileName: 'permis.pdf' },
    { companyId: COMPANY_ID, documentType: 'malware', fileName: 'permis.pdf' },
    { companyId: COMPANY_ID, documentType: 'autorisation', fileName: '' },
    { companyId: COMPANY_ID, documentType: 'autorisation', fileName: 'permis.pdf', bucket: 'public' },
  ])('rejette les métadonnées ambiguës ou extensibles: %o', (metadata) => {
    expect(parseMetadonneesDocumentSociete(metadata)).toBeNull();
  });
});
