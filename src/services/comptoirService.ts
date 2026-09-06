import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { createPrivateSignedUrl } from "@/lib/privateStorage";
import { UPLOAD_POLICIES, validateUploadFile } from "@/lib/uploadValidation";
import {
  emptyComptoir,
  COMPTOIR_DOCUMENT_KINDS,
  type ComptoirValues,
  type ComptoirDocumentKind,
} from "@/lib/comptoirDossier";
import { uploadSensitiveFile } from "./sensitiveUploadGateway";
import type { Json } from "@/types/database";

const documentSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  kind: z.enum([
    "logo",
    "rccm",
    "ifu",
    "purchase_authorization",
    "representative_identity",
    "representative_photo",
    "other",
  ]),
  file_name: z.string(),
  path: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  sha256: z.string(),
  uploaded_at: z.string(),
});
const recordSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  version: z.number().int().nonnegative(),
  organization_updated_at: z.string(),
  updated_at: z.string(),
  values: z.record(z.string(), z.string()),
  documents: z.array(documentSchema),
});
export type ComptoirDocument = z.infer<typeof documentSchema>;
export interface ComptoirRecord extends Omit<
  z.infer<typeof recordSchema>,
  "values"
> {
  values: ComptoirValues;
}
export interface PendingComptoirDocument {
  id: string;
  kind: ComptoirDocumentKind;
  file: File;
  error?: string;
}
function parseRecord(value: unknown): ComptoirRecord {
  const parsed = recordSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "Le serveur a renvoyé un dossier incomplet. Actualisez la page avant de continuer.",
    );
  const row = parsed.data;
  const values = emptyComptoir();
  for (const key of Object.keys(values) as Array<keyof ComptoirValues>)
    if (row.values[key] !== undefined) values[key] = row.values[key];
  return { ...row, values };
}
type ComptoirRpc =
  | "snp_list_comptoir_dossiers"
  | "snp_save_comptoir_dossier"
  | "snp_archive_comptoir_document";
async function rpc(name: ComptoirRpc, args: Record<string, Json> = {}) {
  const call = supabase.rpc.bind(supabase) as unknown as (
    name: ComptoirRpc,
    args: Record<string, Json>,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
  const { data, error } = await call(name, args);
  if (error)
    throw new Error(
      error.code === "23505"
        ? "Ce RCCM ou cet IFU est déjà associé à un autre comptoir."
        : error.message,
    );
  return data;
}
export const comptoirService = {
  async list() {
    const data = await rpc("snp_list_comptoir_dossiers");
    return z.array(z.unknown()).parse(data).map(parseRecord);
  },
  async get(id: string) {
    const data = z
      .array(z.unknown())
      .parse(await rpc("snp_list_comptoir_dossiers", { p_id: id }));
    if (data.length !== 1)
      throw new Error("Comptoir introuvable ou inaccessible.");
    return parseRecord(data[0]);
  },
  async save(
    values: ComptoirValues,
    id: string,
    previous: ComptoirRecord | undefined,
    requestId: string,
  ) {
    return parseRecord(
      await rpc("snp_save_comptoir_dossier", {
        p_id: id,
        p_values: values,
        p_expected_version: previous?.version ?? 0,
        p_expected_organization_updated_at:
          previous?.organization_updated_at ?? null,
        p_request_id: requestId,
      }),
    );
  },
  async upload(organizationId: string, document: PendingComptoirDocument) {
    const image = COMPTOIR_DOCUMENT_KINDS.find(
      (d) => d.value === document.kind,
    )?.image;
    const checked = validateUploadFile(
      document.file,
      image ? UPLOAD_POLICIES.artisanPhoto : UPLOAD_POLICIES.artisanDocument,
    );
    const result = documentSchema.parse(
      await uploadSensitiveFile(
        "comptoir-document",
        document.file,
        {
          fileName: document.file.name,
          organizationId,
          uploadId: document.id,
          documentKind: document.kind,
        },
        { mimeType: checked.mimeType },
      ),
    );
    if (
      result.id !== document.id ||
      result.organization_id !== organizationId ||
      result.kind !== document.kind
    )
      throw new Error("La pièce enregistrée ne correspond pas à ce dossier.");
    return result;
  },
  url(document: ComptoirDocument) {
    return createPrivateSignedUrl("comptoir-dossiers", document.path);
  },
  async removeDocument(id: string) {
    await rpc("snp_archive_comptoir_document", { p_id: id });
  },
};
