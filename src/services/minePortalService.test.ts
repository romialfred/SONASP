import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minePortalService } from './minePortalService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
  responses: {} as Record<string, { data: unknown; error: unknown }>,
  responseQueues: {} as Record<string, Array<{ data: unknown; error: unknown }>>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

function builder(table: string) {
  const response = () => mocks.responseQueues[table]?.shift()
    || mocks.responses[table]
    || { data: [], error: null };
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn((column: string, value: unknown) => {
    mocks.filters.push({ table, column, value });
    return query;
  });
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.gte = vi.fn((column: string, value: unknown) => {
    mocks.filters.push({ table, column, value });
    return query;
  });
  query.lte = vi.fn((column: string, value: unknown) => {
    mocks.filters.push({ table, column, value });
    return query;
  });
  query.is = vi.fn((column: string, value: unknown) => {
    mocks.filters.push({ table, column, value });
    return query;
  });
  query.maybeSingle = vi.fn(async () => response());
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response()).then(resolve);
  return query;
}

describe('minePortalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filters = [];
    mocks.responseQueues = {};
    mocks.responses = {
      mining_companies: { data: { id: 'mine-1', name: 'Mine A', code: 'M-A', is_active: true }, error: null },
      annual_budgets: { data: [], error: null },
      monthly_budgets: { data: [], error: null },
      quarterly_forecasts: { data: [], error: null },
      daily_production: { data: [], error: null },
      mining_company_documents: { data: [], error: null },
      snp_contrats: { data: [{ id: 'c1', numero_contrat: 'CTR-1', intitule: 'Contrat', statut: 'actif', date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_totale: 100, unite: 'oz', mining_company_id: 'mine-1' }], error: null },
      snp_demandes_achat: { data: [], error: null },
      snp_factures_achat: { data: [], error: null },
      snp_reglements_achat: { data: [], error: null },
      snp_analyses_teneur: { data: [
        { id: 'a1', reference: 'ANA-1', statut: 'analysee', date_prelevement: null, teneur_declaree_pct: 90, teneur_retenue_pct: null, mining_company_id: 'mine-1' },
        { id: 'a2', reference: 'ANA-AUTRE', statut: 'analysee', date_prelevement: null, teneur_declaree_pct: 91, teneur_retenue_pct: null, mining_company_id: 'mine-2' },
      ], error: null },
      snp_requisitions: { data: [], error: null },
      shipping_preparations: { data: [], error: null },
      snp_achats_mines: { data: [], error: null },
      gold_inventory: { data: [], error: null },
      freight_shipments: { data: [], error: null },
      sales: { data: [], error: null },
    };
    mocks.from.mockImplementation((table: string) => builder(table));
    mocks.rpc.mockImplementation(() => ({
      error: null,
      maybeSingle: vi.fn(async () => ({ data: { reste_du: 250_000 }, error: null })),
    }));
  });

  it('porte le filtre de société sur chaque source et élimine toute ligne inattendue', async () => {
    const snapshot = await minePortalService.load('mine-1');

    const scopedTables = [
      'annual_budgets', 'monthly_budgets', 'quarterly_forecasts', 'daily_production',
      'snp_contrats', 'snp_demandes_achat', 'snp_factures_achat', 'snp_reglements_achat',
      'snp_analyses_teneur', 'snp_requisitions', 'mining_company_documents',
      'shipping_preparations', 'snp_achats_mines', 'gold_inventory', 'freight_shipments',
    ];
    scopedTables.forEach((table) => {
      expect(mocks.filters).toContainEqual({ table, column: 'mining_company_id', value: 'mine-1' });
    });
    expect(mocks.filters).toContainEqual({ table: 'sales', column: 'seller_type', value: 'mining_company' });
    expect(mocks.filters).toContainEqual({ table: 'sales', column: 'seller_id', value: 'mine-1' });
    expect(mocks.filters).toContainEqual({ table: 'freight_shipments', column: 'deleted_at', value: null });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_situation_societe', { p_mining_company_id: 'mine-1' });
    expect(snapshot.analyses.map((item) => item.reference)).toEqual(['ANA-1']);
    expect(snapshot.company.name).toBe('Mine A');
  });

  it('fusionne deux chargements simultanés du même périmètre', async () => {
    const [first, second] = await Promise.all([
      minePortalService.load('mine-1'),
      minePortalService.load('mine-1'),
    ]);

    expect(first.company.id).toBe('mine-1');
    expect(second.company.id).toBe('mine-1');
    expect(mocks.from.mock.calls.filter(([table]) => table === 'daily_production')).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('liste les sociétés actives disponibles pour la vue globale Owner', async () => {
    mocks.responses.mining_companies = {
      data: [
        { id: 'mine-1', name: 'Mine A', code: 'M-A' },
        { id: 'mine-2', name: 'Mine B', code: 'M-B' },
      ],
      error: null,
    };

    const companies = await minePortalService.listCompanies();

    expect(mocks.filters).toContainEqual({ table: 'mining_companies', column: 'is_active', value: true });
    expect(companies.map((company) => company.id)).toEqual(['mine-1', 'mine-2']);
  });

  it('conserve les autres indicateurs si une source secondaire est indisponible', async () => {
    mocks.responses.snp_factures_achat = { data: null, error: { message: 'offline' } };
    const snapshot = await minePortalService.load('mine-1');

    expect(snapshot.invoices).toEqual([]);
    expect(snapshot.unavailableSources).toContain('factures');
    expect(snapshot.company.name).toBe('Mine A');
  });

  it('borne la production à la période demandée sans retirer le filtre de société', async () => {
    await minePortalService.load('mine-1', { startDate: '2025-09-01', endDate: '2026-09-04' });

    expect(mocks.filters).toContainEqual({ table: 'daily_production', column: 'mining_company_id', value: 'mine-1' });
    expect(mocks.filters).toContainEqual({ table: 'daily_production', column: 'production_date', value: '2025-09-01' });
    expect(mocks.filters).toContainEqual({ table: 'daily_production', column: 'production_date', value: '2026-09-04' });
  });

  it('reste consultable si les colonnes de réception des règlements ne sont pas encore déployées', async () => {
    mocks.responseQueues.snp_reglements_achat = [
      { data: null, error: { code: '42703', message: 'column reception_statut does not exist' } },
      {
        data: [{
          id: 'r1', reference_reglement: 'REG-1', statut: 'execute', date_reglement: '2026-08-20',
          montant_fcfa: 1000, devise: 'XOF', mining_company_id: 'mine-1',
        }],
        error: null,
      },
    ];

    const snapshot = await minePortalService.load('mine-1', { force: true });

    expect(mocks.from.mock.calls.filter(([table]) => table === 'snp_reglements_achat')).toHaveLength(2);
    expect(snapshot.payments[0]).toMatchObject({ reference_reglement: 'REG-1', reception_statut: 'non_requise' });
  });

  it('transmet les actions métier par les RPC sécurisées sans envoyer de société depuis le client', async () => {
    await minePortalService.submitForecast({ year: 2026, month: 9, forecastOz: 432.5, notes: 'Révision terrain' });
    await minePortalService.submitMonthlyBudget({ year: 2026, month: 9, budgetOz: 450 });
    await minePortalService.declareProduction({ productionDate: '2026-08-22', bullionGrams: 1200, finenessPct: 91.2 });
    await minePortalService.respondToRequest('request-1', 'rejeter', 'Volume indisponible');
    await minePortalService.respondToPayment('payment-1', 'confirmer');

    expect(mocks.rpc).toHaveBeenCalledWith('snp_portail_mine_soumettre_prevision', {
      p_annee: 2026, p_mois: 9, p_prevision_oz: 432.5, p_notes: 'Révision terrain',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_portail_mine_soumettre_budget', {
      p_annee: 2026, p_mois: 9, p_budget_oz: 450,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_portail_mine_declarer_production', expect.not.objectContaining({ mining_company_id: expect.anything() }));
    expect(mocks.rpc).toHaveBeenCalledWith('snp_portail_mine_repondre_demande', expect.objectContaining({ p_demande_id: 'request-1', p_decision: 'rejeter' }));
    expect(mocks.rpc).toHaveBeenCalledWith('snp_portail_mine_repondre_reglement', expect.objectContaining({ p_reglement_id: 'payment-1', p_decision: 'confirmer' }));
  });

  it('ne présente jamais une erreur technique brute au compte société', async () => {
    mocks.rpc.mockReturnValueOnce({ error: { message: 'duplicate key value violates unique constraint internal_secret' } });
    await expect(minePortalService.submitForecast({ year: 2026, month: 9, forecastOz: 50 }))
      .rejects.toThrow('La prévision n’a pas pu être transmise.');
  });

  it('ferme le dépôt documentaire legacy sans tentative Storage ou RPC', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'contrat.pdf', { type: 'application/pdf' });
    await expect(minePortalService.uploadDocument({ file, documentType: 'contrat' }))
      .rejects.toThrow('temporairement désactivé');
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
