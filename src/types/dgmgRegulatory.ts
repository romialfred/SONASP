export type DgmgSiteType = 'all' | 'industrial' | 'artisanal';

export interface DgmgRegulatoryFilters {
  startDate: string;
  endDate: string;
  siteType: DgmgSiteType;
  companyId: string | null;
  region: string | null;
  declarationStatus: string | null;
}

export interface DgmgRegulatorySummary {
  miningCompaniesTotal: number | null;
  miningCompaniesActive: number | null;
  sitesTotal: number | null;
  industrialSitesTotal: number | null;
  artisanalSitesTotal: number | null;
  declarationsTotal: number | null;
  onTimeRate: number | null;
  productionGrams: number | null;
  previousProductionGrams: number | null;
  productionTrendPercent: number | null;
  controlsPending: number | null;
  priorityControls: number | null;
}

export interface DgmgProductionMonthlyPoint {
  month: string;
  label: string;
  industrialGrams: number | null;
  artisanalGrams: number | null;
}

export interface DgmgComplianceSummary {
  conforming: number | null;
  regularize: number | null;
  nonConforming: number | null;
  classifiedTotal: number | null;
  rate: number | null;
}

export type DgmgActivityTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface DgmgRegulatoryActivity {
  id: string;
  reference: string | null;
  operatorName: string;
  activity: string;
  zone: string | null;
  status: string | null;
  statusTone: DgmgActivityTone;
  occurredAt: string;
}

export interface DgmgAttentionCounters {
  lateDeclarations: number | null;
  expiringLicenses: number | null;
  productionGaps: number | null;
}

export interface DgmgFilterOption {
  value: string;
  label: string;
}

export interface DgmgRegulatoryDashboardData {
  hasData: boolean;
  partial: boolean;
  unavailableDimensions: string[];
  period: { startDate: string; endDate: string };
  summary: DgmgRegulatorySummary;
  monthly: DgmgProductionMonthlyPoint[];
  compliance: DgmgComplianceSummary;
  activities: DgmgRegulatoryActivity[];
  attention: DgmgAttentionCounters;
  filterOptions: {
    companies: DgmgFilterOption[];
    regions: DgmgFilterOption[];
    declarationStatuses: DgmgFilterOption[];
  };
}
