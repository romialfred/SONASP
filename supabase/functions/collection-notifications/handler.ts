import {
  origineAutorisee,
  reponseJson,
  reponsePrevol,
} from "../_shared/cors.ts";
import {
  clesJsonValides,
  extraireJetonBearer,
  lireJsonLimite,
} from "../_shared/admin-account-edge.ts";

export interface CollectionMail {
  id: string;
  lease: string;
  to: string;
  title: string;
  message: string;
}
export interface CollectionMailDependencies {
  allowed: (authorization: string, saleId: string) => Promise<boolean>;
  prepare: () => Promise<{
    claim: (saleId: string) => Promise<CollectionMail[]>;
    send: (mail: CollectionMail) => Promise<void>;
    finish: (mail: CollectionMail, sent: boolean) => Promise<void>;
  }>;
}
export function collectionNotificationHandler(
  deps: CollectionMailDependencies,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return reponsePrevol(req);
    if (req.headers.get("Origin") && !origineAutorisee(req))
      return reponseJson(req, { error: "Origine non autorisée." }, 403);
    if (req.method !== "POST")
      return reponseJson(req, { error: "Méthode non autorisée." }, 405);
    const token = extraireJetonBearer(req);
    if (!token)
      return reponseJson(req, { error: "Authentification requise." }, 401);
    let body: Record<string, unknown> | null;
    try {
      body = await lireJsonLimite(req, 1024);
    } catch {
      return reponseJson(req, { error: "Requête invalide." }, 400);
    }
    if (
      !clesJsonValides(body, ["sale_id"], ["sale_id"]) ||
      typeof body.sale_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.sale_id,
      )
    )
      return reponseJson(req, { error: "Vente invalide." }, 400);
    try {
      if (!(await deps.allowed(`Bearer ${token}`, body.sale_id)))
        return reponseJson(
          req,
          { error: "Accès à cette vente non autorisé." },
          403,
        );
      // Configuration is checked before leasing. Recipients never come from the request.
      const delivery = await deps.prepare();
      const jobs = await delivery.claim(body.sale_id);
      let sent = 0,
        failed = 0;
      for (const job of jobs) {
        let delivered = false;
        try {
          await delivery.send(job);
          delivered = true;
          sent++;
        } catch {
          failed++;
        }
        await delivery.finish(job, delivered);
      }
      return reponseJson(req, { sent, failed });
    } catch {
      return reponseJson(
        req,
        {
          error:
            "Envoi indisponible. La décision reste enregistrée ; consultez le suivi des notifications.",
        },
        503,
      );
    }
  };
}
