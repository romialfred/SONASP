import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingPreparationEdit from './ShippingPreparationEdit';

const serviceMock = vi.hoisted(() => ({
  getPreparationById: vi.fn(),
  updatePreparation: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/services/shippingPreparationService', () => ({
  shippingPreparationService: serviceMock,
}));
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/ErrorDialog', () => ({ ErrorDialog: () => null }));
vi.mock('@/components/ui/SuccessDialog', () => ({ SuccessDialog: () => null }));

const preparation = {
  id: 'shipping-1',
  reference_number: 'SHIP-1',
  expedition_number: 'EXP-1',
  shipment_date: '2026-08-24',
  production_date: '2026-08-23',
  daily_production_id: null,
  mining_company_id: null,
  export_license_id: null,
  refinery_id: null,
  freight_company_id: null,
  expedition_lot_number: 'LOT-1',
  seal_number: null,
  seal_numbers: [],
  packing_list_url: null,
  packing_list_document_id: null,
  shipped_to_company: null,
  shipped_to_address: null,
  shipped_to_country: null,
  status: 'waiting_for_customs_approval',
  prepared_at: null,
  shipped_at: null,
  notes: null,
  total_net_weight_grams: 1_000,
  total_gross_weight_grams: 1_050,
  total_weight_oz: 32.15,
  total_boxes: 1,
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
  created_by: 'user-1',
} as const;

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={['/shipping/preparation/shipping-1/edit']}>
      <Routes>
        <Route
          path="/shipping/preparation/:id/edit"
          element={<ShippingPreparationEdit />}
        />
        <Route
          path="/shipping/preparation/:id/details"
          element={<div>Détails canoniques</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ShippingPreparationEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getPreparationById.mockResolvedValue(preparation);
    serviceMock.updatePreparation.mockResolvedValue(preparation);
    supabaseMock.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }));
  });

  afterEach(() => vi.useRealTimers());

  it('affiche le statut en lecture seule sans choix arbitraire', async () => {
    renderEdit();

    await screen.findByRole('heading', { name: 'Modifier la préparation d’expédition' });
    expect(screen.getByText(/changements de statut s’effectuent uniquement depuis le circuit de l’expédition/i)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Douane Approuvée' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Prêt pour Expédition' })).not.toBeInTheDocument();
  });

  it.each(['Retour', 'Annuler'])('redirige le bouton %s vers les détails canoniques', async (label) => {
    renderEdit();

    fireEvent.click(await screen.findByRole('button', { name: label }));

    expect(await screen.findByText('Détails canoniques')).toBeInTheDocument();
  });

  it('enregistre uniquement les informations générales puis revient aux détails canoniques', async () => {
    renderEdit();
    await screen.findByRole('heading', { name: 'Modifier la préparation d’expédition' });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
      await Promise.resolve();
    });

    expect(serviceMock.updatePreparation).toHaveBeenCalledWith(
      'shipping-1',
      expect.not.objectContaining({ status: expect.anything() }),
    );
    expect(serviceMock.updatePreparation).toHaveBeenCalledWith('shipping-1', expect.not.objectContaining({ expedition_lot_number: expect.anything() }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la préparation' }));

    expect(screen.getByText('Détails canoniques')).toBeInTheDocument();
  });
});
