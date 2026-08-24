import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BIDataSnapshot } from '@/services/businessIntelligenceService';
import { BusinessIntelligenceWorkspace } from './BusinessIntelligenceWorkspace';

const { loadBusinessIntelligenceData } = vi.hoisted(() => ({
  loadBusinessIntelligenceData: vi.fn(),
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/services/businessIntelligenceService', async () => {
  const actual = await vi.importActual<typeof import('@/services/businessIntelligenceService')>(
    '@/services/businessIntelligenceService',
  );
  return { ...actual, loadBusinessIntelligenceData };
});

vi.mock('@/services/businessIntelligenceExportService', () => ({
  exportBIExcel: vi.fn(),
  exportBIPdf: vi.fn(),
  shareBIReport: vi.fn(),
}));

vi.mock('@/lib/recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const snapshot: BIDataSnapshot = {
  loadedAt: '2026-08-24T08:15:00.000Z',
  unavailable: [],
  records: [
    {
      id: 'prod-1',
      date: '2026-08-20',
      category: 'production',
      reference: 'SOP-2026-001',
      source: 'industriel',
      region: 'Centre',
      province: 'Kadiogo',
      siteId: 'site-1',
      siteName: 'SOPAMIB',
      actorId: 'mine-1',
      actorName: 'SOPAMIB',
      status: 'Validé',
      quantityOz: 120,
      amount: 0,
      currency: 'FCFA',
      taxes: 0,
      qualityPct: 92,
    },
  ],
};

describe('BusinessIntelligenceWorkspace', () => {
  beforeEach(() => {
    loadBusinessIntelligenceData.mockReset();
    loadBusinessIntelligenceData.mockResolvedValue(snapshot);
  });

  it('sépare le pilotage, le diagnostic et les données au lieu de tout répéter', async () => {
    render(<BusinessIntelligenceWorkspace view="production" />);

    expect(await screen.findByRole('heading', { name: 'Rapports de production' })).toBeInTheDocument();
    expect(await screen.findByText('Production déclarée', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Décomposer l’indicateur' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostic' }));
    expect(screen.getByRole('heading', { name: 'Décomposer l’indicateur' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Données/ }));
    expect(screen.getByRole('columnheader', { name: 'Référence' })).toBeInTheDocument();
    expect(screen.getByText('SOP-2026-001')).toBeInTheDocument();
  });

  it('conserve les filtres avancés repliés jusqu’à leur ouverture', async () => {
    render(<BusinessIntelligenceWorkspace view="production" />);
    await waitFor(() => expect(loadBusinessIntelligenceData).toHaveBeenCalled());

    expect(screen.queryByLabelText('Zone / région')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }));
    expect(screen.getByLabelText('Zone / région')).toBeInTheDocument();
  });
});
