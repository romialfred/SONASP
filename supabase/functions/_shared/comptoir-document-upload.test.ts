// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  parseComptoirDocument,
  comptoirDocumentAccess,
  persistComptoirDocument,
} from "./comptoir-document-upload";
import {
  POLITIQUE_DOCUMENT_ARTISAN,
  validerUploadServeur,
} from "./secure-upload";
const id = "11111111-1111-4111-8111-111111111111";
const metadata = {
  fileName: "rccm.pdf",
  organizationId: id,
  uploadId: id,
  documentKind: "rccm",
};
const token = "header." + btoa(JSON.stringify({ aal: "aal2" })) + ".verified";
const bytes = new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF");
const context = {
  profileId: "comptoir-document",
  actorId: id,
  tenantId: id,
  metadata,
  token,
  bytes,
  file: validerUploadServeur(
    { fileName: metadata.fileName, declaredMimeType: "application/pdf", bytes },
    POLITIQUE_DOCUMENT_ARTISAN,
  ),
};
function fixture() {
  const objects = new Map<string, Uint8Array>();
  let row: Record<string, unknown> | null = null;
  let fail = false,
    ambiguous = false,
    allowed = true,
    revoke = false;
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
        if (revoke) allowed = false;
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
      paths.forEach((p) => objects.delete(p));
      return { error: null };
    }),
  };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  const admin = {
    storage: { from: () => bucket },
    from: () => query,
    rpc: vi.fn(
      async (
        name: string,
        args: { p_document: Record<string, unknown>; p_actor_id: string },
      ) => {
        expect(name).toBe("snp_register_comptoir_document_gateway");
        expect(args.p_actor_id).toBe(id);
        if (!fail || ambiguous) row = args.p_document;
        return { data: row, error: fail ? new Error("response_lost") : null };
      },
    ),
  };
  const client = {
    rpc: vi.fn(async (name: string) => ({
      data:
        name === "snp_session_signaler_activite"
          ? { is_active: allowed }
          : allowed,
      error: null,
    })),
  };
  return {
    bucket,
    objects,
    admin,
    client,
    persist: (input = context) =>
      persistComptoirDocument(admin as never, client as never, input),
    setFail: (a: boolean, b = false) => {
      fail = a;
      ambiguous = b;
    },
    revokeAfterUpload: () => {
      revoke = true;
    },
  };
}
describe("Dépôt privé des justificatifs Comptoir", () => {
  it("accepte les types documentaires demandés et refuse les paramètres de stockage fournis par le navigateur", () => {
    for (const kind of [
      "logo",
      "rccm",
      "ifu",
      "purchase_authorization",
      "representative_identity",
      "representative_photo",
      "other",
    ])
      expect(
        parseComptoirDocument({ ...metadata, documentKind: kind }),
      ).not.toBeNull();
    for (const patch of [
      { path: "public/path" },
      { organizationId: "invalide" },
      { documentKind: "secret" },
      { fileName: "../rccm.pdf" },
    ])
      expect(parseComptoirDocument({ ...metadata, ...patch })).toBeNull();
  });
  it("refuse une session sans AAL2 avant toute consultation", async () => {
    const f = fixture();
    expect(await comptoirDocumentAccess(f.client as never, "invalid", id)).toBe(
      false,
    );
    expect(f.client.rpc).not.toHaveBeenCalled();
  });
  it("refuse un rattachement différent avant de déposer le fichier", async () => {
    const f = fixture();
    await expect(
      f.persist({ ...context, tenantId: "another" }),
    ).rejects.toThrow("document_forbidden");
    expect(f.objects.size).toBe(0);
  });
  it("contrôle les octets PDF au lieu de faire confiance à l’extension", async () => {
    const f = fixture();
    await expect(
      f.persist({
        ...context,
        bytes: new TextEncoder().encode("<script>fake PDF</script>"),
      }),
    ).rejects.toThrow();
    expect(f.objects.size).toBe(0);
  });
  it("interdit un PDF à la place du logo ou de la photo", async () => {
    for (const kind of ["logo", "representative_photo"]) {
      const f = fixture();
      await expect(
        f.persist({
          ...context,
          metadata: { ...metadata, documentKind: kind },
        }),
      ).rejects.toThrow();
      expect(f.objects.size).toBe(0);
    }
  });
  it("enregistre le propriétaire et le condensat puis reprend une requête identique sans doublon", async () => {
    const f = fixture();
    const first = await f.persist();
    expect(await f.persist()).toEqual(first);
    expect(first).toMatchObject({
      organization_id: id,
      kind: "rccm",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(f.objects.size).toBe(1);
  });
  it("refuse un nouveau contenu au même identifiant", async () => {
    const f = fixture();
    await f.persist();
    await expect(
      f.persist({
        ...context,
        bytes: new TextEncoder().encode("%PDF-1.7\nautre\n%%EOF"),
      }),
    ).rejects.toThrow("document_upload_failed");
    expect(f.objects.size).toBe(1);
  });
  it("compense un transfert lorsque le serveur refuse les métadonnées", async () => {
    const f = fixture();
    f.setFail(true);
    await expect(f.persist()).rejects.toThrow("document_registration_failed");
    expect(f.objects.size).toBe(0);
    f.setFail(false);
    await f.persist();
    expect(f.objects.size).toBe(1);
  });
  it("conserve un document enregistré quand la réponse réseau est perdue", async () => {
    const f = fixture();
    f.setFail(true, true);
    await expect(f.persist()).rejects.toThrow("document_registration_failed");
    expect(f.objects.size).toBe(1);
    expect(f.bucket.remove).not.toHaveBeenCalled();
    f.setFail(false);
    await f.persist();
    expect(f.objects.size).toBe(1);
  });
  it("prend en compte une révocation intervenant pendant le transfert", async () => {
    const f = fixture();
    f.revokeAfterUpload();
    await expect(f.persist()).rejects.toThrow("document_registration_failed");
    expect(f.objects.size).toBe(0);
    expect(f.admin.rpc).not.toHaveBeenCalled();
  });
});
