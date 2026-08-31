import { supabase } from '@/lib/supabase';
import { PRIVATE_STORAGE_BUCKETS, createPrivateSignedUrl } from '@/lib/privateStorage';

/**
 * Dossier complet d'un maillon de la chaîne.
 *
 * La procédure `snp_dossier_complet` remonte et descend la chaîne réelle —
 * production, enlèvement, vente locale, expédition, fret, analyse raffinerie,
 * conciliation, vente, paiements, comptes — et rend les entités, les documents
 * et la chronologie de chaque étape.
 *
 * Elle est SECURITY INVOKER : chaque lecture passe sous la RLS de l'appelant.
 * Un acteur ne voit dans le dossier que ce que les écrans lui montrent déjà ;
 * une étape hors de son périmètre revient simplement vide.
 *
 * Les documents arrivent en `source` + `chemin`, jamais en URL : la signature
 * courte se fait ici, au moment de l'ouverture, selon le bucket de la source.
 */

export type TypeDossier =
  | 'production'
  | 'requisition'
  | 'achat'
  | 'vente'
  | 'expedition'
  | 'analyse'
  | 'conciliation'
  | 'paiement';

/** Étapes de la chaîne, dans l'ordre du workflow métier. */
export const ETAPES_DOSSIER = [
  'production',
  'enlevement',
  'vente_locale',
  'expedition',
  'analyse',
  'conciliation',
  'vente',
  'paiement',
  'comptes',
] as const;

export type EtapeDossier = (typeof ETAPES_DOSSIER)[number];

export const LIBELLES_ETAPES: Record<EtapeDossier, string> = {
  production: 'Production',
  enlevement: 'Enlèvement',
  vente_locale: 'Vente locale',
  expedition: 'Expédition',
  analyse: 'Analyse raffinerie',
  conciliation: 'Conciliation',
  vente: 'Vente',
  paiement: 'Paiements',
  comptes: 'Comptes',
};

export interface DocumentDossier {
  etape: EtapeDossier;
  source: string;
  id: string;
  nom: string | null;
  chemin: string | null;
  type_mime?: string | null;
  taille?: number | null;
  date?: string | null;
  categorie?: string | null;
  reference?: string | null;
  version?: number | null;
}

export interface EvenementDossier {
  etape: EtapeDossier;
  date: string | null;
  titre: string;
  detail?: string | null;
  acteur?: string | null;
}

export interface ComptesDossier {
  montant_vente?: number;
  devise?: string;
  avances_recues?: number;
  /** Paiements enregistrés mais ni exécutés ni datés : engagements, pas des encaissements. */
  engagements_en_attente?: number;
  ecart_conciliation?: number;
  taxes?: Array<{ code: string; devise?: string; complement_du?: number; trop_percu?: number; net?: number }>;
  avoirs?: Array<{ reference: string; montant: number; devise: string; statut: string }>;
}

export interface EntiteResume {
  id: string;
  reference?: string | null;
  statut?: string | null;
  date?: string | null;
  [cle: string]: unknown;
}

export interface ChaineDossier {
  productions?: EntiteResume[];
  requisition?: EntiteResume & { enlevements?: EntiteResume[] };
  achats?: Array<EntiteResume & { facture?: EntiteResume | null }>;
  expeditions?: Array<EntiteResume & { raffinerie?: string | null }>;
  fret?: EntiteResume[];
  analyses?: EntiteResume[];
  conciliation?: EntiteResume | null;
  vente?: (EntiteResume & { client?: string | null }) | null;
  paiements?: EntiteResume[];
}

export interface DossierComplet {
  ancre: { type: TypeDossier; id: string };
  chaine: ChaineDossier;
  documents: DocumentDossier[];
  chronologie: EvenementDossier[];
  comptes: ComptesDossier;
}

/**
 * Bucket de chaque source documentaire. Une source absente de cette table est
 * une pièce de référence sans fichier (une facture générée à la volée, par
 * exemple) : elle s'affiche, elle ne s'ouvre pas.
 */
const BUCKET_PAR_SOURCE: Record<string, string> = {
  production_documents: PRIVATE_STORAGE_BUCKETS.productionDocuments,
  snp_requisitions_documents: 'contrats-documents',
  shipping_documents: PRIVATE_STORAGE_BUCKETS.shippingDocuments,
  shipping_preparations: PRIVATE_STORAGE_BUCKETS.shippingDocuments,
  // Les PDF de fret ne sont PAS ouvrables : leurs chemins visent le bucket
  // herite 'freight-documents', ferme fail-closed par le lot 2K (aucune
  // politique de lecture client). Ils s'affichent en reference. Les rouvrir
  // demanderait une politique de storage, decision de securite a part.
  assay_certificates: PRIVATE_STORAGE_BUCKETS.assayCertificates,
  snp_payment_proofs: PRIVATE_STORAGE_BUCKETS.paymentProofs,
  sales_documents: 'sales-documents',
};

export const dossierService = {
  async charger(type: TypeDossier, id: string): Promise<DossierComplet> {
    const { data, error } = await supabase.rpc('snp_dossier_complet', {
      p_type: type,
      p_id: id,
    });

    if (error) throw error;
    return data as unknown as DossierComplet;
  },

  /** Un document est ouvrable s'il porte un fichier dans un bucket connu. */
  estOuvrable(document: DocumentDossier): boolean {
    if (!document.chemin) return false;
    if (document.source === 'sales_documents') {
      return true;
    }
    return Boolean(BUCKET_PAR_SOURCE[document.source]);
  },

  /**
   * URL d'ouverture d'un document, signée à la demande et à durée courte.
   * Ne jette pas pour un document non ouvrable : renvoie `null`.
   */
  async urlPourDocument(document: DocumentDossier): Promise<string | null> {
    if (!document.chemin) return null;

    // Les documents de vente historiques portent parfois une URL complète.
    if (document.source === 'sales_documents') {
      if (/^https?:\/\//i.test(document.chemin)) return document.chemin;
    }

    const bucket = BUCKET_PAR_SOURCE[document.source];
    if (!bucket) return null;
    return createPrivateSignedUrl(bucket, document.chemin, 300);
  },
};
