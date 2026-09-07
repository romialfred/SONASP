import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ fetch: vi.fn(), response: {} as unknown }));
// Le SDK et sa méthode rpc sont réels. Seul le transport HTTP est isolé.
vi.mock("@/lib/supabase", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://rpc-contract.invalid", "public-test-key", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: http.fetch },
    }),
  };
});
import { collectorService } from "./collectorService";
import { comptoirService } from "./comptoirService";
import { emptyComptoir } from "@/lib/comptoirDossier";
import { addInventoryEntry } from "./inventoryService";
import { createExportSale } from "./saleCreationService";
import { tracabiliteVenteService } from "./tracabiliteVenteService";

describe("liaison des services au véritable client Supabase", () => {
  it("enregistre et relit le comptoir à travers le véritable transport RPC", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const values = {
      ...emptyComptoir(),
      name: "Comptoir QA",
      legal_form: "SARL",
      city: "Ouagadougou",
    };
    const row = {
      id,
      code: "CPT-QA",
      name: values.name,
      values,
      documents: [],
      is_active: true,
      version: 1,
      organization_updated_at: "2026-09-06T12:00:00Z",
      updated_at: "2026-09-06T12:00:00Z",
    };
    http.response = row;
    await expect(
      comptoirService.save(values, id, undefined, id),
    ).resolves.toMatchObject({ id, values });
    const [, options] = http.fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      p_id: id,
      p_values: values,
      p_expected_version: 0,
      p_request_id: id,
    });
    http.response = [row];
    await expect(comptoirService.get(id)).resolves.toMatchObject({
      id,
      version: 1,
    });
  });
  it("refuse une réponse serveur de comptoir incomplète", async () => {
    http.response = [{ id: "not-a-record" }];
    await expect(comptoirService.list()).rejects.toThrow();
  });
  beforeEach(() => {
    http.fetch.mockReset();
    http.response = [];
    http.fetch.mockImplementation(
      async (_url, options) =>
        new Response(JSON.stringify(http.response), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...(new Headers(options?.headers).get("Prefer")?.includes("count=exact")
              ? { "Content-Range": `*/${Array.isArray(http.response) ? http.response.length : 1}` }
              : {}),
          },
        }),
    );
  });
  it("charge les collecteurs et leurs références via PostgREST", async () => {
    await expect(collectorService.list()).resolves.toEqual([]);
    http.response = { sites: [], organizations: [] };
    await expect(collectorService.references()).resolves.toEqual(http.response);
    expect(http.fetch.mock.calls.map(([url]) => String(url).split("?")[0])).toEqual([
      "https://rpc-contract.invalid/rest/v1/rpc/snp_list_collectors",
      "https://rpc-contract.invalid/rest/v1/rpc/snp_collector_references",
    ]);
    const query = new URL(String(http.fetch.mock.calls[0][0])).searchParams;
    expect(query.get("offset")).toBe("0");
    expect(query.get("limit")).toBe("500");
    expect(query.get("order")).toBe("pgrst_scalar->identity->>nom.asc,pgrst_scalar->identity->>prenoms.asc,pgrst_scalar->>id.asc");
  });
  it("transmet un refus serveur sans planter avant la requête", async () => {
    http.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Accès refusé.", code: "42501" }),
        { status: 403 },
      ),
    );
    await expect(collectorService.list()).rejects.toThrow("Votre session actuelle ne permet pas d’effectuer cette opération.");
    expect(http.fetch).toHaveBeenCalledTimes(1);
  });
  it("conserve le contexte pour l’enregistrement de stock", async () => {
    http.response = { id: "entry-test" };
    const result = await addInventoryEntry({
      entry_date: "2026-09-06",
      weight_before_melting_grams: 100,
      weight_after_melting_grams: 99,
      fineness_percentage: 90,
      metal_retained_percentage: 0,
      transaction_type: "entry",
      freight_shipment_id: "shipment-test",
    });
    expect(result.success).toBe(true);
    expect(http.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rpc/snp_register_gold_inventory_entry"),
      expect.anything(),
    );
  });
  it("conserve le contexte pour la création d’une vente", async () => {
    http.response = { id: "sale-test" };
    const result = await createExportSale({
      customerId: "customer-test",
      sellerId: "seller-test",
      quantityOz: 1,
      londonAmRate: 1000,
      freightCost: 0,
      otherCosts: 0,
      lots: [],
      idempotencyKey: "retry-test",
    });
    expect(result.success).toBe(true);
    expect(http.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rpc/snp_creer_vente_export_idempotent"),
      expect.anything(),
    );
  });
  it("conserve le contexte pour consulter les lots éligibles", async () => {
    http.response = {
      lots: [],
      diagnostic: {
        blocked: false,
        code: null,
        historical_gap_count: 0,
        excluded_untraceable_source_count: 0,
        excluded_untraceable_quantity_oz: 0,
      },
    };
    await expect(
      tracabiliteVenteService.lotsDisponibles(),
    ).resolves.toMatchObject({ lots: [] });
    expect(http.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rpc/snp_lots_vente_export_eligibles"),
      expect.anything(),
    );
  });
});
