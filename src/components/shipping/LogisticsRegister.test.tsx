import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { filterLogisticsRows, logisticsNumber, LogisticsRegister, type LogisticsRow } from './LogisticsRegister';
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const rows: LogisticsRow[] = [
  { id: '1', reference: 'HUM-SONASP-0001/2026', company: 'Mine A', date: '2026-08-01', status: 'ready', grams: 1000, href: '/shipping/preparation/1/details' },
  { id: '2', reference: 'HUM-SONASP-0002/2026', company: 'Mine B', date: '2026-08-20', status: 'pending', grams: null, href: '/shipping/preparation/2/details' },
];
describe('LogisticsRegister', () => {
  it('combines filters and preserves unknown quantities', () => {
    expect(filterLogisticsRows(rows, 'sonasp', 'ready', 'Mine A', '2026-08-01', '2026-08-01')).toEqual([rows[0]]);
    expect(filterLogisticsRows(rows, '', 'ready', 'Mine B', '', '')).toEqual([]);
    expect(logisticsNumber(null)).toBe('—'); expect(logisticsNumber(NaN)).toBe('—'); expect(logisticsNumber(0)).toBe('0,00');
  });
  it('shows actionable loading failure, never a false empty register', async () => {
    const loadRows = vi.fn().mockRejectedValueOnce({ code: 'PGRST201' }).mockResolvedValue(rows);
    render(<MemoryRouter><LogisticsRegister title="Preparations" subtitle="Tracking" loadRows={loadRows} statuses={{ pending: 'Awaiting approval', ready: 'Ready for shipment' }} readyStatus="ready" pendingStatus="pending" createPath="/new" createLabel="New preparation" /></MemoryRouter>);
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Données indisponibles')).toBeInTheDocument();
    expect(screen.queryByText('Aucune expédition ne correspond à ces filtres.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recharger les dossiers' }));
    expect(await screen.findByRole('link', { name: rows[0].reference })).toHaveAttribute('href', rows[0].href);
    expect(loadRows).toHaveBeenCalledTimes(2);
    fireEvent(window, new Event('focus'));
    expect(loadRows).toHaveBeenCalledTimes(2);
  });

  it('separates prepared shipments from shipments actually dispatched', async () => {
    const preparationRows: LogisticsRow[] = [
      { ...rows[0], status: 'ready_for_expedition', shippedAt: '2026-08-22T09:30:00Z', boxes: 1, tracking: '344900' },
      { ...rows[1], status: 'ready_for_expedition', shippedAt: null, boxes: 2, tracking: '344901' },
      { id: '3', reference: 'HUM-SONASP-0003/2026', company: 'Mine C', date: '2026-08-21', status: 'waiting_for_customs_approval', grams: 500, href: '/shipping/preparation/3/details' },
    ];
    render(<MemoryRouter><LogisticsRegister title="Shipment preparations" subtitle="Tracking" loadRows={vi.fn().mockResolvedValue(preparationRows)}
      statuses={{ waiting_for_customs_approval: 'Awaiting customs approval', approved_by_customs: 'Customs approved', ready_for_expedition: 'Ready for shipment' }}
      readyStatus="ready_for_expedition" pendingStatus="waiting_for_customs_approval" createPath="/new" createLabel="New shipment" presentation="shipment-preparations" /></MemoryRouter>);

    const overview = await screen.findByRole('region', { name: 'Synthèse des expéditions' });
    expect(within(overview).getByRole('button', { name: /Préparées1Prêtes à expédier/ })).toBeInTheDocument();
    expect(within(overview).getByRole('button', { name: /Expédiées1Envois effectués/ })).toBeInTheDocument();
    expect(within(overview).getByText('Certains poids sont indisponibles')).toBeInTheDocument();

    fireEvent.click(within(overview).getByRole('button', { name: /Expédiées1/ }));
    expect(screen.getByRole('heading', { name: 'Toutes les expéditions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: preparationRows[0].reference })).toHaveAttribute('href', preparationRows[0].href);
    expect(screen.queryByRole('link', { name: preparationRows[1].reference })).not.toBeInTheDocument();
  });
});
