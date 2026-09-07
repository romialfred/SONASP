import { beforeEach, describe, expect, it, vi } from 'vitest';
import { customerActivity, loadCustomerDossier, loadCustomerDirectory, loadCustomerSales, saveCustomerDossier, type CustomerSale } from './customerDossierService';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: mocks }));
const sale = { id: 'sale-a', customer_id: 'client-a', sale_number: 'REAL-1', created_at: '2026-09-01', status: 'customer_approved', quantity_oz: 2, final_proceeds: 100, currency: 'USD' } as CustomerSale;
function query(result: unknown) { const builder: Record<string, unknown> = {}; for (const method of ['select','eq','order','range','single']) builder[method] = vi.fn(() => builder); builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve); return builder; }
beforeEach(() => vi.clearAllMocks());
describe('Contrat Clients — tests de service isolés', () => {
  it('calcule une moyenne par vente, en conservant les valeurs nulles et les devises', () => {
    expect(customerActivity([sale, { ...sale, id: 'sale-b', final_proceeds: 300, status: 'management_approved' }])).toMatchObject({ count: 2, total: 400, average: 200, currency: 'USD' });
    expect(customerActivity([sale, { ...sale, currency: 'EUR' }]).total).toBeNull();
    expect(customerActivity([{ ...sale, final_proceeds: null }]).total).toBeNull();
    expect(customerActivity([{ ...sale, status: 'create_sales' }]).count).toBe(0);
  });
  it('remonte une erreur bancaire au lieu de simuler une collection vide', async () => {
    mocks.from.mockImplementation(table => query(table === 'customers' ? { data: { id: 'client-a' }, error: null } : { data: null, error: { message: 'Lecture refusée' } }));
    await expect(loadCustomerDossier('client-a')).rejects.toMatchObject({ message: 'Lecture refusée' });
  });
  it('continue la pagination selon le décompte serveur même si une page est courte', async () => {
    mocks.from.mockReturnValueOnce(query({ data: [{ id: 'one' }], count: 2, error: null })).mockReturnValueOnce(query({ data: [{ id: 'two' }], count: 2, error: null }));
    expect(await loadCustomerDirectory()).toEqual([{ id: 'one' }, { id: 'two' }]);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
  it('remonte les erreurs des ventes, sans faux agrégats à zéro', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: new Error('Ventes indisponibles') }));
    await expect(loadCustomerSales('client-a')).rejects.toThrow('Ventes indisponibles');
  });
  it('ne traite pas une réponse RPC vide comme un succès', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(saveCustomerDossier(null, { name: 'QA', email: 'qa@example.test', country: 'Burkina Faso' }, [])).rejects.toThrow('Aucun dossier enregistré');
  });
  it('refuse Autre non renseigné et ne perd aucune banque silencieusement', async () => {
    await expect(saveCustomerDossier(null, { name: 'QA', email: 'qa@example.test', country: 'Burkina Faso' }, [{ bankName: '__other__', country: 'Burkina Faso', city: 'Ouagadougou', currency: 'XOF', accountNumber: '', iban: '', swiftCode: '', isPrimary: true, isActive: true }])).rejects.toThrow('Chaque compte bancaire');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
