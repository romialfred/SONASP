import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shippingPreparationService } from './shippingPreparationService';

const supabaseMock = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
}));

const storageMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}));

const uploadMocks = vi.hoisted(() => ({
  uploadSensitiveFile: vi.fn(),
  deleteSensitiveResource: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
vi.mock('./sensitiveUploadGateway', () => uploadMocks);

const SHIPPING_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const DOCUMENT_ID = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const ACTOR_ID = '01c34df2-98a3-44c3-87aa-35cd62dd8228';

describe('shippingPreparationService — frontières du workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    supabaseMock.storage.from.mockReturnValue(storageMocks);
  });

  it('force toute nouvelle préparation dans le statut initial', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'shipping-1', status: 'waiting_for_customs_approval' },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    supabaseMock.from.mockReturnValue({ insert });

    await shippingPreparationService.createPreparation({
      status: 'ready_for_expedition',
      expedition_lot_number: 'LOT-1',
    } as never);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'waiting_for_customs_approval',
      created_by: 'user-1',
    }));
  });

  it('refuse qu’une mise à jour générale modifie le statut', async () => {
    await expect(shippingPreparationService.updatePreparation('shipping-1', {
      status: 'approved_by_customs',
    } as never)).rejects.toThrow('workflow d’expédition');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('conserve la signature serveur de réservation de quota', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: true, error: null });

    await expect(shippingPreparationService.reserveLicenseQuota(
      'license-1',
      'shipping-1',
      1_250,
    )).resolves.toBe(true);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('reserve_license_quota', {
      p_license_id: 'license-1',
      p_shipping_id: 'shipping-1',
      p_quantity: 1_250,
      p_user_id: 'user-1',
    });
  });

  it('crée une préparation via la RPC atomique et relaie la ligne renvoyée', async () => {
    const created = { id: 'prep-1', expedition_lot_number: 'HUM-MA-0001/2026', status: 'waiting_for_customs_approval' };
    supabaseMock.rpc.mockResolvedValue({ data: created, error: null });
    const key = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';

    await expect(shippingPreparationService.createPreparationAtomic({
      idempotencyKey: key,
      miningCompanyId: 'mine-1', exportLicenseId: 'lic-1', freightCompanyId: 'car-1', refineryId: 'ref-1',
      preparedAt: '2026-09-06T00:00:00.000Z',
      items: [{ daily_production_id: 'prod-1', ingot_box_number: 'BOX-1', net_weight_grams: 990, gross_weight_grams: 1000, fineness_pct: 99, pure_gold_grams: 990, seal_number_1: 'S1', seal_number_2: null, order_index: 0 }],
      signatories: [{ position: 'DG', name: 'Awa', order_index: 0 }],
    })).resolves.toEqual(created);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('snp_create_shipping_preparation_atomic', expect.objectContaining({
      p_idempotency_key: key, p_mining_company_id: 'mine-1', p_export_license_id: 'lic-1',
      p_freight_company_id: 'car-1', p_refinery_id: 'ref-1', p_prepared_at: '2026-09-06T00:00:00.000Z',
    }));
  });

  it('refuse une clé d’idempotence invalide avant tout appel réseau', async () => {
    await expect(shippingPreparationService.createPreparationAtomic({
      idempotencyKey: 'not-a-uuid', miningCompanyId: 'm', exportLicenseId: 'l', freightCompanyId: 'f', refineryId: 'r',
      preparedAt: '2026-09-06T00:00:00.000Z', items: [], signatories: [],
    })).rejects.toThrow('identifiant de la demande');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('relaie le message métier curé levé par la RPC atomique', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('Quota insuffisant : autorisé 1000 g.') });
    await expect(shippingPreparationService.createPreparationAtomic({
      idempotencyKey: '9b3fcaaa-9367-4c91-a82d-788f043f33f1', miningCompanyId: 'm', exportLicenseId: 'l', freightCompanyId: 'f', refineryId: 'r',
      preparedAt: '2026-09-06T00:00:00.000Z',
      items: [{ daily_production_id: 'p', ingot_box_number: 'B', net_weight_grams: 1, gross_weight_grams: 1, fineness_pct: 50, pure_gold_grams: 1, seal_number_1: 'S', seal_number_2: null, order_index: 0 }],
      signatories: [],
    })).rejects.toThrow('Quota insuffisant');
  });

  it('utilise la libération canonique dérivée de l’expédition', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: true, error: null });

    await expect(shippingPreparationService.releaseLicenseQuota(
      'shipping-1',
      'Annulation validée par le responsable',
    )).resolves.toBe(true);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('snp_release_shipping_license_quota', {
      p_shipping_id: 'shipping-1',
      p_reason: 'Annulation validée par le responsable',
    });
  });

  it('refuse un motif de libération trop court avant tout appel réseau', async () => {
    await expect(shippingPreparationService.releaseLicenseQuota(
      'shipping-1',
      'Annulée',
    )).rejects.toThrow('au moins 10 caractères');

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('stocke le chemin objet privé canonique après un upload validé', async () => {
    uploadMocks.uploadSensitiveFile.mockResolvedValue({
      id: DOCUMENT_ID,
      shipping_preparation_id: SHIPPING_ID,
      title: 'Packing list',
      document_url: `${SHIPPING_ID}/format-validated/2026/08/${DOCUMENT_ID}.pdf`,
      file_name: 'packing.pdf',
      file_size: 3,
      mime_type: 'application/pdf',
      uploaded_by: ACTOR_ID,
      created_at: '2026-08-24T10:00:00.000Z',
    });
    const file = new File(['PDF'], 'packing.pdf', { type: 'application/pdf' });

    await expect(shippingPreparationService.uploadDocument(SHIPPING_ID, file, 'Packing list'))
      .resolves.toEqual(expect.objectContaining({ document_url: expect.stringContaining('/format-validated/') }));

    expect(uploadMocks.uploadSensitiveFile).toHaveBeenCalledWith(
      'shipping-document',
      file,
      { shippingPreparationId: SHIPPING_ID, title: 'Packing list', fileName: 'packing.pdf' },
      { mimeType: 'application/pdf' },
    );
    expect(storageMocks.upload).not.toHaveBeenCalled();
  });

  it('rejette une confirmation gateway hors tenant avant de l’afficher', async () => {
    uploadMocks.uploadSensitiveFile.mockResolvedValue({ id: DOCUMENT_ID, shipping_preparation_id: SHIPPING_ID });
    const file = new File(['PDF'], 'packing.pdf', { type: 'application/pdf' });
    await expect(shippingPreparationService.uploadDocument(SHIPPING_ID, file, 'Packing list'))
      .rejects.toThrow('confirmation');
  });

  it('signe une ancienne URL publique sans la rappeler', async () => {
    storageMocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/doc' },
      error: null,
    });

    await expect(shippingPreparationService.getDocumentUrl(
      'https://project.supabase.co/storage/v1/object/public/shipping-documents/shipping-documents/shipping-1/doc.pdf?download=1',
    )).resolves.toBe('https://signed.example/doc');

    expect(storageMocks.createSignedUrl).toHaveBeenCalledWith('shipping-1/doc.pdf', 300);
  });

  it('délègue la suppression au endpoint compensé sans faire confiance au chemin navigateur', async () => {
    uploadMocks.deleteSensitiveResource.mockResolvedValue(undefined);
    await shippingPreparationService.deleteDocument(
      DOCUMENT_ID,
      'https://project.supabase.co/storage/v1/object/public/shipping-documents/shipping-documents/shipping-1/doc.pdf',
    );
    expect(uploadMocks.deleteSensitiveResource).toHaveBeenCalledWith('shipping-document', DOCUMENT_ID);
    expect(storageMocks.remove).not.toHaveBeenCalled();
  });
});
