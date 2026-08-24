import { supabase } from '@/lib/supabase';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

export type BIView = 'sales' | 'production' | 'institutional' | 'national';
export type BIDimension = 'region' | 'site' | 'actor' | 'source' | 'status';
export type BIGranularity = 'month' | 'quarter' | 'year';

export interface BIQueryPeriod {
  startDate: string;
  endDate: string;
}

export interface BIFilters {
  region: string;
  siteId: string;
  actorId: string;
  source: string;
  status: string;
  granularity: BIGranularity;
}

export interface BIRecord {
  id: string;
  date: string;
  category: 'sale' | 'production' | 'contract' | 'invoice' | 'settlement';
  reference: string;
  source: 'industriel' | 'semi-mecanise' | 'artisanal' | 'institutionnel';
  region: string;
  province: string;
  siteId: string;
  siteName: string;
  actorId: string;
  actorName: string;
  status: string;
  quantityOz: number;
  amount: number;
  currency: string;
  taxes: number;
  qualityPct: number | null;
}

export interface BIDataSnapshot {
  records: BIRecord[];
  unavailable: string[];
  loadedAt: string;
}

export interface BITrendPoint {
  key: string;
  label: string;
  quantityOz: number;
  amount: number;
  operations: number;
}

export interface BIBreakdownItem {
  id: string;
  label: string;
  value: number;
  secondary: number;
  share: number;
  records: number;
}

export interface BIModel {
  records: BIRecord[];
  trend: BITrendPoint[];
  breakdowns: Record<BIDimension, BIBreakdownItem[]>;
  totalQuantityOz: number;
  totalAmount: number;
  primaryCurrency: string;
  otherCurrencies: string[];
  totalTaxes: number;
  averageQualityPct: number | null;
  operations: number;
  completedOperations: number;
  pendingOperations: number;
  activeRegions: number;
  activeSites: number;
  activeActors: number;
  unavailable: string[];
}

type CompanyRow = {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
  province?: string | null;
  localite?: string | null;
};

type ProductionRow = {
  id: string;
  production_date: string;
  bullion_grams?: number | null;
  pure_gold_grams?: number | null;
  estimated_oz?: number | null;
  estimated_fineness_pct?: number | null;
  status?: string | null;
  mining_company_id?: string | null;
  site_id?: string | null;
  bar_reference?: string | null;
};

type SaleRow = {
  id: string;
  sale_number?: string | null;
  sale_date?: string | null;
  created_at?: string | null;
  quantity_oz?: number | null;
  total_amount?: number | null;
  gross_proceeds?: number | null;
  final_proceeds?: number | null;
  royalty_amount?: number | null;
  freight_cost?: number | null;
  other_costs?: number | null;
  status?: string | null;
  seller_id?: string | null;
  seller_type?: string | null;
  customer_id?: string | null;
  currency?: string | null;
};

type ArtisanSaleRow = {
  id: string;
  date_vente: string;
  quantite_grammes?: number | null;
  montant_total_fcfa?: number | null;
  montant_brut_fcfa?: number | null;
  purete_karat?: number | null;
  type_or?: string | null;
  statut?: string | null;
  statut_paiement?: string | null;
  artisan_id: string;
  acheteur_id?: string | null;
  taxe_dev_comm_montant_fcfa?: number | null;
  tva_montant_fcfa?: number | null;
  artisan?: {
    nom?: string | null;
    prenoms?: string | null;
    raison_sociale?: string | null;
    region?: string | null;
    commune?: string | null;
    numero_carte?: string | null;
    collecteur_id?: string | null;
  } | null;
};

type ContractRow = {
  id: string;
  numero_contrat: string;
  intitule: string;
  statut: string;
  date_debut: string;
  date_fin: string;
  quantite_totale?: number | null;
  unite?: string | null;
  mining_company_id?: string | null;
  site_id?: string | null;
};

type InvoiceRow = {
  id: string;
  numero_facture: string;
  date_emission: string;
  statut: string;
  mining_company_id: string;
  montant_ttc_fcfa?: number | null;
  montant_paye_fcfa?: number | null;
  quantite_oz?: number | null;
  taxe_dev_comm_montant_fcfa?: number | null;
  retenue_source_fcfa?: number | null;
  tva_montant_fcfa?: number | null;
};

type SettlementRow = {
  id: string;
  reference_reglement: string;
  date_reglement: string;
  statut: string;
  mining_company_id: string;
  montant_fcfa?: number | null;
  montant_affecte_fcfa?: number | null;
};

type ArtisanalSiteRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  status?: string | null;
  region?: string | null;
  province?: string | null;
  locality?: string | null;
  exploitation_type?: string | null;
};

type ArtisanalSiteProductionRow = {
  id: string;
  site_id: string;
  production_date: string;
  gold_weight_grams?: number | null;
  revenue_fcfa?: number | null;
  taxes_fcfa?: number | null;
  artisan_count?: number | null;
  notes?: string | null;
};

type LooseQueryResult = { data: unknown[] | null; error: unknown };
type LooseFilterBuilder = PromiseLike<LooseQueryResult> & {
  gte(column: string, value: string): LooseFilterBuilder;
  lte(column: string, value: string): LooseFilterBuilder;
  order(column: string, options?: { ascending?: boolean }): LooseFilterBuilder;
};
type LooseTableBuilder = { select(columns: string): LooseFilterBuilder };

// Les migrations des sites artisanaux sont plus récentes que le schéma
// TypeScript généré. Cet adaptateur, volontairement limité à la lecture, évite
// de désactiver le typage sur le client Supabase principal.
const fromRecentTable = (table: string) =>
  (supabase as unknown as { from(relation: string): LooseTableBuilder }).from(table);

const EMPTY_FILTERS: BIFilters = {
  region: 'all',
  siteId: 'all',
  actorId: 'all',
  source: 'all',
  status: 'all',
  granularity: 'month',
};

export const DEFAULT_BI_FILTERS = Object.freeze(EMPTY_FILTERS);

const SOURCE_LABELS: Record<BIRecord['source'], string> = {
  industriel: 'Mines industrielles',
  'semi-mecanise': 'Sites semi-mécanisés',
  artisanal: 'Collecte artisanale',
  institutionnel: 'Flux institutionnels',
};

export const BI_DIMENSION_LABELS: Record<BIDimension, string> = {
  region: 'Zone / région',
  site: 'Site minier',
  actor: 'Opérateur / acheteur',
  source: 'Filière',
  status: 'Statut',
};

const normalize = (value?: string | null, fallback = 'Non renseigné') => {
  const trimmed = value?.trim();
  return trimmed || fallback;
};

const numberValue = (value?: number | null) => Number(value || 0);

const normalizeCurrency = (value?: string | null) => normalize(value, 'USD').toUpperCase();

const artisanName = (row: ArtisanSaleRow) =>
  normalize(
    row.artisan?.raison_sociale ||
      [row.artisan?.nom, row.artisan?.prenoms].filter(Boolean).join(' '),
    `Artisan ${row.artisan?.numero_carte || ''}`.trim(),
  );

const companyFor = (companies: Map<string, CompanyRow>, id?: string | null) =>
  (id ? companies.get(id) : undefined) || null;

const productionOunces = (row: ProductionRow) =>
  numberValue(row.estimated_oz) || numberValue(row.pure_gold_grams) / TROY_OZ_GRAMS;

const isOunceUnit = (value?: string | null) => /oz|once/i.test(value || '');

const toResultRows = <T,>(
  result: PromiseSettledResult<{ data: T[] | null; error: unknown }>,
  label: string,
  unavailable: string[],
): T[] => {
  if (result.status === 'rejected' || result.value.error || !Array.isArray(result.value.data)) {
    unavailable.push(label);
    return [];
  }
  return result.value.data;
};

const queryCompanies = () =>
  supabase
    .from('mining_companies')
    .select('id, name, code, region, province, localite')
    .eq('is_active', true)
    .order('name');

const queryProduction = ({ startDate, endDate }: BIQueryPeriod) =>
  supabase
    .from('daily_production')
    .select(
      'id, production_date, bullion_grams, pure_gold_grams, estimated_oz, estimated_fineness_pct, status, mining_company_id, site_id, bar_reference',
    )
    .gte('production_date', startDate)
    .lte('production_date', endDate)
    .order('production_date', { ascending: false });

const querySales = ({ startDate, endDate }: BIQueryPeriod) =>
  supabase
    .from('sales')
    .select(
      'id, sale_number, sale_date, created_at, quantity_oz, total_amount, gross_proceeds, final_proceeds, royalty_amount, freight_cost, other_costs, status, seller_id, seller_type, customer_id, currency',
    )
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .order('sale_date', { ascending: false });

const queryArtisanSales = ({ startDate, endDate }: BIQueryPeriod) =>
  supabase
    .from('snp_artisan_ventes_or')
    .select(
      'id, date_vente, quantite_grammes, montant_total_fcfa, montant_brut_fcfa, purete_karat, type_or, statut, statut_paiement, artisan_id, acheteur_id, taxe_dev_comm_montant_fcfa, tva_montant_fcfa, artisan:snp_artisans_miniers(nom, prenoms, raison_sociale, region, commune, numero_carte, collecteur_id)',
    )
    .gte('date_vente', startDate)
    .lte('date_vente', endDate)
    .order('date_vente', { ascending: false });

const queryContracts = ({ startDate, endDate }: BIQueryPeriod) =>
  supabase
    .from('snp_contrats')
    .select(
      'id, numero_contrat, intitule, statut, date_debut, date_fin, quantite_totale, unite, mining_company_id, site_id',
    )
    .lte('date_debut', endDate)
    .gte('date_fin', startDate)
    .order('date_fin', { ascending: true });

const queryInvoices = ({ startDate, endDate }: BIQueryPeriod) =>
  supabase
    .from('snp_factures_achat')
    .select(
      'id, numero_facture, date_emission, statut, mining_company_id, montant_ttc_fcfa, montant_paye_fcfa, quantite_oz, taxe_dev_comm_montant_fcfa, retenue_source_fcfa, tva_montant_fcfa',
    )
    .gte('date_emission', startDate)
    .lte('date_emission', endDate)
    .order('date_emission', { ascending: false });

const querySettlements = ({ startDate, endDate }: BIQueryPeriod) =>
  supabase
    .from('snp_reglements_achat')
    .select(
      'id, reference_reglement, date_reglement, statut, mining_company_id, montant_fcfa, montant_affecte_fcfa',
    )
    .gte('date_reglement', startDate)
    .lte('date_reglement', endDate)
    .order('date_reglement', { ascending: false });

const queryArtisanalSites = () =>
  fromRecentTable('artisanal_sites')
    .select('id, code, name, status, region, province, locality, exploitation_type')
    .order('name');

const queryArtisanalSiteProductions = ({ startDate, endDate }: BIQueryPeriod) =>
  fromRecentTable('artisanal_site_productions')
    .select('id, site_id, production_date, gold_weight_grams, revenue_fcfa, taxes_fcfa, artisan_count, notes')
    .gte('production_date', startDate)
    .lte('production_date', endDate)
    .order('production_date', { ascending: false });

const industrialProductionRecords = (
  rows: ProductionRow[],
  companies: Map<string, CompanyRow>,
): BIRecord[] =>
  rows.map((row) => {
    const company = companyFor(companies, row.mining_company_id);
    return {
      id: `production-${row.id}`,
      date: row.production_date,
      category: 'production',
      reference: normalize(row.bar_reference, `PROD-${row.id.slice(0, 8)}`),
      source: 'industriel',
      region: normalize(company?.region),
      province: normalize(company?.province),
      siteId: row.site_id || company?.id || 'unknown-site',
      siteName: normalize(company?.name, 'Site industriel non rattaché'),
      actorId: company?.id || 'unknown-actor',
      actorName: normalize(company?.name, 'Société non rattachée'),
      status: normalize(row.status),
      quantityOz: productionOunces(row),
      amount: 0,
      currency: '—',
      taxes: 0,
      qualityPct: row.estimated_fineness_pct == null ? null : numberValue(row.estimated_fineness_pct),
    };
  });

const industrialSaleRecords = (rows: SaleRow[], companies: Map<string, CompanyRow>): BIRecord[] =>
  rows.map((row) => {
    const company = companyFor(companies, row.seller_id);
    return {
      id: `sale-${row.id}`,
      date: row.sale_date || row.created_at || '',
      category: 'sale',
      reference: normalize(row.sale_number, `VTE-${row.id.slice(0, 8)}`),
      source: 'industriel',
      region: normalize(company?.region),
      province: normalize(company?.province),
      siteId: company?.id || row.seller_id || 'unknown-site',
      siteName: normalize(company?.name, 'Origine non rattachée'),
      actorId: row.customer_id || row.seller_id || 'unknown-actor',
      actorName: normalize(company?.name, row.seller_type === 'sonasp' ? 'SONASP' : 'Opérateur non rattaché'),
      status: normalize(row.status),
      quantityOz: numberValue(row.quantity_oz),
      amount: numberValue(row.total_amount) || numberValue(row.gross_proceeds) || numberValue(row.final_proceeds),
      currency: normalizeCurrency(row.currency),
      taxes: numberValue(row.royalty_amount),
      qualityPct: null,
    };
  });

const artisanSaleRecords = (rows: ArtisanSaleRow[], companies: Map<string, CompanyRow>): BIRecord[] =>
  rows.map((row) => {
    const buyer = companyFor(companies, row.acheteur_id);
    const commune = normalize(row.artisan?.commune, 'Site artisanal non rattaché');
    const actor = buyer?.name || artisanName(row);
    return {
      id: `artisan-sale-${row.id}`,
      date: row.date_vente,
      category: 'sale',
      reference: `ART-${row.id.slice(0, 8)}`,
      source: 'artisanal',
      region: normalize(row.artisan?.region),
      province: commune,
      siteId: `artisan-${commune}`,
      siteName: commune,
      actorId: row.acheteur_id || row.artisan?.collecteur_id || row.artisan_id,
      actorName: actor,
      status: normalize(row.statut_paiement || row.statut),
      quantityOz: numberValue(row.quantite_grammes) / TROY_OZ_GRAMS,
      amount: numberValue(row.montant_total_fcfa) || numberValue(row.montant_brut_fcfa),
      currency: 'FCFA',
      taxes: numberValue(row.taxe_dev_comm_montant_fcfa) + numberValue(row.tva_montant_fcfa),
      qualityPct: row.purete_karat == null ? null : (numberValue(row.purete_karat) / 24) * 100,
    };
  });

const institutionalRecords = (
  contracts: ContractRow[],
  invoices: InvoiceRow[],
  settlements: SettlementRow[],
  companies: Map<string, CompanyRow>,
): BIRecord[] => {
  const base = (companyId?: string | null) => {
    const company = companyFor(companies, companyId);
    return {
      region: normalize(company?.region),
      province: normalize(company?.province),
      siteId: company?.id || companyId || 'unknown-site',
      siteName: normalize(company?.name, 'Opérateur non rattaché'),
      actorId: company?.id || companyId || 'unknown-actor',
      actorName: normalize(company?.name, 'Opérateur non rattaché'),
    };
  };

  return [
    ...contracts.map<BIRecord>((row) => ({
      id: `contract-${row.id}`,
      date: row.date_debut,
      category: 'contract',
      reference: row.numero_contrat,
      source: 'institutionnel',
      ...base(row.mining_company_id),
      status: normalize(row.statut),
      quantityOz: isOunceUnit(row.unite) ? numberValue(row.quantite_totale) : 0,
      amount: 0,
      currency: 'FCFA',
      taxes: 0,
      qualityPct: null,
    })),
    ...invoices.map<BIRecord>((row) => ({
      id: `invoice-${row.id}`,
      date: row.date_emission,
      category: 'invoice',
      reference: row.numero_facture,
      source: 'institutionnel',
      ...base(row.mining_company_id),
      status: normalize(row.statut),
      quantityOz: numberValue(row.quantite_oz),
      amount: numberValue(row.montant_ttc_fcfa),
      currency: 'FCFA',
      taxes:
        numberValue(row.taxe_dev_comm_montant_fcfa) +
        numberValue(row.retenue_source_fcfa) +
        numberValue(row.tva_montant_fcfa),
      qualityPct: null,
    })),
    ...settlements.map<BIRecord>((row) => ({
      id: `settlement-${row.id}`,
      date: row.date_reglement,
      category: 'settlement',
      reference: row.reference_reglement,
      source: 'institutionnel',
      ...base(row.mining_company_id),
      status: normalize(row.statut),
      quantityOz: 0,
      amount: numberValue(row.montant_affecte_fcfa) || numberValue(row.montant_fcfa),
      currency: 'FCFA',
      taxes: 0,
      qualityPct: null,
    })),
  ];
};

const artisanalProductionRecords = (
  rows: ArtisanalSiteProductionRow[],
  sites: ArtisanalSiteRow[],
): BIRecord[] => {
  const siteMap = new Map(sites.map((site) => [site.id, site]));
  return rows.map((production) => {
    const site = siteMap.get(production.site_id);
    const siteName = normalize(site?.name, 'Site semi-mécanisé');
    return {
      id: `site-production-${production.id}`,
      date: production.production_date,
      category: 'production',
      reference: normalize(production.notes, `SITE-${production.id.slice(0, 8)}`),
      source: 'semi-mecanise',
      region: normalize(site?.region),
      province: normalize(site?.province),
      siteId: production.site_id,
      siteName,
      actorId: production.site_id,
      actorName: siteName,
      status: normalize(site?.status, 'active'),
      quantityOz: numberValue(production.gold_weight_grams) / TROY_OZ_GRAMS,
      amount: numberValue(production.revenue_fcfa),
      currency: 'FCFA',
      taxes: numberValue(production.taxes_fcfa),
      qualityPct: null,
    };
  });
};

const cache = new Map<string, { expiresAt: number; value: Promise<BIDataSnapshot> }>();
const CACHE_TTL_MS = 60_000;

/**
 * Charge uniquement les sources utiles à la vue demandée. Les appels sont parallèles,
 * mis en cache une minute et chaque source en échec est signalée à l'écran : aucune
 * donnée de démonstration ne remplace une table indisponible.
 */
export function loadBusinessIntelligenceData(
  view: BIView,
  period: BIQueryPeriod,
  options: { force?: boolean } = {},
): Promise<BIDataSnapshot> {
  const key = `${view}:${period.startDate}:${period.endDate}`;
  const cached = cache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.value;

  const value = (async () => {
    const unavailable: string[] = [];
    const companiesResult = await Promise.allSettled([queryCompanies()]);
    const companyRows = toResultRows<CompanyRow>(companiesResult[0], 'référentiel des opérateurs', unavailable);
    const companies = new Map(companyRows.map((company) => [company.id, company]));
    let records: BIRecord[] = [];

    if (view === 'sales') {
      const [sales, artisanSales] = await Promise.allSettled([querySales(period), queryArtisanSales(period)]);
      records = [
        ...industrialSaleRecords(toResultRows<SaleRow>(sales, 'ventes industrielles', unavailable), companies),
        ...artisanSaleRecords(toResultRows<ArtisanSaleRow>(artisanSales, 'ventes artisanales', unavailable), companies),
      ];
    }

    if (view === 'production') {
      const [production, artisanalProductions, artisanalSites] = await Promise.allSettled([
        queryProduction(period),
        queryArtisanalSiteProductions(period),
        queryArtisanalSites(),
      ]);
      records = industrialProductionRecords(
        toResultRows<ProductionRow>(production, 'production industrielle', unavailable),
        companies,
      );
      const siteProductions = toResultRows<ArtisanalSiteProductionRow>(
        artisanalProductions as PromiseSettledResult<{
          data: ArtisanalSiteProductionRow[] | null;
          error: unknown;
        }>,
        'production des sites semi-mécanisés',
        unavailable,
      );
      const sites = toResultRows<ArtisanalSiteRow>(
        artisanalSites as PromiseSettledResult<{ data: ArtisanalSiteRow[] | null; error: unknown }>,
        'référentiel des sites semi-mécanisés',
        unavailable,
      );
      records.push(...artisanalProductionRecords(siteProductions, sites));
    }

    if (view === 'institutional') {
      const [contracts, invoices, settlements] = await Promise.allSettled([
        queryContracts(period),
        queryInvoices(period),
        querySettlements(period),
      ]);
      records = institutionalRecords(
        toResultRows<ContractRow>(contracts, 'contrats', unavailable),
        toResultRows<InvoiceRow>(invoices, 'factures d’achat', unavailable),
        toResultRows<SettlementRow>(settlements, 'règlements', unavailable),
        companies,
      );
    }

    if (view === 'national') {
      const [production, artisanalProductions, artisanalSites, sales, artisanSales] = await Promise.allSettled([
        queryProduction(period),
        queryArtisanalSiteProductions(period),
        queryArtisanalSites(),
        querySales(period),
        queryArtisanSales(period),
      ]);
      const siteProductions = toResultRows<ArtisanalSiteProductionRow>(
        artisanalProductions as PromiseSettledResult<{
          data: ArtisanalSiteProductionRow[] | null;
          error: unknown;
        }>,
        'production des sites semi-mécanisés',
        unavailable,
      );
      const sites = toResultRows<ArtisanalSiteRow>(
        artisanalSites as PromiseSettledResult<{ data: ArtisanalSiteRow[] | null; error: unknown }>,
        'référentiel des sites semi-mécanisés',
        unavailable,
      );
      records = [
        ...industrialProductionRecords(
          toResultRows<ProductionRow>(production, 'production industrielle', unavailable),
          companies,
        ),
        ...artisanalProductionRecords(siteProductions, sites),
        ...industrialSaleRecords(toResultRows<SaleRow>(sales, 'ventes industrielles', unavailable), companies),
        ...artisanSaleRecords(toResultRows<ArtisanSaleRow>(artisanSales, 'ventes artisanales', unavailable), companies),
      ];
    }

    return { records, unavailable, loadedAt: new Date().toISOString() };
  })();

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

const modeRecords = (records: BIRecord[], view: BIView) => {
  if (view === 'sales') return records.filter((record) => record.category === 'sale');
  if (view === 'production') return records.filter((record) => record.category === 'production');
  if (view === 'institutional') return records.filter((record) => ['contract', 'invoice', 'settlement'].includes(record.category));
  return records;
};

export function filterBIRecords(records: BIRecord[], filters: Partial<BIFilters>): BIRecord[] {
  return records.filter((record) => {
    if (filters.region && filters.region !== 'all' && record.region !== filters.region) return false;
    if (filters.siteId && filters.siteId !== 'all' && record.siteId !== filters.siteId) return false;
    if (filters.actorId && filters.actorId !== 'all' && record.actorId !== filters.actorId) return false;
    if (filters.source && filters.source !== 'all' && record.source !== filters.source) return false;
    if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false;
    return true;
  });
}

const periodKey = (dateValue: string, granularity: BIGranularity) => {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { key: 'unknown', label: 'Date inconnue' };
  const year = date.getFullYear();
  if (granularity === 'year') return { key: String(year), label: String(year) };
  if (granularity === 'quarter') {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    return { key: `${year}-Q${quarter}`, label: `T${quarter} ${year}` };
  }
  return {
    key: `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', ''),
  };
};

const primaryCurrencyFor = (records: BIRecord[]) => {
  const currencies = new Map<string, number>();
  records.forEach((record) => {
    if (record.amount <= 0 || record.currency === '—') return;
    currencies.set(record.currency, (currencies.get(record.currency) || 0) + 1);
  });
  return [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'FCFA';
};

const isCompleteStatus = (status: string) =>
  /complete|completed|valid|valide|pay|paye|régl|regl|execut|clotur|approuv/i.test(status);

const isPendingStatus = (status: string) =>
  /pending|attente|draft|brouillon|soumis|review|control|prépar|prepar/i.test(status);

const breakdownValue = (record: BIRecord, view: BIView, primaryCurrency: string) => {
  if (view === 'production' || view === 'national') {
    return record.category === 'production' ? record.quantityOz : 0;
  }
  if (view === 'sales') {
    return record.category === 'sale' && record.currency === primaryCurrency ? record.amount : 0;
  }
  return record.category === 'invoice' && record.currency === primaryCurrency ? record.amount : 0;
};

const amountForView = (record: BIRecord, view: BIView, primaryCurrency: string) => {
  if (record.currency !== primaryCurrency) return 0;
  if (view === 'institutional') return record.category === 'invoice' ? record.amount : 0;
  if (view === 'national') return record.category === 'sale' ? record.amount : 0;
  return record.amount;
};

const dimensionValue = (record: BIRecord, dimension: BIDimension) => {
  if (dimension === 'region') return { id: record.region, label: record.region };
  if (dimension === 'site') return { id: record.siteId, label: record.siteName };
  if (dimension === 'actor') return { id: record.actorId, label: record.actorName };
  if (dimension === 'source') return { id: record.source, label: SOURCE_LABELS[record.source] };
  return { id: record.status, label: record.status };
};

function buildBreakdown(
  records: BIRecord[],
  dimension: BIDimension,
  view: BIView,
  primaryCurrency: string,
): BIBreakdownItem[] {
  const groups = new Map<string, BIBreakdownItem>();
  records.forEach((record) => {
    const key = dimensionValue(record, dimension);
    const current = groups.get(key.id) || {
      id: key.id,
      label: key.label,
      value: 0,
      secondary: 0,
      share: 0,
      records: 0,
    };
    current.value += breakdownValue(record, view, primaryCurrency);
    current.secondary += record.quantityOz;
    current.records += 1;
    groups.set(key.id, current);
  });
  const rows = [...groups.values()].sort((a, b) => b.value - a.value || b.records - a.records);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? (row.value / total) * 100 : 0 }));
}

export function buildBusinessIntelligenceModel(
  snapshot: BIDataSnapshot,
  view: BIView,
  filters: Partial<BIFilters> = DEFAULT_BI_FILTERS,
): BIModel {
  const relevant = modeRecords(snapshot.records, view);
  const records = filterBIRecords(relevant, filters);
  const primaryCurrency = primaryCurrencyFor(records);
  const currencies = [...new Set(records.filter((record) => record.amount > 0).map((record) => record.currency))];
  const trendMap = new Map<string, BITrendPoint>();

  records.forEach((record) => {
    const period = periodKey(record.date, filters.granularity || 'month');
    const point = trendMap.get(period.key) || {
      key: period.key,
      label: period.label,
      quantityOz: 0,
      amount: 0,
      operations: 0,
    };
    point.quantityOz += record.quantityOz;
    point.amount += amountForView(record, view, primaryCurrency);
    point.operations += 1;
    trendMap.set(period.key, point);
  });

  const qualityRows = records.filter((record) => record.qualityPct != null && record.quantityOz > 0);
  const qualityWeight = qualityRows.reduce((sum, record) => sum + record.quantityOz, 0);
  const averageQualityPct =
    qualityWeight > 0
      ? qualityRows.reduce((sum, record) => sum + (record.qualityPct || 0) * record.quantityOz, 0) /
        qualityWeight
      : null;

  const dimensions: BIDimension[] = ['region', 'site', 'actor', 'source', 'status'];
  const breakdowns = Object.fromEntries(
    dimensions.map((dimension) => [dimension, buildBreakdown(records, dimension, view, primaryCurrency)]),
  ) as Record<BIDimension, BIBreakdownItem[]>;

  return {
    records: [...records].sort((a, b) => b.date.localeCompare(a.date)),
    trend: [...trendMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    breakdowns,
    totalQuantityOz: records.reduce((sum, record) => {
      if (view === 'national') return sum + (record.category === 'production' ? record.quantityOz : 0);
      return sum + record.quantityOz;
    }, 0),
    totalAmount: records.reduce(
      (sum, record) => sum + amountForView(record, view, primaryCurrency),
      0,
    ),
    primaryCurrency,
    otherCurrencies: currencies.filter((currency) => currency !== primaryCurrency),
    totalTaxes: records.reduce(
      (sum, record) => sum + (record.currency === primaryCurrency ? record.taxes : 0),
      0,
    ),
    averageQualityPct,
    operations: records.length,
    completedOperations: records.filter((record) => isCompleteStatus(record.status)).length,
    pendingOperations: records.filter((record) => isPendingStatus(record.status)).length,
    activeRegions: new Set(records.map((record) => record.region).filter((value) => value !== 'Non renseigné')).size,
    activeSites: new Set(records.map((record) => record.siteId).filter((value) => value !== 'unknown-site')).size,
    activeActors: new Set(records.map((record) => record.actorId).filter((value) => value !== 'unknown-actor')).size,
    unavailable: snapshot.unavailable,
  };
}

export function optionsForDimension(records: BIRecord[], dimension: BIDimension) {
  const options = new Map<string, string>();
  records.forEach((record) => {
    const value = dimensionValue(record, dimension);
    if (value.id && value.label) options.set(value.id, value.label);
  });
  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
