import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternationalSaleSimulator } from './InternationalSaleSimulator';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  calculate: vi.fn(),
  exportCsv: vi.fn(),
  success: vi.fn(),
  user: { id: 'user-1', role: 'owner', is_active: true, capabilities: ['referentials.manage'] },
}));

vi.mock('@/components/layout/MainLayout', () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/sales/LiveGoldMarketPanel', () => ({ LiveGoldMarketPanel: () => <div data-testid="gold-drawer" /> }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock('@/hooks/useAlert', () => ({ useAlert: () => ({ success: mocks.success }) }));
vi.mock('@/services/saleSimulationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/saleSimulationService')>();
  return {
    ...actual,
    loadSaleSimulationContext: mocks.load,
    saveSaleSimulation: mocks.save,
    calculateSaleSimulation: mocks.calculate,
    exportSaleSimulationCsv: mocks.exportCsv,
  };
});

const context = {
  sellerId: 'seller-1',
  sellerName: 'SONASP',
  sellerProfile: 'tous' as const,
  availableStockOz: 100,
  goldPrice: {
    price: 2_848.87, timestamp: Date.parse('2026-09-04T16:58:37Z'), source: 'Référentiel SONASP', currency: 'USD',
    change24h: 11.87, changePercent24h: 0.42, openPrice: 2_837, high24h: 2_855.87, low24h: 2_839.87,
  },
  usdXofRate: 598.42,
  fxRateDate: '2026-09-04',
  fxSource: 'Référentiel SONASP',
  counterparties: [{ key: 'refinery:r1', id: 'r1', type: 'refinery' as const, name: 'Rand Refinery', detail: 'Afrique du Sud' }],
  suggestedTaxRatePct: 1.25,
  taxRulesAvailable: true,
};

const result = {
  quantityOz: 15,
  quantityGrams: 466.552152,
  grossValueUsd: 42_733.05,
  premiumDiscountAmountUsd: 0,
  adjustedValueUsd: 42_733.05,
  taxAmountUsd: 534.163125,
  netProceedsUsd: 42_198.886875,
  grossValueXof: 25_574_155.371,
  premiumDiscountAmountXof: 0,
  logisticsCostXof: 0,
  taxAmountXof: 319_657.110868,
  netProceedsXof: 25_254_498.260132,
  netPriceXofOz: 1_683_633.217342,
  netMarginPct: 98.75,
};

const saved = {
  id: 'simulation-1', simulation_reference: 'SIM-2026-000001', created_at: '2026-09-04T17:00:00Z', created_by: 'user-1',
  seller_id: 'seller-1', seller_name_snapshot: 'SONASP', counterparty_id: 'r1', counterparty_type: 'refinery' as const,
  counterparty_name_snapshot: 'Rand Refinery', stock_available_oz: 100, quantity_oz: 15, input_unit: 'oz' as const,
  reference_price_usd_oz: 2848.87, usd_xof_rate: 598.42, settlement_currency: 'USD', premium_discount_pct: 0,
  logistics_cost_usd: 0, tax_rate_pct: 1.25, tax_amount_usd: 534.163125, gross_value_usd: 42733.05,
  adjusted_value_usd: 42733.05, net_proceeds_usd: 42198.886875, net_proceeds_xof: 25254498.260132,
  net_price_xof_oz: 1683633.217342, net_margin_pct: 98.75, value_date: '2026-09-04', status: 'completed' as const,
  gold_price_source: 'Référentiel SONASP', fx_source: 'Référentiel SONASP',
};

const renderPage = () => render(<MemoryRouter><InternationalSaleSimulator /></MemoryRouter>);

describe('InternationalSaleSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue(context);
    mocks.calculate.mockReturnValue(result);
    mocks.save.mockResolvedValue(saved);
  });

  it('affiche les données réelles du contexte et les paramètres attendus', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Simulation de vente internationale' })).toBeInTheDocument();
    expect(screen.getByText('100,000 oz')).toBeInTheDocument();
    expect(screen.getByText('Référentiel du 04 sept. 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Acheteur / Raffineur')).toHaveValue('refinery:r1');
    expect(screen.getByLabelText('Prix de référence')).toHaveValue('2 848,87');
    expect(screen.getByTestId('gold-drawer')).toBeInTheDocument();
  });

  it('synchronise le curseur avec la quantité', async () => {
    renderPage();
    const slider = await screen.findByRole('slider', { name: 'Pourcentage du stock à vendre' });
    fireEvent.change(slider, { target: { value: '50' } });
    expect(screen.getByLabelText('Quantité à vendre')).toHaveValue('50,00');
    expect(screen.getByText('50,0 % du stock disponible')).toBeInTheDocument();
  });

  it('refuse une quantité supérieure au stock', async () => {
    const user = userEvent.setup();
    renderPage();
    const quantity = await screen.findByLabelText('Quantité à vendre');
    fireEvent.change(quantity, { target: { value: '101' } });
    await user.click(screen.getByRole('button', { name: 'Lancer la simulation' }));
    expect(await screen.findByText('La quantité dépasse le stock exportable disponible.')).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('calcule, historise et affiche la synthèse sans recharger la page', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Stock exportable');
    await user.click(screen.getByRole('button', { name: 'Lancer la simulation' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(screen.getByText('Simulation prête')).toBeInTheDocument();
    expect(screen.getByText('25,3 M FCFA')).toBeInTheDocument();
    expect(screen.queryByText('−0 FCFA')).not.toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledWith('Simulation SIM-2026-000001 enregistrée.');
  });

  it('conserve le résultat si l’historisation échoue et affiche une erreur locale', async () => {
    mocks.save.mockRejectedValue(new Error('table indisponible'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Stock exportable');
    await user.click(screen.getByRole('button', { name: 'Lancer la simulation' }));
    expect(await screen.findByText(/son enregistrement dans l’historique a échoué/)).toBeInTheDocument();
    expect(screen.getByText('Simulation prête')).toBeInTheDocument();
  });

  it('exporte le scénario calculé', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Stock exportable');
    await user.click(screen.getByRole('button', { name: 'Lancer la simulation' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Exporter le scénario' }));
    expect(mocks.exportCsv).toHaveBeenCalledWith(saved, expect.objectContaining({ result }));
  });

  it('présente une erreur de chargement contrôlée avec reprise', async () => {
    mocks.load.mockRejectedValueOnce(new Error('Référentiel indisponible')).mockResolvedValueOnce(context);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Référentiel indisponible')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Stock exportable')).toBeInTheDocument();
  });
});
