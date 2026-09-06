/** The server is authoritative for status and calendar days; never infer activation from validation. */
export type AffiliationStatus =
  | "non_validee"
  | "inactive"
  | "programmee"
  | "active"
  | "expiree"
  | "suspendue"
  | "annulee"
  | "remplacee"
  | "a_reexaminer";
export interface AffiliationSnapshot {
  nom: string;
  prenoms: string;
  societe: string | null;
  titulaire_id: string | null;
  role: string;
  photo_reference: string;
  site_nom: string;
  commune: string;
  numero_affiliation: string;
}
export interface AffiliationCard {
  id: string;
  artisan_id: string;
  numero_carte: string;
  numero_affiliation: string;
  version: number;
  dues_card_id?: string;
  holder_name?: string;
  template_version: string;
  statut: string;
  statut_effectif: AffiliationStatus;
  snapshot: AffiliationSnapshot | null;
  validated_at: string | null;
  activated_at: string | null;
  issued_on?: string | null;
  expires_soon?: boolean;
  valid_from: string | null;
  valid_until: string | null;
  jours_restants: number | null;
  server_date: string;
  render_status: "pending" | "rendering" | "ready" | "failed";
  render_revision: number;
  recto_path: string | null;
  verso_path: string | null;
  pdf_path: string | null;
  verification_token: string;
  created_at: string;
  replaced_by: string | null;
}
export const AFFILIATION_STATUS_LABELS: Record<AffiliationStatus, string> = {
  non_validee: "Non validée",
  inactive: "Activation en attente",
  programmee: "Validité à venir",
  active: "Active",
  expiree: "Expirée",
  suspendue: "Suspendue",
  annulee: "Annulée",
  remplacee: "Remplacée",
  a_reexaminer: "Droits à réexaminer",
};
export function affiliationCountdown(
  card: Pick<AffiliationCard, "statut_effectif" | "jours_restants">,
): string {
  if (card.statut_effectif !== "active")
    return AFFILIATION_STATUS_LABELS[card.statut_effectif];
  if (card.jours_restants === null || card.jours_restants < 0)
    return "Échéance indisponible";
  return card.jours_restants === 0
    ? "Expire aujourd’hui"
    : `${card.jours_restants} jour${card.jours_restants > 1 ? "s" : ""} restant${card.jours_restants > 1 ? "s" : ""}`;
}
export function affiliationDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Après activation";
  return value.split("-").reverse().join(".");
}
