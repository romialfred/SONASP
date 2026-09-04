import type { MinePortalSnapshot } from '@/services/minePortalService';
import { formatStatusFr } from '@/utils/statusFormatter';

export const TROY_OUNCE_GRAMS = 31.1034768;

export type MineOperationFilter = 'all' | 'production' | 'request' | 'shipment' | 'purchase' | 'refining';
export type MineStatusFilter = 'all' | 'open' | 'completed' | 'attention';
export type MineStatusTone = 'success' | 'processing' | 'warning' | 'danger' | 'neutral';

export interface MineDashboardFilters {
  startDate: string;
  endDate: string;
  operation: MineOperationFilter;
  status: MineStatusFilter;
}

export interface MineMonthlyPoint {
  key: string;
  label: string;
  actual: number;
  objective: number | null;
  cumulative: number;
}

export interface MineDistributionItem {
  key: 'vault' | 'committed' | 'shipping' | 'refining';
  label: string;
  valueOz: number | null;
  percent: number | null;
}

export interface MineActivity {
  id: string;
  reference: string;
  operation: string;
  operationType: Exclude<MineOperationFilter, 'all'>;
  quantityOz: number | null;
  status: string;
  statusTone: MineStatusTone;
  occurredAt: string;
  path: string;
}

export interface MineNextAction {
  id: string;
  label: string;
  dueAt: string | null;
  path: string | null;
  kind: 'request' | 'shipment' | 'payment' | 'contract';
}

export interface MineContractExecution {
  contractId: string;
  reference: string;
  executedOz: number;
  committedOz: number | null;
  rate: number | null;
  dueAt: string;
  expired: boolean;
}

export interface MineDashboardModel {
  production: {
    valueOz: number | null;
    variationPercent: number | null;
    declarationCount: number | null;
    sparkline: number[];
  };
  availableFineGold: { valueOz: number | null; productionPercent: number | null };
  sonaspCommitment: { valueOz: number | null; executionPercent: number | null };
  activeShipments: { count: number | null; preparing: number | null };
  expectedPayments: { amountFcfa: number | null; dueCount: number | null };
  monthly: MineMonthlyPoint[];
  distribution: MineDistributionItem[];
  contracts: Array<{ id: string; reference: string; label: string }>;
  contractExecution: MineContractExecution | null;
  contractSelectionRequired: boolean;
  activities: MineActivity[];
  actions: MineNextAction[];
  partial: boolean;
}

const finalStatuses = new Set([
  'approved', 'approuvee', 'approuvée', 'validated', 'validee', 'validée', 'completed',
  'terminee', 'terminée', 'paid', 'payee', 'payée', 'processed', 'in_stock', 'confirmee',
  'confirmée', 'ready_for_expedition', 'livree', 'livrée',
]);
const dangerStatuses = new Set([
  'rejected', 'rejetee', 'rejetée', 'cancelled', 'annulee', 'annulée', 'contestee',
  'contestée', 'non_conforme',
]);
const attentionStatuses = new Set([
  'waiting_for_customs_approval', 'a_confirmer', 'à_confirmer', 'pending', 'en_attente',
  'waiting_for_payment', 'clarification',
]);
const engagingPurchaseStatuses = new Set(['en_attente', 'validee', 'validée', 'payee', 'payée']);

function normalized(value: string | null | undefined): string {
  return (value || '').trim().toLocaleLowerCase('fr-FR');
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function inPeriod(value: string | null | undefined, filters: MineDashboardFilters): boolean {
  if (!value) return false;
  return value.slice(0, 10) >= filters.startDate && value.slice(0, 10) <= filters.endDate;
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + Number(value || 0), 0);
}

function hasSource(snapshot: MinePortalSnapshot, source: string): boolean {
  return !snapshot.unavailableSources.includes(source);
}

function statusTone(status: string): MineStatusTone {
  const value = normalized(status);
  if (dangerStatuses.has(value)) return 'danger';
  if (finalStatuses.has(value)) return 'success';
  if (attentionStatuses.has(value)) return 'warning';
  return value ? 'processing' : 'neutral';
}

function isOpen(status: string): boolean {
  const value = normalized(status);
  return Boolean(value && !finalStatuses.has(value) && !dangerStatuses.has(value));
}

function readableStatus(status: string): string {
  return formatStatusFr(status, statusTone(status) === 'processing' ? 'En traitement' : 'Indisponible');
}

export function previousPeriodStart(filters: Pick<MineDashboardFilters, 'startDate' | 'endDate'>): string {
  const start = validDate(filters.startDate);
  const end = validDate(filters.endDate);
  if (!start || !end || end < start) return filters.startDate;
  const durationDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - durationDays);
  return isoDate(previousStart);
}

function monthlySeries(snapshot: MinePortalSnapshot, filters: MineDashboardFilters): MineMonthlyPoint[] {
  const start = validDate(filters.startDate);
  const end = validDate(filters.endDate);
  if (!start || !end || end < start) return [];

  const months: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const visibleMonths = months.slice(-12);
  let cumulative = 0;

  return visibleMonths.map((date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const actual = sum(snapshot.productions
      .filter((row) => row.status !== 'cancelled' && row.production_date.startsWith(key))
      .map((row) => row.estimated_oz));
    cumulative += actual;
    const annualBudget = snapshot.budgets.find((budget) => budget.year === year);
    const objectiveRow = annualBudget
      ? snapshot.monthlyBudgets.find((budget) => budget.annual_budget_id === annualBudget.id && budget.month === month)
      : undefined;
    return {
      key,
      label: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: visibleMonths.length > 9 ? '2-digit' : undefined })
        .format(date).replace('.', ''),
      actual,
      objective: hasSource(snapshot, 'budgets mensuels') && objectiveRow ? Number(objectiveRow.budget_oz) : null,
      cumulative,
    };
  });
}

function filterActivities(activities: MineActivity[], filters: MineDashboardFilters): MineActivity[] {
  return activities.filter((activity) => {
    if (filters.operation !== 'all' && activity.operationType !== filters.operation) return false;
    if (filters.status === 'completed' && activity.statusTone !== 'success') return false;
    if (filters.status === 'attention' && !['warning', 'danger'].includes(activity.statusTone)) return false;
    if (filters.status === 'open' && !['processing', 'warning'].includes(activity.statusTone)) return false;
    return true;
  });
}

function activities(snapshot: MinePortalSnapshot, filters: MineDashboardFilters): MineActivity[] {
  const rows: MineActivity[] = [
    ...snapshot.productions.filter((row) => inPeriod(row.production_date, filters)).map((row) => ({
      id: `production-${row.id}`,
      reference: row.bar_reference || `PROD-${row.id.slice(0, 8).toUpperCase()}`,
      operation: 'Déclaration de production',
      operationType: 'production' as const,
      quantityOz: Number(row.estimated_oz || 0),
      status: readableStatus(row.status),
      statusTone: statusTone(row.status),
      occurredAt: row.production_date,
      path: `/production/${row.id}`,
    })),
    ...snapshot.requests.filter((row) => inPeriod(row.created_at, filters)).map((row) => ({
      id: `request-${row.id}`,
      reference: row.numero_demande,
      operation: 'Demande SONASP',
      operationType: 'request' as const,
      quantityOz: Number(row.quantite_demandee_oz || 0),
      status: readableStatus(row.statut),
      statusTone: statusTone(row.statut),
      occurredAt: row.created_at,
      path: '/achats/demandes',
    })),
    ...snapshot.shipments.filter((row) => inPeriod(row.created_at, filters)).map((row) => ({
      id: `shipment-${row.id}`,
      reference: row.expedition_lot_number || `EXP-${row.id.slice(0, 8).toUpperCase()}`,
      operation: 'Préparation d’expédition',
      operationType: 'shipment' as const,
      quantityOz: row.total_weight_oz === null ? null : Number(row.total_weight_oz),
      status: readableStatus(row.status),
      statusTone: statusTone(row.status),
      occurredAt: row.created_at,
      path: '/shipping/preparation',
    })),
    ...snapshot.purchases.filter((row) => inPeriod(row.date_achat, filters)).map((row) => ({
      id: `purchase-${row.id}`,
      reference: row.numero_achat || `ACH-${row.id.slice(0, 8).toUpperCase()}`,
      operation: 'Engagement SONASP',
      operationType: 'purchase' as const,
      quantityOz: Number(row.quantite_oz || 0),
      status: readableStatus(row.statut),
      statusTone: statusTone(row.statut),
      occurredAt: row.date_achat,
      path: '/achats/demandes',
    })),
    ...snapshot.freightShipments.filter((row) => inPeriod(row.shipment_date, filters)).map((row) => ({
      id: `refining-${row.id}`,
      reference: row.reference_number,
      operation: ['received_at_refinery', 'processing', 'processed', 'in_stock'].includes(row.status)
        ? 'Suivi du raffinage'
        : 'Expédition vers la raffinerie',
      operationType: 'refining' as const,
      quantityOz: row.total_pure_gold_oz === null ? null : Number(row.total_pure_gold_oz),
      status: readableStatus(row.status),
      statusTone: statusTone(row.status),
      occurredAt: row.shipment_date,
      path: '/refining',
    })),
  ];

  return filterActivities(rows, filters)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 5);
}

function nextActions(snapshot: MinePortalSnapshot): MineNextAction[] {
  const today = isoDate(new Date());
  const rows: MineNextAction[] = [
    ...snapshot.requests.filter((row) => isOpen(row.statut)).map((row) => ({
      id: `request-${row.id}`,
      label: `Demande ${row.numero_demande} à confirmer`,
      dueAt: row.date_limite_reponse,
      path: '/achats/demandes',
      kind: 'request' as const,
    })),
    ...snapshot.shipments.filter((row) => isOpen(row.status)).map((row) => ({
      id: `shipment-${row.id}`,
      label: `Expédition ${row.expedition_lot_number || 'sans référence'} à finaliser`,
      dueAt: row.shipped_at,
      path: '/shipping/preparation',
      kind: 'shipment' as const,
    })),
    ...snapshot.invoices.filter((row) => Number(row.montant_ttc_fcfa) > Number(row.montant_paye_fcfa)).map((row) => ({
      id: `payment-${row.id}`,
      label: `Paiement attendu — facture ${row.numero_facture}`,
      dueAt: row.date_echeance,
      path: '/achats/reglements',
      kind: 'payment' as const,
    })),
    ...snapshot.contracts.filter((row) => row.date_fin >= today && row.date_fin <= isoDate(new Date(Date.now() + 45 * 86_400_000))).map((row) => ({
      id: `contract-${row.id}`,
      label: `Contrat ${row.numero_contrat} arrivant à échéance`,
      dueAt: row.date_fin,
      path: '/contrats',
      kind: 'contract' as const,
    })),
  ];
  return rows.sort((left, right) => (left.dueAt || '9999').localeCompare(right.dueAt || '9999')).slice(0, 4);
}

function selectedContractExecution(
  snapshot: MinePortalSnapshot,
  selectedContractId: string | null,
): { contracts: MineDashboardModel['contracts']; execution: MineContractExecution | null; selectionRequired: boolean } {
  const today = isoDate(new Date());
  const active = snapshot.contracts.filter((contract) => {
    const status = normalized(contract.statut);
    return !dangerStatuses.has(status) && !['cloture', 'clôturé', 'expired', 'expire', 'expiré'].includes(status)
      && contract.date_debut <= today;
  });
  const contracts = active.map((contract) => ({
    id: contract.id,
    reference: contract.numero_contrat,
    label: `${contract.numero_contrat} — ${contract.intitule}`,
  }));
  const selected = selectedContractId
    ? active.find((contract) => contract.id === selectedContractId) ?? null
    : active.length === 1 ? active[0] : null;

  if (!selected) return { contracts, execution: null, selectionRequired: active.length > 1 };
  const executedOz = sum(snapshot.purchases
    .filter((purchase) => purchase.contrat_id === selected.id && engagingPurchaseStatuses.has(normalized(purchase.statut)))
    .map((purchase) => Number(purchase.quantite_imputee_oz || purchase.quantite_oz || 0)));
  const committedOz = selected.quantite_totale === null ? null : Number(selected.quantite_totale);
  return {
    contracts,
    selectionRequired: false,
    execution: {
      contractId: selected.id,
      reference: selected.numero_contrat,
      executedOz,
      committedOz,
      rate: committedOz && committedOz > 0 ? (executedOz / committedOz) * 100 : null,
      dueAt: selected.date_fin,
      expired: selected.date_fin < today,
    },
  };
}

export function buildMineDashboard(
  snapshot: MinePortalSnapshot,
  filters: MineDashboardFilters,
  selectedContractId: string | null = null,
): MineDashboardModel {
  const productionAvailable = hasSource(snapshot, 'production');
  const selectedProductions = snapshot.productions.filter(
    (row) => row.status !== 'cancelled' && inPeriod(row.production_date, filters),
  );
  const productionOz = productionAvailable ? sum(selectedProductions.map((row) => row.estimated_oz)) : null;
  const previousStart = previousPeriodStart(filters);
  const previousEndDate = validDate(filters.startDate);
  if (previousEndDate) previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousEnd = previousEndDate ? isoDate(previousEndDate) : filters.startDate;
  const previousOz = productionAvailable ? sum(snapshot.productions
    .filter((row) => row.status !== 'cancelled' && row.production_date >= previousStart && row.production_date <= previousEnd)
    .map((row) => row.estimated_oz)) : null;
  const variationPercent = productionOz !== null && previousOz !== null && previousOz > 0
    ? ((productionOz - previousOz) / previousOz) * 100
    : null;

  const inventoryAvailable = hasSource(snapshot, 'stock d’or fin');
  const availableFineOz = inventoryAvailable ? sum(snapshot.inventory.map((row) => row.quantity_available_oz)) : null;
  const purchasesAvailable = hasSource(snapshot, 'achats SONASP');
  const committedOz = purchasesAvailable ? sum(snapshot.purchases
    .filter((row) => engagingPurchaseStatuses.has(normalized(row.statut)) && inPeriod(row.date_achat, filters))
    .map((row) => row.quantite_oz)) : null;
  const shipmentAvailable = hasSource(snapshot, 'expéditions');
  const activeShipments = shipmentAvailable ? snapshot.shipments.filter((row) => isOpen(row.status)) : [];
  const freightAvailable = hasSource(snapshot, 'fret et raffinage');
  const refiningOz = freightAvailable ? sum(snapshot.freightShipments
    .filter((row) => ['received_at_refinery', 'processing'].includes(row.status))
    .map((row) => row.total_pure_gold_oz ?? (row.total_bullion_grams ? row.total_bullion_grams / TROY_OUNCE_GRAMS : 0))) : null;
  const shippingOz = shipmentAvailable ? sum(activeShipments.map((row) => row.total_weight_oz)) : null;

  const distributionValues = [availableFineOz, committedOz, shippingOz, refiningOz];
  const distributionTotal = distributionValues.every((value) => value !== null)
    ? sum(distributionValues)
    : null;
  const distribution = [
    { key: 'vault' as const, label: 'Or en coffre', valueOz: availableFineOz },
    { key: 'committed' as const, label: 'Engagé SONASP', valueOz: committedOz },
    { key: 'shipping' as const, label: 'En expédition', valueOz: shippingOz },
    { key: 'refining' as const, label: 'En raffinage', valueOz: refiningOz },
  ].map((item) => ({
    ...item,
    percent: item.valueOz !== null && distributionTotal !== null && distributionTotal > 0
      ? (item.valueOz / distributionTotal) * 100
      : distributionTotal === 0 && item.valueOz !== null ? 0 : null,
  }));

  const contract = selectedContractExecution(snapshot, selectedContractId);
  const situationAvailable = hasSource(snapshot, 'situation financière');
  const monthly = monthlySeries(snapshot, filters);

  return {
    production: {
      valueOz: productionOz,
      variationPercent,
      declarationCount: productionAvailable ? selectedProductions.length : null,
      sparkline: monthly.map((row) => row.actual),
    },
    availableFineGold: {
      valueOz: availableFineOz,
      productionPercent: availableFineOz !== null && productionOz !== null && productionOz > 0
        ? (availableFineOz / productionOz) * 100
        : null,
    },
    sonaspCommitment: {
      valueOz: committedOz,
      executionPercent: contract.execution?.rate ?? null,
    },
    activeShipments: {
      count: shipmentAvailable ? activeShipments.length : null,
      preparing: shipmentAvailable
        ? activeShipments.filter((row) => row.status !== 'ready_for_expedition').length
        : null,
    },
    expectedPayments: {
      amountFcfa: situationAvailable ? Number(snapshot.situation?.reste_du || 0) : null,
      dueCount: situationAvailable ? Number(snapshot.situation?.nb_ouvertes || 0) : null,
    },
    monthly,
    distribution,
    contracts: contract.contracts,
    contractExecution: contract.execution,
    contractSelectionRequired: contract.selectionRequired,
    activities: activities(snapshot, filters),
    actions: nextActions(snapshot),
    partial: snapshot.unavailableSources.length > 0,
  };
}
