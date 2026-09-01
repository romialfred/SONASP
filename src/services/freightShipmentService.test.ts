import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freightShipmentService } from './freightShipmentService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { getUser: mocks.getUser },
  },
}));

function query(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return builder;
}

const production = {
  id: 'production-1',
  production_date: '2026-08-30',
  bar_reference: 'BAR-2026-001',
  bullion_grams: 100,
  estimated_fineness_pct: 99.9,
  estimated_silver_pct: 0.1,
  pure_gold_grams: 99.9,
  estimated_oz: 3.21,
  silver_content_grams: 0.1,
};

const preparation = {
  id: 'preparation-1',
  mining_company_id: 'company-1',
  expedition_lot_number: 'HUM-SONASP-0001/2026',
  status: 'ready_for_expedition',
  total_net_weight_grams: 99.9,
  total_gross_weight_grams: 100,
  total_boxes: 1,
  packing_list_url: '/private/packing-list.pdf',
  shipped_at: null,
  shipped_to_company: null,
  shipped_to_country: null,
  items: [{ id: 'item-1', daily_production_id: production.id, daily_production: production }],
};

describe('freightShipmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } } });
  });

  it('enriches the freight register with authoritative source companies', async () => {
    const shipment = {
      id: 'freight-1',
      reference_number: 'FRT-2026-0001',
      productions: [{ production_id: production.id }],
      signatories: [],
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === 'freight_shipments') return query([shipment]);
      if (table === 'daily_production') return query([{ id: production.id, mining_company_id: 'company-1' }]);
      if (table === 'mining_companies') return query([{
        id: 'company-1', name: 'Mine A', address: null, city: null,
        localite: null, country: 'Burkina Faso', tax_id: null,
      }]);
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await freightShipmentService.listShipments();
    expect(result[0].source_mining_companies).toEqual([expect.objectContaining({ name: 'Mine A' })]);
  });

  it('excludes an entire preparation when any production is already assigned', async () => {
    const used = query([{ production_id: 'production-2' }]);
    const preparations = query([
      preparation,
      {
        ...preparation,
        id: 'preparation-2',
        items: [
          { id: 'item-2', daily_production_id: 'production-2', daily_production: production },
          { id: 'item-3', daily_production_id: 'production-3', daily_production: production },
        ],
      },
    ]);
    mocks.from.mockImplementation((table: string) =>
      table === 'freight_shipment_productions' ? used : preparations,
    );

    await expect(freightShipmentService.getAvailableShippingPreparations())
      .resolves.toEqual([preparation]);
    expect(preparations.eq).toHaveBeenCalledWith('status', 'ready_for_expedition');
  });

  it('creates the complete shipment through the idempotent atomic RPC', async () => {
    const parent = {
      id: 'freight-1',
      reference_number: 'FRT-2026-0001',
      status: 'pending',
      productions: [],
      signatories: [],
    };
    const parentQuery = query(parent);
    mocks.from.mockImplementation((table: string) => {
      if (table === 'freight_shipments') return parentQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.rpc.mockResolvedValue({ data: { id: parent.id, reference_number: parent.reference_number }, error: null });

    await expect(freightShipmentService.createShipment({
      shipping_preparation_ids: [preparation.id],
      shipment_date: '2026-08-30',
      destination_refinery_id: 'refinery-1',
      number_of_boxes: 1,
      box_type: 'Sealed case',
      gold_price_usd_per_oz: 2400,
      exchange_rate: 600,
      local_currency: 'xof',
      notes: 'Handle with care',
      idempotency_key: '11111111-1111-4111-8111-111111111111',
    })).resolves.toMatchObject(parent);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_create_freight_shipment_atomic', {
      p_idempotency_key: '11111111-1111-4111-8111-111111111111',
      p_shipping_preparation_ids: [preparation.id],
      p_shipment_date: '2026-08-30',
      p_destination_refinery_id: 'refinery-1',
      p_number_of_boxes: 1,
      p_box_type: 'Sealed case',
      p_gold_price_usd_per_oz: 2400,
      p_exchange_rate: 600,
      p_local_currency: 'XOF',
      p_notes: 'Handle with care',
    });
    expect(parentQuery.insert).not.toHaveBeenCalled();
  });

  it('fails closed after an atomic server rejection without any browser write fallback', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'outside tenant' } });

    await expect(freightShipmentService.createShipment({
      shipping_preparation_ids: [preparation.id],
      destination_refinery_id: 'refinery-1',
      number_of_boxes: 1,
      box_type: 'Sealed case',
      gold_price_usd_per_oz: 2400,
      exchange_rate: 600,
      local_currency: 'XOF',
      idempotency_key: '22222222-2222-4222-8222-222222222222',
    })).rejects.toMatchObject({ code: '42501' });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('uses the secured server transition with the current status as concurrency guard', async () => {
    const currentQuery = query({ status: 'pending' });
    const transitioned = { id: 'freight-1', status: 'approved' };
    mocks.from.mockReturnValue(currentQuery);
    mocks.rpc.mockResolvedValue({ data: transitioned, error: null });

    await expect(freightShipmentService.updateStatus('freight-1', 'approved', 'Reviewed'))
      .resolves.toEqual(transitioned);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_transition_freight_shipment', {
      p_shipment_id: 'freight-1',
      p_expected_status: 'pending',
      p_new_status: 'approved',
      p_request_id: expect.any(String),
      p_notes: 'Reviewed',
    });
    expect(currentQuery.update).not.toHaveBeenCalled();
  });

  it('never falls back to a direct status update after a server denial', async () => {
    const currentQuery = query({ status: 'pending' });
    mocks.from.mockReturnValue(currentQuery);
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'capability required' },
    });

    await expect(freightShipmentService.updateStatus('freight-1', 'approved'))
      .rejects.toMatchObject({ code: '42501' });
    expect(currentQuery.update).not.toHaveBeenCalled();
  });

  it.each(['PGRST202', '42883'])(
    'fails closed when the secured transition RPC is unavailable (%s)',
    async (code) => {
      const currentQuery = query({ status: 'pending' });
      mocks.from.mockReturnValue(currentQuery);
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code, message: 'secured transition RPC unavailable' },
      });

      await expect(freightShipmentService.updateStatus('freight-1', 'approved'))
        .rejects.toMatchObject({ code });
      expect(currentQuery.update).not.toHaveBeenCalled();
      expect(mocks.getUser).not.toHaveBeenCalled();
    },
  );
});
