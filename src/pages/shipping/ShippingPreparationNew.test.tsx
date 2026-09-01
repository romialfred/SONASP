import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingPreparationNew from './ShippingPreparationNew';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), licenses: vi.fn(), availability: vi.fn(),
  service: { generateExpeditionLotNumber: vi.fn(), createPreparation: vi.fn(), getPreparationById: vi.fn(), updatePreparation: vi.fn(), getProductionItems: vi.fn(), addProductionItem: vi.fn(), getSignatories: vi.fn(), createSignatory: vi.fn(), getDocuments: vi.fn(), uploadDocument: vi.fn(), reserveLicenseQuota: vi.fn() },
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
  await waitFor(() => expect(screen.getByLabelText(/Mining company/)).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText(/Mining company/), { target: { value: 'mine-a' } });
  await screen.findByRole('option', { name: /EXP-2026-001/ });
  await waitFor(() => expect(screen.getByLabelText('Export licence *')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Export licence *'), { target: { value: 'licence-a' } });
  fireEvent.change(screen.getByLabelText('Add a production lot'), { target: { value: 'production-a' } });
  fireEvent.change(screen.getByLabelText('Primary seal for BAR-2026-001'), { target: { value: 'SEAL-001' } });
  fireEvent.change(screen.getByLabelText(/^Carrier/), { target: { value: 'carrier-a' } });
  fireEvent.change(screen.getByLabelText(/^Destination refinery/), { target: { value: 'refinery-a' } });
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
    mocks.service.generateExpeditionLotNumber.mockResolvedValue(prep.expedition_lot_number);
    mocks.service.createPreparation.mockResolvedValue(prep);
    mocks.service.getProductionItems.mockResolvedValue([]);
    mocks.service.getSignatories.mockResolvedValue([]);
    mocks.service.getDocuments.mockResolvedValue([]);
    mocks.service.addProductionItem.mockResolvedValue({ id: 'item-a' });
    mocks.service.reserveLicenseQuota.mockResolvedValue(false);
  });
  it('does not generate a reference before save, writes canonical foreign keys and rejects an unconfirmed quota', async () => {
    showForm(); await completeFields();
    expect(mocks.service.generateExpeditionLotNumber).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save preparation' }));
    fireEvent.click(screen.getByRole('button', { name: /Save preparation|Saving preparation/ }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(mocks.service.createPreparation).toHaveBeenCalledOnce();
    expect(mocks.service.createPreparation).toHaveBeenCalledWith(expect.objectContaining({ refinery_id: 'refinery-a', freight_company_id: 'carrier-a', total_net_weight_grams: 990, total_gross_weight_grams: 1000, status: 'waiting_for_customs_approval', expedition_lot_number: prep.expedition_lot_number }));
    expect(screen.queryByText('Preparation saved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete preparation' })).toBeInTheDocument();
  });
  it('resumes the same preparation and skips production children already saved', async () => {
    showForm(); await completeFields();
    fireEvent.click(screen.getByRole('button', { name: 'Save preparation' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    mocks.service.getProductionItems.mockResolvedValue([{ daily_production_id: production.id }]);
    const before = mocks.availability.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Complete preparation' }));
    await screen.findByRole('alertdialog');
    expect(mocks.service.createPreparation).toHaveBeenCalledOnce();
    expect(mocks.service.addProductionItem).toHaveBeenCalledOnce();
    expect(mocks.availability.mock.calls.length).toBe(before);
    expect(mocks.service.reserveLicenseQuota).toHaveBeenCalledTimes(2);
  });
  it('excludes a physically invalid production and announces the reason accessibly', async () => {
    productionRows = [{ ...production, estimated_fineness_pct: 100.01 }];
    showForm();
    await screen.findByRole('option', { name: 'Mine A (MA)' });
    fireEvent.change(screen.getByLabelText(/Mining company/), { target: { value: 'mine-a' } });

    const exclusionMessage = await screen.findByText(/1 production lot was excluded/i);
    expect(exclusionMessage.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('option', { name: /BAR-2026-001/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Add a production lot')).toHaveAccessibleDescription(/coherent positive weights and purity/i);
    expect(mocks.service.createPreparation).not.toHaveBeenCalled();
  });
});
