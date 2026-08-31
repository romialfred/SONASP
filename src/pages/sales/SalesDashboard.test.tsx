import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/types/auth';
import { saleFixture, paymentFixture } from './internationalSalesList.fixture';

const mock = vi.hoisted(() => ({ list: vi.fn(), export: vi.fn(), user: null as UserProfile | null, language: 'fr' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: mock.language } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/services/internationalSalesListService', () => ({ listInternationalSales: mock.list }));
vi.mock('@/lib/excelExport', () => ({ downloadExcelWorkbook: mock.export }));

import { InternationalSalesRegister, SalesDashboard } from './SalesDashboard';

const owner = { id: 'owner-a', role: 'owner', is_active: true, mining_company_id: null, capabilities: [], module_codes: ['sales'] } as unknown as UserProfile;
const records = Array.from({ length: 13 }, (_, index) => saleFixture({
  id: `sale-${index}`, sale_number: `VE-${String(index + 1).padStart(3, '0')}`,
  payments: index === 0 ? [paymentFixture()] : [],
}));
const renderRegister = (sales = records, options = {}) => render(<MemoryRouter><InternationalSalesRegister sales={sales} loading={false} failed={false} canCreate={true} onRetry={vi.fn()} {...options} /></MemoryRouter>);

describe('International sales register', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.user = owner; mock.language = 'fr'; mock.list.mockResolvedValue(records); mock.export.mockResolvedValue(undefined); });
  it('renders the requested columns, real invoice/licence, 10 rows and detail links', () => {
    renderRegister();
    expect(screen.getByRole('heading', { name: 'Ventes d’or à l’international' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(10);
    expect(screen.getAllByRole('row')).toHaveLength(11);
    expect(screen.getByRole('link', { name: 'Voir la vente VE-001' })).toHaveAttribute('href', '/sales/sale-0');
    expect(screen.getByText('Affichage de 1 à 10 sur 13 ventes')).toBeInTheDocument();
    expect(screen.getAllByText('Licence exp. EXP-2026-001')).toHaveLength(10);
  });
  it('supports status chips, counts, search, reset and pagination', async () => {
    const user = userEvent.setup(); renderRegister();
    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(screen.getByText('Affichage de 11 à 13 sur 13 ventes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Partiellement payées 1' }));
    expect(screen.getByText('Affichage de 1 à 1 sur 1 vente')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await user.type(screen.getByRole('searchbox'), 'VE-013');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'VE-013' })).toBeInTheDocument();
  });
  it('exports all filtered results rather than just the current page', async () => {
    const user = userEvent.setup(); renderRegister();
    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(mock.export).toHaveBeenCalledOnce());
    expect(mock.export.mock.calls[0][0][0].rows).toHaveLength(13);
    expect(mock.export.mock.calls[0][0][0].rows[0]['Montant payé']).toBe(24000);
  });
  it('does not export filtered-out structures', async () => {
    const user = userEvent.setup();
    renderRegister([records[0], saleFixture({ id: 'foreign', seller_id: 'mine-b', companyName: 'Mine B' })]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mine / Comptoir' }), 'mining_company:mine-a');
    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(mock.export).toHaveBeenCalledOnce());
    expect(mock.export.mock.calls[0][0][0].rows).toHaveLength(1);
  });
  it('does not offer a structure selector inside a tenant portal', () => {
    renderRegister(records, { canFilterSellers: false });
    expect(screen.queryByRole('combobox', { name: 'Mine / Comptoir' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(10);
  });
  it('opens advanced filters and closes actions with Escape while restoring focus', async () => {
    const user = userEvent.setup(); renderRegister();
    await user.click(screen.getByRole('button', { name: 'Filtres' }));
    expect(screen.getByRole('combobox', { name: 'Étape de la vente' })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Autres actions VE-001' });
    await user.click(trigger);
    expect(screen.getByRole('link', { name: 'Ouvrir dans un nouvel onglet' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Ouvrir dans un nouvel onglet' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Copier la référence' }).closest('table')).toBeNull();
    await user.keyboard('{Escape}'); expect(trigger).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Copier la référence' })).not.toBeInTheDocument();
  });
  it('keeps the shell visible during loading and distinguishes errors from empty data', () => {
    const { unmount } = renderRegister([], { loading: true, canCreate: false });
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByText('Chargement des ventes…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nouvelle vente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled(); unmount();
    renderRegister([], { failed: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Le registre des ventes');
    expect(screen.queryByText('Aucune vente à afficher')).not.toBeInTheDocument();
  });
  it('preserves the English interface', () => {
    mock.language = 'en'; renderRegister();
    expect(screen.getByRole('heading', { name: 'International gold sales' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
  it('does not reload on tab focus or equivalent refreshed profile objects', async () => {
    const view = render(<MemoryRouter><SalesDashboard /></MemoryRouter>);
    await screen.findByText('Affichage de 1 à 10 sur 13 ventes');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'VE-013' } });
    mock.user = { ...owner, capabilities: [], module_codes: ['sales'] };
    view.rerender(<MemoryRouter><SalesDashboard /></MemoryRouter>);
    fireEvent(window, new Event('focus')); fireEvent(document, new Event('visibilitychange'));
    expect(mock.list).toHaveBeenCalledOnce();
    expect(screen.getByRole('searchbox')).toHaveValue('VE-013');
  });
  it('clears the previous account data immediately and ignores its late response', async () => {
    let resolveOld!: (sales: typeof records) => void;
    mock.list.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<MemoryRouter><SalesDashboard /></MemoryRouter>);
    const oldSignal = mock.list.mock.calls[0][0] as AbortSignal;
    mock.user = { ...owner, id: 'owner-b' };
    mock.list.mockResolvedValueOnce([saleFixture({ id: 'b-sale', sale_number: 'TENANT-B' })]);
    view.rerender(<MemoryRouter><SalesDashboard /></MemoryRouter>);
    await screen.findByRole('link', { name: 'TENANT-B' });
    await act(async () => { resolveOld(records); });
    expect(oldSignal.aborted).toBe(true);
    expect(within(screen.getByRole('table')).queryByText('VE-001')).not.toBeInTheDocument();
  });
  it('invalidates a customer perimeter when its authoritative email changes', async () => {
    mock.user = { ...owner, role: 'customer', email: 'buyer-a@example.invalid' };
    const view = render(<MemoryRouter><SalesDashboard /></MemoryRouter>);
    await screen.findByRole('link', { name: 'VE-001' });
    mock.user = { ...mock.user, email: 'buyer-b@example.invalid' };
    mock.list.mockResolvedValueOnce([]);
    view.rerender(<MemoryRouter><SalesDashboard /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'VE-001' })).not.toBeInTheDocument();
    await screen.findByText('Aucune vente à afficher');
    expect(mock.list).toHaveBeenCalledTimes(2);
  });
});
