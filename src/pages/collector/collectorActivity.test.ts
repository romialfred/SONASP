import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectorActivityService,
  summarizeCollectorActivity,
  type CollectorActivitySale,
} from "@/services/collectorActivityService";
const mock = vi.hoisted(() => ({
  range: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mock.from } }));
const sale: CollectorActivitySale = {
  id: "sale-a",
  date_vente: "2026-09-06",
  quantite_grammes: 25,
  montant_brut_fcfa: 1000000,
  tva_montant_fcfa: 180000,
  taxe_dev_comm_montant_fcfa: 10000,
  statut: "validee",
  collection: { collector_id: "collector-a", status: "approved" },
};
beforeEach(() => {
  vi.resetAllMocks();
  const chain = {
    select: mock.select,
    eq: mock.eq,
    order: () => chain,
    range: mock.range,
  };
  mock.from.mockReturnValue(chain);
  mock.select.mockReturnValue(chain);
  mock.eq.mockReturnValue(chain);
});
describe("Activité du collecteur", () => {
  it("compte les déclarations mais exclut les refus, annulations et autres collecteurs des montants", () => {
    const rows = [
      sale,
      { ...sale, id: "paid", statut: "payee" },
      { ...sale, collection: { ...sale.collection, status: "submitted" } },
      { ...sale, collection: { ...sale.collection, status: "rejected" } },
      { ...sale, statut: "annulee" },
      { ...sale, collection: { ...sale.collection, collector_id: "other" } },
    ];
    expect(summarizeCollectorActivity(rows, "collector-a")).toMatchObject({
      declarations: 5,
      approved: 2,
      pending: 1,
      rejected: 1,
      cancelled: 1,
      paid: 1,
      turnover: 2000000,
      taxes: 380000,
      quantity: 50,
    });
  });
  it("distingue une taxe inconnue d’une taxe nulle", () => {
    expect(
      summarizeCollectorActivity(
        [{ ...sale, tva_montant_fcfa: null }],
        "collector-a",
      ).taxes,
    ).toBeNull();
    expect(
      summarizeCollectorActivity(
        [{ ...sale, tva_montant_fcfa: 0, taxe_dev_comm_montant_fcfa: 0 }],
        "collector-a",
      ).taxes,
    ).toBe(0);
  });
  it("lit toutes les pages autorisées et filtre sur le collecteur au serveur", async () => {
    const page = Array.from({ length: 500 }, (_, i) => ({
      ...sale,
      id: String(i),
    }));
    mock.range
      .mockResolvedValueOnce({ data: page, count: 501, error: null })
      .mockResolvedValueOnce({ data: [sale], count: 501, error: null });
    expect(
      (await collectorActivityService.get("collector-a")).declarations,
    ).toBe(501);
    expect(mock.eq).toHaveBeenCalledWith(
      "collection.collector_id",
      "collector-a",
    );
    expect(mock.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
  it("propage les erreurs serveur au lieu d’un bilan vide", async () => {
    mock.range.mockResolvedValue({
      data: null,
      error: { message: "Accès refusé" },
      count: null,
    });
    await expect(collectorActivityService.get("collector-a")).rejects.toThrow(
      "Accès refusé",
    );
  });
  it("refuse un chargement partiel", async () => {
    mock.range.mockResolvedValue({ data: [], error: null, count: 2 });
    await expect(collectorActivityService.get("collector-a")).rejects.toThrow(
      "incomplet",
    );
  });
});
