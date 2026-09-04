import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dgmgRegulatoryDashboardService,
  normalizeDgmgRegulatoryDashboard,
} from './dgmgRegulatoryDashboardService';
import type { DgmgRegulatoryFilters } from '@/types/dgmgRegulatory';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

const filters: DgmgRegulatoryFilters = {
  startDate: '2026-01-01', endDate: '2026-09-04', siteType: 'all',
  companyId: null, region: null, declarationStatus: null,
};

describe('service du tableau réglementaire DGMG', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalise les données complètes et rejette les valeurs invalides', () => {
    const data = normalizeDgmgRegulatoryDashboard({
      has_data: true,
      partial: false,
      period: { start_date: '2026-01-01', end_date: '2026-09-04' },
      summary: {
        mining_companies_total: 11,
        mining_companies_active: 10,
        sites_total: 42,
        industrial_sites_total: 33,
        artisanal_sites_total: 9,
        declarations_total: 317,
        on_time_rate: 94,
        production_grams: 1817050,
        previous_production_grams: 1676240,
        controls_pending: 14,
        priority_controls: 5,
      },
      monthly: [{ month: '2026-09', label: 'Sept. 2026', industrial_grams: 100, artisanal_grams: 20 }],
      compliance: { conforming: 298, regularize: 14, non_conforming: 5 },
      activities: [{
        id: 'a1', reference: 'DRP-1', operator_name: 'ESSAKANE SA',
        activity: 'Déclaration de production', zone: 'Sahel', status: 'Conforme',
        status_tone: 'success', occurred_at: '2026-09-04T09:12:00Z',
      }],
      attention: { late_declarations: 5, expiring_licenses: 3, production_gaps: 2 },
      filter_options: { companies: [{ value: 'c1', label: 'ESSAKANE SA' }], regions: [], declaration_statuses: [] },
    }, filters);

    expect(data.summary.productionTrendPercent).toBeCloseTo(8.4, 1);
    expect(data.compliance.rate).toBeCloseTo(94.01, 1);
    expect(data.activities[0].operatorName).toBe('ESSAKANE SA');
  });

  it('conserve les dimensions indisponibles à null sans les convertir en zéro', () => {
    const data = normalizeDgmgRegulatoryDashboard({
      has_data: false,
      partial: true,
      unavailable_dimensions: ['conformité'],
      summary: { mining_companies_total: -1 },
      compliance: {}, attention: {}, monthly: [], activities: [],
    }, filters);
    expect(data.summary.miningCompaniesTotal).toBeNull();
    expect(data.compliance.rate).toBeNull();
    expect(data.unavailableDimensions).toEqual(['conformité']);
  });

  it('appelle la RPC bornée avec les filtres actifs', async () => {
    mocks.rpc.mockResolvedValue({
      data: { has_data: false, summary: {}, compliance: {}, attention: {} },
      error: null,
    });
    await dgmgRegulatoryDashboardService.load(filters);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_dgmg_charger_tableau_reglementaire', {
      p_date_debut: '2026-01-01', p_date_fin: '2026-09-04', p_type_site: 'all',
      p_societe_id: null, p_region: null, p_statut_declaration: null,
    });
  });

  it('propage une erreur réseau sans fabriquer de contrat vide', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'refus' } });
    await expect(dgmgRegulatoryDashboardService.load(filters)).rejects.toMatchObject({ message: 'refus' });
  });
});
