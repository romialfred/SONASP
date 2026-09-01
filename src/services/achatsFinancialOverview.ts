import type {
  FactureAchat,
  LigneBalanceAgee,
  ReglementAchat,
  Societe,
} from './achatsIndustrielsService';

export interface MineFinancialPosition {
  id: string;
  name: string;
  purchased: number;
  paid: number;
  outstanding: number;
  advances: number;
  invoices: number;
}

export interface PaymentTrendPoint {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface AchatsFinancialOverview {
  totalPurchased: number;
  totalPaid: number;
  outstanding: number;
  advances: number;
  payments: { pending: number; validated: number; rejected: number; correction: number };
  positions: MineFinancialPosition[];
  recentPayments: ReglementAchat[];
  recentInvoices: FactureAchat[];
  trend: PaymentTrendPoint[];
  alerts: { overdueInvoices: number; disputedInvoices: number; correctionPayments: number; unmatchedAdvances: number };
}

const PAYMENT_COMPLETED = new Set(['valide', 'execute', 'rapproche']);
const PAYMENT_PENDING = new Set(['brouillon', 'enregistre', 'soumis', 'en_execution']);

const amountDue = (invoice: FactureAchat) => Math.max(
  0,
  Number(invoice.montant_ttc_fcfa || 0)
    - Number(invoice.montant_ajustements_fcfa || 0)
    - Number(invoice.montant_paye_fcfa || 0),
);

const monthKey = (date: string) => date?.slice(0, 7) || '';

/**
 * Projection financière pure. Les montants sources restent ceux de la base :
 * aucune écriture ni règle d'affectation n'est reproduite dans le navigateur.
 */
export function buildAchatsFinancialOverview(input: {
  invoices: FactureAchat[];
  payments: ReglementAchat[];
  balances: LigneBalanceAgee[];
  companies: Societe[];
  now?: Date;
}): AchatsFinancialOverview {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const invoices = input.invoices.filter((invoice) => invoice.statut !== 'annulee');
  const completedPayments = input.payments.filter((payment) => PAYMENT_COMPLETED.has(String(payment.statut)));

  const companyNames = new Map(input.companies.map((company) => [company.id, company.name]));
  invoices.forEach((invoice) => {
    if (invoice.mining_company?.name) companyNames.set(invoice.mining_company_id, invoice.mining_company.name);
  });
  input.payments.forEach((payment) => {
    if (payment.mining_company?.name) companyNames.set(payment.mining_company_id, payment.mining_company.name);
  });

  const positions = new Map<string, MineFinancialPosition>();
  const positionFor = (id: string) => {
    const existing = positions.get(id);
    if (existing) return existing;
    const created: MineFinancialPosition = {
      id,
      name: companyNames.get(id) || 'Société minière',
      purchased: 0,
      paid: 0,
      outstanding: 0,
      advances: 0,
      invoices: 0,
    };
    positions.set(id, created);
    return created;
  };

  invoices.forEach((invoice) => {
    const position = positionFor(invoice.mining_company_id);
    position.purchased += Math.max(0, Number(invoice.montant_ttc_fcfa || 0) - Number(invoice.montant_ajustements_fcfa || 0));
    position.paid += Number(invoice.montant_paye_fcfa || 0);
    position.invoices += 1;
  });
  input.balances.forEach((balance) => {
    positionFor(balance.mining_company_id).outstanding += Number(balance.total || 0);
  });
  completedPayments.forEach((payment) => {
    positionFor(payment.mining_company_id).advances += Math.max(
      0,
      Number(payment.montant_fcfa || 0) - Number(payment.montant_affecte_fcfa || 0),
    );
  });

  const trendKeys = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    return date.toISOString().slice(0, 7);
  });
  const trend = trendKeys.map((key) => {
    const payments = completedPayments.filter((payment) => monthKey(payment.date_reglement) === key);
    const [year, month] = key.split('-').map(Number);
    return {
      key,
      label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(Date.UTC(year, month - 1, 1))),
      amount: payments.reduce((sum, payment) => sum + Number(payment.montant_fcfa || 0), 0),
      count: payments.length,
    };
  });

  const correctionPayments = input.payments.filter((payment) => payment.reception_statut === 'contestee').length;
  const overdueInvoices = invoices.filter((invoice) => amountDue(invoice) > 0 && invoice.date_echeance < today).length;

  return {
    totalPurchased: invoices.reduce(
      (sum, invoice) => sum + Math.max(0, Number(invoice.montant_ttc_fcfa || 0) - Number(invoice.montant_ajustements_fcfa || 0)),
      0,
    ),
    totalPaid: invoices.reduce((sum, invoice) => sum + Number(invoice.montant_paye_fcfa || 0), 0),
    outstanding: input.balances.reduce((sum, balance) => sum + Number(balance.total || 0), 0),
    advances: completedPayments.reduce(
      (sum, payment) => sum + Math.max(0, Number(payment.montant_fcfa || 0) - Number(payment.montant_affecte_fcfa || 0)),
      0,
    ),
    payments: {
      pending: input.payments.filter((payment) => PAYMENT_PENDING.has(String(payment.statut))).length,
      validated: completedPayments.length,
      rejected: input.payments.filter((payment) => String(payment.statut) === 'rejete').length,
      correction: correctionPayments,
    },
    positions: [...positions.values()].sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name)),
    recentPayments: [...input.payments]
      .sort((a, b) => b.date_reglement.localeCompare(a.date_reglement))
      .slice(0, 8),
    recentInvoices: [...invoices]
      .sort((a, b) => b.date_emission.localeCompare(a.date_emission))
      .slice(0, 8),
    trend,
    alerts: {
      overdueInvoices,
      disputedInvoices: invoices.filter((invoice) => ['contestee', 'suspendue', 'echec_certification'].includes(invoice.statut)).length,
      correctionPayments,
      unmatchedAdvances: completedPayments.filter(
        (payment) => Number(payment.montant_fcfa || 0) - Number(payment.montant_affecte_fcfa || 0) > 0.005,
      ).length,
    },
  };
}
