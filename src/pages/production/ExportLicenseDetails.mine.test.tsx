import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportLicense } from '@/services/exportLicenseService';
import { ExportLicenseDetails } from './ExportLicenseDetails';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getLicenseById: vi.fn(),
  from: vi.fn(),
  shipmentFilters: [] as Array<[string, unknown]>,
  workspace: {
    isMine: true,
    companyId: 'mine-1' as string | null,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ id: 'license-1' }),
}));

vi.mock('@/hooks/useMineWorkspace', () => ({
  useMineWorkspace: () => mocks.workspace,
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/exportLicenseService', () => ({
  exportLicenseService: { getLicenseById: mocks.getLicenseById },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

const license: ExportLicense = {
  id: 'license-1',
  license_number: 'EXP-MINE-2026-001',
  mining_company_id: 'mine-1',
  request_date: '2026-07-01',
  start_date: '2026-08-01',
  end_date: '2026-12-31',
  issuing_institution: 'Ministère chargé des Mines',
  authorized_quantity_grams: 500_000,
  used_quantity_grams: 100_000,
  remaining_quantity_grams: 400_000,
  average_sale_price: null,
  status: 'active',
  comments: null,
  notes: null,
  created_at: '2026-07-01T08:00:00Z',
  updated_at: '2026-08-01T08:00:00Z',
  created_by: 'authority-1',
  updated_by: 'authority-1',
  mining_company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
};

describe('ExportLicenseDetails — Société minière', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shipmentFilters = [];
    mocks.workspace.isMine = true;
    mocks.workspace.companyId = 'mine-1';
    mocks.getLicenseById.mockResolvedValue(license);
    mocks.from.mockImplementation(() => {
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        mocks.shipmentFilters.push([column, value]);
        return query;
      });
      query.order = vi.fn(async () => ({ data: [], error: null }));
      return query;
    });
  });

  it('filtre la licence et ses expéditions par le tenant et masque Modifier', async () => {
    render(<ExportLicenseDetails />);

    expect(await screen.findByText('EXP-MINE-2026-001')).toBeInTheDocument();
    expect(mocks.getLicenseById).toHaveBeenCalledWith('license-1', 'mine-1');
    expect(mocks.shipmentFilters).toEqual([
      ['license_id', 'license-1'],
      ['mining_company_id', 'mine-1'],
    ]);
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('conserve la modification pour l’autorité SONASP uniquement', async () => {
    mocks.workspace.isMine = false;
    mocks.workspace.companyId = null;
    render(<ExportLicenseDetails />);

    expect(await screen.findByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(mocks.getLicenseById).toHaveBeenCalledWith('license-1', undefined);
    await waitFor(() => expect(mocks.shipmentFilters).toEqual([
      ['license_id', 'license-1'],
    ]));
  });
});
