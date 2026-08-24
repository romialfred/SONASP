import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

import { CAPABILITIES } from '@/lib/capabilities';
import {
  PRIVATE_ROUTE_REGISTRY,
  accountTypeFor,
  evaluatePrivateRouteAccess,
} from '@/lib/routeAccessRegistry';
import type { UserProfile, UserRole } from '@/types/auth';
import {
  ComptoirSaleTransitionConflictError,
  comptoirPortalService,
  computeComptoirStockSummary,
  type ComptoirSonaspSale,
  type ComptoirStockMovement,
} from './comptoirPortalService';
import { exportLicenseService, type ExportLicense } from './exportLicenseService';
import { shippingPreparationService, type ShippingPreparation } from './shippingPreparationService';

type ActorKind = 'mine' | 'sonasp-approver' | 'comptoir' | 'sonasp-finance';

const state: {
  actor: { id: string; kind: ActorKind };
  requests: Array<Record<string, unknown>>;
  licenses: ExportLicense[];
  shipping: ShippingPreparation | null;
  movements: ComptoirStockMovement[];
  sales: ComptoirSonaspSale[];
} = {
  actor: { id: 'mine-user', kind: 'mine' },
  requests: [],
  licenses: [],
  shipping: null,
  movements: [],
  sales: [],
};

function dateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function exportLicense(overrides: Partial<ExportLicense> = {}): ExportLicense {
  return {
    id: 'license-1', license_number: 'EXP-2026-001', mining_company_id: 'mine-1',
    request_date: dateFromToday(0), start_date: dateFromToday(0), end_date: dateFromToday(365),
    issuing_institution: 'SONASP', authorized_quantity_grams: 120_000,
    used_quantity_grams: 0, remaining_quantity_grams: 120_000, average_sale_price: null,
    status: 'active', comments: null, notes: null, created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), created_by: 'sonasp-user', updated_by: 'sonasp-user',
    ...overrides,
  };
}

function queryFor(table: string) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.lte = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.order = vi.fn(async () => ({
    data: table === 'export_licenses' ? state.licenses : [],
    error: null,
  }));
  query.insert = vi.fn((payload: Partial<ShippingPreparation>) => {
    if (table !== 'shipping_preparations') throw new Error(`Insertion inattendue dans ${table}`);
    state.shipping = {
      ...payload,
      id: 'shipping-1',
    } as ShippingPreparation;
    return query;
  });
  query.single = vi.fn(async () => ({ data: state.shipping, error: null }));
  return query;
}

function rpcImplementation(name: string, rawArgs?: Record<string, unknown>) {
  const args = rawArgs || {};
  if (name === 'snp_portail_mine_soumettre_demande_licence_export') {
    if (state.actor.kind !== 'mine') return Promise.resolve({ data: null, error: { code: '42501', message: 'mine.operate requis' } });
    const request = {
      id: 'request-1', mining_company_id: 'mine-1',
      requested_quantity_grams: args.p_quantite_demandee_grammes,
      desired_export_date: args.p_date_export_souhaitee,
      destination: args.p_destination, reason: args.p_motif, comment: args.p_commentaire,
      status: 'submitted', submitted_by: state.actor.id, submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      reviewed_by: null, reviewed_at: null, decision_reason: null, license_id: null,
    };
    state.requests.push(request);
    return Promise.resolve({ data: request, error: null });
  }
  if (name === 'snp_sonasp_decider_demande_licence_export') {
    if (state.actor.kind !== 'sonasp-approver') return Promise.resolve({ data: null, error: { code: '42501', message: 'sonasp.approve requis' } });
    const request = state.requests.find((item) => item.id === args.p_demande_id);
    if (!request) return Promise.resolve({ data: null, error: { code: 'P0002', message: 'Demande introuvable' } });
    const license = exportLicense({
      license_number: String(args.p_numero_licence),
      start_date: String(args.p_date_debut),
      end_date: String(args.p_date_fin),
      issuing_institution: String(args.p_institution_emettrice),
      authorized_quantity_grams: Number(args.p_quantite_autorisee_grammes),
      remaining_quantity_grams: Number(args.p_quantite_autorisee_grammes),
    });
    state.licenses.push(license, exportLicense({ id: 'license-other', mining_company_id: 'mine-2' }));
    Object.assign(request, {
      status: 'approved', reviewed_by: state.actor.id, reviewed_at: new Date().toISOString(),
      decision_reason: args.p_motif_decision, license_id: license.id,
    });
    return Promise.resolve({ data: request, error: null });
  }
  if (name === 'check_license_availability') {
    const license = state.licenses.find((item) => item.id === args.p_license_id);
    const quantity = Number(args.p_required_quantity);
    const available = Boolean(license && license.status === 'active' && license.remaining_quantity_grams >= quantity);
    return Promise.resolve({
      data: [{
        is_available: available,
        remaining_quantity: license?.remaining_quantity_grams || 0,
        message: available ? 'Quota disponible' : 'Quota insuffisant',
      }],
      error: null,
    });
  }
  if (name === 'reserve_license_quota') {
    const license = state.licenses.find((item) => item.id === args.p_license_id);
    const quantity = Number(args.p_quantity);
    if (!license || state.shipping?.id !== args.p_shipping_id || license.remaining_quantity_grams < quantity) {
      return Promise.resolve({ data: null, error: { code: '40001', message: 'Conflit de quota' } });
    }
    license.remaining_quantity_grams -= quantity;
    license.used_quantity_grams += quantity;
    return Promise.resolve({ data: true, error: null });
  }
  if (name === 'snp_submit_comptoir_sale_to_sonasp') {
    if (state.actor.kind !== 'comptoir') return Promise.resolve({ data: null, error: { code: '42501', message: 'comptoir.manage requis' } });
    const stock = computeComptoirStockSummary(state.movements, state.sales);
    const quantity = Number(args.p_quantity_grams);
    if (quantity > stock.availableGrams) {
      return Promise.resolve({ data: null, error: { code: '23514', message: 'Stock disponible insuffisant' } });
    }
    state.sales.push({
      id: 'sale-1', reference: 'CESS-1', date: dateFromToday(0), quantityGrams: quantity,
      unitPriceFcfa: Number(args.p_unit_price_fcfa), totalFcfa: quantity * Number(args.p_unit_price_fcfa),
      status: 'submitted', notes: args.p_notes as string | null,
    });
    return Promise.resolve({ data: 'sale-1', error: null });
  }
  if (name === 'snp_transition_comptoir_sale_to_sonasp') {
    const sale = state.sales.find((item) => item.id === args.p_sale_id);
    const target = args.p_target_status;
    const authorized = (target === 'accepted' && state.actor.kind === 'sonasp-approver')
      || (target === 'paid' && state.actor.kind === 'sonasp-finance');
    const valid = (sale?.status === 'submitted' && target === 'accepted')
      || (sale?.status === 'accepted' && target === 'paid');
    if (!authorized) return Promise.resolve({ data: null, error: { code: '42501', message: 'capability SONASP requise' } });
    if (!sale || !valid) {
      return Promise.resolve({ data: null, error: { code: '22023', message: 'Seule une cession dans l’état attendu peut être traitée.' } });
    }
    sale.status = target as ComptoirSonaspSale['status'];
    return Promise.resolve({ data: null, error: null });
  }
  return Promise.resolve({ data: null, error: { code: '42883', message: `RPC inattendue ${name}` } });
}

function profile(
  role: UserRole,
  capabilities: string[],
  miningCompanyId: string | null = null,
): UserProfile {
  return {
    id: `${role}-user`, email: `${role}@example.bf`, full_name: role, phone: null,
    role, mining_company_id: miningCompanyId, site_ids: [], is_active: true,
    capabilities, is_sales_approver: false, two_factor_enabled: true, language: 'fr',
    email_notifications: true, batch_notifications: true, approval_notifications: true,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  };
}

function materialize(pattern: string): string {
  return pattern.replace('*', 'tableau').replace(/:[^/]+/gu, '123e4567-e89b-42d3-a456-426614174000');
}

describe('recette inter-portails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actor = { id: 'mine-user', kind: 'mine' };
    state.requests = [];
    state.licenses = [];
    state.shipping = null;
    state.movements = [];
    state.sales = [];
    supabaseMock.auth.getUser.mockImplementation(async () => ({ data: { user: { id: state.actor.id } } }));
    supabaseMock.from.mockImplementation((table: string) => queryFor(table));
    supabaseMock.rpc.mockImplementation(rpcImplementation);
  });

  it('enchaîne demande Mine, autorisation SONASP et réservation du quota de la même licence', async () => {
    const request = await exportLicenseService.submitMineLicenseRequest({
      requestedQuantityGrams: 120_000,
      desiredExportDate: dateFromToday(30),
      destination: 'Suisse',
      reason: 'Export trimestriel validé par la direction',
    });
    expect(request).toMatchObject({ status: 'submitted', mining_company_id: 'mine-1' });
    expect(supabaseMock.rpc.mock.calls[0][1]).not.toHaveProperty('p_mining_company_id');

    state.actor = { id: 'sonasp-approver', kind: 'sonasp-approver' };
    const decision = await exportLicenseService.decideMineLicenseRequest({
      requestId: request.id,
      decision: 'approved',
      licenseNumber: 'EXP-2026-001',
      startDate: dateFromToday(0),
      endDate: dateFromToday(365),
      issuingInstitution: 'SONASP',
      authorizedQuantityGrams: 100_000,
      decisionReason: 'Autorisation conforme au programme annuel',
    });
    expect(decision).toMatchObject({ status: 'approved', license_id: 'license-1' });

    state.actor = { id: 'mine-user', kind: 'mine' };
    const licenses = await exportLicenseService.getActiveLicensesByCompany('mine-1');
    expect(licenses.map((license) => license.id)).toEqual(['license-1']);
    await expect(exportLicenseService.checkLicenseAvailability('license-1', 25_000))
      .resolves.toMatchObject({ is_available: true, remaining_quantity: 100_000 });

    const shipping = await shippingPreparationService.createPreparation({
      mining_company_id: 'mine-1', export_license_id: 'license-1',
      total_net_weight_grams: 25_000, expedition_lot_number: 'LOT-MINE-001',
    });
    await expect(shippingPreparationService.reserveLicenseQuota(
      'license-1', shipping.id, 25_000,
    )).resolves.toBe(true);

    expect(state.shipping).toMatchObject({
      mining_company_id: 'mine-1', export_license_id: 'license-1',
      status: 'waiting_for_customs_approval', created_by: 'mine-user',
    });
    expect(state.licenses[0]).toMatchObject({ used_quantity_grams: 25_000, remaining_quantity_grams: 75_000 });
    expect(supabaseMock.rpc.mock.calls.map(([name]) => name)).toEqual([
      'snp_portail_mine_soumettre_demande_licence_export',
      'snp_sonasp_decider_demande_licence_export',
      'check_license_availability',
      'reserve_license_quota',
    ]);
  });

  it('enchaîne stock libre, cession Comptoir, acceptation SONASP et paiement Finance', async () => {
    state.actor = { id: 'comptoir-user', kind: 'comptoir' };
    state.movements = [
      { id: 'in-1', date: dateFromToday(0), direction: 'in', quantityGrams: 90, type: 'purchase', reference: 'ACH-1' },
      { id: 'out-1', date: dateFromToday(0), direction: 'out', quantityGrams: 10, type: 'adjustment', reference: 'AJU-1' },
    ];
    expect(computeComptoirStockSummary(state.movements, state.sales))
      .toEqual({ physicalGrams: 80, reservedGrams: 0, availableGrams: 80 });

    await expect(comptoirPortalService.submitSaleToSonasp({
      quantityGrams: 30, unitPriceFcfa: 45_000, notes: '  Lot contrôlé  ',
    })).resolves.toBe('sale-1');
    expect(computeComptoirStockSummary(state.movements, state.sales))
      .toEqual({ physicalGrams: 80, reservedGrams: 30, availableGrams: 50 });

    state.actor = { id: 'sonasp-approver', kind: 'sonasp-approver' };
    await comptoirPortalService.transitionSaleToSonasp('sale-1', 'accepted', 'Conformité vérifiée');
    state.actor = { id: 'sonasp-finance', kind: 'sonasp-finance' };
    await comptoirPortalService.transitionSaleToSonasp('sale-1', 'paid', 'Règlement rapproché');
    expect(state.sales[0]).toMatchObject({ status: 'paid', notes: 'Lot contrôlé' });

    await expect(comptoirPortalService.transitionSaleToSonasp('sale-1', 'paid'))
      .rejects.toBeInstanceOf(ComptoirSaleTransitionConflictError);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('maintient le Collecteur strictement consultatif même avec des capabilities injectées', () => {
    const collector = profile('customer', [
      CAPABILITIES.COLLECTOR_OPERATE,
      CAPABILITIES.COMPTOIR_MANAGE,
      CAPABILITIES.SONASP_APPROVE,
      CAPABILITIES.FINANCE_EXECUTE,
    ]);
    expect(accountTypeFor(collector)).toBe('collector');

    const allowedPolicies = PRIVATE_ROUTE_REGISTRY.filter((policy) =>
      evaluatePrivateRouteAccess(collector, materialize(policy.route)).allowed);
    expect(allowedPolicies.length).toBeGreaterThan(0);
    expect(allowedPolicies.every((policy) => policy.readOnly)).toBe(true);
    expect(evaluatePrivateRouteAccess(collector, '/portail-collecteur').allowed).toBe(true);
    [
      '/portail-comptoir/ventes-sonasp', '/sonasp/cessions-comptoirs',
      '/production/licenses/new', '/shipping/preparation/new',
    ].forEach((path) => expect(evaluatePrivateRouteAccess(collector, path).allowed, path).toBe(false));
  });

  it('ferme les routes inter-portails dès qu’un rôle, tenant ou capability ne correspond pas', () => {
    const mine = profile('mine', [CAPABILITIES.MINE_OPERATE], 'mine-1');
    const comptoir = profile('customer', [CAPABILITIES.COMPTOIR_MANAGE]);
    const finance = profile('management', [CAPABILITIES.FINANCE_EXECUTE]);
    const mineWithoutTenant = profile('mine', [CAPABILITIES.MINE_OPERATE]);

    expect(evaluatePrivateRouteAccess(mine, '/production/licenses/new').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(mine, '/shipping/preparation/new').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(mine, '/sonasp/cessions-comptoirs').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(comptoir, '/portail-comptoir/ventes-sonasp').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(comptoir, '/sonasp/cessions-comptoirs').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(finance, '/sonasp/cessions-comptoirs').allowed).toBe(true);
    expect(evaluatePrivateRouteAccess(finance, '/production/licenses/edit/license-1').allowed).toBe(false);
    expect(accountTypeFor(mineWithoutTenant)).toBe('unknown');
    expect(evaluatePrivateRouteAccess(mineWithoutTenant, '/shipping/preparation/new').allowed).toBe(false);
    expect(evaluatePrivateRouteAccess(null, '/production/licenses/new').allowed).toBe(false);
  });
});
