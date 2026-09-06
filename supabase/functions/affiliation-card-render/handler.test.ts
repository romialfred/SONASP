import { describe, expect, it, vi } from 'vitest';
import { createAffiliationRenderHandler } from './handler';
const id = 'a0000000-0000-4000-8000-000000000001';
describe('Gateway du rendu de carte', () => {
  it('refuse une origine étrangère avant toute génération', async () => {
    const deps = { authenticate: vi.fn(), render: vi.fn() };
    const response = await createAffiliationRenderHandler(deps)(new Request('https://example.test', { method: 'POST', headers: { Origin: 'https://evil.test' } }));
    expect(response.status).toBe(403); expect(deps.render).not.toHaveBeenCalled();
  });
  it('exige une identité vérifiée et ignore les données imprimées transmises par le client', async () => {
    const deps = { authenticate: vi.fn().mockResolvedValue(true), render: vi.fn() };
    const handler = createAffiliationRenderHandler(deps);
    expect((await handler(new Request('https://example.test', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect((await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ cardId: id, nom: 'FAUX TITULAIRE' }) }))).status).toBe(400);
    expect(deps.render).not.toHaveBeenCalled();
  });
  it('n’annonce pas de succès lorsque le rendu ou la persistance échoue', async () => {
    const deps = { authenticate: vi.fn().mockResolvedValue(true), render: vi.fn().mockRejectedValue(new Error('secret internal details')) };
    const response = await createAffiliationRenderHandler(deps)(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ cardId: id }) }));
    expect(response.status).toBe(422); expect(await response.text()).not.toContain('secret internal');
  });
});
