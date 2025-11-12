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
    return data || [];
  }

  /**
   * Récupérer les licences actives pour une compagnie minière
   */
  async getActiveLicensesByCompany(miningCompanyId: string): Promise<ExportLicense[]> {
    const { data, error } = await supabase
      .from('export_licenses')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .eq('mining_company_id', miningCompanyId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .gt('remaining_quantity_grams', 0)
      .order('end_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer une licence par ID
   */
  async getLicenseById(id: string): Promise<ExportLicense | null> {
    const { data, error } = await supabase
      .from('export_licenses')
      .select(`
        *,
        mining_company:mining_companies(id, name, code)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Créer une nouvelle licence
   */
  async createLicense(licenseData: CreateLicenseData): Promise<ExportLicense> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

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

    if (error) throw error;
    return data;
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
    return data;
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
    try {
      const { data, error } = await supabase.rpc('check_license_availability', {
        p_license_id: licenseId,
        p_required_quantity: requiredQuantity,
      });

      if (error) {
        console.error('RPC error:', error);
        // If function doesn't exist, provide manual check
        if (error.message.includes('does not exist')) {
          return await this.manualLicenseCheck(licenseId, requiredQuantity);
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          is_available: false,
          remaining_quantity: 0,
          message: 'Impossible de vérifier la disponibilité',
        };
      }

      return data[0];
    } catch (error: any) {
      console.error('License check error:', error);
      // Fallback to manual check
      return await this.manualLicenseCheck(licenseId, requiredQuantity);
    }
  }

  /**
   * Vérification manuelle si la fonction RPC n'existe pas
   */
  private async manualLicenseCheck(
    licenseId: string,
    requiredQuantity: number
  ): Promise<LicenseAvailability> {
    const license = await this.getLicenseById(licenseId);

    if (!license) {
      return {
        is_available: false,
        remaining_quantity: 0,
        message: 'Licence introuvable',
      };
    }

    if (license.status !== 'active') {
      return {
        is_available: false,
        remaining_quantity: license.remaining_quantity_grams,
        message: `Licence ${license.license_number} : statut "${license.status}" (doit être "active")`,
      };
    }

    if (new Date(license.end_date) < new Date()) {
      return {
        is_available: false,
        remaining_quantity: license.remaining_quantity_grams,
        message: `Licence ${license.license_number} expirée le ${license.end_date}`,
      };
    }

    if (license.remaining_quantity_grams < requiredQuantity) {
      return {
        is_available: false,
        remaining_quantity: license.remaining_quantity_grams,
        message: `Quantité insuffisante. Disponible: ${license.remaining_quantity_grams.toFixed(2)}g, Requis: ${requiredQuantity.toFixed(2)}g`,
      };
    }

    return {
      is_available: true,
      remaining_quantity: license.remaining_quantity_grams,
      message: `✅ Quantité disponible: ${license.remaining_quantity_grams.toFixed(2)}g`,
    };
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
