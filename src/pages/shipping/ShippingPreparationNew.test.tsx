import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingPreparationNew from './ShippingPreparationNew';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), licenses: vi.fn(), availability: vi.fn(),
  service: { generateExpeditionLotNumber: vi.fn(), createPreparation: vi.fn(), createPreparationAtomic: vi.fn(), getPreparationById: vi.fn(), updatePreparation: vi.fn(), getProductionItems: vi.fn(), addProductionItem: vi.fn(), getSignatories: vi.fn(), createSignatory: vi.fn(), getDocuments: vi.fn(), uploadDocument: vi.fn(), reserveLicenseQuota: vi.fn() },
}));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner', role: 'owner', is_active: true } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/shipping/DynamicPackingList', () => ({ DynamicPackingList: () => <div>Packing list</div> }));
vi.mock('@/services/shippingPreparationService', () => ({ shippingPreparationService: mocks.service }));
vi.mock('@/services/depositorService', () => ({ depositorService: { getDepositorsByCompany: async () => ({ data: [], error: null }) } }));
vi.mock('@/services/exportLicenseService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/exportLicenseService')>(),
  exportLicenseService: { getActiveLicensesByCompany: mocks.licenses, checkLicenseAvailability: mocks.availability },
}));
const production = { id: 'production-a', mining_company_id: 'mine-a', production_date: '2026-08-01', bullion_grams: 1000, pure_gold_grams: 990, estimated_fineness_pct: 99, estimated_oz: 31.83, bar_reference: 'BAR-2026-001', status: 'ready_for_customs', mining_company: { name: 'Mine A' } };
const license = { id: 'licence-a', mining_company_id: 'mine-a', license_number: 'EXP-2026-001', status: 'active', start_date: '2026-01-01', end_date: '2099-12-31', remaining_quantity_grams: 10000 };
const prep = { id: 'prep-a', expedition_lot_number: 'HUM-MA-0001/2026', mining_company_id: 'mine-a' };
let productionRows = [production];
function showForm() { return render(<MemoryRouter><ShippingPreparationNew /></MemoryRouter>); }
async function completeFields() {
  await screen.findByRole('option', { name: 'Mine A (MA)' });
  await waitFor(() => expect(screen.getByLabelText(/Société minière/)).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText(/Société minière/), { target: { value: 'mine-a' } });
  await screen.findByRole('option', { name: /EXP-2026-001/ });
  await waitFor(() => expect(screen.getByLabelText('Licence d’exportation *')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Licence d’exportation *'), { target: { value: 'licence-a' } });
  fireEvent.change(screen.getByLabelText('Ajouter un lot de production'), { target: { value: 'production-a' } });
  fireEvent.change(screen.getByLabelText('Scellé principal de BAR-2026-001'), { target: { value: 'SEAL-001' } });
  fireEvent.change(screen.getByLabelText(/^Transporteur/), { target: { value: 'carrier-a' } });
  fireEvent.change(screen.getByLabelText(/^Raffinerie de destination/), { target: { value: 'refinery-a' } });
}
describe('ShippingPreparationNew regression coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productionRows = [production];
    mocks.from.mockImplementation((table: string) => {
      const data = ({ mining_companies: [{ id: 'mine-a', name: 'Mine A', code: 'MA' }], transport_companies: [{ id: 'carrier-a', name: 'Carrier A' }], refineries: [{ id: 'refinery-a', name: 'Refinery A', country: 'South Africa' }], daily_production: productionRows, shipping_production_items: [] } as Record<string, unknown[]>)[table] || [];
      const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
      query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query); return query;
    });
    mocks.licenses.mockResolvedValue([license]);
    mocks.availability.mockResolvedValue({ is_available: true, remaining_quantity: 9000 });
    mocks.service.createPreparationAtomic.mockResolvedValue(prep);
    // La création atomique a déjà produit les enfants côté serveur : la relecture
    // les renvoie, donc les boucles de reprise n'insèrent aucun doublon.
    mocks.service.getProductionItems.mockResolvedValue([{ daily_production_id: production.id }]);
    mocks.service.getSignatories.mockResolvedValue([]);
    mocks.service.getDocuments.mockResolvedValue([]);
    mocks.service.addProductionItem.mockResolvedValue({ id: 'item-a' });
    mocks.service.reserveLicenseQuota.mockResolvedValue(false);
  });
  it('crée la préparation atomiquement (parent+enfants) et rejette un quota non confirmé', async () => {
    showForm(); await completeFields();
    // La référence est générée côté serveur : aucun tirage de numéro côté client.
    expect(mocks.service.generateExpeditionLotNumber).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la préparation' }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la préparation|Enregistrement de la préparation/ }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(mocks.service.createPreparation).not.toHaveBeenCalled();
    expect(mocks.service.createPreparationAtomic).toHaveBeenCalledOnce();
    expect(mocks.service.createPreparationAtomic).toHaveBeenCalledWith(expect.objectContaining({
      miningCompanyId: 'mine-a',
      exportLicenseId: 'licence-a',
      freightCompanyId: 'carrier-a',
      refineryId: 'refinery-a',
      items: [expect.objectContaining({
        daily_production_id: 'production-a',
        net_weight_grams: 990,
        gross_weight_grams: 1000,
        seal_number_1: 'SEAL-001',
      })],
    }));
    // Les enfants existant déjà, la reprise ne réinsère aucune ligne.
    expect(mocks.service.addProductionItem).not.toHaveBeenCalled();
    expect(screen.queryByText('Préparation enregistrée')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finaliser la préparation' })).toBeInTheDocument();
  });
  it('rejoue la même préparation sans la recréer ni dupliquer ses enfants', async () => {
    showForm(); await completeFields();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la préparation' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    const before = mocks.availability.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Finaliser la préparation' }));
    await screen.findByRole('alertdialog');
    // La création atomique n'a lieu qu'une fois ; la reprise passe par la mise à jour.
    expect(mocks.service.createPreparationAtomic).toHaveBeenCalledOnce();
    expect(mocks.service.updatePreparation).toHaveBeenCalled();
    expect(mocks.service.addProductionItem).not.toHaveBeenCalled();
    expect(mocks.availability.mock.calls.length).toBe(before);
    expect(mocks.service.reserveLicenseQuota).toHaveBeenCalledTimes(2);
  });
  it('excludes a physically invalid production and announces the reason accessibly', async () => {
    productionRows = [{ ...production, estimated_fineness_pct: 100.01 }];
    showForm();
    await screen.findByRole('option', { name: 'Mine A (MA)' });
    fireEvent.change(screen.getByLabelText(/Société minière/), { target: { value: 'mine-a' } });

    const exclusionMessage = await screen.findByText(/1 lot de production a été exclu/i);
    expect(exclusionMessage.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('option', { name: /BAR-2026-001/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ajouter un lot de production')).toHaveAccessibleDescription(/poids positifs ainsi qu’une pureté cohérente/i);
    expect(mocks.service.createPreparationAtomic).not.toHaveBeenCalled();
  });
});
