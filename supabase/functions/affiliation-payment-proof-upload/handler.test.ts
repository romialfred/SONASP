// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAffiliationProofHandler } from './handler';
const duesId = 'a0000000-0000-4000-8000-000000000001';
const receiptId = 'b0000000-0000-4000-8000-000000000001';
const request = (bytes = '%PDF-1.7\nverified test document\n%%EOF', mime = 'application/pdf', extra = false) => {
  const form = new FormData();
  form.append('duesId', duesId); form.append('receiptId', receiptId);
  form.append('file', new File([bytes], 'preuve.pdf', { type: mime }));
  if (extra) form.append('artisanId', 'forged-tenant');
  return new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test', Origin: 'http://127.0.0.1:5180' }, body: form });
};
describe('Dépôt privé des preuves d’adhésion', () => {
  it('valide le contenu réel et transmet uniquement le dossier et le fichier vérifiés', async () => {
    const deps = { authenticate: vi.fn().mockResolvedValue(true), save: vi.fn().mockResolvedValue({ path: 'private-object' }) };
    const response = await createAffiliationProofHandler(deps)(request());
    expect(response.status).toBe(200);
    expect(deps.save).toHaveBeenCalledWith('test', duesId, receiptId, expect.objectContaining({ mime: 'application/pdf', extension: 'pdf' }));
    expect(await response.json()).toEqual({ proof: { path: 'private-object' } });
  });
  it('rejette contenu maquillé, métadonnées de tenant, taille et session invalides', async () => {
    const deps = { authenticate: vi.fn().mockResolvedValue(true), save: vi.fn() };
    const handler = createAffiliationProofHandler(deps);
    expect((await handler(request('MZ executable', 'application/pdf'))).status).toBe(400);
    expect((await handler(request('%PDF-1.7', 'image/png'))).status).toBe(400);
    expect((await handler(request(undefined, undefined, true))).status).toBe(400);
    expect((await handler(request('x'.repeat(5 * 1024 * 1024 + 1)))).status).toBe(413);
    deps.authenticate.mockResolvedValue(false);
    expect((await handler(request())).status).toBe(401);
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('refuse une origine étrangère et conserve les erreurs internes privées', async () => {
    const deps = { authenticate: vi.fn().mockResolvedValue(true), save: vi.fn().mockRejectedValue(new Error('private database detail')) };
    const handler = createAffiliationProofHandler(deps);
    const foreign = request(); foreign.headers.set('Origin', 'https://evil.test');
    expect((await handler(foreign)).status).toBe(403);
    expect(deps.authenticate).not.toHaveBeenCalled();
    const response = await handler(request());
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain('private database');
  });
});
