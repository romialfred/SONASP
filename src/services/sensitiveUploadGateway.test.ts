import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SensitiveUploadGatewayError,
  uploadSensitiveFile,
} from './sensitiveUploadGateway';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

describe('sensitiveUploadGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co/');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'verified-session-token' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('envoie les octets au gateway sans chemin Storage ni clé privilégiée', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'permis.pdf', { type: 'application/pdf' });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      validationStatus: 'format_validated',
      resource: { id: 'document-1' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    await expect(uploadSensitiveFile(
      'mining-company-document',
      file,
      { companyId: 'company-1', documentType: 'autorisation', fileName: file.name },
      { mimeType: 'application/pdf' },
    )).resolves.toEqual({ id: 'document-1' });

    const [url, options] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(url).toBe('https://project.supabase.co/functions/v1/sensitive-upload?profile=mining-company-document');
    expect(options).toMatchObject({
      method: 'POST',
      body: file,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    expect(headers.get('Authorization')).toBe('Bearer verified-session-token');
    expect(headers.get('apikey')).toBe('public-anon-key');
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(JSON.parse(decodeURIComponent(headers.get('X-Upload-Metadata') ?? ''))).toEqual({
      companyId: 'company-1',
      documentType: 'autorisation',
      fileName: 'permis.pdf',
    });
    expect(JSON.stringify(options)).not.toContain('service_role');
  });

  it('échoue avant le réseau sans session authentifiée', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const file = new File(['x'], 'preuve.pdf', { type: 'application/pdf' });

    await expect(uploadSensitiveFile(
      'mining-company-document',
      file,
      { fileName: file.name },
      { mimeType: 'application/pdf' },
    )).rejects.toBeInstanceOf(SensitiveUploadGatewayError);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('route aussi les certificats d’analyse par le profil fermé dédié', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'analyse.pdf', { type: 'application/pdf' });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      validationStatus: 'format_validated',
      resource: { id: 'certificate-1' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    await uploadSensitiveFile(
      'assay-certificate',
      file,
      { shippingPreparationId: '9b3fcaaa-9367-4c91-a82d-788f043f33f1', fileName: file.name },
      { mimeType: 'application/pdf' },
    );

    expect(mocks.fetch.mock.calls[0][0]).toBe(
      'https://project.supabase.co/functions/v1/sensitive-upload?profile=assay-certificate',
    );
  });

  it('ne propage pas les détails techniques renvoyés par le serveur', async () => {
    const file = new File(['x'], 'preuve.pdf', { type: 'application/pdf' });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: 'storage internal bucket path and SQL constraint',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }));

    const operation = uploadSensitiveFile(
      'mining-company-document',
      file,
      { fileName: file.name },
      { mimeType: 'application/pdf' },
    );
    await expect(operation).rejects.toEqual(expect.objectContaining({ message: 'SENSITIVE_UPLOAD_REJECTED' }));
    await expect(operation).rejects.not.toEqual(expect.objectContaining({
      message: expect.stringContaining('bucket path'),
    }));
  });
});
