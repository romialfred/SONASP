import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FreightShipmentCreate from './FreightShipmentCreate';
import { FreightShipmentPartialSaveError } from '@/services/freightShipmentService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  getAvailable: vi.fn(),
  createShipment: vi.fn(),
  from: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/contexts/NotificationContext', () => ({
  useNotification: () => ({ showSuccess: mocks.showSuccess, showWarning: mocks.showWarning }),
}));
// La creation de fret exige desormais la capacite freight.prepare (garde UI) :
// le compte de test la detient pour que le formulaire reste actif.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'op-1', is_active: true, capabilities: ['freight.prepare'] } }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/services/freightShipmentService', () => {
  class PartialSaveError extends Error {
    constructor(public shipmentId: string, public reference: string) {
      super('partial save');
      this.name = 'FreightShipmentPartialSaveError';
    }
  }
  return {
    FreightShipmentPartialSaveError: PartialSaveError,
    freightShipmentService: {
      getAvailableShippingPreparations: mocks.getAvailable,
      createShipment: mocks.createShipment,
    },
  };
});

function query(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
}

const preparation = {
  id: 'preparation-1',
  expedition_lot_number: 'HUM-SONASP-0001/2026',
  status: 'ready_for_expedition',
  shipped_at: null,
  total_net_weight_grams: 999,
  total_gross_weight_grams: 1000,
  total_boxes: 1,
  shipped_to_company: null,
  shipped_to_country: null,
  items: [{
    id: 'item-1',
    daily_production_id: 'production-1',
    ingot_box_number: 'BOX-1',
    daily_production: {
      production_date: '2026-08-30', bar_reference: 'BAR-1', bullion_grams: 1000,
      estimated_fineness_pct: 99.9, pure_gold_grams: 999, estimated_oz: 32.12,
      silver_content_grams: 1, mining_company_id: 'company-1',
    },
  }],
};

describe('FreightShipmentCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAvailable.mockResolvedValue([preparation]);
    mocks.from.mockImplementation((table: string) => {
      if (table === 'refineries') return query([{ id: 'refinery-1', name: 'African Refinery', country: 'Ghana' }]);
      if (table === 'mining_companies') return query([{ id: 'company-1', name: 'Mine A' }]);
      if (table === 'shipping_signatories') return query([{ name: 'Jane Doe', position: 'Authorised officer' }]);
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('distinguishes a failed load from a valid empty register and blocks creation', async () => {
    mocks.getAvailable.mockRejectedValue({ code: '42501', message: 'denied' });
    render(<FreightShipmentCreate />);

    expect(await screen.findByText(/Impossible de charger les données des préparations/i)).toBeInTheDocument();
    expect(screen.queryByText(/Aucune préparation admissible n’est disponible/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer l’expédition de fret/i })).toBeDisabled();
  });

  async function completeForm() {
    render(<FreightShipmentCreate />);
    const checkbox = await screen.findByRole('checkbox', { name: /HUM-SONASP-0001\/2026/i });
    fireEvent.click(checkbox);
    await screen.findByText(/Jane Doe/);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'refinery-1' } });
    const numbers = screen.getAllByRole('spinbutton');
    fireEvent.change(numbers[1], { target: { value: '2400' } });
    fireEvent.change(numbers[2], { target: { value: '600' } });
    return screen.getByRole('button', { name: /Créer l’expédition de fret/i });
  }

  it('creates once even when the submit action is activated twice', async () => {
    mocks.createShipment.mockResolvedValue({ id: 'freight-1', reference_number: 'FRT-2026-0001' });
    const submit = await completeForm();
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.createShipment).toHaveBeenCalledTimes(1));
    expect(mocks.createShipment).toHaveBeenCalledWith(expect.objectContaining({
      shipping_preparation_ids: [preparation.id],
      destination_refinery_id: 'refinery-1',
      number_of_boxes: 1,
      gold_price_usd_per_oz: 2400,
      exchange_rate: 600,
      signatories: [{ full_name: 'Jane Doe', position: 'Authorised officer', display_order: 0 }],
      idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }));
    expect(mocks.navigate).toHaveBeenCalledWith('/freight/shipments/freight-1');
  });

  it('reuses the same idempotency key after an uncertain network failure', async () => {
    mocks.createShipment
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ id: 'freight-1', reference_number: 'FRT-2026-0001' });
    const submit = await completeForm();

    fireEvent.click(submit);
    await waitFor(() => expect(mocks.createShipment).toHaveBeenCalledTimes(1));
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.createShipment).toHaveBeenCalledTimes(2));

    const firstKey = mocks.createShipment.mock.calls[0][0].idempotency_key;
    const retryKey = mocks.createShipment.mock.calls[1][0].idempotency_key;
    expect(retryKey).toBe(firstKey);
    expect(mocks.navigate).toHaveBeenCalledWith('/freight/shipments/freight-1');
  });

  it('opens the existing shipment after a partial child write instead of offering a duplicate retry', async () => {
    mocks.createShipment.mockRejectedValue(new FreightShipmentPartialSaveError('freight-1', 'FRT-2026-0001', new Error('denied')));
    const submit = await completeForm();
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.showWarning).toHaveBeenCalledWith(
      'Expédition à vérifier',
      expect.stringContaining('n’en créez pas une autre'),
    ));
    expect(mocks.navigate).toHaveBeenCalledWith('/freight/shipments/freight-1');
    expect(mocks.createShipment).toHaveBeenCalledTimes(1);
  });
});
