import { describe, expect, it } from 'vitest';
import type { FactureAchat, LigneBalanceAgee, ReglementAchat } from './achatsIndustrielsService';
import { buildAchatsFinancialOverview } from './achatsFinancialOverview';

const invoice = (overrides: Partial<FactureAchat>): FactureAchat => ({
  id: 'invoice', numero_facture: 'FA-2026-001', achat_id: 'purchase', mining_company_id: 'mine-a',
  date_emission: '2026-01-10', periode_debut: '2026-01-01', periode_fin: '2026-01-31',
  quantite_oz: 1, titre_pct: 99.9, prix_once_fcfa: 1, montant_ht_fcfa: 1_000,
  tva_montant_fcfa: 0, taxe_dev_comm_montant_fcfa: 0, montant_ttc_fcfa: 1_000,
  montant_ajustements_fcfa: 0, montant_paye_fcfa: 400, devise: 'XOF', conditions_paiement: 'comptant',
  date_echeance: '2026-02-01', statut: 'partiellement_payee', statut_certification: 'certifiee',
  certification_reference: null, certification_date: null,
  ...overrides,
});

const payment = (overrides: Partial<ReglementAchat>): ReglementAchat => ({
  id: 'payment', reference_reglement: 'REG-2026-001', mining_company_id: 'mine-a',
  date_reglement: '2026-08-12', montant_fcfa: 400, montant_affecte_fcfa: 300, devise: 'XOF',
  mode_reglement: 'virement', banque: null, reference_bancaire: null, statut: 'valide', observations: null,
  ...overrides,
});

const balance: LigneBalanceAgee = {
  mining_company_id: 'mine-a', societe: 'Mine A', devise: 'XOF', non_echu: 0,
  j1_30: 0, j31_60: 0, j61_90: 0, j91_180: 600, plus_180: 0, total: 600,
  nb_factures: 1, plus_ancienne: '2026-02-01', anciennete_moyenne: 180,
};

describe('buildAchatsFinancialOverview', () => {
  it('compose les indicateurs depuis les montants comptables sans compter les annulations', () => {
    const overview = buildAchatsFinancialOverview({
      invoices: [
        invoice({ mining_company: { id: 'mine-a', name: 'Mine A' } }),
        invoice({ id: 'invoice-b', mining_company_id: 'mine-b', numero_facture: 'FA-2026-002', montant_ttc_fcfa: 500, montant_ajustements_fcfa: 50, montant_paye_fcfa: 450, statut: 'payee' }),
        invoice({ id: 'cancelled', montant_ttc_fcfa: 99_999, statut: 'annulee' }),
      ],
      payments: [
        payment({ mining_company: { id: 'mine-a', name: 'Mine A' } }),
        payment({ id: 'pending', statut: 'enregistre' }),
        payment({ id: 'rejected', mining_company_id: 'mine-b', statut: 'rejete' }),
        payment({ id: 'correction', mining_company_id: 'mine-b', statut: 'enregistre', reception_statut: 'contestee' }),
      ],
      balances: [balance],
      companies: [{ id: 'mine-a', name: 'Mine A' }, { id: 'mine-b', name: 'Mine B' }],
      now: new Date('2026-09-01T00:00:00Z'),
    });

    expect(overview.totalPurchased).toBe(1_450);
    expect(overview.totalPaid).toBe(850);
    expect(overview.outstanding).toBe(600);
    expect(overview.advances).toBe(100);
    expect(overview.payments).toEqual({ pending: 2, validated: 1, rejected: 1, correction: 1 });
    expect(overview.positions.find((position) => position.id === 'mine-a')).toEqual(expect.objectContaining({
      name: 'Mine A', purchased: 1_000, paid: 400, outstanding: 600, advances: 100,
    }));
    expect(overview.alerts).toEqual({
      overdueInvoices: 1,
      disputedInvoices: 0,
      correctionPayments: 1,
      unmatchedAdvances: 1,
    });
    expect(overview.trend.find((point) => point.key === '2026-08')).toEqual(expect.objectContaining({ amount: 400, count: 1 }));
  });
});
