import { supabase } from '@/lib/supabase';

export type FreightShipmentStatus =
  | 'pending'
  | 'approved'
  | 'shipped_to_refinery'
  | 'received_at_refinery'
  | 'processing'
  | 'processed'
  | 'in_stock';

export interface FreightShipmentMiningCompany {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  localite: string | null;
  country: string;
  tax_id: string | null;
}

export interface FreightShipment {
  id: string;
  reference_number: string;
  status: FreightShipmentStatus;
  shipment_date: string;
  destination_refinery_id?: string | null;
  number_of_boxes: number;
  box_type: string | null;
  gold_price_usd_per_oz: number;
  exchange_rate: number;
  local_currency: string;
  total_bullion_grams: number | null;
  total_pure_gold_grams: number | null;
  total_pure_gold_oz: number | null;
  total_pure_silver_grams: number | null;
  total_value_usd: number | null;
  total_value_local: number | null;
  production_count: number | null;
  packing_list_pdf_path?: string | null;
  consignment_note_pdf_path?: string | null;
  bullion_summary_pdf_path?: string | null;
  customs_invoice_pdf_path?: string | null;
  shipping_preparation_id?: string | null;
  expedition_number?: string | null;
  notes?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  shipped_at?: string | null;
  shipped_by?: string | null;
  received_at?: string | null;
  received_by?: string | null;
  created_by?: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at?: string | null;

  destination_refinery?: any;
  productions?: FreightShipmentProduction[];
  signatories?: FreightShipmentSignatory[];
  source_mining_companies?: FreightShipmentMiningCompany[];
}

export interface FreightShipmentProduction {
  id: string;
  freight_shipment_id: string;
  production_id: string;
  production_date: string | null;
  bar_reference: string | null;
  bullion_grams: number | null;
  estimated_fineness_pct: number | null;
  estimated_silver_pct: number | null;
  pure_gold_grams: number | null;
  pure_gold_oz: number | null;
  silver_content_grams: number | null;
  added_at: string | null;
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
  created_at: string | null;
}

export interface AvailableShippingPreparation {
  id: string;
  expedition_lot_number: string;
  status: string;
  shipped_at: string | null;
  total_net_weight_grams: number;
  total_gross_weight_grams: number;
  total_boxes?: number | null;
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

/** The parent row exists. Retrying would create a duplicate shipment. */
export class FreightShipmentPartialSaveError extends Error {
  constructor(public readonly shipmentId: string, public readonly reference: string, cause: unknown) {
    super('The freight shipment exists, but its related records were not fully saved. Open the existing shipment; do not create another one.');
    this.name = 'FreightShipmentPartialSaveError';
    this.cause = cause;
  }
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
    const shipments = (data || []) as FreightShipment[];
    const productionIds = Array.from(new Set(shipments.flatMap(shipment =>
      (shipment.productions || []).map(production => production.production_id).filter(Boolean),
    )));
    if (productionIds.length === 0) return shipments;

    const { data: sourceProductions, error: sourceError } = await supabase
      .from('daily_production')
      .select('id, mining_company_id')
      .in('id', productionIds);
    if (sourceError) throw sourceError;
    const productionCompany = new Map((sourceProductions || []).map(row => [row.id, row.mining_company_id]));
    const companyIds = Array.from(new Set([...productionCompany.values()].filter((id): id is string => Boolean(id))));
    if (companyIds.length === 0) return shipments.map(shipment => ({ ...shipment, source_mining_companies: [] }));

    const { data: companies, error: companiesError } = await supabase
      .from('mining_companies')
      .select('id, name, address, city, localite, country, tax_id')
      .in('id', companyIds);
    if (companiesError) throw companiesError;
    const companyById = new Map((companies || []).map(company => [company.id, company]));

    return shipments.map(shipment => {
      const sourceIds = new Set((shipment.productions || [])
        .map(production => productionCompany.get(production.production_id))
        .filter((companyId): companyId is string => Boolean(companyId)));
      return {
        ...shipment,
        source_mining_companies: [...sourceIds]
          .map(companyId => companyById.get(companyId))
          .filter((company): company is FreightShipmentMiningCompany => Boolean(company)),
      };
    });
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
    if (!data) return null;

    const productionIds = (data.productions || [])
      .map((production) => production.production_id)
      .filter(Boolean);

    if (productionIds.length === 0) {
      return { ...data, source_mining_companies: [] } as FreightShipment;
    }

    const { data: sourceProductions, error: sourceProductionError } = await supabase
      .from('daily_production')
      .select('mining_company_id')
      .in('id', productionIds);

    if (sourceProductionError) {
      return { ...data, source_mining_companies: [] } as FreightShipment;
    }

    const companyIds = Array.from(
      new Set(
        (sourceProductions || [])
          .map((production) => production.mining_company_id)
          .filter((companyId): companyId is string => Boolean(companyId)),
      ),
    );

    if (companyIds.length === 0) {
      return { ...data, source_mining_companies: [] } as FreightShipment;
    }

    const { data: companies, error: companiesError } = await supabase
      .from('mining_companies')
      .select('id, name, address, city, localite, country, tax_id')
      .in('id', companyIds);

    return {
      ...data,
      source_mining_companies: companiesError ? [] : companies || [],
    } as FreightShipment;
  },

  async getAvailableShippingPreparations(): Promise<AvailableShippingPreparation[]> {
    // Get all production IDs that are already used in freight shipments
    const { data: usedProductions, error: usedError } = await supabase
      .from('freight_shipment_productions')
      .select('production_id');

    if (usedError) throw usedError;

    const usedProductionIds = (usedProductions || []).map((p: any) => p.production_id);

    // Get all shipping preparations with their production items
    const { data: shippingPreps, error: prepError } = await supabase
      .from('shipping_preparations')
      .select(`
        id,
        expedition_lot_number,
        status,
        shipped_at,
        total_net_weight_grams,
        total_gross_weight_grams,
        total_boxes,
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

    if (prepError) throw prepError;

    // Selection is by whole preparation: a partly used preparation is not eligible.
    const availablePreps = (shippingPreps || []).filter((prep: any) => {
      const items = prep.items || [];
      return items.length > 0 && items.every((item: any) => !usedProductionIds.includes(item.daily_production_id));
    });

    return availablePreps as AvailableShippingPreparation[];
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
    /** Reuse this key after an uncertain network response. */
    idempotency_key?: string;
    /** Display-only preview; the server copies authoritative source signatories. */
    signatories?: Array<{ position: string; full_name: string; display_order: number }>;
  }): Promise<FreightShipment> {
    const preparationIds = Array.from(new Set(data.shipping_preparation_ids.filter(Boolean)));
    if (preparationIds.length === 0 || preparationIds.length !== data.shipping_preparation_ids.length) {
      throw new Error('Select one or more distinct shipment preparations.');
    }
    if (!data.destination_refinery_id) {
      throw new Error('Select the destination refinery.');
    }
    if (!Number.isInteger(data.number_of_boxes) || data.number_of_boxes <= 0) {
      throw new Error('The number of packages must be a positive whole number.');
    }
    if (!data.box_type.trim()) {
      throw new Error('Enter the package type.');
    }
    if (!Number.isFinite(data.gold_price_usd_per_oz) || data.gold_price_usd_per_oz <= 0) {
      throw new Error('Enter a valid gold price.');
    }
    if (!Number.isFinite(data.exchange_rate) || data.exchange_rate <= 0) {
      throw new Error('Enter a valid exchange rate.');
    }
    if (!data.local_currency.trim()) {
      throw new Error('Select the settlement currency.');
    }
    const currency = data.local_currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('The settlement currency must use a three-letter ISO code.');
    }
    const boxType = data.box_type.trim();
    if (boxType.length > 100) {
      throw new Error('The package type cannot exceed 100 characters.');
    }
    const notes = data.notes?.trim() || null;
    if (notes && notes.length > 5_000) {
      throw new Error('Notes cannot exceed 5,000 characters.');
    }
    const shipmentDate = data.shipment_date?.trim() || new Date().toISOString();
    if (!Number.isFinite(Date.parse(shipmentDate))) {
      throw new Error('Enter a valid shipment date.');
    }

    const idempotencyKey = data.idempotency_key || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new Error('The shipment request identifier is invalid.');
    }

    // The database owns the entire creation saga: tenant/status checks,
    // quantity locks, canonical reference and every child snapshot either all
    // commit or all roll back.
    const { data: result, error } = await supabase.rpc(
      'snp_create_freight_shipment_atomic',
      {
        p_idempotency_key: idempotencyKey,
        p_shipping_preparation_ids: preparationIds,
        p_shipment_date: shipmentDate,
        p_destination_refinery_id: data.destination_refinery_id,
        p_number_of_boxes: data.number_of_boxes,
        p_box_type: boxType,
        p_gold_price_usd_per_oz: data.gold_price_usd_per_oz,
        p_exchange_rate: data.exchange_rate,
        p_local_currency: currency,
        p_notes: notes,
      },
    );

    if (error) throw error;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('The atomic freight creation returned an invalid response.');
    }
    const shipmentId = 'id' in result && typeof result.id === 'string' ? result.id : null;
    if (!shipmentId) {
      throw new Error('The atomic freight creation did not return a shipment identifier.');
    }

    const shipment = await this.getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error('The created freight shipment is not visible in the authorised perimeter.');
    }
    return shipment;
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
    status: FreightShipmentStatus,
    notes?: string
  ): Promise<FreightShipment> {
    const { data: current, error: currentError } = await supabase
      .from('freight_shipments')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (currentError) throw currentError;

    const { data: transitioned, error: transitionError } = await supabase.rpc(
      'snp_transition_freight_shipment',
      {
        p_shipment_id: id,
        p_expected_status: current.status,
        p_new_status: status,
        p_request_id: crypto.randomUUID(),
        p_notes: notes?.trim() || null,
      }
    );
    if (!transitionError) return transitioned as FreightShipment;
    // Fail closed when the secured RPC is unavailable. A browser-side UPDATE
    // would bypass the workflow graph, separation of duties and audit trail.
    throw transitionError;
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
