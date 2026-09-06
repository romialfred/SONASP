import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import type { ContextePersistanceUpload } from "../sensitive-upload/handler.ts";
import { niveauAssurance } from "./assurance.ts";
import {
  POLITIQUE_DOCUMENT_ARTISAN,
  POLITIQUE_PHOTO_ARTISAN,
  validerUploadServeur,
} from "./secure-upload.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ComptoirDocumentMetadata = Record<string, unknown> & {
  fileName: string;
  organizationId: string;
  uploadId: string;
  documentKind: string;
};
export function parseComptoirDocument(
  raw: unknown,
): ComptoirDocumentMetadata | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as ComptoirDocumentMetadata;
  if (
    Object.keys(m).length !== 4 ||
    !Object.keys(m).every((k) =>
      ["fileName", "organizationId", "uploadId", "documentKind"].includes(k),
    ) ||
    typeof m.fileName !== "string" ||
    !m.fileName.trim() ||
    m.fileName.length > 250 ||
    /[/\\]/.test(m.fileName) ||
    !UUID.test(m.organizationId) ||
    !UUID.test(m.uploadId) ||
    ![
      "logo",
      "rccm",
      "ifu",
      "purchase_authorization",
      "representative_identity",
      "representative_photo",
      "other",
    ].includes(m.documentKind)
  )
    return null;
  return m;
}
export async function comptoirDocumentAccess(
  client: SupabaseClient,
  token: string,
  organizationId: string,
) {
  if (niveauAssurance(token) !== "aal2") return false;
  const [session, access] = await Promise.all([
    client.rpc("snp_session_signaler_activite"),
    client.rpc("snp_comptoir_document_allowed", {
      p_organization_id: organizationId,
    }),
  ]);
  return (
    !session.error &&
    session.data?.is_active === true &&
    !access.error &&
    access.data === true
  );
}
const bucket = "comptoir-dossiers";
const hash = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export async function persistComptoirDocument(
  admin: SupabaseClient,
  client: SupabaseClient,
  input: ContextePersistanceUpload,
) {
  const m = parseComptoirDocument(input.metadata);
  if (
    !m ||
    m.organizationId !== input.tenantId ||
    !(await comptoirDocumentAccess(client, input.token, m.organizationId))
  )
    throw new Error("document_forbidden");
  validerUploadServeur(
    {
      fileName: m.fileName,
      declaredMimeType: input.file.mimeType,
      bytes: input.bytes,
    },
    ["logo", "representative_photo"].includes(m.documentKind)
      ? POLITIQUE_PHOTO_ARTISAN
      : POLITIQUE_DOCUMENT_ARTISAN,
  );
  const path = `${m.organizationId}/${m.uploadId}.${input.file.extension}`;
  const sha256 = await hash(input.bytes);
  const upload = await admin.storage
    .from(bucket)
    .upload(path, input.bytes, {
      contentType: input.file.mimeType,
      upsert: false,
      cacheControl: "0",
    });
  if (upload.error) {
    const previous = await admin.storage.from(bucket).download(path);
    if (
      previous.error ||
      !previous.data ||
      previous.data.size !== input.bytes.length ||
      (await hash(new Uint8Array(await previous.data.arrayBuffer()))) !== sha256
    )
      throw new Error("document_upload_failed");
  }
  // Réévaluation après le transfert : révocation de session prise en compte.
  const stillAllowed = await comptoirDocumentAccess(
    client,
    input.token,
    m.organizationId,
  );
  const result = stillAllowed
    ? await admin.rpc("snp_register_comptoir_document_gateway", {
        p_actor_id: input.actorId,
        p_document: {
          id: m.uploadId,
          organization_id: m.organizationId,
          kind: m.documentKind,
          file_name: input.file.safeFileName,
          path,
          mime_type: input.file.mimeType,
          size_bytes: input.bytes.length,
          sha256,
        },
      })
    : { data: null, error: { message: "document_forbidden" } };
  if (result.error) {
    // Ne retire jamais une pièce existante après une réponse réseau perdue.
    const existing = await admin
      .from("snp_comptoir_documents")
      .select("id")
      .eq("id", m.uploadId)
      .maybeSingle();
    if (!existing.error && !existing.data && !upload.error) {
      const cleanup = await admin.storage.from(bucket).remove([path]);
      if (cleanup.error)
        console.error(
          "[comptoir-document] Compensation du dépôt indisponible.",
        );
    }
    throw new Error("document_registration_failed");
  }
  return result.data;
}
