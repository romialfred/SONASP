import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { ArtisanMinier } from "./artisanMinierService";
import {
  collectorPayload,
  type CollectorFormValues,
} from "@/lib/collectorDossier";

export interface CollectorRecord {
  id: string;
  identity: ArtisanMinier;
  organization_id: string;
  organization_name: string;
  organization_type: "sonasp" | "comptoir" | null;
  is_legacy?: boolean;
  site_ids: string[];
  sites?: CollectionSite[];
  version: number;
  payment_authorized_until: string | null;
  account_user_id: string | null;
  can_delegate_payment?: boolean;
}
export interface CollectionSite {
  id: string;
  name: string;
  locality: string;
  region: string;
}
export interface CollectionOrganization {
  id: string;
  name: string;
  code: string;
  organization_type: "sonasp" | "comptoir";
}
export interface CollectionReference {
  sites: CollectionSite[];
  organizations: CollectionOrganization[];
}
export interface CollectionArtisan {
  id: string;
  name: string;
  site_id: string;
  site_name: string;
}
export interface CollectorSale {
  id: string;
  collector_id: string;
  collector_name: string;
  artisan_id: string;
  artisan_name: string;
  site_name: string;
  organization_id: string;
  organization_name: string;
  quantity: number;
  total: number;
  date: string;
  status: "submitted" | "approved" | "rejected";
  version: number;
  reason: string | null;
  can_approve: boolean;
  can_issue_invoice?: boolean;
  can_pay: boolean;
  invoice_id: string | null;
  payment_id?: string | null;
  payment_status: string | null;
  notifications: Array<{ recipient: string; status: string }>;
}
// This boundary is extended explicitly until generated types include the new migration.
type CollectorRpc =
  | "snp_collector_references"
  | "snp_list_collectors"
  | "snp_save_collector"
  | "snp_collector_set_payment_authorization"
  | "snp_collector_sale_artisans"
  | "snp_collector_submit_sale"
  | "snp_collector_decide_sale"
  | "snp_collector_sales"
  | "snp_collector_workspace_artisans";
async function rpc<T>(
  name: CollectorRpc,
  args: Record<string, Json | undefined> = {},
): Promise<T> {
  const call = supabase.rpc.bind(supabase) as unknown as (
    n: string,
    a: Record<string, Json | undefined>,
  ) => Promise<{ data: T; error: { message: string } | null }>;
  const { data, error } = await call(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const collectorService = {
  workspaceArtisanIds: () => rpc<string[]>("snp_collector_workspace_artisans"),
  references: () => rpc<CollectionReference>("snp_collector_references"),
  list: () => rpc<CollectorRecord[]>("snp_list_collectors"),
  async save(
    values: CollectorFormValues,
    id: string,
    version: number | null,
    legacyUpdatedAt?: string | null,
  ) {
    return rpc<CollectorRecord>("snp_save_collector", {
      p_id: id,
      p_expected_version: version,
      p_dossier: {
        ...collectorPayload(values),
        ...(version === 0
          ? { legacy_updated_at: legacyUpdatedAt ?? null }
          : {}),
      } as unknown as Json,
    });
  },
  authorizePayment: (id: string, until: string | null, reason: string) =>
    rpc<void>("snp_collector_set_payment_authorization", {
      p_collector_id: id,
      p_until: until,
      p_reason: reason,
    }),
  saleArtisans: () => rpc<CollectionArtisan[]>("snp_collector_sale_artisans"),
  sales: () => rpc<CollectorSale[]>("snp_collector_sales"),
  submitSale: (
    id: string,
    data: {
      artisan_id: string;
      site_id: string;
      date: string;
      quantity: number;
      gold_type: string;
      purity: number;
      price: number;
      observations: string;
    },
  ) => rpc<string>("snp_collector_submit_sale", { p_id: id, p_sale: data }),
  async dispatchNotifications(saleId: string) {
    const { error } = await supabase.functions.invoke(
      "collection-notifications",
      { body: { sale_id: saleId } },
    );
    if (error)
      throw new Error(
        "La décision est enregistrée. Les notifications par courriel restent en attente d’envoi.",
      );
  },
  decideSale: async (
    sale: CollectorSale,
    decision: "approved" | "rejected",
    reason: string,
  ) => {
    await rpc<void>("snp_collector_decide_sale", {
      p_id: sale.id,
      p_expected_version: sale.version,
      p_decision: decision,
      p_reason: reason,
    });
    // A delivery outage never reverses or retries the committed business decision.
    try {
      await collectorService.dispatchNotifications(sale.id);
    } catch {
      /* The persisted queue and its status remain visible. */
    }
  },
};
