import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLITIQUE_DOCUMENT_SOCIETE_MINIERE } from '../_shared/secure-upload.ts';
import {
  createSensitiveUploadHandler,
  type DependancesGatewayUpload,
  type MetadonneesUpload,
} from './handler.ts';

const ORIGIN = 'https://sonasp.data-univers.com';
const TOKEN = 'a'.repeat(40);
const COMPANY_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const PDF = new TextEncoder().encode('%PDF-1.7\ncontenu\n%%EOF');

function parseMetadata(raw: unknown): MetadonneesUpload | null {
  if (!raw || typeof raw !== 'object') return null;
  const object = raw as Record<string, unknown>;
  return typeof object.fileName === 'string' && typeof object.companyId === 'string'
    ? object as MetadonneesUpload
    : null;
}

function deps(maxBytes = POLITIQUE_DOCUMENT_SOCIETE_MINIERE.maxBytes): DependancesGatewayUpload {
  return {
    profiles: {
      'mining-company-document': {
        policy: { ...POLITIQUE_DOCUMENT_SOCIETE_MINIERE, maxBytes },
        parseMetadata,
      },
    },
    authorize: vi.fn().mockResolvedValue({ allowed: true, actorId: 'actor-1', tenantId: COMPANY_ID }),
    persist: vi.fn().mockResolvedValue({ id: 'document-1' }),
  };
}

function request(
  body: BodyInit = PDF,
  metadata?: Record<string, unknown>,
  headers: Record<string, string> = {},
): Request {
  const effectiveMetadata = metadata ?? { fileName: 'preuve.pdf', companyId: COMPANY_ID };
  return new Request('https://project.supabase.co/functions/v1/sensitive-upload?profile=mining-company-document', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/pdf',
      'X-Upload-Metadata': encodeURIComponent(JSON.stringify(effectiveMetadata)),
      ...headers,
    },
    body,
  });
}

describe('sensitive-upload handler', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: vi.fn(() => undefined) } });
  });

  it('refuse une origine hors allowlist avant authentification', async () => {
    const dependencies = deps();
    const response = await createSensitiveUploadHandler(dependencies)(request(PDF, undefined, {
      Origin: 'https://evil.example',
    }));
    expect(response.status).toBe(403);
    expect(dependencies.authorize).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('autorise côté serveur avant de lire et persister le contenu', async () => {
    const dependencies = deps();
    vi.mocked(dependencies.authorize).mockResolvedValue({ allowed: false, status: 403 });
    const response = await createSensitiveUploadHandler(dependencies)(request());

    expect(response.status).toBe(403);
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('refuse les profils ambigus ou les paramètres additionnels', async () => {
    const dependencies = deps();
    const ambiguous = request();
    const response = await createSensitiveUploadHandler(dependencies)(new Request(
      `${ambiguous.url}&profile=mining-company-document&bucket=public`,
      { method: 'POST', headers: ambiguous.headers, body: PDF },
    ));

    expect(response.status).toBe(400);
    expect(dependencies.authorize).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('rejette un contenu dont les magic bytes contredisent le MIME et l’extension', async () => {
    const dependencies = deps();
    const response = await createSensitiveUploadHandler(dependencies)(request('MZ executable'));

    expect(response.status).toBe(415);
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('borne le flux même en l’absence de Content-Length fiable', async () => {
    const dependencies = deps(8);
    const response = await createSensitiveUploadHandler(dependencies)(request(new Uint8Array(64)));

    expect(response.status).toBe(413);
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('persiste seulement le tenant et l’acteur issus de l’autorisation serveur', async () => {
    const dependencies = deps();
    const response = await createSensitiveUploadHandler(dependencies)(request());
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      success: true,
      validationStatus: 'format_validated',
      resource: { id: 'document-1' },
    });
    expect(dependencies.persist).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-1',
      tenantId: COMPANY_ID,
      file: expect.objectContaining({ mimeType: 'application/pdf', extension: 'pdf' }),
    }));
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(await new Response(JSON.stringify(payload)).text()).not.toContain(TOKEN);
  });

  it('masque toute erreur interne de persistance', async () => {
    const dependencies = deps();
    vi.mocked(dependencies.persist).mockRejectedValue(new Error('bucket SQL path secret detail'));
    const response = await createSensitiveUploadHandler(dependencies)(request());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).not.toContain('bucket SQL path secret detail');
    expect(text).not.toContain(TOKEN);
  });
});
