import { supabase } from '@/lib/supabase';

export interface MinePortalCompany {
  id: string;
  name: string;
  code: string | null;
  abbreviation?: string | null;
  country?: string | null;
  region?: string | null;
  province?: string | null;
  localite?: string | null;
}

export interface MinePortalBudget {
  id: string;
  year: number;
  mining_company_id: string;
}

export interface MinePortalMonthlyBudget {
  id: string;
  annual_budget_id: string;
  month: number;
  budget_oz: number;
  daily_budget_oz: number;
  mining_company_id: string;
}

export interface MinePortalForecast {
  id: string;
  annual_budget_id: string;
  quarter: number;
  month: number;
  revision_date: string;
  forecast_oz: number;
  daily_forecast_oz: number;
  mining_company_id: string;
}

export interface MinePortalProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_oz: number;
  estimated_fineness_pct: number;
  bar_reference: string | null;
  status: string;
  mining_company_id: string;
}

export interface MinePortalDocument {
  id: string;
  mining_company_id: string;
  doc_type: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface MinePortalContract {
  id: string;
  numero_contrat: string;
  intitule: string;
  statut: string;
  date_fin: string;
  quantite_totale: number | null;
  unite: string;
  mining_company_id: string;
}

export interface MinePortalRequest {
  id: string;
  numero_demande: string;
  statut: string;
  quantite_demandee_oz: number;
  montant_estime_fcfa: number;
  date_limite_reponse: string | null;
  mining_company_id: string;
}

export interface MinePortalInvoice {
  id: string;
  numero_facture: string;
  statut: string;
  date_emission: string;
  date_echeance: string;
  montant_ttc_fcfa: number;
  montant_paye_fcfa: number;
  devise: string;
  mining_company_id: string;
}

export interface MinePortalPayment {
  id: string;
  reference_reglement: string;
  statut: string;
  date_reglement: string;
  montant_fcfa: number;
  devise: string;
  reception_statut?: 'a_confirmer' | 'confirmee' | 'contestee' | 'non_requise';
  reception_motif?: string | null;
  mining_company_id: string;
}

export interface MinePortalAnalysis {
  id: string;
  reference: string;
  statut: string;
  date_prelevement: string | null;
  teneur_declaree_pct: number;
  teneur_retenue_pct: number | null;
  mining_company_id: string;
}

export interface MinePortalRequisition {
  id: string;
  reference: string;
  objet: string;
  statut: string;
  date_notification: string | null;
  quantite_oz: number | null;
  unite: string;
  mining_company_id: string;
}

export interface MinePortalSituation {
  facture_total: number;
  facture_payee: number;
  reste_du: number;
  dette_echue: number;
  nb_factures: number;
  nb_ouvertes: number;
  nb_echues: number;
  plus_ancienne_echeance: string | null;
  anciennete_moyenne: number | null;
  reglements_total: number;
  non_affecte: number;
}

export interface MinePortalSnapshot {
  company: MinePortalCompany;
  budgets: MinePortalBudget[];
  monthlyBudgets: MinePortalMonthlyBudget[];
  forecasts: MinePortalForecast[];
  productions: MinePortalProduction[];
  contracts: MinePortalContract[];
  requests: MinePortalRequest[];
  invoices: MinePortalInvoice[];
  payments: MinePortalPayment[];
  analyses: MinePortalAnalysis[];
  requisitions: MinePortalRequisition[];
  documents: MinePortalDocument[];
  situation: MinePortalSituation | null;
}

export class MinePortalDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MinePortalDataError';
  }
}

const COMPANY_LIST_TTL_MS = 60_000;
let companyListCache: { expiresAt: number; data: MinePortalCompany[] } | null = null;
let companyListRequest: Promise<MinePortalCompany[]> | null = null;
const snapshotRequests = new Map<string, Promise<MinePortalSnapshot>>();

async function loadCompanies(): Promise<MinePortalCompany[]> {
  const result = await supabase
    .from('mining_companies')
    .select('id, name, abbreviation, code, country, region, province, localite')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (result.error) {
    throw new MinePortalDataError('Impossible de charger la liste des sociétés minières.');
  }

  return (result.data || []) as MinePortalCompany[];
}

export type MineRequestDecision = 'approuver' | 'rejeter' | 'clarification';
export type MinePaymentDecision = 'confirmer' | 'contester';

function assertRpcResult(
  result: { error: { message?: string } | null },
  fallback: string,
): void {
  if (!result.error) return;
  const message = result.error.message?.trim() || '';
  const expectedBusinessMessages = [
    'L’exercice demandé', 'Le mois est invalide', 'La prévision doit', 'Les hypothèses sont',
    'La date de production', 'Le poids doit', 'La teneur estimée', 'Les observations sont',
    'Cette référence de barre', 'Demande introuvable', 'Cette demande a déjà', 'Décision invalide',
    'Un motif d’au moins', 'Règlement introuvable', 'Seul un règlement exécuté',
    'Une réponse a déjà', 'Le motif de contestation', 'Cette opération est réservée',
    'La société minière est inactive', 'Chemin de dépôt non autorisé', 'Le document doit',
    'Ce format de document', 'Le contrat sélectionné',
  ];
  const safeMessage = expectedBusinessMessages.some((prefix) => message.startsWith(prefix)) ? message : fallback;
  throw new MinePortalDataError(safeMessage);
}

type SupabaseError = { message?: string; code?: string; details?: string };
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };

function isMissingReceptionColumn(error: SupabaseError | null): boolean {
  if (!error) return false;
  const text = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return ['42703', 'PGRST204'].includes(error.code || '')
    || ((text.includes('reception_statut') || text.includes('reception_motif'))
      && (text.includes('column') || text.includes('schema cache')));
}

async function loadPayments(companyId: string): Promise<SupabaseResult<MinePortalPayment[]>> {
  const enhanced = await supabase
    .from('snp_reglements_achat')
    .select('id, reference_reglement, statut, date_reglement, montant_fcfa, devise, reception_statut, reception_motif, mining_company_id')
    .eq('mining_company_id', companyId)
    .order('date_reglement', { ascending: false })
    .limit(6);

  if (!enhanced.error || !isMissingReceptionColumn(enhanced.error)) {
    return enhanced as unknown as SupabaseResult<MinePortalPayment[]>;
  }

  // Compatibilité de déploiement : le portail reste consultable pendant que la
  // migration ajoutant l'accusé de réception est propagée. Aucune confirmation
  // n'est proposée tant que les colonnes ne sont pas présentes.
  const legacy = await supabase
    .from('snp_reglements_achat')
    .select('id, reference_reglement, statut, date_reglement, montant_fcfa, devise, mining_company_id')
    .eq('mining_company_id', companyId)
    .order('date_reglement', { ascending: false })
    .limit(6);

  return {
    error: legacy.error,
    data: legacy.data?.map((payment) => ({
      ...payment,
      reception_statut: 'non_requise' as const,
      reception_motif: null,
    })) ?? null,
  } as SupabaseResult<MinePortalPayment[]>;
}

function rowsForCompany<T extends { mining_company_id: string }>(
  result: SupabaseResult<T[]>,
  companyId: string,
  source: string,
): T[] {
  if (result.error) throw new MinePortalDataError(`Impossible de charger ${source}.`);
  // Filtre défensif : la RLS reste l'autorité, mais une réponse inattendue ne
  // doit jamais être rendue dans le portail d'une autre société.
  return (result.data || []).filter((row) => row.mining_company_id === companyId);
}

export const minePortalService = {
  async listCompanies(): Promise<MinePortalCompany[]> {
    if (companyListCache && companyListCache.expiresAt > Date.now()) {
      return companyListCache.data;
    }

    if (!companyListRequest) {
      companyListRequest = loadCompanies()
        .then((companies) => {
          companyListCache = {
            expiresAt: Date.now() + COMPANY_LIST_TTL_MS,
            data: companies,
          };
          return companies;
        })
        .finally(() => {
          companyListRequest = null;
        });
    }

    return companyListRequest;
  },

  async load(companyId: string, options: { force?: boolean } = {}): Promise<MinePortalSnapshot> {
    if (!companyId.trim()) throw new MinePortalDataError('Aucune société minière n’est rattachée à ce compte.');

    const pendingRequest = snapshotRequests.get(companyId);
    if (pendingRequest && !options.force) return pendingRequest;

    const request = (async () => {

    const [companyResult, budgetsResult, monthlyBudgetsResult, forecastsResult, productionsResult, contractsResult, requestsResult, invoicesResult, paymentsResult, analysesResult, requisitionsResult, documentsResult, situationResult] = await Promise.all([
      supabase.from('mining_companies').select('id, name, abbreviation, code, country, region, province, localite, is_active').eq('id', companyId).eq('is_active', true).maybeSingle(),
      supabase.from('annual_budgets').select('id, year, mining_company_id').eq('mining_company_id', companyId).order('year', { ascending: false }).limit(4),
      supabase.from('monthly_budgets').select('id, annual_budget_id, month, budget_oz, daily_budget_oz, mining_company_id').eq('mining_company_id', companyId).order('month', { ascending: true }),
      supabase.from('quarterly_forecasts').select('id, annual_budget_id, quarter, month, revision_date, forecast_oz, daily_forecast_oz, mining_company_id').eq('mining_company_id', companyId).order('revision_date', { ascending: false }).limit(24),
      supabase.from('daily_production').select('id, production_date, bullion_grams, estimated_oz, estimated_fineness_pct, bar_reference, status, mining_company_id').eq('mining_company_id', companyId).order('production_date', { ascending: false }).limit(30),
      supabase.from('snp_contrats').select('id, numero_contrat, intitule, statut, date_fin, quantite_totale, unite, mining_company_id').eq('mining_company_id', companyId).order('date_fin', { ascending: true }).limit(6),
      supabase.from('snp_demandes_achat').select('id, numero_demande, statut, quantite_demandee_oz, montant_estime_fcfa, date_limite_reponse, mining_company_id').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(6),
      supabase.from('snp_factures_achat').select('id, numero_facture, statut, date_emission, date_echeance, montant_ttc_fcfa, montant_paye_fcfa, devise, mining_company_id').eq('mining_company_id', companyId).order('date_emission', { ascending: false }).limit(6),
      loadPayments(companyId),
      supabase.from('snp_analyses_teneur').select('id, reference, statut, date_prelevement, teneur_declaree_pct, teneur_retenue_pct, mining_company_id').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(6),
      supabase.from('snp_requisitions').select('id, reference, objet, statut, date_notification, quantite_oz, unite, mining_company_id').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(6),
      supabase.from('mining_company_documents').select('id, mining_company_id, doc_type, file_name, file_path, file_size, mime_type, created_at').eq('mining_company_id', companyId).order('created_at', { ascending: false }).limit(20),
      supabase.rpc('snp_situation_societe', { p_mining_company_id: companyId }).maybeSingle(),
    ]) as [
      SupabaseResult<(MinePortalCompany & { is_active: boolean })>,
      SupabaseResult<MinePortalBudget[]>,
      SupabaseResult<MinePortalMonthlyBudget[]>,
      SupabaseResult<MinePortalForecast[]>,
      SupabaseResult<MinePortalProduction[]>,
      SupabaseResult<MinePortalContract[]>,
      SupabaseResult<MinePortalRequest[]>,
      SupabaseResult<MinePortalInvoice[]>,
      SupabaseResult<MinePortalPayment[]>,
      SupabaseResult<MinePortalAnalysis[]>,
      SupabaseResult<MinePortalRequisition[]>,
      SupabaseResult<MinePortalDocument[]>,
      SupabaseResult<MinePortalSituation>,
    ];

    if (companyResult.error || !companyResult.data || companyResult.data.is_active === false) {
      throw new MinePortalDataError('La société minière rattachée est introuvable ou inactive.');
    }
    if (situationResult.error) throw new MinePortalDataError('Impossible de charger la situation financière.');

    const company: MinePortalCompany = {
      id: companyResult.data.id,
      name: companyResult.data.name,
      code: companyResult.data.code,
      abbreviation: companyResult.data.abbreviation,
      country: companyResult.data.country,
      region: companyResult.data.region,
      province: companyResult.data.province,
      localite: companyResult.data.localite,
    };
    return {
      company,
      budgets: rowsForCompany(budgetsResult, companyId, 'les budgets'),
      monthlyBudgets: rowsForCompany(monthlyBudgetsResult, companyId, 'les budgets mensuels'),
      forecasts: rowsForCompany(forecastsResult, companyId, 'les prévisions'),
      productions: rowsForCompany(productionsResult, companyId, 'la production'),
      contracts: rowsForCompany(contractsResult, companyId, 'les contrats'),
      requests: rowsForCompany(requestsResult, companyId, 'les demandes'),
      invoices: rowsForCompany(invoicesResult, companyId, 'les factures'),
      payments: rowsForCompany(paymentsResult, companyId, 'les règlements'),
      analyses: rowsForCompany(analysesResult, companyId, 'les analyses'),
      requisitions: rowsForCompany(requisitionsResult, companyId, 'les réquisitions'),
      documents: rowsForCompany(documentsResult, companyId, 'les documents'),
      situation: situationResult.data || null,
    };

    })();

    if (!options.force) snapshotRequests.set(companyId, request);
    try {
      return await request;
    } finally {
      if (snapshotRequests.get(companyId) === request) snapshotRequests.delete(companyId);
    }
  },

  async submitForecast(input: { year: number; month: number; forecastOz: number; notes?: string }): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_soumettre_prevision', {
      p_annee: input.year,
      p_mois: input.month,
      p_prevision_oz: input.forecastOz,
      p_notes: input.notes?.trim() || null,
    });
    assertRpcResult(result, 'La prévision n’a pas pu être transmise.');
  },

  async submitMonthlyBudget(input: { year: number; month: number; budgetOz: number }): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_soumettre_budget', {
      p_annee: input.year,
      p_mois: input.month,
      p_budget_oz: input.budgetOz,
    });
    assertRpcResult(result, 'L’objectif budgétaire n’a pas pu être transmis.');
  },

  async declareProduction(input: {
    productionDate: string;
    bullionGrams: number;
    finenessPct: number;
    barReference?: string;
    notes?: string;
  }): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_declarer_production', {
      p_date_production: input.productionDate,
      p_poids_brut_grammes: input.bullionGrams,
      p_teneur_estimee_pct: input.finenessPct,
      p_reference_barre: input.barReference?.trim() || null,
      p_notes: input.notes?.trim() || null,
    });
    assertRpcResult(result, 'La déclaration de production n’a pas pu être transmise.');
  },

  async updateProduction(input: {
    productionId: string;
    productionDate: string;
    bullionGrams: number;
    finenessPct: number;
    barReference?: string;
    notes?: string;
  }): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_modifier_production', {
      p_production_id: input.productionId,
      p_date_production: input.productionDate,
      p_poids_brut_grammes: input.bullionGrams,
      p_teneur_estimee_pct: input.finenessPct,
      p_reference_barre: input.barReference?.trim() || null,
      p_notes: input.notes?.trim() || null,
    });
    assertRpcResult(result, 'La production n’a pas pu être modifiée.');
  },

  async deleteProduction(productionId: string): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_supprimer_production', {
      p_production_id: productionId,
    });
    assertRpcResult(result, 'La production n’a pas pu être supprimée.');
  },

  async respondToRequest(requestId: string, decision: MineRequestDecision, reason?: string): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_repondre_demande', {
      p_demande_id: requestId,
      p_decision: decision,
      p_motif: reason?.trim() || null,
    });
    assertRpcResult(result, 'La réponse à la demande n’a pas pu être enregistrée.');
  },

  async respondToPayment(paymentId: string, decision: MinePaymentDecision, reason?: string): Promise<void> {
    const result = await supabase.rpc('snp_portail_mine_repondre_reglement', {
      p_reglement_id: paymentId,
      p_decision: decision,
      p_motif: reason?.trim() || null,
    });
    assertRpcResult(result, 'La confirmation du règlement n’a pas pu être enregistrée.');
  },

  async uploadDocument(input: { file: File; documentType: string; contractId?: string }): Promise<void> {
    const session = await supabase.auth.getUser();
    if (!session.data.user || session.error) throw new MinePortalDataError('Votre session a expiré. Reconnectez-vous.');
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
    const objectPath = `incoming/${session.data.user.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage
      .from('mining-company-documents')
      .upload(objectPath, input.file, { contentType: input.file.type || 'application/octet-stream', upsert: false });

    if (upload.error) throw new MinePortalDataError('Le fichier n’a pas pu être téléversé.');

    const registration = await supabase.rpc('snp_portail_mine_enregistrer_document', {
      p_chemin_temporaire: upload.data.path,
      p_nom_fichier: input.file.name,
      p_type_document: input.documentType,
      p_type_mime: input.file.type || 'application/octet-stream',
      p_taille_octets: input.file.size,
      p_contrat_id: input.contractId || null,
    });

    if (registration.error) {
      await supabase.storage.from('mining-company-documents').remove([upload.data.path]);
      assertRpcResult(registration, 'Le document n’a pas pu être rattaché au dossier.');
    }
  },

  async getDocumentUrl(filePath: string): Promise<string> {
    const result = await supabase.storage.from('mining-company-documents').createSignedUrl(filePath, 60);
    if (result.error || !result.data?.signedUrl) {
      throw new MinePortalDataError('Le document ne peut pas être ouvert pour le moment.');
    }
    return result.data.signedUrl;
  },
};
