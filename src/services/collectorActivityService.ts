import { supabase } from "@/lib/supabase";

export interface CollectorActivitySale {
  id: string;
  date_vente: string;
  quantite_grammes: number;
  montant_brut_fcfa: number;
  tva_montant_fcfa: number | null;
  taxe_dev_comm_montant_fcfa: number | null;
  statut: string | null;
  collection: { collector_id: string; status: string };
}

export interface CollectorActivity {
  declarations: number;
  approved: number;
  pending: number;
  rejected: number;
  cancelled: number;
  paid: number;
  turnover: number;
  taxes: number | null;
  quantity: number;
  lastDeclaration: string | null;
}

/** Only explicitly attributed collection sales count, never all sales of an assigned artisan. */
export function summarizeCollectorActivity(
  rows: CollectorActivitySale[],
  collectorId: string,
): CollectorActivity {
  const result: CollectorActivity = {
    declarations: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    cancelled: 0,
    paid: 0,
    turnover: 0,
    taxes: 0,
    quantity: 0,
    lastDeclaration: null,
  };
  for (const row of rows) {
    if (row.collection.collector_id !== collectorId) continue;
    result.declarations++;
    if (!result.lastDeclaration || row.date_vente > result.lastDeclaration)
      result.lastDeclaration = row.date_vente;
    if (row.collection.status === "rejected") {
      result.rejected++;
      continue;
    }
    if (row.statut === "annulee") {
      result.cancelled++;
      continue;
    }
    if (row.collection.status === "submitted") {
      result.pending++;
      continue;
    }
    if (row.collection.status !== "approved")
      throw new Error("Statut de déclaration non reconnu.");
    result.approved++;
    if (row.statut === "payee") result.paid++;
    if (
      !Number.isFinite(row.montant_brut_fcfa) ||
      !Number.isFinite(row.quantite_grammes)
    ) {
      throw new Error("Montants d’activité incomplets.");
    }
    result.turnover += row.montant_brut_fcfa;
    result.quantity += row.quantite_grammes;
    // A missing historical tax is unknown, not a zero or a newly recalculated rate.
    if (row.tva_montant_fcfa == null || row.taxe_dev_comm_montant_fcfa == null)
      result.taxes = null;
    else if (result.taxes !== null)
      result.taxes += row.tva_montant_fcfa + row.taxe_dev_comm_montant_fcfa;
  }
  return result;
}

export const collectorActivityService = {
  async get(collectorId: string): Promise<CollectorActivity> {
    const rows: CollectorActivitySale[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      // Both relations retain their RLS policies. The inner join excludes unrelated sales.
      const { data, error, count } = await supabase
        .from("snp_artisan_ventes_or")
        .select(
          "id,date_vente,quantite_grammes,montant_brut_fcfa,tva_montant_fcfa,taxe_dev_comm_montant_fcfa,statut,collection:snp_collector_sales!inner(collector_id,status)",
          { count: "exact" },
        )
        .eq("collection.collector_id", collectorId)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      // The collection relation is newer than the generated Database relationship catalog.
      const page = (data ?? []) as unknown as CollectorActivitySale[];
      rows.push(...page);
      if (count == null)
        throw new Error("Le total des déclarations n’a pas pu être vérifié.");
      if (rows.length >= count) break;
      if (!page.length)
        throw new Error(
          "Le chargement des déclarations est incomplet. Actualisez la fiche.",
        );
    }
    return summarizeCollectorActivity(rows, collectorId);
  },
};
