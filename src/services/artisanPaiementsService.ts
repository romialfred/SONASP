import { supabase } from '@/lib/supabase';
import type { Json, Tables } from '@/types/database';

export interface FactureDefinitive {
  id?: string;
  numero_facture: string;
  vente_or_id: string;
  artisan_id: string;
  montant_brut: number;
  montant_taxe_tva: number;
  montant_taxe_retenue_source: number;
  montant_autres_taxes: number;
  montant_total_taxes: number;
  montant_net_a_payer: number;
  taux_tva: number;
  taux_retenue_source: number;
  date_emission: string | null;
  date_echeance?: string | null;
  statut: 'emise' | 'en_paiement' | 'payee' | 'annulee';
  pdf_url?: string | null;
  notes?: string | null;
  emise_par?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  certification_dgi_status?: string;
  dgi_reference?: string | null;
  dgi_document_path?: string | null;
  dgi_certified_at?: string | null;
  dgi_certified_by?: string | null;
  comptoir_organization_id?: string | null;
  /** Verrou optimiste détenu et incrémenté par les RPC 4I. */
  version?: number;
}

export type TypePaiementArtisan =
  | 'virement_bancaire' | 'cash' | 'orange_money' | 'mobile_money'
  | 'moov_money' | 'wave' | 'cheque';
export type StatutPaiementArtisan =
  | 'en_attente' | 'en_traitement' | 'valide' | 'complete' | 'annule' | 'echec';
export type TypeTaxeRetenue =
  | 'tva' | 'retenue_source' | 'taxe_municipale' | 'taxe_regionale' | 'autre';

export interface PaiementArtisan {
  id?: string;
  reference_paiement: string;
  facture_id: string;
  vente_or_id: string;
  artisan_id: string;
  type_paiement: TypePaiementArtisan;
  montant_paye: number;
  montant_taxes_retenues: number;
  details_paiement: Json | null;
  statut: StatutPaiementArtisan;
  date_paiement: string | null;
  date_validation?: string | null;
  date_completion?: string | null;
  preuve_paiement_url?: string | null;
  recu_paiement_url?: string | null;
  traite_par?: string | null;
  valide_par?: string | null;
  completed_by?: string | null;
  cancelled_by?: string | null;
  failed_by?: string | null;
  terminal_reason?: string | null;
  notes?: string | null;
  /** Coordonnee de reglement employee, prise sur la fiche de l'artisan. */
  moyen_paiement_id?: string | null;
  /** Facture presentee au reglement ; specimen tant que la certification DGI n'est pas raccordee. */
  numero_facture?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  comptoir_organization_id?: string | null;
  /** Verrou optimiste détenu et incrémenté par les RPC 4I. */
  version?: number;
}

export interface ArtisanPaymentBeneficiary {
  id: string;
  nom?: string | null;
  prenoms?: string | null;
  raison_sociale?: string | null;
  numero_carte?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  commune?: string | null;
  region?: string | null;
}

export interface ArtisanPaymentSale {
  id: string;
  numero_recu?: string | null;
  reference_vente?: string | null;
  date_vente: string;
  type_or: string;
  quantite_grammes: number;
  purete_karat: number;
  prix_kg_fcfa: number;
  montant_brut_fcfa: number;
  montant_total_fcfa: number;
  statut?: string | null;
  statut_paiement?: string | null;
}

export interface ArtisanPaymentMethod {
  id: string;
  type: string;
  libelle?: string | null;
  titulaire: string;
  banque?: string | null;
  code_swift?: string | null;
  numero_compte?: string | null;
  numero_telephone?: string | null;
  est_principal: boolean;
  actif: boolean;
  verifie_le?: string | null;
}

export interface ArtisanPaymentOrganization {
  id: string;
  code: string;
  name: string;
  short_name?: string | null;
  organization_type: string;
}

export interface ArtisanPaymentWorkflowEvent {
  id: string;
  action: string;
  actor_id?: string | null;
  actor_role?: string | null;
  capability_code?: string | null;
  reason?: string | null;
  status_before?: string | null;
  status_after?: string | null;
  occurred_at: string;
}

export interface ArtisanPaymentDossier extends PaiementArtisan {
  artisan?: ArtisanPaymentBeneficiary | null;
  facture?: FactureDefinitive | null;
  vente?: ArtisanPaymentSale | null;
  moyen_paiement?: ArtisanPaymentMethod | null;
  organisation?: ArtisanPaymentOrganization | null;
  taxes: TaxeRetenue[];
  historique: ArtisanPaymentWorkflowEvent[];
}

export interface TaxeRetenue {
  id?: string;
  paiement_id: string;
  facture_id: string;
  vente_or_id: string;
  artisan_id: string;
  type_taxe: TypeTaxeRetenue;
  libelle_taxe: string;
  taux_taxe: number;
  montant_taxe: number;
  compte_comptable?: string | null;
  reference_comptable?: string | null;
  statut_reversement: 'a_reverser' | 'en_cours' | 'reverse' | 'comptabilise' | null;
  date_reversement?: string | null;
  reversement_reference?: string | null;
  periode_fiscale?: string | null;
  exercice_fiscal?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Verrou optimiste détenu et incrémenté par les RPC 4I. */
  version?: number;
}

export interface VenteEnAttentePaiement {
  vente_id: string;
  reference_vente: string;
  date_vente: string;
  artisan_id: string;
  artisan_nom_complet: string;
  numero_carte: string;
  telephone: string;
  facture_id: string | null;
  numero_facture: string | null;
  montant_net_a_payer: number | null;
  date_facture: string | null;
  statut_paiement: string;
  certification_dgi_status: string | null;
  jours_attente: number | null;
  vente_statut: string;
  vente_version: number;
  facture_version: number | null;
}

export type ArtisanPaymentStatus = PaiementArtisan['statut'];
export type ArtisanTaxStatus = NonNullable<TaxeRetenue['statut_reversement']>;

const FACTURE_STATUSES = ['emise', 'en_paiement', 'payee', 'annulee'] as const;
const TAX_STATUSES = ['a_reverser', 'en_cours', 'reverse', 'comptabilise'] as const;

function normaliserFacture(row: Tables<'snp_artisan_factures_definitives'>): FactureDefinitive {
  if (!row.statut || !FACTURE_STATUSES.includes(row.statut as FactureDefinitive['statut'])) {
    throw new Error(`Statut de facture inconnu : ${row.statut ?? 'non renseigné'}.`);
  }
  return { ...row, statut: row.statut as FactureDefinitive['statut'] };
}

function normaliserPaiement(row: Tables<'snp_artisan_paiements'>): PaiementArtisan {
  return row;
}

function normaliserTaxe(row: Tables<'snp_artisan_taxes_retenues'>): TaxeRetenue {
  if (row.statut_reversement !== null
    && !TAX_STATUSES.includes(row.statut_reversement as ArtisanTaxStatus)) {
    throw new Error(`Statut fiscal inconnu : ${row.statut_reversement}.`);
  }
  return { ...row, statut_reversement: row.statut_reversement as ArtisanTaxStatus | null };
}

export interface ArtisanInvoiceMutationResult {
  invoice_id: string;
  sale_id: string;
  invoice_number: string;
  invoice_status: FactureDefinitive['statut'];
  invoice_version: number;
  sale_status: string;
  sale_payment_status: string;
  sale_version: number;
  gross_amount: number;
  vat_amount: number;
  withholding_amount: number;
  other_tax_amount: number;
  total_taxes: number;
  net_payable: number;
  tax_policy_version: string;
  idempotency_key: string;
  replayed: boolean;
  processed_at: string;
}

export interface ArtisanPaymentMutationResult {
  payment_id: string;
  invoice_id: string;
  sale_id: string;
  artisan_id: string;
  payment_reference: string;
  payment_status: ArtisanPaymentStatus;
  payment_version: number;
  invoice_status: FactureDefinitive['statut'];
  invoice_version: number;
  sale_status: string;
  sale_payment_status: string;
  sale_version: number;
  amount_paid: number;
  taxes_withheld: number;
  payment_method_id: string;
  payment_type: PaiementArtisan['type_paiement'];
  idempotency_key: string;
  replayed: boolean;
  processed_at: string;
}

export interface ArtisanTaxMutationResult {
  tax_id: string;
  payment_id: string;
  invoice_id: string;
  sale_id: string;
  tax_type: TaxeRetenue['type_taxe'];
  tax_status: ArtisanTaxStatus;
  tax_version: number;
  remittance_reference: string | null;
  idempotency_key: string;
  replayed: boolean;
  processed_at: string;
}

export interface EmitArtisanInvoiceInput {
  saleId: string;
  expectedSaleStatus: string;
  expectedSaleVersion: number;
  idempotencyKey: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface CreateArtisanPaymentInput {
  invoiceId: string;
  expectedInvoiceStatus: FactureDefinitive['statut'];
  expectedInvoiceVersion: number;
  paymentMethodId: string;
  idempotencyKey: string;
  notes?: string | null;
}

export interface TransitionArtisanPaymentInput {
  paymentId: string;
  expectedStatus: ArtisanPaymentStatus;
  expectedVersion: number;
  newStatus: ArtisanPaymentStatus;
  idempotencyKey: string;
  notes?: string | null;
}

export interface TransitionArtisanTaxInput {
  taxId: string;
  expectedStatus: ArtisanTaxStatus;
  expectedVersion: number;
  newStatus: ArtisanTaxStatus;
  idempotencyKey: string;
  remittanceReference?: string;
  notes?: string;
}

interface ArtisanRpcError {
  code?: string;
  message?: string;
}

export class ArtisanPaymentConflictError extends Error {
  constructor(message = 'Le dossier a été modifié par un autre opérateur. Rechargez-le avant de recommencer.') {
    super(message);
    this.name = 'ArtisanPaymentConflictError';
  }
}

export function createArtisanPaymentIdempotencyKey(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error("Le navigateur ne permet pas de générer une clé d'idempotence sûre.");
  }
  return crypto.randomUUID();
}

function nullableTrimmed(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function assertExpectedVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('La version serveur attendue est invalide. Rechargez le dossier.');
  }
}

function isOptimisticConflict(error: ArtisanRpcError): boolean {
  return error.code === '40001' || /conflit optimiste/i.test(error.message || '');
}

const PAYMENT_TRANSITIONS: Record<ArtisanPaymentStatus, ArtisanPaymentStatus[]> = {
  en_attente: ['en_traitement', 'annule', 'echec'],
  en_traitement: ['valide', 'annule', 'echec'],
  valide: ['complete', 'annule', 'echec'],
  complete: [],
  annule: [],
  echec: [],
};

const TAX_TRANSITIONS: Record<ArtisanTaxStatus, ArtisanTaxStatus[]> = {
  a_reverser: ['en_cours'],
  en_cours: ['reverse'],
  reverse: ['comptabilise'],
  comptabilise: [],
};

function assertCommonMutationResult(
  data: Record<string, unknown> | null,
  idField: string,
  expectedIdempotencyKey: string,
): asserts data is Record<string, unknown> & {
  idempotency_key: string;
  replayed: boolean;
  processed_at: string;
} {
  if (!data || typeof data[idField] !== 'string'
    || data.idempotency_key !== expectedIdempotencyKey
    || typeof data.replayed !== 'boolean'
    || typeof data.processed_at !== 'string') {
    throw new Error("La procédure sécurisée n'a pas confirmé l'opération demandée.");
  }
}

async function callArtisanMutationRpc<T extends object>(
  name: string,
  parameters: Record<string, unknown>,
  idField: string,
  expectedIdempotencyKey: string,
): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, parameters) as {
    data: T | null;
    error: ArtisanRpcError | null;
  };
  if (error) {
    if (isOptimisticConflict(error)) throw new ArtisanPaymentConflictError();
    throw error;
  }
  assertCommonMutationResult(data as Record<string, unknown> | null, idField, expectedIdempotencyKey);
  return data as T;
}

const artisanPaiementsService = {
  async emettreFacture(input: EmitArtisanInvoiceInput): Promise<ArtisanInvoiceMutationResult> {
    assertExpectedVersion(input.expectedSaleVersion);
    const result = await callArtisanMutationRpc<ArtisanInvoiceMutationResult>(
      'snp_artisan_emettre_facture',
      {
        p_vente_id: input.saleId,
        p_expected_vente_statut: input.expectedSaleStatus,
        p_expected_vente_version: input.expectedSaleVersion,
        p_idempotency_key: input.idempotencyKey,
        p_date_echeance: input.dueDate || null,
        p_notes: nullableTrimmed(input.notes),
      },
      'invoice_id',
      input.idempotencyKey,
    );
    if (!result.sale_id || !result.invoice_number
      || result.invoice_status !== 'emise'
      || result.sale_payment_status !== 'facture_emise'
      || typeof result.invoice_version !== 'number'
      || typeof result.sale_version !== 'number') {
      throw new Error("La procédure sécurisée n'a pas confirmé l'émission de la facture.");
    }
    return result;
  },

  async getFactureByVenteId(venteId: string): Promise<FactureDefinitive | null> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_factures_definitives')
        .select('*')
        .eq('vente_or_id', venteId)
        .maybeSingle();

      if (error) throw error;
      return data ? normaliserFacture(data) : null;
    } catch (error) {
      console.error('Erreur récupération facture:', error);
      throw error;
    }
  },

  async getVentesEnAttentePaiement(): Promise<VenteEnAttentePaiement[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select(`
          id,
          numero_recu,
          date_vente,
          artisan_id,
          montant_total_fcfa,
          statut,
          statut_paiement,
          version,
          facture_definitive_id,
          artisan:snp_artisans_miniers!inner(
            nom,
            prenoms,
            raison_sociale,
            numero_carte,
            telephone
          )
        `)
        .eq('statut', 'validee')
        .order('date_vente', { ascending: true });

      if (error) throw error;

      const ventesWithFactures = await Promise.all(
        (data || []).map(async (vente: any) => {
          let facture = null;
          if (vente.facture_definitive_id) {
            const { data: factureData } = await supabase
              .from('snp_artisan_factures_definitives')
              .select('id, numero_facture, montant_net_a_payer, date_emission, statut, certification_dgi_status, version')
              .eq('id', vente.facture_definitive_id)
              .maybeSingle();

            facture = factureData;
          }

          const artisan = vente.artisan;
          const nomComplet = artisan.raison_sociale || `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim();

          const dateVente = new Date(vente.date_vente);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - dateVente.getTime());
          const joursAttente = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            vente_id: vente.id,
            reference_vente: vente.numero_recu || `VENTE-${vente.id.slice(0, 8)}`,
            date_vente: vente.date_vente,
            artisan_id: vente.artisan_id,
            artisan_nom_complet: nomComplet,
            numero_carte: artisan.numero_carte,
            telephone: artisan.telephone || '',
            facture_id: facture?.id || vente.facture_definitive_id,
            numero_facture: facture?.numero_facture || null,
            montant_net_a_payer: facture?.montant_net_a_payer || vente.montant_total_fcfa,
            date_facture: facture?.date_emission || null,
            statut_paiement: vente.statut_paiement
              || (facture ? (facture.statut === 'payee' ? 'paye' : 'facture_emise') : 'non_paye'),
            certification_dgi_status: facture?.certification_dgi_status || null,
            jours_attente: joursAttente,
            vente_statut: vente.statut,
            vente_version: vente.version,
            facture_version: facture?.version ?? null,
          };
        })
      );

      return ventesWithFactures;
    } catch (error) {
      console.error('Erreur récupération ventes en attente:', error);
      throw error;
    }
  },

  async creerPaiement(input: CreateArtisanPaymentInput): Promise<ArtisanPaymentMutationResult> {
    assertExpectedVersion(input.expectedInvoiceVersion);
    const result = await callArtisanMutationRpc<ArtisanPaymentMutationResult>(
      'snp_artisan_creer_paiement',
      {
        p_facture_id: input.invoiceId,
        p_expected_facture_statut: input.expectedInvoiceStatus,
        p_expected_facture_version: input.expectedInvoiceVersion,
        p_moyen_paiement_id: input.paymentMethodId,
        p_idempotency_key: input.idempotencyKey,
        p_notes: nullableTrimmed(input.notes),
      },
      'payment_id',
      input.idempotencyKey,
    );
    if (!result.invoice_id || !result.sale_id || !result.artisan_id
      || !result.payment_reference || !result.payment_method_id
      || result.payment_status !== 'en_attente'
      || result.invoice_status !== 'en_paiement'
      || typeof result.payment_version !== 'number'
      || typeof result.invoice_version !== 'number'
      || typeof result.sale_version !== 'number') {
      throw new Error("La procédure sécurisée n'a pas confirmé la création du paiement.");
    }
    return result;
  },

  async transitionPaiement(input: TransitionArtisanPaymentInput): Promise<ArtisanPaymentMutationResult> {
    assertExpectedVersion(input.expectedVersion);
    if (!PAYMENT_TRANSITIONS[input.expectedStatus]?.includes(input.newStatus)) {
      throw new Error(`Transition de paiement interdite : ${input.expectedStatus} vers ${input.newStatus}.`);
    }
    if (['annule', 'echec'].includes(input.newStatus) && (input.notes?.trim().length || 0) < 10) {
      throw new Error("Un motif d'au moins 10 caractères est requis pour abandonner un paiement.");
    }
    const result = await callArtisanMutationRpc<ArtisanPaymentMutationResult>(
      'snp_artisan_transition_paiement',
      {
        p_paiement_id: input.paymentId,
        p_expected_statut: input.expectedStatus,
        p_expected_version: input.expectedVersion,
        p_nouveau_statut: input.newStatus,
        p_idempotency_key: input.idempotencyKey,
        p_notes: nullableTrimmed(input.notes),
      },
      'payment_id',
      input.idempotencyKey,
    );
    if (!result.invoice_id || !result.sale_id || !result.artisan_id
      || result.payment_status !== input.newStatus
      || typeof result.payment_version !== 'number'
      || typeof result.invoice_version !== 'number'
      || typeof result.sale_version !== 'number') {
      throw new Error("La procédure sécurisée n'a pas confirmé la transition du paiement.");
    }
    return result;
  },

  async getPaiementsByFactureId(factureId: string): Promise<PaiementArtisan[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_paiements')
        .select('*')
        .eq('facture_id', factureId)
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      return (data || []).map(normaliserPaiement);
    } catch (error) {
      console.error('Erreur récupération paiements:', error);
      throw error;
    }
  },

  async getPaiementsByArtisanId(artisanId: string): Promise<PaiementArtisan[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_paiements')
        .select(`
          *,
          facture:snp_artisan_factures_definitives(*),
          vente:snp_artisan_ventes_or(*),
          artisan:snp_artisans_miniers(nom, prenoms, numero_carte)
        `)
        .eq('artisan_id', artisanId)
        .order('date_paiement', { ascending: false});

      if (error) throw error;
      return (data || []).map(normaliserPaiement);
    } catch (error) {
      console.error('Erreur récupération paiements artisan:', error);
      throw error;
    }
  },

  async getAllPaiements(filters?: {
    statut?: StatutPaiementArtisan;
    type_paiement?: TypePaiementArtisan;
    date_debut?: string;
    date_fin?: string;
  }): Promise<PaiementArtisan[]> {
    try {
      let query = supabase
        .from('snp_artisan_paiements')
        .select(`
          *,
          facture:snp_artisan_factures_definitives(*),
          vente:snp_artisan_ventes_or(id, reference_vente, numero_recu, date_vente),
          artisan:snp_artisans_miniers(nom, prenoms, numero_carte, telephone)
        `);

      if (filters?.statut) {
        query = query.eq('statut', filters.statut);
      }

      if (filters?.type_paiement) {
        query = query.eq('type_paiement', filters.type_paiement);
      }

      if (filters?.date_debut) {
        query = query.gte('date_paiement', filters.date_debut);
      }

      if (filters?.date_fin) {
        query = query.lte('date_paiement', filters.date_fin);
      }

      const { data, error } = await query.order('date_paiement', { ascending: false });

      if (error) throw error;
      return (data || []).map(normaliserPaiement);
    } catch (error) {
      console.error('Erreur récupération tous les paiements:', error);
      throw error;
    }
  },

  async getTaxesRetenues(filters?: {
    statut_reversement?: string;
    type_taxe?: TypeTaxeRetenue;
    periode_fiscale?: string;
  }): Promise<TaxeRetenue[]> {
    try {
      let query = supabase
        .from('snp_artisan_taxes_retenues')
        .select('*');

      if (filters?.statut_reversement) {
        query = query.eq('statut_reversement', filters.statut_reversement);
      }

      if (filters?.type_taxe) {
        query = query.eq('type_taxe', filters.type_taxe);
      }

      if (filters?.periode_fiscale) {
        query = query.eq('periode_fiscale', filters.periode_fiscale);
      }

      const { data, error } = await query.order('periode_fiscale', { ascending: false });

      if (error) throw error;
      return (data || []).map(normaliserTaxe);
    } catch (error) {
      console.error('Erreur récupération taxes retenues:', error);
      throw error;
    }
  },

  async transitionTaxe(input: TransitionArtisanTaxInput): Promise<ArtisanTaxMutationResult> {
    assertExpectedVersion(input.expectedVersion);
    if (!TAX_TRANSITIONS[input.expectedStatus]?.includes(input.newStatus)) {
      throw new Error(`Transition fiscale interdite : ${input.expectedStatus} vers ${input.newStatus}.`);
    }
    if (input.newStatus === 'reverse' && !nullableTrimmed(input.remittanceReference)) {
      throw new Error('La référence de reversement est obligatoire.');
    }
    const result = await callArtisanMutationRpc<ArtisanTaxMutationResult>(
      'snp_artisan_transition_reversement_taxe',
      {
        p_taxe_id: input.taxId,
        p_expected_statut: input.expectedStatus,
        p_expected_version: input.expectedVersion,
        p_nouveau_statut: input.newStatus,
        p_idempotency_key: input.idempotencyKey,
        p_reversement_reference: nullableTrimmed(input.remittanceReference),
        p_notes: nullableTrimmed(input.notes),
      },
      'tax_id',
      input.idempotencyKey,
    );
    if (!result.payment_id || !result.invoice_id || !result.sale_id
      || result.tax_status !== input.newStatus || typeof result.tax_version !== 'number') {
      throw new Error("La procédure sécurisée n'a pas confirmé la transition fiscale.");
    }
    return result;
  },

  async getPaiementDossier(paiementId: string): Promise<ArtisanPaymentDossier | null> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_paiements')
        .select(`
          *,
          artisan:snp_artisans_miniers(
            id, nom, prenoms, raison_sociale, numero_carte, telephone,
            email, adresse, commune, region
          ),
          facture:snp_artisan_factures_definitives(*),
          vente:snp_artisan_ventes_or(
            id, numero_recu, reference_vente, date_vente, type_or,
            quantite_grammes, purete_karat, prix_kg_fcfa,
            montant_brut_fcfa, montant_total_fcfa, statut, statut_paiement
          ),
          moyen_paiement:snp_artisan_moyens_paiement(
            id, type, libelle, titulaire, banque, code_swift,
            numero_compte, numero_telephone, est_principal, actif, verifie_le
          ),
          organisation:snp_organizations!snp_artisan_paiements_comptoir_organization_id_fkey(
            id, code, name, short_name, organization_type
          )
        `)
        .eq('id', paiementId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const [taxesResult, historiqueResult] = await Promise.all([
        supabase
          .from('snp_artisan_taxes_retenues')
          .select('*')
          .eq('paiement_id', paiementId)
          .order('created_at', { ascending: true }),
        supabase
          .from('snp_workflow_audit')
          .select('id, action, actor_id, actor_role, capability_code, reason, status_before, status_after, occurred_at')
          .eq('aggregate_type', 'artisan-payment')
          .eq('aggregate_id', paiementId)
          .order('occurred_at', { ascending: true }),
      ]);

      if (taxesResult.error) throw taxesResult.error;
      if (historiqueResult.error) throw historiqueResult.error;

      return {
        ...(data as unknown as Omit<ArtisanPaymentDossier, 'taxes' | 'historique'>),
        taxes: (taxesResult.data || []) as TaxeRetenue[],
        historique: (historiqueResult.data || []).map((event) => ({
          ...event,
          id: String(event.id),
        })) as ArtisanPaymentWorkflowEvent[],
      };
    } catch (error) {
      console.error('Erreur récupération dossier de paiement:', error);
      throw error;
    }
  },

  async getResumePaiementsArtisan(artisanId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('v_artisan_paiements_resume')
        .select('*')
        .eq('artisan_id', artisanId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur récupération résumé paiements artisan:', error);
      throw error;
    }
  },

  async getTaxesAReverser(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('v_taxes_a_reverser')
        .select('*')
        .eq('statut_reversement', 'a_reverser');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération taxes à reverser:', error);
      throw error;
    }
  },

  async getDashboardStats(): Promise<{
    total_ventes_en_attente: number;
    montant_total_a_payer: number;
    paiements_en_cours: number;
    paiements_completes: number;
    total_taxes_retenues: number;
    taxes_a_reverser: number;
  }> {
    try {
      const [ventesEnAttente, paiements, taxes] = await Promise.all([
        this.getVentesEnAttentePaiement(),
        this.getAllPaiements(),
        this.getTaxesRetenues()
      ]);

      const paiementsEnCours = paiements.filter(
        p => ['en_attente', 'en_traitement', 'valide'].includes(p.statut)
      );
      const paiementsCompletes = paiements.filter(p => p.statut === 'complete');
      const taxesAReverser = taxes.filter(t => t.statut_reversement === 'a_reverser');

      return {
        total_ventes_en_attente: ventesEnAttente.length,
        montant_total_a_payer: ventesEnAttente.reduce(
          (sum, v) => sum + (v.montant_net_a_payer || 0),
          0
        ),
        paiements_en_cours: paiementsEnCours.length,
        paiements_completes: paiementsCompletes.length,
        total_taxes_retenues: taxes.reduce((sum, t) => sum + t.montant_taxe, 0),
        taxes_a_reverser: taxesAReverser.reduce((sum, t) => sum + t.montant_taxe, 0)
      };
    } catch (error) {
      console.error('Erreur récupération stats dashboard:', error);
      throw error;
    }
  }
};

export default artisanPaiementsService;
