import { describe, expect, it } from 'vitest';
import {
  buildDgmgRegulatoryCsv,
  deriveComplianceSummary,
  deriveProductionTrend,
  formatDgmgWeight,
} from './dgmgRegulatoryDashboard';
import type { DgmgRegulatoryDashboardData } from '@/types/dgmgRegulatory';

describe('calculs du tableau réglementaire DGMG', () => {
  it('calcule un taux de conformité borné à partir des seules classes connues', () => {
    expect(deriveComplianceSummary(94, 4, 2)).toMatchObject({
      classifiedTotal: 100,
      rate: 94,
    });
    expect(deriveComplianceSummary(5, 0, 0).rate).toBe(100);
  });

  it('protège la division par zéro, les absences et les valeurs négatives', () => {
    expect(deriveComplianceSummary(0, 0, 0).rate).toBeNull();
    expect(deriveComplianceSummary(null, 2, 1).rate).toBeNull();
    expect(deriveComplianceSummary(-1, 2, 1).rate).toBeNull();
    expect(deriveProductionTrend(100, 0)).toBeNull();
    expect(deriveProductionTrend(null, 20)).toBeNull();
  });

  it('formate la masse sans confondre zéro et absence', () => {
    expect(formatDgmgWeight(0)).toBe('0 g');
    expect(formatDgmgWeight(1_250)).toContain('kg');
    expect(formatDgmgWeight(null)).toBe('Indisponible');
  });

  it('exporte uniquement les valeurs présentes dans le contrat normalisé', () => {
    const data = {
      hasData: true,
      partial: true,
      unavailableDimensions: ['conformité'],
      period: { startDate: '2026-01-01', endDate: '2026-09-04' },
      summary: {
        miningCompaniesTotal: 2, miningCompaniesActive: 1,
        sitesTotal: 3, industrialSitesTotal: null, artisanalSitesTotal: 3,
        declarationsTotal: 1, onTimeRate: null,
        productionGrams: 31.1, previousProductionGrams: 20,
        productionTrendPercent: 55.5, controlsPending: null, priorityControls: null,
      },
      monthly: [],
      compliance: deriveComplianceSummary(null, null, null),
      activities: [],
      attention: { lateDeclarations: null, expiringLicenses: 1, productionGaps: null },
      filterOptions: { companies: [], regions: [], declarationStatuses: [] },
    } satisfies DgmgRegulatoryDashboardData;

    const csv = buildDgmgRegulatoryCsv(data);
    expect(csv).toContain('TABLEAU DE BORD RÉGLEMENTAIRE DGMG');
    expect(csv).toContain('31,1');
    expect(csv).not.toContain('OUEDRAOGO Moussa');
  });
});
