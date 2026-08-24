import { describe, expect, it } from 'vitest';
import {
  autoriserDocumentWorkflow,
  parseMetadonneesDocumentExpedition,
  parseMetadonneesDocumentProduction,
} from './workflow-document-upload-policy.ts';

const ACTOR = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const PARENT = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const TENANT = '30d25b87-c4bf-4ca6-9582-6a736be3ba8c';

describe('métadonnées fermées des documents métier', () => {
  it('accepte uniquement les champs Shipping attendus', () => {
    expect(parseMetadonneesDocumentExpedition({
      fileName: 'packing.pdf', shippingPreparationId: PARENT, title: 'Packing list',
    })).toEqual({ fileName: 'packing.pdf', shippingPreparationId: PARENT, title: 'Packing list' });
    expect(parseMetadonneesDocumentExpedition({
      fileName: 'packing.pdf', shippingPreparationId: PARENT, title: 'Packing list', bucket: 'public',
    })).toBeNull();
  });

  it('accepte uniquement les champs Production attendus', () => {
    expect(parseMetadonneesDocumentProduction({
      fileName: 'rapport.pdf', productionId: PARENT, documentName: 'Rapport journalier',
    })).toEqual({ fileName: 'rapport.pdf', productionId: PARENT, documentName: 'Rapport journalier' });
    expect(parseMetadonneesDocumentProduction({
      fileName: 'rapport.pdf', productionId: 'invalide', documentName: 'Rapport journalier',
    })).toBeNull();
  });
});

describe('autoriserDocumentWorkflow', () => {
  const contexte = {
    actorId: ACTOR,
    parentId: PARENT,
    tenantId: TENANT,
    activeSession: true,
    aal2: true,
    parentExists: true,
    parentPermission: true,
    hasWriteCapability: true,
  };

  it('retourne uniquement acteur et tenant vérifiés', () => {
    expect(autoriserDocumentWorkflow(contexte)).toEqual({ actorId: ACTOR, tenantId: TENANT });
  });

  it.each([
    { activeSession: false }, { aal2: false }, { parentExists: false },
    { parentPermission: false }, { hasWriteCapability: false }, { tenantId: 'invalide' },
  ])('échoue fermé si une preuve manque: %o', (override) => {
    expect(autoriserDocumentWorkflow({ ...contexte, ...override })).toBeNull();
  });
});
