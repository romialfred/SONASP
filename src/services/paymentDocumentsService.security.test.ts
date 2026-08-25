import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/services/paymentDocumentsService.ts'), 'utf8');

describe('paymentDocumentsService — preuve privée', () => {
  it('signe la référence payment-proofs pendant 300 secondes', () => {
    expect(source).toContain('PRIVATE_STORAGE_BUCKETS.paymentProofs');
    expect(source).toMatch(/payment\.proof_url,\s*300,/s);
    expect(source).toContain('url: signedUrl');
  });

  it('ne rend jamais directement proof_url au composant', () => {
    expect(source).not.toContain('url: payment.proof_url');
    expect(source).not.toContain('getPublicUrl');
  });
});
