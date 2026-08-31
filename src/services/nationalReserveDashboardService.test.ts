import { describe, expect, it } from 'vitest';
import type { ReserveAllocation } from '@/services/reserveAllocationService';
import { buildNationalReserveSnapshot } from './nationalReserveDashboardService';

const allocation = (
  reference: string,
  status: ReserveAllocation['status'],
  fineWeightGrams: number,
  grossWeightGrams: number,
  depositoryId: string,
): ReserveAllocation => ({
  id: reference,
  reference,
  allocation_date: reference === 'AFF-1' ? '2026-08-20' : '2026-08-28',
  status,
  reason: null,
  allocation_nature: 'CONSTITUTION_RESERVE',
  priority: 'NORMAL',
  decision_reference: null,
  decision_date: null,
  decision_authority: null,
  decision_department: null,
  decision_comment: null,
  control_results: {},
  depository_organization_id: depositoryId,
  deposit_type: 'reserve_vault',
  planned_deposit_reference: null,
  planned_transfer_date: null,
  gold_price_fcfa_gram: 78_500,
  usd_xof_rate: 602,
  eur_xof_rate: 655,
  lot_count: 1,
  ingot_count: 2,
  gross_weight_grams: grossWeightGrams,
  fine_weight_grams: fineWeightGrams,
  weighted_fineness: 99,
  indicative_value_fcfa: fineWeightGrams * 78_500,
  indicative_value_usd: fineWeightGrams * 130,
  indicative_value_eur: fineWeightGrams * 118,
  valuation_source: 'LBMA / BCEAO',
  valuation_at: `${reference === 'AFF-1' ? '2026-08-20' : '2026-08-28'}T18:30:00Z`,
  submitted_at: null,
  completed_at: null,
  created_by: 'actor',
  created_at: `${reference === 'AFF-1' ? '2026-08-20' : '2026-08-28'}T10:00:00Z`,
  updated_at: '2026-08-28T18:30:00Z',
  creator_name: 'Gestionnaire',
  depository: {
    id: depositoryId,
    code: depositoryId,
    name: depositoryId === 'dep-a' ? 'BCEAO' : 'Coffre souverain SONASP',
    short_name: null,
    address: null,
    administrative_region: null,
    organization_type: 'DEPOSITORY',
    scope_metadata: {},
  },
  items: [{
    id: `${reference}-item`,
    allocation_id: reference,
    inventory_id: `${reference}-inventory`,
    lot_reference: `${reference}-LOT`,
    ingot_count: 2,
    gross_weight_grams: grossWeightGrams,
    fine_weight_grams: fineWeightGrams,
    fineness_percentage: 99,
    certificate_number: null,
    reserved_at: '2026-08-20T00:00:00Z',
    released_at: null,
  }],
  events: [{
    id: reference === 'AFF-1' ? 1 : 2,
    allocation_id: reference,
    event_type: 'TRANSITION',
    status_from: 'RECONCILED',
    status_to: status,
    actor_id: 'actor',
    actor_role: 'management',
    actor_name: 'Gestionnaire',
    comment: null,
    occurred_at: '2026-08-28T18:30:00Z',
  }],
  documents: [],
});

describe('agrégation du patrimoine de la Réserve nationale', () => {
  it('ne compte dans la réserve physique que les affectations actives', () => {
    const snapshot = buildNationalReserveSnapshot([
      allocation('AFF-1', 'ACTIVE', 990, 1_000, 'dep-a'),
      allocation('AFF-2', 'IN_TRANSIT', 495, 500, 'dep-b'),
    ]);

    expect(snapshot.activeAllocations).toHaveLength(1);
    expect(snapshot.totalFineWeightGrams).toBe(990);
    expect(snapshot.totalGrossWeightGrams).toBe(1_000);
    expect(snapshot.totalIngotCount).toBe(2);
    expect(snapshot.physicalAssets).toHaveLength(1);
    expect(snapshot.depositories).toHaveLength(1);
  });

  it('conserve les quantités et calcule une répartition déterministe par dépositaire', () => {
    const snapshot = buildNationalReserveSnapshot([
      allocation('AFF-1', 'ACTIVE', 990, 1_000, 'dep-a'),
      allocation('AFF-2', 'ACTIVE', 495, 500, 'dep-b'),
    ]);

    expect(snapshot.totalFineWeightGrams).toBe(1_485);
    expect(snapshot.depositories.map(({ share }) => share)).toEqual([
      expect.closeTo(66.666, 2),
      expect.closeTo(33.333, 2),
    ]);
    expect(snapshot.depositories.reduce((sum, item) => sum + item.fineWeightGrams, 0))
      .toBe(snapshot.totalFineWeightGrams);
    expect(snapshot.trend.at(-1)?.fineWeightGrams).toBe(snapshot.totalFineWeightGrams);
  });

  it('classe les rapprochements et écarts dans la file des contrôles', () => {
    const snapshot = buildNationalReserveSnapshot([
      allocation('AFF-1', 'RECONCILIATION_PENDING', 990, 1_000, 'dep-a'),
      allocation('AFF-2', 'DISCREPANCY_REVIEW', 495, 500, 'dep-b'),
    ]);

    expect(snapshot.pendingControls.map(({ status }) => status)).toEqual([
      'DISCREPANCY_REVIEW',
      'RECONCILIATION_PENDING',
    ]);
    expect(snapshot.totalFineWeightGrams).toBe(0);
  });
});
