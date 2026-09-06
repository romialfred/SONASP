import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectionNotificationHandler } from "./handler";
const saleId = "55555555-5555-4555-8555-555555555555";
const jobs = [
  {
    id: "mail",
    lease: "lease",
    to: "fixture@example.test",
    title: "Décision",
    message: "Approuvée",
  },
];
const send = vi.fn(),
  finish = vi.fn(),
  claim = vi.fn(),
  allowed = vi.fn(),
  prepare = vi.fn();
const handler = collectionNotificationHandler({ allowed, prepare });
const request = (body: unknown = { sale_id: saleId }, headers = {}) =>
  new Request("https://example.test", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + "x".repeat(30),
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  allowed.mockResolvedValue(true);
  claim.mockResolvedValue(jobs);
  send.mockResolvedValue(undefined);
  finish.mockResolvedValue(undefined);
  prepare.mockResolvedValue({ claim, send, finish });
});
describe("Notifications de collecte", () => {
  it("refuse les appels anonymes avant tout accès privilégié", async () => {
    expect(
      (await handler(request(undefined, { Authorization: "" }))).status,
    ).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("refuse une origine inconnue", async () => {
    expect(
      (await handler(request(undefined, { Origin: "https://foreign.example" })))
        .status,
    ).toBe(403);
    expect(allowed).not.toHaveBeenCalled();
  });
  it("refuse un destinataire injecté dans la requête", async () => {
    expect(
      (await handler(request({ sale_id: saleId, to: "foreign@example.test" })))
        .status,
    ).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("refuse une vente hors périmètre", async () => {
    allowed.mockResolvedValue(false);
    expect((await handler(request())).status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("envoie uniquement les messages loués pour cette vente", async () => {
    expect(await (await handler(request())).json()).toEqual({
      sent: 1,
      failed: 0,
    });
    expect(claim).toHaveBeenCalledWith(saleId);
    expect(send).toHaveBeenCalledWith(jobs[0]);
    expect(finish).toHaveBeenCalledWith(jobs[0], true);
  });
  it("enregistre un échec sans prétendre avoir livré", async () => {
    send.mockRejectedValue(new Error("smtp"));
    expect(await (await handler(request())).json()).toEqual({
      sent: 0,
      failed: 1,
    });
    expect(finish).toHaveBeenCalledWith(jobs[0], false);
  });
  it("ne réclame aucun message si la configuration manque", async () => {
    prepare.mockRejectedValue(new Error("config"));
    expect((await handler(request())).status).toBe(503);
    expect(claim).not.toHaveBeenCalled();
  });
  it("un rejeu sans message disponible ne renvoie aucun courriel", async () => {
    claim.mockResolvedValue([]);
    expect(await (await handler(request())).json()).toEqual({
      sent: 0,
      failed: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
