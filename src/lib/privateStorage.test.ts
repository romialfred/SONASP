import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPrivateSignedUrl,
  PRIVATE_STORAGE_BUCKETS,
  storageObjectPath,
} from './privateStorage';

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: mocks.from } },
}));

describe('références de stockage privé', () => {
  const bucket = PRIVATE_STORAGE_BUCKETS.shippingDocuments;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  });

  it.each([
    ['prep-1/document.pdf', 'prep-1/document.pdf'],
    ['shipping-documents/prep-1/document.pdf', 'prep-1/document.pdf'],
    ['shipping-documents/shipping-documents/prep-1/document.pdf', 'prep-1/document.pdf'],
    [
      'https://projet.supabase.co/storage/v1/object/public/shipping-documents/prep-1/document.pdf?download=1',
      'prep-1/document.pdf',
    ],
    [
      'https://projet.supabase.co/storage/v1/object/sign/shipping-documents/shipping-documents/prep-1/Packing%20List.pdf?token=secret',
      'prep-1/Packing List.pdf',
    ],
  ])('canonicalise %s', (reference, expected) => {
    expect(storageObjectPath(reference, bucket)).toBe(expected);
  });

  it('refuse le mauvais bucket, les URL ordinaires et la traversée encodée', () => {
    expect(storageObjectPath(
      'https://projet.supabase.co/storage/v1/object/public/autre-bucket/prep/document.pdf',
      bucket,
    )).toBeNull();
    expect(storageObjectPath('https://example.com/document.pdf', bucket)).toBeNull();
    expect(storageObjectPath('prep/%2e%2e/secret.pdf', bucket)).toBeNull();
    expect(storageObjectPath('prep%2Fsecret.pdf', bucket)).toBeNull();
  });

  it('respecte la casse du bucket de certificats et canonicalise le bucket mine', () => {
    expect(storageObjectPath(
      'https://projet.supabase.co/storage/v1/object/public/ASSAY-CERTIFICATES/prep/cert.pdf',
      PRIVATE_STORAGE_BUCKETS.assayCertificates,
    )).toBe('prep/cert.pdf');
    expect(storageObjectPath(
      'mining-company-documents/company/report.pdf',
      PRIVATE_STORAGE_BUCKETS.miningCompanyDocuments,
    )).toBe('company/report.pdf');
  });

  it('signe uniquement le chemin canonique et borne la durée', async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/document' },
      error: null,
    });

    await expect(createPrivateSignedUrl(
      bucket,
      'https://projet.supabase.co/storage/v1/object/public/shipping-documents/shipping-documents/prep/document.pdf',
      99_999,
    )).resolves.toBe('https://signed.example/document');

    expect(mocks.from).toHaveBeenCalledWith(bucket);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('prep/document.pdf', 3600);
  });

  it('échoue fermé lorsque la signature est refusée', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(createPrivateSignedUrl(bucket, 'prep/document.pdf')).rejects.toThrow(/ne peut pas être ouvert/);
    expect(storageObjectPath('javascript:alert(1)', bucket)).toBeNull();
  });
});
