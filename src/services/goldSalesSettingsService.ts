import { supabase } from '@/lib/supabase';

export type SaleMethod = 'standard' | 'consignment' | 'forward_sale' | 'spot_sale';

export interface GoldSalesSetting {
  id: string;
  mining_company_id: string;
  customer_id: string;
  max_stock_percentage: number;
  sale_method: SaleMethod;
  refining_fees_paid_by_customer: boolean;
  transport_fees_paid_by_customer: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface GoldSalesSettingView extends GoldSalesSetting {
  mining_company_name: string;
  mining_company_abbr: string;
  customer_name: string;
  contact_person?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface CreateGoldSalesSettingData {
  mining_company_id: string;
  customer_id: string;
  max_stock_percentage: number;
  sale_method: SaleMethod;
  refining_fees_paid_by_customer: boolean;
  transport_fees_paid_by_customer: boolean;
  notes?: string;
}

export interface UpdateGoldSalesSettingData {
  max_stock_percentage?: number;
  sale_method?: SaleMethod;
  refining_fees_paid_by_customer?: boolean;
  transport_fees_paid_by_customer?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface AuthorizedCustomer {
  customer_id: string;
  customer_name: string;
  max_stock_percentage: number;
  sale_method: SaleMethod;
  refining_fees_paid_by_customer: boolean;
  transport_fees_paid_by_customer: boolean;
}

export interface SaleAuthorizationResult {
  is_authorized: boolean;
  reason: string;
  max_allowed_oz: number;
  settings: {
    max_stock_percentage: number;
    sale_method: SaleMethod;
    refining_fees_paid_by_customer: boolean;
    transport_fees_paid_by_customer: boolean;
  } | null;
}

// Récupérer toutes les configurations
export async function getAllGoldSalesSettings() {
  try {
    const { data, error } = await supabase
      .from('gold_sales_settings_view')
      .select('*')
      .order('mining_company_name', { ascending: true })
      .order('customer_name', { ascending: true });

    if (error) throw error;

    return {success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching gold sales settings:', error);
    return {
      success: false,
      data: [],
      error: {
        message: 'Erreur lors de la récupération des paramètres de vente.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Récupérer une configuration par ID
export async function getGoldSalesSettingById(id: string) {
  try {
    const { data, error } = await supabase
      .from('gold_sales_settings_view')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching gold sales setting:', error);
    return {
      success: false,
      data: null,
      error: {
        message: 'Erreur lors de la récupération du paramètre de vente.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Récupérer les configurations pour une mine
export async function getGoldSalesSettingsByMiningCompany(miningCompanyId: string) {
  try {
    const { data, error } = await supabase
      .from('gold_sales_settings_view')
      .select('*')
      .eq('mining_company_id', miningCompanyId)
      .order('customer_name', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching settings by mining company:', error);
    return {
      success: false,
      data: [],
      error: {
        message: 'Erreur lors de la récupération des paramètres pour cette mine.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Créer une nouvelle configuration
export async function createGoldSalesSetting(data: CreateGoldSalesSettingData) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: {
          message: 'Vous devez être connecté pour effectuer cette action.',
          technicalDetails: userError?.message || 'User not authenticated'
        }
      };
    }

    const { data: result, error } = await supabase
      .from('gold_sales_settings')
      .insert({
        ...data,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single();

    if (error) {
      let userMessage = 'Erreur lors de la création du paramètre de vente.';

      if (error.code === '23505') { // unique violation
        userMessage = 'Une configuration existe déjà pour ce couple Mine-Client.';
      } else if (error.code === '23503') { // foreign key violation
        userMessage = 'La mine ou le client sélectionné n\'existe pas.';
      } else if (error.code === '23514') { // check constraint violation
        userMessage = 'Les valeurs saisies ne respectent pas les contraintes (ex: pourcentage entre 1 et 100).';
      }

      return {
        success: false,
        error: {
          message: userMessage,
          technicalDetails: `Code: ${error.code}\nMessage: ${error.message}\nDétails: ${error.details || 'N/A'}`
        }
      };
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error creating gold sales setting:', error);
    return {
      success: false,
      error: {
        message: 'Une erreur inattendue est survenue lors de la création.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Mettre à jour une configuration
export async function updateGoldSalesSetting(id: string, data: UpdateGoldSalesSettingData) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: {
          message: 'Vous devez être connecté pour effectuer cette action.',
          technicalDetails: userError?.message || 'User not authenticated'
        }
      };
    }

    const { data: result, error } = await supabase
      .from('gold_sales_settings')
      .update({
        ...data,
        updated_by: user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      let userMessage = 'Erreur lors de la mise à jour du paramètre de vente.';

      if (error.code === '23514') { // check constraint violation
        userMessage = 'Les valeurs saisies ne respectent pas les contraintes (ex: pourcentage entre 1 et 100).';
      }

      return {
        success: false,
        error: {
          message: userMessage,
          technicalDetails: `Code: ${error.code}\nMessage: ${error.message}\nDétails: ${error.details || 'N/A'}`
        }
      };
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error updating gold sales setting:', error);
    return {
      success: false,
      error: {
        message: 'Une erreur inattendue est survenue lors de la mise à jour.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Supprimer une configuration
export async function deleteGoldSalesSetting(id: string) {
  try {
    const { error } = await supabase
      .from('gold_sales_settings')
      .delete()
      .eq('id', id);

    if (error) {
      return {
        success: false,
        error: {
          message: 'Erreur lors de la suppression du paramètre de vente.',
          technicalDetails: `Code: ${error.code}\nMessage: ${error.message}`
        }
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting gold sales setting:', error);
    return {
      success: false,
      error: {
        message: 'Une erreur inattendue est survenue lors de la suppression.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Obtenir les clients autorisés pour une mine
export async function getAuthorizedCustomersForMine(miningCompanyId: string): Promise<{
  success: boolean;
  data: AuthorizedCustomer[];
  error?: any;
}> {
  try {
    const { data, error } = await supabase
      .rpc('get_authorized_customers_for_mine', {
        p_mining_company_id: miningCompanyId
      });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching authorized customers:', error);
    return {
      success: false,
      data: [],
      error: {
        message: 'Erreur lors de la récupération des clients autorisés.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Vérifier si une vente est autorisée
export async function checkSaleAuthorization(
  miningCompanyId: string,
  customerId: string,
  quantityOz: number,
  availableStockOz: number
): Promise<{
  success: boolean;
  data?: SaleAuthorizationResult;
  error?: any;
}> {
  try {
    const { data, error } = await supabase
      .rpc('check_sale_authorization', {
        p_mining_company_id: miningCompanyId,
        p_customer_id: customerId,
        p_quantity_oz: quantityOz,
        p_available_stock_oz: availableStockOz
      });

    if (error) throw error;

    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      return {
        success: false,
        error: {
          message: 'Aucun résultat retourné par la vérification.',
          technicalDetails: 'No data returned from check_sale_authorization'
        }
      };
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error checking sale authorization:', error);
    return {
      success: false,
      error: {
        message: 'Erreur lors de la vérification de l\'autorisation de vente.',
        technicalDetails: error?.message || JSON.stringify(error, null, 2)
      }
    };
  }
}

// Obtenir les méthodes de vente disponibles
export function getSaleMethods(): Array<{ value: SaleMethod; label: string; description: string }> {
  return [
    {
      value: 'standard',
      label: 'Standard',
      description: 'Vente standard immédiate au prix du marché'
    },
    {
      value: 'consignment',
      label: 'Consignation',
      description: 'Vente en consignation avec paiement différé'
    },
    {
      value: 'forward_sale',
      label: 'Vente à terme',
      description: 'Vente à terme avec prix fixé à l\'avance'
    },
    {
      value: 'spot_sale',
      label: 'Vente au comptant',
      description: 'Vente au prix spot du marché'
    }
  ];
}
