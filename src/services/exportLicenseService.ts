import { supabase } from '@/lib/supabase';

export interface ExportLicense {
  id: string;
  license_number: string;
  mining_company_id: string;
  request_date: string;
  start_date: string;
  end_date: string;
  issuing_institution: string;
  authorized_quantity_grams: number;
  used_quantity_grams: number;
  remaining_quantity_grams: number;
  average_sale_price: number | null;
  status: 'pending' | 'active' | 'expired' | 'exhausted' | 'suspended' | 'cancelled';
  comments: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  mining_company?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface ExportLicenseDocument {
  id: string;
  license_id: string;
  document_name: string;
  document_type: string | null;
  file_url: string | null;
  file_path: string | null;
  file_size_kb: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  description: string | null;
}

export interface LicenseAvailability {
  is_available: boolean;
  remaining_quantity: number;
  message: string;
}

export interface CreateLicenseData {
  license_number: string;
  mining_company_id: string;
  request_date: string;
  start_date: string;
  end_date: string;
  issuing_institution: string;
  authorized_quantity_grams: number;
  average_sale_price?: number;
  comments?: string;
  notes?: string;
}

export interface UpdateLicenseData extends Partial<CreateLicenseData> {
  status?: 'pending' | 'active' | 'expired' | 'exhausted' | 'suspended' | 'cancelled';
}

export interface MineExportLicenseRequestInput {
  requestedQuantityGrams: number;
  desiredExportDate: string;
  destination: string;
  reason: string;
  comment?: string;
}

export interface MineExportLicenseRequest {
  id: string;
  mining_company_id: string;
  requested_quantity_grams: number;
  desired_export_date: string;
  destination: string;
  reason: string;
  comment: string | null;
  status: string;
  submitted_by: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_reason: string | null;
  license_id: string | null;
}

/**
 * Certains environnements historiques conservent le reliquat dans une colonne
 * ordinaire. Une licence nouvellement créée peut donc revenir avec `NULL` tant
 * que la migration de synchronisation n'a pas encore été appliquée.
 *
 * Le client ne doit ni masquer cette licence ni propager un quota indéfini : le
 * reliquat canonique est toujours quantité autorisée - quantité consommée.
 */
export function normalizeExportLicenseQuota(license: ExportLicense): ExportLicense {
  const authorizedQuantity = Number(license.authorized_quantity_grams) || 0;
  const usedQuantity = Number(license.used_quantity_grams) || 0;
  const storedRemaining = license.remaining_quantity_grams;
  const remainingQuantity = storedRemaining == null
    ? authorizedQuantity - usedQuantity
    : Number(storedRemaining);

  return {
    ...license,
    authorized_quantity_grams: authorizedQuantity,
    used_quantity_grams: usedQuantity,
    remaining_quantity_grams: Math.max(0, Number.isFinite(remainingQuantity) ? remainingQuantity : 0),
  };
}

/** Défense UI supplémentaire : la requête et la RLS restent autoritatives. */
export function isExportLicenseSelectable(
  license: ExportLicense,
  miningCompanyId: string,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  return Boolean(
    miningCompanyId
      && license.mining_company_id === miningCompanyId
      && license.status === 'active'
      && license.start_date <= today
      && license.end_date >= today
      && Number(license.remaining_quantity_grams) > 0,
  );
}

export class ExportLicenseWorkflowUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportLicenseWorkflowUnavailableError';
  }
}

class ExportLicenseService {
  /**
   * Récupérer toutes les licences avec leurs compagnies minières
   */
  async getAllLicenses(): Promise<ExportLicense[]> {
    const { data, error } = await supabase
      .from('export_licenses')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((license) => normalizeExportLicenseQuota(license as ExportLicense));
  }

  /**
   * Récupérer toutes les licences d'une société, quel que soit leur statut.
   *
   * Le filtre explicite complète la RLS : une page du portail Mine ne lance
   * jamais une lecture nationale avant de filtrer côté navigateur.
   */
  async getLicensesByCompany(miningCompanyId: string): Promise<ExportLicense[]> {
    if (!miningCompanyId.trim()) return [];

    const { data, error } = await supabase
      .from('export_licenses')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .eq('mining_company_id', miningCompanyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((license) => normalizeExportLicenseQuota(license as ExportLicense));
  }

  /**
   * Récupérer les licences actives pour une compagnie minière
   */
  async getActiveLicensesByCompany(miningCompanyId: string): Promise<ExportLicense[]> {
    if (!miningCompanyId.trim()) return [];

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('export_licenses')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .eq('mining_company_id', miningCompanyId)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('end_date', { ascending: true });

    if (error) throw error;
    return (data || [])
      .map((license) => normalizeExportLicenseQuota(license as ExportLicense))
      .filter((license) => isExportLicenseSelectable(license, miningCompanyId, today));
  }

  /**
   * Récupérer une licence par ID
   */
  async getLicenseById(id: string, miningCompanyId?: string | null): Promise<ExportLicense | null> {
    let query = supabase
      .from('export_licenses')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .eq('id', id);

    if (miningCompanyId) query = query.eq('mining_company_id', miningCompanyId);

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data ? normalizeExportLicenseQuota(data as ExportLicense) : null;
  }

  /**
   * Créer une nouvelle licence
   */
  async createLicense(licenseData: CreateLicenseData): Promise<ExportLicense> {
    try {
      console.log('🚀 Creating export license:', licenseData);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      console.log('👤 User ID:', userId);

      // Exclude generated columns
      const { remaining_quantity_grams, used_quantity_grams, ...insertData } = licenseData as any;

      const { data, error } = await supabase
        .from('export_licenses')
        .insert({
          ...insertData,
          created_by: userId,
          updated_by: userId,
        })
        .select(`
          *,
          mining_company:mining_companies(id, name, code)
        `)
        .single();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw new Error(`Erreur d'enregistrement de licence: ${error.message}`);
      }

      console.log('✅ License created successfully:', data);
      return normalizeExportLicenseQuota(data as ExportLicense);
    } catch (error: any) {
      console.error('❌ Service error:', error);
      throw new Error(error.message || 'Impossible de créer la licence');
    }
  }

  /**
   * Mettre à jour une licence
   */
  async updateLicense(id: string, updates: UpdateLicenseData): Promise<ExportLicense> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // Exclude generated columns
    const { remaining_quantity_grams, used_quantity_grams, ...updateData } = updates as any;

    const { data, error } = await supabase
      .from('export_licenses')
      .update({
        ...updateData,
        updated_by: userId,
      })
      .eq('id', id)
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .single();

    if (error) throw error;
    return normalizeExportLicenseQuota(data as ExportLicense);
  }

  /**
   * Supprimer une licence
   */
  async deleteLicense(id: string): Promise<void> {
    const { error } = await supabase
      .from('export_licenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Vérifier la disponibilité d'une licence pour une quantité donnée
   */
  async checkLicenseAvailability(
    licenseId: string,
    requiredQuantity: number
  ): Promise<LicenseAvailability> {
    if (!licenseId.trim() || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      throw new Error('Une licence et une quantité strictement positive sont requises.');
    }

    const { data, error } = await supabase.rpc('check_license_availability', {
      p_license_id: licenseId,
      p_required_quantity: requiredQuantity,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.remaining_quantity == null
      || !Number.isFinite(Number(result.remaining_quantity))) {
      throw new ExportLicenseWorkflowUnavailableError(
        'La vérification sécurisée du quota n’a renvoyé aucun résultat exploitable.',
      );
    }

    return {
      is_available: Boolean(result.is_available),
      remaining_quantity: Number(result.remaining_quantity),
      message: String(result.message || ''),
    };
  }

  /** Soumet une demande ; le tenant, l’auteur et le statut sont dérivés en base. */
  async submitMineLicenseRequest(
    input: MineExportLicenseRequestInput,
  ): Promise<MineExportLicenseRequest> {
    const destination = input.destination.trim();
    const reason = input.reason.trim();
    const comment = input.comment?.trim() || null;
    if (!Number.isFinite(input.requestedQuantityGrams) || input.requestedQuantityGrams <= 0) {
      throw new Error('La quantité demandée doit être strictement positive.');
    }
    if (!input.desiredExportDate) throw new Error('La date d’export souhaitée est obligatoire.');
    if (input.desiredExportDate < new Date().toISOString().slice(0, 10)) {
      throw new Error('La date d’export souhaitée ne peut pas être passée.');
    }
    if (destination.length < 2) throw new Error('La destination est obligatoire.');
    if (reason.length < 10) throw new Error('Le motif doit contenir au moins 10 caractères.');

    const { data, error } = await supabase.rpc(
      'snp_portail_mine_soumettre_demande_licence_export',
      {
        p_quantite_demandee_grammes: input.requestedQuantityGrams,
        p_date_export_souhaitee: input.desiredExportDate,
        p_destination: destination,
        p_motif: reason,
        p_commentaire: comment,
      },
    );
    if (error) {
      const message = String(error.message || '');
      if (error.code === '42883' || /does not exist|schema cache|function/i.test(message)) {
        throw new ExportLicenseWorkflowUnavailableError(
          'Le service sécurisé de demande de licence n’est pas disponible. Contactez la SONASP ; aucune demande n’a été enregistrée.',
        );
      }
      throw error;
    }
    if (!data || typeof data !== 'object') {
      throw new ExportLicenseWorkflowUnavailableError(
        'La demande n’a pas pu être confirmée par le service sécurisé.',
      );
    }
    return data as MineExportLicenseRequest;
  }

  /**
   * Ajouter un document à une licence
   */
  async addDocument(documentData: {
    license_id: string;
    document_name: string;
    document_type?: string;
    file_url?: string;
    file_path?: string;
    file_size_kb?: number;
    description?: string;
  }): Promise<ExportLicenseDocument> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data, error } = await supabase
      .from('export_license_documents')
      .insert({
        ...documentData,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les documents d'une licence
   */
  async getLicenseDocuments(licenseId: string): Promise<ExportLicenseDocument[]> {
    const { data, error } = await supabase
      .from('export_license_documents')
      .select('*')
      .eq('license_id', licenseId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Supprimer un document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('export_license_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  }

  /**
   * Récupérer le résumé des licences (via vue)
   */
  async getLicensesSummary() {
    const { data, error } = await supabase
      .from('v_export_licenses_summary')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Générer un numéro de licence automatique
   */
  async generateLicenseNumber(companyCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const { count, error } = await supabase
      .from('export_licenses')
      .select('*', { count: 'exact', head: true })
      .like('license_number', `%${year}%`);

    if (error) throw error;

    const sequenceNumber = String((count || 0) + 1).padStart(4, '0');
    return `EXP-${companyCode}-${year}-${sequenceNumber}`;
  }

  /**
   * Calculer les statistiques d'une licence
   */
  async getLicenseStatistics(licenseId: string) {
    const license = await this.getLicenseById(licenseId);
    if (!license) return null;

    const { data: shipments } = await supabase
      .from('shipping_preparations')
      .select('*')
      .eq('license_id', licenseId);

    const usagePercentage =
      (license.used_quantity_grams / license.authorized_quantity_grams) * 100;

    const daysRemaining = Math.ceil(
      (new Date(license.end_date).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      license,
      totalShipments: shipments?.length || 0,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      daysRemaining: Math.max(0, daysRemaining),
      isExpiringSoon: daysRemaining <= 30 && daysRemaining > 0,
      isAlmostExhausted: usagePercentage >= 90,
    };
  }
}

export const exportLicenseService = new ExportLicenseService();
