import { describe, expect, it } from 'vitest';
import type { MinePortalSnapshot } from '@/services/minePortalService';
import { buildMineDashboard, type MineDashboardFilters } from './mineDashboardData';

const filters: MineDashboardFilters = {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  operation: 'all',
  status: 'all',
};

function snapshot(overrides: Partial<MinePortalSnapshot> = {}): MinePortalSnapshot {
  return {
    company: { id: 'mine-1', name: 'Mine A', code: 'M-A' },
    budgets: [],
    monthlyBudgets: [],
    forecasts: [],
    productions: [
      { id: 'p-current', production_date: '2026-08-15', bullion_grams: 3100, estimated_oz: 100, estimated_fineness_pct: 92, bar_reference: 'DRP-001', status: 'validated', mining_company_id: 'mine-1' },
      { id: 'p-previous', production_date: '2026-07-15', bullion_grams: 6200, estimated_oz: 200, estimated_fineness_pct: 92, bar_reference: 'DRP-000', status: 'validated', mining_company_id: 'mine-1' },
    ],
    contracts: [
      { id: 'c1', numero_contrat: 'CTR-001', intitule: 'Approvisionnement 2026', statut: 'actif', date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_totale: 100, unite: 'oz', mining_company_id: 'mine-1' },
    ],
    requests: [],
    invoices: [],
    payments: [],
    analyses: [],
    requisitions: [],
    shipments: [
      { id: 's1', expedition_lot_number: 'EXP-001', status: 'preparing', created_at: '2026-08-16T08:00:00Z', shipped_at: null, total_weight_oz: 20, mining_company_id: 'mine-1' },
    ],
    purchases: [
      { id: 'a1', numero_achat: 'ACH-001', date_achat: '2026-08-17', quantite_oz: 40, quantite_imputee_oz: 40, statut: 'validee', contrat_id: 'c1', mining_company_id: 'mine-1' },
    ],
    inventory: [
      { id: 'i1', entry_date: '2026-08-18', final_fine_oz: 70, quantity_available_oz: 60, quantity_allocated_oz: 10, mining_company_id: 'mine-1' },
    ],
    freightShipments: [
      { id: 'f1', reference_number: 'FRET-001', status: 'processing', shipment_date: '2026-08-19', total_bullion_grams: null, total_pure_gold_oz: 10, mining_company_id: 'mine-1' },
    ],
    sales: [],
    documents: [],
    situation: {
      facture_total: 10_000,
      facture_payee: 5_000,
      reste_du: 5_000,
      dette_echue: 0,
      nb_factures: 2,
      nb_ouvertes: 2,
      nb_echues: 0,
      plus_ancienne_echeance: null,
      anciennete_moyenne: null,
      reglements_total: 5_000,
      non_affecte: 0,
    },
    unavailableSources: [],
    ...overrides,
  };
}

describe('buildMineDashboard', () => {
  it('calcule les indicateurs uniquement à partir des écritures du périmètre', () => {
    const model = buildMineDashboard(snapshot(), filters);

    expect(model.production).toMatchObject({ valueOz: 100, variationPercent: -50, declarationCount: 1 });
    expect(model.availableFineGold).toMatchObject({ valueOz: 60, productionPercent: 60 });
    expect(model.sonaspCommitment).toMatchObject({ valueOz: 40, executionPercent: 40 });
    expect(model.activeShipments).toEqual({ count: 1, preparing: 1 });
    expect(model.expectedPayments).toEqual({ amountFcfa: 5000, dueCount: 2 });
    expect(model.contractExecution?.rate).toBe(40);
    expect(model.distribution.reduce((total, item) => total + (item.percent || 0), 0)).toBeCloseTo(100, 8);
  });

  it('laisse l’objectif mensuel indisponible lorsqu’aucun budget réel ne le définit', () => {
    const model = buildMineDashboard(snapshot(), filters);

    expect(model.monthly).toHaveLength(1);
    expect(model.monthly[0]).toMatchObject({ actual: 100, objective: null, cumulative: 100 });
  });

  it('gère explicitement l’absence et la pluralité des contrats actifs', () => {
    const withoutContract = buildMineDashboard(snapshot({ contracts: [] }), filters);
    expect(withoutContract.contractExecution).toBeNull();
    expect(withoutContract.contractSelectionRequired).toBe(false);

    const contracts = [
      ...snapshot().contracts,
      { id: 'c2', numero_contrat: 'CTR-002', intitule: 'Complément', statut: 'actif', date_debut: '2026-02-01', date_fin: '2027-01-31', quantite_totale: 200, unite: 'oz', mining_company_id: 'mine-1' },
    ];
    const multiple = buildMineDashboard(snapshot({ contracts }), filters);
    expect(multiple.contractExecution).toBeNull();
    expect(multiple.contractSelectionRequired).toBe(true);

    const selected = buildMineDashboard(snapshot({ contracts }), filters, 'c2');
    expect(selected.contractExecution?.contractId).toBe('c2');
    expect(selected.contractSelectionRequired).toBe(false);
  });

  it('évite les divisions par zéro et représente un vrai zéro sans donnée fictive', () => {
    const model = buildMineDashboard(snapshot({
      productions: [],
      contracts: [{ ...snapshot().contracts[0], quantite_totale: 0 }],
      purchases: [],
      inventory: [],
      shipments: [],
      freightShipments: [],
      situation: null,
    }), filters);

    expect(model.production.valueOz).toBe(0);
    expect(model.production.variationPercent).toBeNull();
    expect(model.contractExecution?.rate).toBeNull();
    expect(model.distribution.every((item) => item.percent === 0)).toBe(true);
    expect(model.activeShipments).toEqual({ count: 0, preparing: 0 });
    expect(model.expectedPayments).toEqual({ amountFcfa: 0, dueCount: 0 });
  });

  it('distingue une source indisponible d’une collection réellement vide', () => {
    const model = buildMineDashboard(snapshot({
      inventory: [],
      shipments: [],
      unavailableSources: ['stock d’or fin', 'expéditions', 'situation financière'],
    }), filters);

    expect(model.availableFineGold.valueOz).toBeNull();
    expect(model.activeShipments).toEqual({ count: null, preparing: null });
    expect(model.expectedPayments).toEqual({ amountFcfa: null, dueCount: null });
    expect(model.partial).toBe(true);
  });
});
