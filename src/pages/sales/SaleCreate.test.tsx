import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAuthorization: vi.fn(),
  loadCustomer: vi.fn(),
  loadMarket: vi.fn(),
  saveDraft: vi.fn(),
  submitDraft: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@/components/layout/MainLayout', () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1', mining_company_id: null } }) }));
vi.mock('@/hooks/useAlert', () => ({ useAlert: () => ({ success: mocks.success, error: vi.fn() }) }));
vi.mock('@/lib/supabase', () => {
  const query = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: 'sonasp-1', name: 'Société Nationale des Substances Précieuses', abbreviation: 'SONASP', country: 'Burkina Faso', company_type: 'institution' }, error: null });
  return { supabase: { from: vi.fn(() => query) } };
});
vi.mock('@/services/goldSalesSettingsService', () => ({
  getAuthorizedCustomersForMine: vi.fn().mockResolvedValue({ success: true, data: [{ customer_id: 'customer-1', customer_name: 'Auramet Trading LLC', max_stock_percentage: 100, sale_method: 'spot_sale', refining_fees_paid_by_customer: true, transport_fees_paid_by_customer: true }] }),
  checkSaleAuthorization: mocks.checkAuthorization,
}));
vi.mock('@/services/goldTradeSpaceService', () => ({ getApprovedRefineries: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock('@/services/mineStockService', () => ({ mineStockService: { stock: vi.fn() } }));
vi.mock('@/services/stockSonaspService', () => ({ stockSonaspService: { stock: vi.fn().mockResolvedValue({ decouvert: false }) } }));
vi.mock('@/services/tracabiliteVenteService', () => ({
  tracabiliteVenteService: { lotsDisponibles: vi.fn().mockResolvedValue({ lots: [{ disponibleOz: 500 }], diagnostic: { blocked: false } }) },
  composer: vi.fn(), messageIndisponibiliteLots: vi.fn(), validerComposition: vi.fn(),
}));
vi.mock('@/services/saleCreationWorkspaceService', () => ({
  calculateSaleCreationSummary: vi.fn(() => ({ quantityOz: 25, quantityGrams: 777.5, grossUsd: 75_000, costsUsd: 0, royaltyRatePct: 3, royaltyUsd: 2_250, netUsd: 72_750, grossXof: 45_000_000, netXof: 43_650_000, netMarginPct: 97 })),
  loadCustomerSaleContext: mocks.loadCustomer,
  loadSaleMarketContext: mocks.loadMarket,
  normalizeSaleWorkspaceError: (error: Error) => ({ code: 'TEST', message: error.message }),
  quantityToOunces: (quantity: number, unit: string) => unit === 'g' ? quantity / 31.1034768 : quantity,
  saveSaleDraft: mocks.saveDraft,
  submitSaleDraft: mocks.submitDraft,
  validateSaleCreationInputs: vi.fn(() => ({})),
}));

import { SaleCreate } from './SaleCreate';

describe('SaleCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadMarket.mockResolvedValue({
      spotPriceUsdOz: 3_000, previousCloseUsdOz: 2_990, goldPriceSource: 'Référentiel SONASP',
      goldPriceUpdatedAt: '2026-09-04T12:00:00Z', usdXofRate: 600, fxSource: 'Référentiel SONASP',
      fxRateDate: '2026-09-04', royaltyRatePct: 3,
      history: [{ date: '2026-09-03', priceUsdOz: 2_990, source: 'LBMA' }, { date: '2026-09-04', priceUsdOz: 3_000, source: 'LBMA' }],
      projections: null,
    });
    mocks.loadCustomer.mockResolvedValue({
      id: 'customer-1', name: 'Auramet Trading LLC', country: 'Émirats arabes unis', status: 'active', isActive: true,
      creditLimitUsd: null, paymentTerms: '15 jours', contracts: [],
      performance: { confirmedQuantityOz: 100, weightedAveragePriceUsdOz: 2_950, confirmedSalesCount: 2, confirmedPaymentsUsd: 250_000, outstandingUsd: 0, onTimePaymentPct: 100, averagePaymentDelayDays: 0, averagePaymentTermDays: 15, riskLabel: 'Non évalué', riskReason: 'Aucun modèle validé.' },
    });
    mocks.checkAuthorization.mockResolvedValue({ success: true, data: { is_authorized: true } });
    mocks.saveDraft.mockResolvedValue({ id: 'draft-1', draftNumber: 'BRV-2026-000001', version: 1, status: 'draft', submittedSaleId: null, updatedAt: '2026-09-04T12:00:00Z' });
  });

  it('affiche le formulaire institutionnel et ne fabrique aucune projection', async () => {
    render(<MemoryRouter><SaleCreate /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Créer une vente internationale' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Soumettre pour validation/u })).toBeDisabled();
    expect(screen.getAllByText('Projection indisponible')).toHaveLength(2);
    expect(screen.getByLabelText('Quantité à vendre')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix proposé')).toBeInTheDocument();
  });

  it('recharge le contexte du seul client choisi puis active la validation après analyse', async () => {
    render(<MemoryRouter><SaleCreate /></MemoryRouter>);
    const customer = await screen.findByRole('option', { name: /Auramet Trading LLC/u });
    fireEvent.click(customer);
    expect(await screen.findByRole('heading', { name: 'Auramet Trading LLC' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantité à vendre'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analyser la vente' }));
    await waitFor(() => expect(mocks.checkAuthorization).toHaveBeenCalledWith('sonasp-1', 'customer-1', 25, 500));
    expect(screen.getByRole('button', { name: /Soumettre pour validation/u })).toBeEnabled();
  });

  it('enregistre un brouillon sans déclencher la soumission', async () => {
    render(<MemoryRouter><SaleCreate /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('option', { name: /Auramet Trading LLC/u }));
    await screen.findByRole('heading', { name: 'Auramet Trading LLC' });
    fireEvent.change(screen.getByLabelText('Quantité à vendre'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledOnce());
    expect(mocks.submitDraft).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('sans réservation de stock'));
  });
});
