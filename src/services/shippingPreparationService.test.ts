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

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

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
    storageMocks.upload.mockResolvedValue({
      data: { path: 'shipping-1/random.pdf' },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'doc-1',
        shipping_preparation_id: 'shipping-1',
        document_url: 'shipping-1/random.pdf',
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    supabaseMock.from.mockReturnValue({ insert });
    const file = new File(['PDF'], 'packing.pdf', { type: 'application/pdf' });

    await expect(shippingPreparationService.uploadDocument('shipping-1', file, 'Packing list'))
      .resolves.toEqual(expect.objectContaining({ document_url: 'shipping-1/random.pdf' }));

    expect(storageMocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^shipping-1\/[0-9a-f-]+\.pdf$/u),
      file,
      { contentType: 'application/pdf', upsert: false },
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      document_url: 'shipping-1/random.pdf',
      mime_type: 'application/pdf',
    }));
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

  it('supprime le chemin canonique sans doubler le nom du bucket', async () => {
    storageMocks.remove.mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const deleteRow = vi.fn(() => ({ eq }));
    supabaseMock.from.mockReturnValue({ delete: deleteRow });

    await shippingPreparationService.deleteDocument(
      'doc-1',
      'https://project.supabase.co/storage/v1/object/public/shipping-documents/shipping-documents/shipping-1/doc.pdf',
    );

    expect(storageMocks.remove).toHaveBeenCalledWith(['shipping-1/doc.pdf']);
    expect(eq).toHaveBeenCalledWith('id', 'doc-1');
  });
});
