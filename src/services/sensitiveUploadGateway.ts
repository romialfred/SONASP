import { supabase } from '@/lib/supabase';

export type SensitiveUploadProfile =
  | 'mining-company-document'
  | 'assay-certificate'
  | 'shipping-document'
  | 'production-document';

export class SensitiveUploadGatewayError extends Error {
  constructor() {
    super('SENSITIVE_UPLOAD_REJECTED');
    this.name = 'SensitiveUploadGatewayError';
  }
}

function encodeMetadata(metadata: Record<string, unknown>): string {
  const encoded = encodeURIComponent(JSON.stringify(metadata));
  if (encoded.length === 0 || encoded.length > 2_048) throw new SensitiveUploadGatewayError();
  return encoded;
}

/**
 * Client binaire minimal du gateway. Le navigateur ne fournit jamais de chemin
 * Storage et ne reçoit aucune clé privilégiée ; le profil choisi est une valeur
 * fermée du code applicatif.
 */
export async function uploadSensitiveFile(
  profile: SensitiveUploadProfile,
  file: File,
  metadata: Record<string, unknown>,
  options: { mimeType: string; signal?: AbortSignal },
): Promise<unknown> {
  const encodedMetadata = encodeMetadata(metadata);
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonymousKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!accessToken || !baseUrl || !anonymousKey) throw new SensitiveUploadGatewayError();

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/functions/v1/sensitive-upload?profile=${encodeURIComponent(profile)}`,
      {
        method: 'POST',
        signal: options.signal,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonymousKey,
          'Content-Type': options.mimeType,
          'X-Upload-Metadata': encodedMetadata,
        },
        body: file,
      },
    );
  } catch {
    throw new SensitiveUploadGatewayError();
  }

  if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    throw new SensitiveUploadGatewayError();
  }
  const payload = await response.json().catch(() => null) as {
    success?: unknown;
    validationStatus?: unknown;
    resource?: unknown;
  } | null;
  if (
    payload?.success !== true
    || payload.validationStatus !== 'format_validated'
    || !payload.resource
  ) throw new SensitiveUploadGatewayError();
  return payload.resource;
}
