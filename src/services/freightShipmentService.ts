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

export interface AvailableShippingPreparation {
  id: string;
  expedition_lot_number: string;
  status: string;
  shipped_at: string | null;
  total_net_weight_grams: number;
  total_gross_weight_grams: number;
  shipped_to_company: string | null;
  shipped_to_country: string | null;
  items: Array<{
    id: string;
    daily_production_id: string;
    ingot_box_number: string;
    daily_production: {
      production_date: string;
      bar_reference: string;
      bullion_grams: number;
      estimated_fineness_pct: number;
      pure_gold_grams: number;
      estimated_oz: number;
      silver_content_grams: number | null;
      mining_company_id: string | null;
    };
  }>;
}

export const freightShipmentService = {
  async listShipments(): Promise<FreightShipment[]> {
    const { data, error } = await supabase
      .from('freight_shipments')
      .select(`
        *,
        destination_refinery:refineries(id, name, location, country),
        productions:freight_shipment_productions(*),
        signatories:freight_shipment_signatories(*)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getShipmentById(id: string): Promise<FreightShipment | null> {
    const { data, error } = await supabase
      .from('freight_shipments')
      .select(`
        *,
        destination_refinery:refineries(*),
        productions:freight_shipment_productions(*),
        signatories:freight_shipment_signatories(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data;
  },

  async getAvailableShippingPreparations(): Promise<AvailableShippingPreparation[]> {
    const { data, error } = await supabase
      .from('shipping_preparations')
      .select(`
        id,
        expedition_lot_number,
        status,
        shipped_at,
        total_net_weight_grams,
        total_gross_weight_grams,
        shipped_to_company,
        shipped_to_country,
        items:shipping_production_items(
          id,
          daily_production_id,
          ingot_box_number,
          daily_production:daily_production_id(
            production_date,
            bar_reference,
            bullion_grams,
            estimated_fineness_pct,
            pure_gold_grams,
            estimated_oz,
            silver_content_grams,
            mining_company_id
          )
        )
      `)
      .eq('status', 'ready_for_expedition')
      .order('shipped_at', { ascending: false });

    if (error) throw error;
    return (data || []) as AvailableShippingPreparation[];
  },

  async createShipment(data: {
    shipping_preparation_ids: string[];
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

    const { data: refData, error: refError } = await supabase.rpc(
      'generate_freight_shipment_reference'
    );

    if (refError) throw refError;

    const { data: shippingPreps, error: prepError } = await supabase
      .from('shipping_preparations')
      .select(`
        id,
        expedition_lot_number,
        total_net_weight_grams,
        total_gross_weight_grams,
        items:shipping_production_items(
          id,
          daily_production_id,
          daily_production:daily_production_id(
            id,
            production_date,
            bar_reference,
            bullion_grams,
            estimated_fineness_pct,
            estimated_silver_pct,
            pure_gold_grams,
            estimated_oz,
            silver_content_grams
          )
        )
      `)
      .in('id', data.shipping_preparation_ids);

    if (prepError) throw prepError;
    if (!shippingPreps || shippingPreps.length === 0) {
      throw new Error('Aucune shipping preparation trouvée');
    }

    const allProductions: any[] = [];
    shippingPreps.forEach((prep: any) => {
      if (prep.items) {
        prep.items.forEach((item: any) => {
          if (item.daily_production) {
            allProductions.push(item.daily_production);
          }
        });
      }
    });

    if (allProductions.length === 0) {
      throw new Error('Aucune production trouvée dans les shipping preparations');
    }

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

    const productionsToInsert = allProductions.map((prod: any) => ({
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

    return this.getShipmentById(shipment.id) as Promise<FreightShipment>;
  },

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

  async updateStatus(
    id: string,
    status: FreightShipmentStatus
  ): Promise<FreightShipment> {
    const { data: userData } = await supabase.auth.getUser();
    const updates: any = { status };

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

  async removeSignatory(signatoryId: string): Promise<void> {
    const { error } = await supabase
      .from('freight_shipment_signatories')
      .delete()
      .eq('id', signatoryId);

    if (error) throw error;
  },

  async updateSignatoryOrder(signatoryId: string, displayOrder: number): Promise<void> {
    const { error } = await supabase
      .from('freight_shipment_signatories')
      .update({ display_order: displayOrder })
      .eq('id', signatoryId);

    if (error) throw error;
  },

  async deleteShipment(id: string): Promise<void> {
    const { error} = await supabase
      .from('freight_shipments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },
};
