// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  parseArtisanDocument,
  artisanDocumentAccess,
  persistArtisanDocument,
  removeArtisanDocument,
} from "./artisan-document-upload";
import {
  POLITIQUE_DOCUMENT_ARTISAN,
  POLITIQUE_PHOTO_ARTISAN,
  validerUploadServeur,
} from "./secure-upload";
const id = "11111111-1111-4111-8111-111111111111";
const metadata = {
  artisanId: id,
  uploadId: id,
  fileName: "cnib.pdf",
  ownerKind: "artisan",
  responsableId: null,
  documentType: "cni",
  title: "Recto",
};
describe("frontière du dépôt documentaire artisan", () => {
  it("valide le propriétaire et ferme les métadonnées", () => {
    expect(parseArtisanDocument(metadata)).toEqual(metadata);
    expect(parseArtisanDocument({ ...metadata, bucket: "public" })).toBeNull();
    expect(
      parseArtisanDocument({ ...metadata, ownerKind: "responsable" }),
    ).toBeNull();
    expect(
      parseArtisanDocument({
        ...metadata,
        ownerKind: "societe",
        documentType: "rccm",
      }),
    ).not.toBeNull();
    expect(
      parseArtisanDocument({
        ...metadata,
        ownerKind: "societe",
        documentType: "photo",
      }),
    ).toBeNull();
  });
  it("vérifie la signature réelle et la taille maximale de chaque type", () => {
    expect(() =>
      validerUploadServeur(
        {
          fileName: "f.pdf",
          declaredMimeType: "application/pdf",
          bytes: new Uint8Array([1, 2, 3]),
        },
        POLITIQUE_DOCUMENT_ARTISAN,
      ),
    ).toThrow();
    expect(POLITIQUE_PHOTO_ARTISAN.maxBytes).toBe(2 * 1024 * 1024);
    expect(() =>
      validerUploadServeur(
        {
          fileName: "f.png",
          declaredMimeType: "image/png",
          bytes: new Uint8Array(5 * 1024 * 1024 + 1),
        },
        POLITIQUE_DOCUMENT_ARTISAN,
      ),
    ).toThrow();
  });
  it("refuse une assurance insuffisante avant toute consultation", async () => {
    const client = {
      rpc: () => {
        throw new Error("Ne doit pas être consulté");
      },
    };
    expect(await artisanDocumentAccess(client as never, "invalid", id)).toBe(
      false,
    );
  });
});
const token = "header." + btoa(JSON.stringify({ aal: "aal2" })) + ".verified";
const bytes = new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF");
const context = {
  profileId: "artisan-document",
  actorId: id,
  tenantId: id,
  metadata,
  token,
  bytes,
  file: validerUploadServeur(
    { fileName: "cnib.pdf", declaredMimeType: "application/pdf", bytes },
    POLITIQUE_DOCUMENT_ARTISAN,
  ),
};
function gatewayFixture() {
  const objects = new Map<string, Uint8Array>();
  let document: Record<string, unknown> | null = null;
  let failRegister = false;
  let ambiguousRegister = false;
  let failDelete = false;
  let allowed = true;
  const bucket = {
    upload: vi.fn(
      async (
        path: string,
        content: Uint8Array,
        options: { upsert: boolean },
      ) => {
        expect(options.upsert).toBe(false);
        if (objects.has(path)) return { error: new Error("exists") };
        objects.set(path, content);
        return { error: null };
      },
    ),
    download: vi.fn(async (path: string) => ({
      data: objects.has(path)
        ? new Blob([new Uint8Array(objects.get(path)!).buffer])
        : null,
      error: objects.has(path) ? null : new Error("missing"),
    })),
    remove: vi.fn(async (paths: string[]) => {
      paths.forEach((path) => objects.delete(path));
      return { error: null };
    }),
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: document, error: null })),
  };
  const admin = {
    storage: { from: vi.fn(() => bucket) },
    from: vi.fn(() => query),
    rpc: vi.fn(async () => {
      if (failDelete) return { error: new Error("transaction_failed") };
      document = { ...document, deleted_at: "2026-09-06T12:00:00Z" };
      return { data: document.chemin_fichier, error: null };
    }),
  };
  const client = {
    rpc: vi.fn(
      async (name: string, args?: { p_document: Record<string, unknown> }) => {
        if (name === "snp_session_signaler_activite")
          return { data: { is_active: true }, error: null };
        if (name === "snp_artisan_document_allowed")
          return { data: allowed, error: null };
        if (name !== "snp_register_artisan_document" || !args)
          throw new Error("Unexpected RPC");
        if (!failRegister || ambiguousRegister) document = args.p_document;
        return {
          data: document,
          error: failRegister ? new Error("network_failure") : null,
        };
      },
    ),
  };
  return {
    admin,
    client,
    objects,
    bucket,
    setAllowed: (value: boolean) => {
      allowed = value;
    },
    setRegisterFailure: (value: boolean, ambiguous = false) => {
      failRegister = value;
      ambiguousRegister = ambiguous;
    },
    setDeleteFailure: (value: boolean) => {
      failDelete = value;
    },
    persist: () =>
      persistArtisanDocument(admin as never, client as never, context),
    remove: () =>
      removeArtisanDocument(admin as never, client as never, token, id, id),
    document: () => document,
  };
}
describe("dépôt privé : reprises et compensation", () => {
  it("reprend la même pièce sans écraser ni dupliquer son objet", async () => {
    const f = gatewayFixture();
    const first = await f.persist();
    expect(await f.persist()).toEqual(first);
    expect(f.objects.size).toBe(1);
    expect(f.bucket.download).toHaveBeenCalledTimes(1);
  });
  it("refuse un contenu différent sous le même identifiant", async () => {
    const f = gatewayFixture();
    await f.persist();
    const altered = {
      ...context,
      bytes: new TextEncoder().encode("%PDF-1.7\nautre\n%%EOF"),
    };
    await expect(
      persistArtisanDocument(f.admin as never, f.client as never, altered),
    ).rejects.toThrow("document_upload_failed");
    expect(f.objects.size).toBe(1);
  });
  it("compense le fichier lorsque sa métadonnée est définitivement absente", async () => {
    const f = gatewayFixture();
    f.setRegisterFailure(true);
    await expect(f.persist()).rejects.toThrow("document_registration_failed");
    expect(f.objects.size).toBe(0);
    f.setRegisterFailure(false);
    await f.persist();
    expect(f.objects.size).toBe(1);
  });
  it("conserve une réussite dont la réponse réseau a été perdue", async () => {
    const f = gatewayFixture();
    f.setRegisterFailure(true, true);
    await expect(f.persist()).rejects.toThrow("document_registration_failed");
    expect(f.objects.size).toBe(1);
    expect(f.bucket.remove).not.toHaveBeenCalled();
    f.setRegisterFailure(false);
    await f.persist();
    expect(f.document()?.id).toBe(id);
  });
  it("restaure le fichier si la suppression des métadonnées échoue", async () => {
    const f = gatewayFixture();
    await f.persist();
    f.setDeleteFailure(true);
    await expect(f.remove()).rejects.toThrow("metadata_delete_failed");
    expect(f.objects.size).toBe(1);
    expect(f.document()?.deleted_at).toBeUndefined();
    f.setDeleteFailure(false);
    await f.remove();
    expect(f.objects.size).toBe(0);
    expect(f.document()?.deleted_at).toBeTruthy();
    await f.remove();
    expect(f.bucket.remove).toHaveBeenCalledTimes(2);
  });
  it("refuse une suppression hors périmètre sans toucher au fichier", async () => {
    const f = gatewayFixture();
    await f.persist();
    f.setAllowed(false);
    await expect(f.remove()).rejects.toThrow("document_forbidden");
    expect(f.bucket.remove).not.toHaveBeenCalled();
  });
});
