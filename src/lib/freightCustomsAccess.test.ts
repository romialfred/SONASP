import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import type { FreightCustomsOperation } from '@/services/freightCustomsService';
import {
  FREIGHT_CAPABILITIES,
  canReadFreightHistory,
  getFreightTransitionAccess,
  hasFreightCapability,
  nextFreightStatus,
} from './freightCustomsAccess';

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'agent@sonasp.test',
    full_name: 'Agent',
    phone: null,
    role: 'management',
    mining_company_id: null,
    site_ids: [],
    is_active: true,
    capabilities: [],
    is_sales_approver: false,
    two_factor_enabled: true,
    language: 'fr',
    email_notifications: false,
    batch_notifications: false,
    approval_notifications: false,
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
    ...overrides,
  };
}

function operation(overrides: Partial<FreightCustomsOperation> = {}): FreightCustomsOperation {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    shipping_preparation_id: '30000000-0000-4000-8000-000000000001',
    reference_number: 'FC-20260824-00000001',
    status: 'customs_pending',
    created_by: '10000000-0000-4000-8000-000000000009',
    prepared_by: '10000000-0000-4000-8000-000000000009',
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
    ...overrides,
  };
}

describe('freightCustomsAccess', () => {
  it('reste fail-closed sans liste autoritative de capacités, y compris pour owner', () => {
    expect(hasFreightCapability(
      profile({ role: 'owner', capabilities: undefined }),
      FREIGHT_CAPABILITIES.PREPARE,
    )).toBe(false);
  });

  it('n’expose qu’une étape suivante canonique', () => {
    expect(nextFreightStatus('customs_pending')).toBe('customs_approved');
    expect(nextFreightStatus('customs_approved')).toBe('ready_for_transport');
    expect(nextFreightStatus('ready_for_transport')).toBe('shipped_to_refinery');
    expect(nextFreightStatus('shipped_to_refinery')).toBeNull();
  });

  it('autorise l’historique tenant d’une mine seulement via la capacité autoritative', () => {
    expect(canReadFreightHistory(profile({ role: 'mine', capabilities: ['mine.operate'] }))).toBe(true);
    expect(canReadFreightHistory(profile({ role: 'mine', capabilities: undefined }))).toBe(false);
  });

  it('refuse l’auto-approbation même avec la capacité adéquate', () => {
    const actor = profile({
      capabilities: [FREIGHT_CAPABILITIES.CUSTOMS_APPROVE],
    });
    const result = getFreightTransitionAccess(actor, operation({
      created_by: actor.id,
      prepared_by: actor.id,
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('preparer');
  });

  it('autorise un approbateur distinct disposant de la capacité AAL2', () => {
    const result = getFreightTransitionAccess(
      profile({ capabilities: [FREIGHT_CAPABILITIES.CUSTOMS_APPROVE] }),
      operation(),
    );
    expect(result).toEqual({ allowed: true, nextStatus: 'customs_approved' });
  });

  it('refuse à l’approbateur de préparer puis de constater seul le départ', () => {
    const actor = profile({ capabilities: [
      FREIGHT_CAPABILITIES.PREPARE,
      FREIGHT_CAPABILITIES.TRANSPORT_DISPATCH,
    ] });
    expect(getFreightTransitionAccess(actor, operation({
      status: 'customs_approved',
      customs_approved_by: actor.id,
    })).allowed).toBe(false);
    expect(getFreightTransitionAccess(actor, operation({
      status: 'ready_for_transport',
      customs_approved_by: actor.id,
    })).allowed).toBe(false);
  });
});
