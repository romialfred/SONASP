import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadSaleDocument, getSaleDocuments } from './saleDocumentsService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    storage: {
      from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })),
    },
  },
}));

const queryBuilder = (terminal: 'order' | 'maybeSingle', result: unknown) => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = terminal === 'order' ? vi.fn().mockResolvedValue(result) : vi.fn(() => builder);
  builder.maybeSingle =
    terminal === 'maybeSingle' ? vi.fn().mockResolvedValue(result) : vi.fn(() => builder);
  return builder;
};

describe('saleDocumentsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ne charge que les documents explicitement rattachés à la vente', async () => {
    const builder = queryBuilder('order', {
      data: [
        {
          id: 'doc-1',
          sale_id: 'sale-1',
          document_name: 'Facture export',
          document_number: 'FAC-001',
          document_type: 'invoice',
          file_url: 'private/sale-1/facture.pdf',
          file_size: 1200,
          mime_type: 'application/pdf',
          status: 'approved',
          created_at: '2026-08-22T10:00:00Z',
        },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(builder);

    const result = await getSaleDocuments('sale-1');

    expect(mocks.from).toHaveBeenCalledWith('sales_documents');
    expect(builder.eq).toHaveBeenCalledWith('sale_id', 'sale-1');
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({
      documentId: 'doc-1',
      label: 'Facture export',
      available: true,
      fileUrl: undefined,
    });
  });

  it('ne fabrique aucun document lorsque la vente n’en possède pas', async () => {
    mocks.from.mockReturnValue(queryBuilder('order', { data: [], error: null }));

    await expect(getSaleDocuments('sale-1')).resolves.toEqual({ success: true, data: [] });
  });

  it('vérifie le couple document/vente avant de signer le lien privé', async () => {
    const builder = queryBuilder('maybeSingle', {
      data: { file_url: 'private/sale-1/facture.pdf', status: 'approved' },
      error: null,
    });
    mocks.from.mockReturnValue(builder);
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed' },
      error: null,
    });

    const result = await downloadSaleDocument('invoice', 'doc-1', 'sale-1');

    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', 'doc-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'sale_id', 'sale-1');
    expect(result).toEqual({ success: true, url: 'https://storage.example/signed' });
  });
});
