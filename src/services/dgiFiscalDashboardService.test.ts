import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dgiFiscalDashboardService, normalizeDgiFiscalDashboard } from './dgiFiscalDashboardService';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }));

describe('service du tableau fiscal DGI', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalise une projection partielle sans remplacer les absences par zéro', () => {
    const result = normalizeDgiFiscalDashboard({
      has_data: true,
      partial: true,
      period: { start_date: '2026-01-01', end_date: '2026-09-04' },
      summary: { expected_amount: '1000', collected_amount: '850', declaration_count: null },
      monthly: [{ month: '2026-01', label: 'Janv. 2026', expected_amount: '1000', collected_amount: null }],
      counters: { payments_to_reconcile: '2', late_declarations: null, assessment_gaps: '1' },
    }, { startDate: '2025-01-01', endDate: '2025-12-31' });

    expect(result.summary).toMatchObject({ remainingAmount: 150, recoveryRate: 85, declarationCount: null });
    expect(result.monthly[0].collectedAmount).toBeNull();
    expect(result.counters.lateDeclarations).toBeNull();
    expect(result.partial).toBe(true);
  });

  it('appelle uniquement la projection RPC bornée par période', async () => {
    rpc.mockResolvedValue({
      data: { has_data: false, partial: false, summary: {}, counters: {} },
      error: null,
    });
    await dgiFiscalDashboardService.load('2026-01-01', '2026-09-04');
    expect(rpc).toHaveBeenCalledWith('snp_dgi_charger_tableau_collecte', {
      p_date_debut: '2026-01-01',
      p_date_fin: '2026-09-04',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('propage le refus du serveur sans effectuer de lecture de repli', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Périmètre fiscal DGI requis.' } });
    await expect(dgiFiscalDashboardService.load('2026-01-01', '2026-09-04'))
      .rejects.toMatchObject({ message: 'Périmètre fiscal DGI requis.' });
    expect(from).not.toHaveBeenCalled();
  });
});
