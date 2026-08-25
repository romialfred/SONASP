import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FreightLegacyDocumentsDisabledError,
  FREIGHT_LEGACY_DOCUMENTS_ENABLED,
  freightDocumentService,
} from './freightDocumentService';

describe('freightDocumentService legacy — fermeture de sécurité', () => {
  it('publie explicitement son état fail-closed pour l’interface', () => {
    expect(FREIGHT_LEGACY_DOCUMENTS_ENABLED).toBe(false);
  });

  it('refuse tout nouveau dépôt avant le réseau', async () => {
    await expect(freightDocumentService.uploadPDF(
      new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' }),
      'invoice.pdf',
      '9b3fcaaa-9367-4c91-a82d-788f043f33f1',
    )).rejects.toBeInstanceOf(FreightLegacyDocumentsDisabledError);
  });

  it('refuse la génération groupée tant que le contrat serveur manque', async () => {
    await expect(freightDocumentService.generateAllDocuments(
      '9b3fcaaa-9367-4c91-a82d-788f043f33f1',
      {} as never,
      {} as never,
    )).rejects.toBeInstanceOf(FreightLegacyDocumentsDisabledError);
  });

  it('ne contient plus d’upload, URL publique ou DML freight_shipments', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/freightDocumentService.ts'),
      'utf8',
    );
    expect(source).not.toContain('.storage');
    expect(source).not.toContain('.getPublicUrl(');
    expect(source).not.toContain(".from('freight_shipments')");
  });
});
