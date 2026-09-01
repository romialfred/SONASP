import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FreightCustomsConflictError,
  FreightCustomsTransitionError,
  freightCustomsService,
} from './freightCustomsService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  uploadBinary: vi.fn(),
  getBinaryUrl: vi.fn(),
  deleteBinary: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

vi.mock('@/services/freightCustomsBinaryGateway', () => ({
  uploadFreightCustomsBinary: mocks.uploadBinary,
  getFreightCustomsBinaryUrl: mocks.getBinaryUrl,
  deleteFreightCustomsBinary: mocks.deleteBinary,
}));

const operation = {
  id: '20000000-0000-4000-8000-000000000001',
  shipping_preparation_id: '30000000-0000-4000-8000-000000000001',
  mining_company_id: '40000000-0000-4000-8000-000000000001',
  reference_number: 'FC-20260824-00000001',
  status: 'customs_pending',
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
};

describe('freightCustomsService – live read contract', () => {
  beforeEach(() => vi.clearAllMocks());

  function query(result: unknown = []) {
    const builder = {
      select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve),
    };
    mocks.from.mockReturnValue(builder);
    return builder;
  }

  it.each(['listOperations', 'getOperationById'] as const)('%s disambiguates every duplicated foreign key', async (method) => {
    const builder = query(method === 'listOperations' ? [] : null);
    await freightCustomsService[method]('operation-id');
    const select = builder.select.mock.calls[0][0] as string;
    expect(select).toContain('shipping_preparations!fk_shipping_preparation');
    expect(select).toContain('freight_customs_documents!fk_freight_operation(');
    expect(select).toContain('freight_customs_invoice_data!fk_freight_operation_invoice(');
    expect(select).not.toMatch(/\bshipping_preparation_items\(/);
    expect(select).not.toMatch(/\bdaily_productions\(/);
  });

  it('loads eligible shipments using canonical columns and a left anti-join', async () => {
    const builder = query();
    await freightCustomsService.getAvailableShipments();
    const select = builder.select.mock.calls[0][0] as string;
    expect(select).toContain('reference_number:expedition_lot_number');
    expect(select).toContain('total_weight_grams:total_net_weight_grams');
    expect(select).toContain('freight_customs_operations!fk_shipping_preparation(id)');
    expect(select).not.toContain('!inner');
    expect(builder.eq).toHaveBeenCalledWith('status', 'ready_for_expedition');
    expect(builder.is).toHaveBeenCalledWith('freight_customs_operations.id', null);
    expect(builder.order).toHaveBeenCalledWith('prepared_at', { ascending: false });
  });

  it('propagates denied reads instead of returning an empty result', async () => {
    const denied = { code: '42501', message: 'denied' };
    const builder = query();
    builder.then = (resolve) => Promise.resolve({ data: null, error: denied }).then(resolve);
    await expect(freightCustomsService.listOperations()).rejects.toBe(denied);
  });
});

describe('freightCustomsService – mutations 4F', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crée exclusivement via snp_fret_creer_operation et accepte le composite', async () => {
    mocks.rpc.mockResolvedValue({ data: operation, error: null });

    await expect(freightCustomsService.createOperation(
      operation.shipping_preparation_id,
    )).resolves.toMatchObject(operation);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_fret_creer_operation', {
      p_shipping_preparation_id: operation.shipping_preparation_id,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('transmet la version optimiste et retire les champs statut/audit injectés', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...operation, notes: 'ok' }, error: null });

    await freightCustomsService.updateOperation(
      operation.id,
      operation.updated_at,
      {
        notes: 'ok',
        status: 'shipped_to_refinery',
        created_by: 'acteur-forgé',
      } as never,
    );

    expect(mocks.rpc).toHaveBeenCalledWith('snp_fret_modifier_operation', {
      p_operation_id: operation.id,
      p_expected_updated_at: operation.updated_at,
      p_modifications: { notes: 'ok' },
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('refuse un saut de statut avant tout appel réseau', async () => {
    await expect(freightCustomsService.transitionStatus(
      operation.id,
      'customs_pending',
      'shipped_to_refinery',
    )).rejects.toBeInstanceOf(FreightCustomsTransitionError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('délègue une transition canonique avec statut attendu et détails nettoyés', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...operation, status: 'customs_approved' },
      error: null,
    });

    await freightCustomsService.transitionStatus(
      operation.id,
      'customs_pending',
      'customs_approved',
      { notes: 'contrôlé', actual_departure_date: 'forgée' } as never,
    );

    expect(mocks.rpc).toHaveBeenCalledWith('snp_fret_transitionner_operation', {
      p_operation_id: operation.id,
      p_expected_status: 'customs_pending',
      p_new_status: 'customs_approved',
      p_details: { notes: 'contrôlé' },
    });
  });

  it('convertit SQLSTATE 40001 en conflit métier et propage les autres refus', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '40001', message: 'Conflit optimiste sur le dossier fret.' },
    });
    await expect(freightCustomsService.transitionStatus(
      operation.id,
      'customs_pending',
      'customs_approved',
    )).rejects.toBeInstanceOf(FreightCustomsConflictError);

    const denied = { code: '42501', message: 'capability requise' };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: denied });
    await expect(freightCustomsService.transitionStatus(
      operation.id,
      'customs_pending',
      'customs_approved',
    )).rejects.toBe(denied);
  });

  it('n’envoie jamais les identités mine/expéditeur dérivées dans la facture', async () => {
    const invoice = {
      id: '50000000-0000-4000-8000-000000000001',
      freight_customs_operation_id: operation.id,
    };
    mocks.rpc.mockResolvedValue({ data: invoice, error: null });

    await freightCustomsService.saveInvoiceData(operation.id, {
      recipient_name: 'Raffinerie',
      sender_name: 'Expéditeur forgé',
      mine_name: 'Mine forgée',
      created_by: 'acteur forgé',
    } as never);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_fret_enregistrer_facture', {
      p_operation_id: operation.id,
      p_donnees: { recipient_name: 'Raffinerie' },
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('charge l’historique immuable via la RPC tenant-aware', async () => {
    const history = [{
      id: '60000000-0000-4000-8000-000000000001',
      old_status: null,
      new_status: 'customs_pending',
    }];
    mocks.rpc.mockResolvedValue({ data: history, error: null });
    await expect(freightCustomsService.getStatusHistory(operation.id)).resolves.toBe(history);
    expect(mocks.rpc).toHaveBeenCalledWith('get_unified_status_history', {
      p_entity_type: 'freight_customs',
      p_entity_id: operation.id,
    });
  });

  it('délègue les trois opérations binaires au gateway privé sans DML navigateur', async () => {
    const file = new File(['pdf'], 'douane.pdf', { type: 'application/pdf' });
    const document = {
      id: '70000000-0000-4000-8000-000000000001',
      freight_customs_operation_id: operation.id,
    };
    mocks.uploadBinary.mockResolvedValue(document);
    mocks.getBinaryUrl.mockResolvedValue('https://signed.test/document');
    mocks.deleteBinary.mockResolvedValue(undefined);

    await expect(freightCustomsService.uploadDocument(
      operation.id,
      'customs_declaration',
      'Déclaration douanière',
      file,
    )).resolves.toBe(document);
    await expect(freightCustomsService.getDocumentUrl('private/path.pdf'))
      .resolves.toBe('https://signed.test/document');
    await expect(freightCustomsService.deleteDocument(document.id)).resolves.toBeUndefined();

    expect(mocks.uploadBinary).toHaveBeenCalledTimes(1);
    expect(mocks.getBinaryUrl).toHaveBeenCalledWith('private/path.pdf');
    expect(mocks.deleteBinary).toHaveBeenCalledWith(document.id);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
