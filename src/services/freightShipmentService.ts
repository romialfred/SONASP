import { supabase } from '@/lib/supabase';

export type FreightShipmentStatus =
  | 'pending'
  | 'approved'
  | 'shipped_to_refinery'
  | 'received_at_refinery';

export interface FreightShipment {
  id: string;
  reference_number: string;
  status: FreightShipmentStatus;
  shipment_date: string;
  destination_refinery_id?: string | null;
  number_of_boxes: number;
  box_type: string;
  gold_price_usd_per_oz: number;
  exchange_rate: number;
  local_currency: string;
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_pure_gold_oz: number;
  total_pure_silver_grams: number;
  total_value_usd: number;
  total_value_local: number;
  production_count: number;
  bullion_summary_pdf_path?: string | null;
  customs_invoice_pdf_path?: string | null;
  notes?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  shipped_at?: string | null;
  shipped_by?: string | null;
  received_at?: string | null;
  received_by?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Relations
  destination_refinery?: any;
  productions?: FreightShipmentProduction[];
  signatories?: FreightShipmentSignatory[];
}

export interface FreightShipmentProduction {
  id: string;
  freight_shipment_id: string;
  production_id: string;
  production_date: string;
  bar_reference: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  estimated_silver_pct: number;
  pure_gold_grams: number;
  pure_gold_oz: number;
  silver_content_grams: number;
  added_at: string;
  added_by?: string | null;
}

export interface FreightShipmentSignatory {
  id: string;
  freight_shipment_id: string;
  position: string;
  full_name: string;
  display_order: number;
  signature_data?: string | null;
  signed_at?: string | null;
  created_at: string;
}

/**
 * Production individuelle disponible pour expédition
 * Statut: ready_for_customs (Prêt pour Expédition vers Raffinerie)
 */
export interface AvailableProduction {
  id: string;
  production_date: string;
  bar_reference: string;
  status: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  estimated_silver_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  silver_content_grams: number;
  mining_company_id?: string | null;
  mining_companies?: {
    id: string;
    name: string;
    country?: string;
  };
}

export const freightShipmentService = {
  /**
   * Récupère toutes les expéditions freight
   */
  async listShipments(): Promise<FreightShipment[]> {
    const { data, error } = await supabase
      .from('freight_shipments')
      .select(`
        *,
        destination_refinery:refineries(id, name, location, country),
        productions:freight_shipment_productions(
          *,
          daily_production:daily_production(
            id,
            production_date,
            bar_reference,
            mining_company_id,
            mining_companies(id, name)
          )
        ),
        signatories:freight_shipment_signatories(*)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère une expédition par ID
   */
  async getShipmentById(id: string): Promise<FreightShipment | null> {
    const { data, error } = await supabase
      .from('freight_shipments')
      .select(`
        *,
        destination_refinery:refineries(*),
        productions:freight_shipment_productions(
          *,
          daily_production:daily_production(
            *,
            mining_companies(id, name, country)
          )
        ),
        signatories:freight_shipment_signatories(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Récupère les productions individuelles disponibles pour expédition
   * Statut: ready_for_customs (Prêt pour Douane = Prêt pour Expédition)
   */
  async getAvailableProductions(): Promise<AvailableProduction[]> {
    const { data, error } = await supabase
      .from('daily_production')
      .select(`
        id,
        production_date,
        bar_reference,
        status,
        bullion_grams,
        estimated_fineness_pct,
        estimated_silver_pct,
        pure_gold_grams,
        estimated_oz,
        silver_content_grams,
        mining_company_id,
        mining_companies:mining_company_id(id, name, country)
      `)
      .eq('status', 'ready_for_customs')
      .order('production_date', { ascending: false });

    if (error) throw error;

    // Filtrer les productions déjà assignées à une expédition freight
    const { data: assignedProductions } = await supabase
      .from('freight_shipment_productions')
      .select('production_id');

    const assignedIds = new Set(assignedProductions?.map(p => p.production_id) || []);

    return (data || []).filter(prod => !assignedIds.has(prod.id));
  },

  /**
   * Crée une nouvelle expédition freight avec plusieurs productions
   */
  async createShipment(data: {
    production_ids: string[];
    shipment_date?: string;
    destination_refinery_id?: string;
    number_of_boxes: number;
    box_type: string;
    gold_price_usd_per_oz: number;
    exchange_rate: number;
    local_currency: string;
    notes?: string;
    signatories?: Array<{ position: string; full_name: string; display_order: number }>;
  }): Promise<FreightShipment> {
    const { data: userData } = await supabase.auth.getUser();

    // Générer le numéro de référence
    const { data: refData, error: refError } = await supabase.rpc(
      'generate_freight_shipment_reference'
    );

    if (refError) throw refError;

    // Récupérer les informations des productions sélectionnées
    const { data: productions, error: prodError } = await supabase
      .from('daily_production')
      .select(`
        id,
        production_date,
        bar_reference,
        bullion_grams,
        estimated_fineness_pct,
        estimated_silver_pct,
        pure_gold_grams,
        estimated_oz,
        silver_content_grams
      `)
      .in('id', data.production_ids);

    if (prodError) throw prodError;
    if (!productions || productions.length === 0) {
      throw new Error('Aucune production trouvée avec les IDs fournis');
    }

    // Créer l'expédition freight
    const { data: shipment, error: shipmentError } = await supabase
      .from('freight_shipments')
      .insert({
        reference_number: refData,
        status: 'pending',
        shipment_date: data.shipment_date || new Date().toISOString(),
        destination_refinery_id: data.destination_refinery_id,
        number_of_boxes: data.number_of_boxes,
        box_type: data.box_type,
        gold_price_usd_per_oz: data.gold_price_usd_per_oz,
        exchange_rate: data.exchange_rate,
        local_currency: data.local_currency,
        notes: data.notes,
        created_by: userData?.user?.id,
      })
      .select()
      .single();

    if (shipmentError) throw shipmentError;

    // Ajouter les productions
    const productionsToInsert = productions.map((prod: any) => ({
      freight_shipment_id: shipment.id,
      production_id: prod.id,
      production_date: prod.production_date,
      bar_reference: prod.bar_reference,
      bullion_grams: prod.bullion_grams,
      estimated_fineness_pct: prod.estimated_fineness_pct,
      estimated_silver_pct: prod.estimated_silver_pct || 0,
      pure_gold_grams: prod.pure_gold_grams,
      pure_gold_oz: prod.estimated_oz,
      silver_content_grams: prod.silver_content_grams || 0,
      added_by: userData?.user?.id,
    }));

    const { error: prodInsertError } = await supabase
      .from('freight_shipment_productions')
      .insert(productionsToInsert);

    if (prodInsertError) throw prodInsertError;

    // Ajouter les signataires
    if (data.signatories && data.signatories.length > 0) {
      const signatoriesToInsert = data.signatories.map((sig) => ({
        freight_shipment_id: shipment.id,
        position: sig.position,
        full_name: sig.full_name,
        display_order: sig.display_order,
      }));

      const { error: sigError } = await supabase
        .from('freight_shipment_signatories')
        .insert(signatoriesToInsert);

      if (sigError) throw sigError;
    }

    // Retourner l'expédition complète
    return this.getShipmentById(shipment.id) as Promise<FreightShipment>;
  },

  /**
   * Met à jour une expédition
   */
  async updateShipment(
    id: string,
    updates: Partial<FreightShipment>
  ): Promise<FreightShipment> {
    const { data, error } = await supabase
      .from('freight_shipments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Change le statut d'une expédition
   */
  async updateStatus(
    id: string,
    status: FreightShipmentStatus
  ): Promise<FreightShipment> {
    const { data: userData } = await supabase.auth.getUser();
    const updates: any = { status };

    // Ajouter les timestamps selon le statut
    if (status === 'approved') {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = userData?.user?.id;
    } else if (status === 'shipped_to_refinery') {
      updates.shipped_at = new Date().toISOString();
      updates.shipped_by = userData?.user?.id;
    } else if (status === 'received_at_refinery') {
      updates.received_at = new Date().toISOString();
      updates.received_by = userData?.user?.id;
    }

    return this.updateShipment(id, updates);
  },

  /**
   * Ajoute un signataire
   */
  async addSignatory(
    shipmentId: string,
    signatory: { position: string; full_name: string; display_order: number }
  ): Promise<FreightShipmentSignatory> {
    const { data, error } = await supabase
      .from('freight_shipment_signatories')
      .insert({
        freight_shipment_id: shipmentId,
        ...signatory,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Supprime un signataire
   */
  async removeSignatory(signatoryId: string): Promise<void> {
    const { error } = await supabase
      .from('freight_shipment_signatories')
      .delete()
      .eq('id', signatoryId);

    if (error) throw error;
  },

  /**
   * Met à jour l'ordre des signataires
   */
  async updateSignatoryOrder(signatoryId: string, displayOrder: number): Promise<void> {
    const { error } = await supabase
      .from('freight_shipment_signatories')
      .update({ display_order: displayOrder })
      .eq('id', signatoryId);

    if (error) throw error;
  },

  /**
   * Supprime une expédition (soft delete)
   */
  async deleteShipment(id: string): Promise<void> {
    const { error } = await supabase
      .from('freight_shipments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },
};
