import { supabase } from "@/lib/supabase";
import { createPrivateSignedUrl } from "@/lib/privateStorage";
import type { AffiliationCard, AffiliationStatus } from "@/lib/affiliationCard";
import type {
  AdhesionBareme,
  AdhesionDroit,
  AdhesionEncaissement,
  AdhesionPaymentProof,
  AffiliationEvent,
} from "@/types/affiliations";
import type { ArtisanMinier } from "./artisanMinierService";

type RpcContracts = {
  snp_lister_affiliations: {
    args: { p_artisan: string | null };
    result: AffiliationCard[];
  };
  snp_affiliation_history: {
    args: { p_carte: string };
    result: AffiliationEvent[];
  };
  snp_preparer_carte_affiliation: {
    args: { p_carte: string };
    result: unknown;
  };
  snp_activer_carte_affiliation: {
    args: { p_carte: string };
    result: AffiliationCard;
  };
  snp_corriger_carte_affiliation: {
    args: { p_id: string; p_carte: string; p_motif: string };
    result: unknown;
  };
  snp_configurer_adhesion_bareme: {
    args: {
      p_id: string;
      p_libelle: string;
      p_role: string;
      p_montant: number;
      p_devise: string;
      p_duree: number;
      p_fuseau: string;
      p_alerte: number;
    };
    result: AdhesionBareme;
  };
  snp_etablir_adhesion_droit: {
    args: {
      p_id: string;
      p_carte: string;
      p_bareme: string;
      p_debut: string;
      p_fin: string;
    };
    result: AdhesionDroit;
  };
  snp_enregistrer_adhesion_encaissement: {
    args: {
      p_id: string;
      p_droit: string;
      p_montant: number;
      p_reference: string;
      p_mode: string;
      p_date: string;
      p_annee: number;
      p_lieu: string;
      p_preuve: string;
    };
    result: AdhesionEncaissement;
  };
  snp_controler_adhesion_encaissement: {
    args: { p_id: string; p_statut: string; p_motif: string | null };
    result: AdhesionEncaissement;
  };
  snp_annuler_adhesion_droit: {
    args: { p_id: string; p_motif: string };
    result: AdhesionDroit;
  };
  snp_artisans_eligibles_operations: {
    args: Record<string, never>;
    result: ArtisanMinier[];
  };
  snp_artisan_affiliation_eligible: {
    args: { p_artisan: string };
    result: boolean;
  };
  snp_verifier_affiliation: {
    args: { p_reference: string };
    result: {
      numero_affiliation: string;
      version: number;
      statut_effectif: AffiliationStatus;
      valid_from: string | null;
      valid_until: string | null;
      verified_at: string;
    } | null;
  };
};
const client = supabase as unknown as {
  rpc<K extends keyof RpcContracts>(
    name: K,
    args: RpcContracts[K]["args"],
  ): PromiseLike<{
    data: RpcContracts[K]["result"];
    error: { code?: string; message: string } | null;
  }>;
};
async function rpc<K extends keyof RpcContracts>(
  name: K,
  args: RpcContracts[K]["args"],
): Promise<RpcContracts[K]["result"]> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const messages: Record<string, string> = {
      "40001": "Le dossier a changé. Actualisez avant de réessayer.",
      "42501":
        "Votre habilitation, votre périmètre ou la règle de double contrôle ne permet pas cette action.",
      "23505":
        "Cette référence est déjà utilisée. Vérifiez le reçu ou le dossier existant.",
      "23514":
        "Les valeurs ne respectent pas les règles du dossier. Vérifiez les dates et montants.",
    };
    throw new Error(
      error.code === "P0001"
        ? error.message
        : messages[error.code || ""] ||
          "L’opération n’a pas abouti. Actualisez le dossier avant de réessayer.",
    );
  }
  return data;
}
export const affiliationService = {
  list: (artisanId?: string) =>
    rpc("snp_lister_affiliations", { p_artisan: artisanId || null }),
  history: (cardId: string) =>
    rpc("snp_affiliation_history", { p_carte: cardId }),
  prepare: (cardId: string) =>
    rpc("snp_preparer_carte_affiliation", { p_carte: cardId }),
  activate: (cardId: string) =>
    rpc("snp_activer_carte_affiliation", { p_carte: cardId }),
  correct: (id: string, cardId: string, reason: string) =>
    rpc("snp_corriger_carte_affiliation", {
      p_id: id,
      p_carte: cardId,
      p_motif: reason.trim(),
    }),
  eligibleArtisans: () => rpc("snp_artisans_eligibles_operations", {}),
  eligible: (artisanId: string) =>
    rpc("snp_artisan_affiliation_eligible", { p_artisan: artisanId }),
  verify: (reference: string) =>
    rpc("snp_verifier_affiliation", { p_reference: reference }),
  configureTariff: (
    args: RpcContracts["snp_configurer_adhesion_bareme"]["args"],
  ) => rpc("snp_configurer_adhesion_bareme", args),
  establishDues: (args: RpcContracts["snp_etablir_adhesion_droit"]["args"]) =>
    rpc("snp_etablir_adhesion_droit", args),
  recordReceipt: (
    args: RpcContracts["snp_enregistrer_adhesion_encaissement"]["args"],
  ) => rpc("snp_enregistrer_adhesion_encaissement", args),
  async uploadPaymentProof(file: File, duesId: string, receiptId: string): Promise<AdhesionPaymentProof> {
    const formats: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
    if (!formats[file.type] || file.size < 1 || file.size > 5 * 1024 * 1024)
      throw new Error("Joignez un fichier PDF, JPG ou PNG de 5 Mo maximum.");
    const payload = new FormData();
    payload.append("duesId", duesId);
    payload.append("receiptId", receiptId);
    payload.append("file", file);
    const { data, error } = await supabase.functions.invoke("affiliation-payment-proof-upload", { body: payload });
    const proof = data?.proof as AdhesionPaymentProof | undefined;
    if (error || !proof || typeof proof.path !== "string" || !proof.path.endsWith(`/${duesId}/${receiptId}.${formats[file.type]}`)
      || proof.file_size !== file.size || proof.mime_type !== file.type || !/^[a-f0-9]{64}$/.test(proof.sha256))
      throw new Error("La preuve du paiement n’a pas pu être déposée. Vérifiez votre accès puis réessayez.");
    return proof;
  },
  signedPaymentProof: (path: string) => createPrivateSignedUrl("affiliation-payment-proofs", path),
  reviewReceipt: (id: string, status: string, reason?: string) =>
    rpc("snp_controler_adhesion_encaissement", {
      p_id: id,
      p_statut: status,
      p_motif: reason?.trim() || null,
    }),
  cancelDues: (id: string, reason: string) =>
    rpc("snp_annuler_adhesion_droit", { p_id: id, p_motif: reason.trim() }),
  async tariffs(): Promise<AdhesionBareme[]> {
    const { data, error } = await supabase
      .from("snp_adhesion_baremes")
      .select("*")
      .eq("actif", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async dues(
    cardId: string,
  ): Promise<{
    droit: AdhesionDroit | null;
    encaissements: AdhesionEncaissement[];
  }> {
    const rights = await supabase
      .from("snp_adhesion_droits")
      .select("*")
      .eq("carte_id", cardId)
      .maybeSingle();
    if (rights.error) throw rights.error;
    if (!rights.data) return { droit: null, encaissements: [] };
    const payments = await supabase
      .from("snp_adhesion_encaissements")
      .select("*")
      .eq("droit_id", rights.data.id)
      .order("created_at", { ascending: false });
    if (payments.error) throw payments.error;
    return { droit: rights.data, encaissements: payments.data || [] };
  },
  async render(cardId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke(
      "affiliation-card-render",
      { body: { cardId } },
    );
    if (error || data?.success !== true)
      throw new Error(
        "La génération n’a pas abouti. Vérifiez la photographie et réessayez.",
      );
  },
  signedFile: (path: string) =>
    createPrivateSignedUrl("affiliation-cards", path),
  async download(path: string, fileName: string): Promise<void> {
    const signed = await this.signedFile(path);
    const response = await fetch(signed, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok)
      throw new Error("Le fichier privé n’a pas pu être téléchargé.");
    const blob = await response.blob();
    const local = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = local;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(local), 1000);
  },
};
