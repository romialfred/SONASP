import { describe, expect, it } from 'vitest';
import {
  buildDgiFiscalCsv,
  deriveFiscalSummary,
  formatFiscalAmount,
  recoveryPerformanceLabel,
} from './dgiFiscalDashboard';
import type { DgiFiscalDashboardData } from '@/types/dgiFiscal';

describe('règles du tableau fiscal DGI', () => {
  it('calcule le reste, le taux et la tendance sans propager NaN', () => {
    expect(deriveFiscalSummary(4_360_000_000, 3_740_000_000, 317, 3_320_000_000)).toMatchObject({
      remainingAmount: 620_000_000,
      recoveryRate: expect.closeTo(85.7798, 3),
      collectedTrendPercent: expect.closeTo(12.6506, 3),
    });
    expect(deriveFiscalSummary(0, 0)).toMatchObject({
      remainingAmount: 0,
      recoveryRate: null,
      collectedTrendPercent: null,
    });
    expect(deriveFiscalSummary(-1, Number.NaN)).toMatchObject({
      expectedAmount: null,
      collectedAmount: null,
      remainingAmount: null,
      recoveryRate: null,
    });
  });

  it('formate les valeurs sans inventer un zéro quand elles manquent', () => {
    expect(formatFiscalAmount(4_360_000_000)).toBe('4,36 Md FCFA');
    expect(formatFiscalAmount(620_000_000)).toBe('620 M FCFA');
    expect(formatFiscalAmount(null)).toBe('Indisponible');
  });

  it('centralise le libellé de performance et respecte un objectif configuré', () => {
    expect(recoveryPerformanceLabel(85.8, null)).toBe('Proche du niveau attendu');
    expect(recoveryPerformanceLabel(91, 90)).toBe('Niveau de recouvrement atteint');
    expect(recoveryPerformanceLabel(null, null)).toBe('Taux indisponible');
  });

  it('exporte exclusivement les données effectivement reçues', () => {
    const data: DgiFiscalDashboardData = {
      hasData: true,
      partial: false,
      period: { startDate: '2026-01-01', endDate: '2026-09-04' },
      summary: deriveFiscalSummary(100, 80, 2, 60),
      monthly: [{ month: '2026-01', label: 'Janv. 2026', expectedAmount: 100, collectedAmount: 80 }],
      taxBreakdown: [{ code: 'tva', label: 'TVA', amount: 80, sharePercent: 100 }],
      contributors: [{ id: 'mine-1', name: 'ESSAKANE SA', amount: 80 }],
      priorities: [{ id: 'tax-1', operatorName: 'ESSAKANE SA', taxNature: 'TVA', amountDue: 20, dueDate: '2026-09-10', priority: 'watch' }],
      counters: { paymentsToReconcile: 1, lateDeclarations: null, assessmentGaps: 0 },
      objectiveRate: null,
    };
    const csv = buildDgiFiscalCsv(data);
    expect(csv).toContain('ESSAKANE SA');
    expect(csv).toContain('À suivre');
    expect(csv).not.toContain('Objectif 90');
  });
});
