import {
  reserveAllocationService,
  type ReserveAllocation,
  type ReserveAllocationEvent,
  type ReserveAllocationItem,
  type ReserveAllocationStatus,
} from '@/services/reserveAllocationService';

const ACTIVE_STATUSES = new Set<ReserveAllocationStatus>(['ACTIVE']);
const PENDING_CONTROL_STATUSES = new Set<ReserveAllocationStatus>([
  'RECEIVED',
  'RECONCILIATION_PENDING',
  'DISCREPANCY_REVIEW',
]);

export interface ReserveDepositoryPosition {
  id: string;
  name: string;
  depositType: string | null;
  allocationCount: number;
  lotCount: number;
  ingotCount: number;
  grossWeightGrams: number;
  fineWeightGrams: number;
  weightedFineness: number;
  indicativeValueFcfa: number;
  share: number;
}

export interface ReservePhysicalAsset extends ReserveAllocationItem {
  allocationReference: string;
  allocationDate: string;
  depositoryName: string;
  depositType: string | null;
  allocationStatus: ReserveAllocationStatus;
}

export interface ReserveAuditEntry extends ReserveAllocationEvent {
  allocationReference: string;
}

export interface ReserveTrendPoint {
  date: string;
  fineWeightGrams: number;
  indicativeValueFcfa: number;
}

export interface NationalReserveSnapshot {
  allocations: ReserveAllocation[];
  activeAllocations: ReserveAllocation[];
  pendingControls: ReserveAllocation[];
  physicalAssets: ReservePhysicalAsset[];
  auditEntries: ReserveAuditEntry[];
  depositories: ReserveDepositoryPosition[];
  trend: ReserveTrendPoint[];
  totalGrossWeightGrams: number;
  totalFineWeightGrams: number;
  totalLotCount: number;
  totalIngotCount: number;
  weightedFineness: number;
  indicativeValueFcfa: number;
  indicativeValueUsd: number;
  indicativeValueEur: number;
  latestValuationAt: string | null;
}

const finite = (value: number | null | undefined) => Number.isFinite(Number(value))
  ? Number(value)
  : 0;

const depositoryIdentity = (allocation: ReserveAllocation) => ({
  id: allocation.depository?.id || 'sans-depositaire',
  name: allocation.depository?.short_name || allocation.depository?.name || 'Dépositaire non renseigné',
});

export function buildNationalReserveSnapshot(
  allocations: ReserveAllocation[],
): NationalReserveSnapshot {
  const ordered = [...allocations].sort((left, right) => (
    right.allocation_date.localeCompare(left.allocation_date)
    || right.created_at.localeCompare(left.created_at)
  ));
  const activeAllocations = ordered.filter((allocation) => ACTIVE_STATUSES.has(allocation.status));
  const pendingControls = ordered.filter((allocation) => PENDING_CONTROL_STATUSES.has(allocation.status));

  const totalGrossWeightGrams = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.gross_weight_grams),
    0,
  );
  const totalFineWeightGrams = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.fine_weight_grams),
    0,
  );
  const totalLotCount = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.lot_count),
    0,
  );
  const totalIngotCount = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.ingot_count),
    0,
  );
  const weightedFineness = totalGrossWeightGrams > 0
    ? activeAllocations.reduce(
      (sum, allocation) => sum
        + finite(allocation.weighted_fineness) * finite(allocation.gross_weight_grams),
      0,
    ) / totalGrossWeightGrams
    : 0;

  const indicativeValueFcfa = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.indicative_value_fcfa),
    0,
  );
  const indicativeValueUsd = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.indicative_value_usd),
    0,
  );
  const indicativeValueEur = activeAllocations.reduce(
    (sum, allocation) => sum + finite(allocation.indicative_value_eur),
    0,
  );

  const depositoryMap = new Map<string, Omit<ReserveDepositoryPosition, 'share'>>();
  activeAllocations.forEach((allocation) => {
    const identity = depositoryIdentity(allocation);
    const current = depositoryMap.get(identity.id) || {
      ...identity,
      depositType: allocation.deposit_type,
      allocationCount: 0,
      lotCount: 0,
      ingotCount: 0,
      grossWeightGrams: 0,
      fineWeightGrams: 0,
      weightedFineness: 0,
      indicativeValueFcfa: 0,
    };
    const nextGross = current.grossWeightGrams + finite(allocation.gross_weight_grams);
    current.weightedFineness = nextGross > 0
      ? (
        current.weightedFineness * current.grossWeightGrams
        + finite(allocation.weighted_fineness) * finite(allocation.gross_weight_grams)
      ) / nextGross
      : 0;
    current.allocationCount += 1;
    current.lotCount += finite(allocation.lot_count);
    current.ingotCount += finite(allocation.ingot_count);
    current.grossWeightGrams = nextGross;
    current.fineWeightGrams += finite(allocation.fine_weight_grams);
    current.indicativeValueFcfa += finite(allocation.indicative_value_fcfa);
    depositoryMap.set(identity.id, current);
  });
  const depositories = [...depositoryMap.values()]
    .map((position) => ({
      ...position,
      share: totalFineWeightGrams > 0
        ? (position.fineWeightGrams / totalFineWeightGrams) * 100
        : 0,
    }))
    .sort((left, right) => right.fineWeightGrams - left.fineWeightGrams);

  const physicalAssets = activeAllocations.flatMap((allocation) => allocation.items.map((item) => ({
    ...item,
    allocationReference: allocation.reference,
    allocationDate: allocation.allocation_date,
    depositoryName: depositoryIdentity(allocation).name,
    depositType: allocation.deposit_type,
    allocationStatus: allocation.status,
  })));

  const auditEntries = ordered.flatMap((allocation) => allocation.events.map((event) => ({
    ...event,
    allocationReference: allocation.reference,
  }))).sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));

  let cumulativeWeight = 0;
  let cumulativeValue = 0;
  const trend = [...activeAllocations]
    .sort((left, right) => left.allocation_date.localeCompare(right.allocation_date))
    .map((allocation) => {
      cumulativeWeight += finite(allocation.fine_weight_grams);
      cumulativeValue += finite(allocation.indicative_value_fcfa);
      return {
        date: allocation.allocation_date,
        fineWeightGrams: cumulativeWeight,
        indicativeValueFcfa: cumulativeValue,
      };
    });

  const latestValuationAt = activeAllocations.reduce<string | null>((latest, allocation) => (
    !latest || allocation.valuation_at > latest ? allocation.valuation_at : latest
  ), null);

  return {
    allocations: ordered,
    activeAllocations,
    pendingControls,
    physicalAssets,
    auditEntries,
    depositories,
    trend,
    totalGrossWeightGrams,
    totalFineWeightGrams,
    totalLotCount,
    totalIngotCount,
    weightedFineness,
    indicativeValueFcfa,
    indicativeValueUsd,
    indicativeValueEur,
    latestValuationAt,
  };
}

export async function loadNationalReserveSnapshot(): Promise<NationalReserveSnapshot> {
  return buildNationalReserveSnapshot(await reserveAllocationService.list());
}
