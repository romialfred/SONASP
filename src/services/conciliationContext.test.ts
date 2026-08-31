import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conciliation } from './conciliationService';
const mocks = vi.hoisted(() => ({ from: vi.fn(), lots: vi.fn(), queries: [] as Array<{ table: string; filters: unknown[][] }>, results: {} as Record<string, { data: unknown; error: unknown }> }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('./tracabiliteVenteService', () => ({ tracabiliteVenteService: { lotsDeVente: mocks.lots } }));
import { chargerContexteConciliation } from './conciliationContext';
const dossier = { id: 'c1', sale_id: 'sale1', sale: { shipping_preparation_id: 'sp1' }, assay_certificate_id: null, analyse_teneur_id: null } as Conciliation;
beforeEach(() => {
  mocks.queries.length = 0; mocks.results = {}; mocks.lots.mockResolvedValue([]);
  mocks.from.mockImplementation((table: string) => {
    const query = { table, filters: [] as unknown[][] }; mocks.queries.push(query);
    const chain: Record<string, unknown> = { then: (resolve: (r: unknown) => unknown) => Promise.resolve(mocks.results[table] ?? { data: [], error: null }).then(resolve) };
    for (const method of ['select', 'eq', 'is', 'in', 'order', 'limit', 'maybeSingle']) chain[method] = (...args: unknown[]) => { query.filters.push([method, ...args]); return chain; };
    return chain;
  });
});
describe('chargement indépendant du contexte de conciliation', () => {
  it('une relation secondaire absente ne masque pas une preuve visible pour Owner', async () => {
    mocks.lots.mockRejectedValue({ code: 'PGRST200' });
    mocks.results.assay_certificates = { data: [{ id: 'cert', approval_status: 'approved', approved_by: 'owner', approved_at: '2026-08-30' }], error: null };
    const result = await chargerContexteConciliation(dossier);
    expect(result.certificat?.id).toBe('cert');
    expect(result.incidents).toEqual([{ section: 'Origine des lots', code: 'PGRST200', type: 'technique' }]);
  });
  it('ne choisit pas silencieusement entre deux certificats approuvés', async () => {
    mocks.results.assay_certificates = { data: [1, 2].map(n => ({ id: `cert${n}`, approval_status: 'approved', approved_at: 'date', approved_by: 'owner' })), error: null };
    expect((await chargerContexteConciliation(dossier)).certificat).toBeNull();
    expect((await chargerContexteConciliation({ ...dossier, assay_certificate_id: 'cert2' })).certificat?.id).toBe('cert2');
  });
  it('ne recherche les preuves que dans l’expédition effectivement rattachée', async () => {
    await chargerContexteConciliation(dossier);
    for (const table of ['assay_certificates', 'snp_analyses_teneur', 'freight_shipments']) {
      expect(mocks.queries.find(q => q.table === table)?.filters).toContainEqual(['eq', 'shipping_preparation_id', 'sp1']);
    }
  });
  it('sans expédition ne tente pas de deviner un certificat à partir de la référence', async () => {
    await chargerContexteConciliation({ ...dossier, sale: { ...dossier.sale!, shipping_preparation_id: null } });
    expect(mocks.queries.map(q => q.table)).not.toContain('assay_certificates');
  });

  it('retrouve aussi le rapport Mine rattaché à l’achat source réel de la vente', async () => {
    mocks.lots.mockResolvedValue([{ source_type: 'achat_mine', source_id: 'achat1' }]);
    await chargerContexteConciliation(dossier);
    expect(mocks.queries.find(q => q.table === 'snp_analyses_teneur' && q.filters.some(f => f[0] === 'in'))?.filters).toContainEqual(['in', 'achat_id', ['achat1']]);
  });
  it('distingue le refus SQL d’une panne et conserve les lignes', async () => {
    mocks.results.payments = { data: null, error: { code: '42501' } };
    mocks.results.sales_line_items = { data: [{ id: 'line' }], error: null };
    const result = await chargerContexteConciliation(dossier);
    expect(result.lignes).toEqual([{ id: 'line' }]);
    expect(result.incidents?.[0].type).toBe('acces');
  });
});
