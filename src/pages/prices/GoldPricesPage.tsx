import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays,
  Coins, LineChart as LineChartIcon, RefreshCw, Scale, TrendingUp,
} from 'lucide-react';
import {
  Bar, BarChart, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { LiveGoldMarketPanel } from '@/components/sales/LiveGoldMarketPanel';
import {
  Badge, Card, DataTable, EmptyState, Note, PageHeader, SelectControl,
  StatGrid, TabPanel, Tabs, type Column,
} from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import './gold-prices.css';

type ViewMode = 'daily' | 'monthly' | 'comparison';

interface DailyPrice {
  price_date: string;
  london_am_rate: number;
  london_pm_rate: number | null;
  spot_price: number | null;
  average_price: number;
  high_price: number;
  low_price: number;
}

interface MonthlyAggregate {
  year: number;
  month: number;
  average_price: number;
  high_price: number;
  low_price: number;
  opening_price: number | null;
  closing_price: number | null;
  total_days: number | null;
}

interface SalesPriceAnalysis {
  sale_id: string | null;
  sale_number: string | null;
  sale_date: string;
  year: number;
  month: number;
  quantity_oz: number;
  sale_price_per_oz: number;
  market_price_per_oz: number;
  variance_usd: number;
  variance_percent: number;
  customer_name: string;
}

interface MonthlySalesVsMarket {
  year: number | null;
  month: number | null;
  total_sales: number;
  total_quantity_oz: number;
  avg_sale_price: number;
  avg_market_price: number;
  avg_variance_usd: number;
  avg_variance_percent: number;
  total_variance_usd: number;
}

interface DailyPriceRow extends DailyPrice { id: string; change: number | null }
interface MonthlyAggregateRow extends MonthlyAggregate {
  id: string;
  change: number | null;
  changePercent: number | null;
}
interface SalesPriceRow extends SalesPriceAnalysis { id: string }

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

const usd = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('fr-FR');
const date = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
});

export const formatPriceDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? '—' : date.format(parsed);
};

export const buildDailyRows = (prices: DailyPrice[]): DailyPriceRow[] =>
  prices.map((price, index) => ({
    ...price,
    id: price.price_date,
    change: index === 0 ? null : price.london_am_rate - prices[index - 1].london_am_rate,
  })).reverse();

export const buildMonthlyRows = (aggregates: MonthlyAggregate[]): MonthlyAggregateRow[] =>
  aggregates.map((aggregate, index) => {
    const previousClose = aggregates[index - 1]?.closing_price;
    const currentClose = aggregate.closing_price;
    const change = currentClose == null || previousClose == null ? null : currentClose - previousClose;
    return {
      ...aggregate,
      id: `${aggregate.year}-${aggregate.month}`,
      change,
      changePercent: change == null || previousClose == null || previousClose === 0
        ? null
        : (change / previousClose) * 100,
    };
  }).reverse();

const variationBadge = (value: number | null, percent?: number | null) => {
  if (value == null) return <span className="gold-prices__muted">—</span>;
  const positive = value >= 0;
  return (
    <Badge tone={positive ? 'success' : 'danger'} icon={positive ? ArrowUpRight : ArrowDownRight}>
      {positive ? '+' : ''}{decimal.format(value)}
      {percent == null ? '' : ` (${positive ? '+' : ''}${decimal.format(percent)} %)`}
    </Badge>
  );
};

export function GoldPricesPage() {
  const { addToast } = useToast();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyPrices, setDailyPrices] = useState<DailyPrice[]>([]);
  const [monthlyAggregates, setMonthlyAggregates] = useState<MonthlyAggregate[]>([]);
  const [salesAnalysis, setSalesAnalysis] = useState<SalesPriceAnalysis[]>([]);
  const [monthlySalesVsMarket, setMonthlySalesVsMarket] = useState<MonthlySalesVsMarket[]>([]);

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'daily') {
        const today = new Date().toISOString().split('T')[0];
        const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
        const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
        const { data: prices, error: queryError } = await supabase
          .from('gold_prices_daily')
          .select('*')
          .gte('price_date', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
          .lt('price_date', `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`)
          .lte('price_date', today)
          .order('price_date', { ascending: true });
        if (queryError) throw queryError;
        setDailyPrices((prices || []).map((price) => ({
          price_date: price.price_date,
          london_am_rate: Number(price.london_am_rate ?? 0),
          london_pm_rate: price.london_pm_rate,
          spot_price: price.spot_price,
          average_price: Number(price.average_price ?? 0),
          high_price: Number(price.high_price ?? 0),
          low_price: Number(price.low_price ?? 0),
        })));
      } else if (viewMode === 'monthly') {
        const { data: prices, error: queryError } = await supabase
          .from('gold_prices_monthly')
          .select('*')
          .eq('year', selectedYear)
          .order('month', { ascending: true });
        if (queryError) throw queryError;
        const visiblePrices = selectedYear === currentYear
          ? (prices || []).filter((price) => price.month <= currentMonth)
          : (prices || []);
        setMonthlyAggregates(visiblePrices.map((price) => ({
          year: Number(price.year ?? selectedYear),
          month: Number(price.month ?? 0),
          average_price: Number(price.average_price ?? 0),
          high_price: Number(price.high_price ?? 0),
          low_price: Number(price.low_price ?? 0),
          opening_price: price.opening_price,
          closing_price: price.closing_price,
          total_days: price.total_days,
        })));
      } else {
        const today = new Date().toISOString().split('T')[0];
        const [{ data: sales, error: salesError }, { data: summaries, error: summariesError }] = await Promise.all([
          supabase.from('v_sales_price_analysis').select('*')
            .eq('year', selectedYear).eq('month', selectedMonth)
            .lte('sale_date', today).order('sale_date', { ascending: false }),
          supabase.from('v_monthly_sales_vs_market').select('*')
            .eq('year', selectedYear).order('month', { ascending: false }),
        ]);
        if (salesError) throw salesError;
        if (summariesError) throw summariesError;
        setSalesAnalysis((sales || []).map((sale) => ({
          sale_id: sale.sale_id,
          sale_number: sale.sale_number,
          sale_date: sale.sale_date ?? '',
          year: Number(sale.year ?? selectedYear),
          month: Number(sale.month ?? selectedMonth),
          quantity_oz: Number(sale.quantity_oz ?? 0),
          sale_price_per_oz: Number(sale.sale_price_per_oz ?? 0),
          market_price_per_oz: Number(sale.market_price_per_oz ?? 0),
          variance_usd: Number(sale.variance_usd ?? 0),
          variance_percent: Number(sale.variance_percent ?? 0),
          customer_name: sale.customer_name ?? 'Client non renseigné',
        })));
        const visibleSummaries = selectedYear === currentYear
          ? (summaries || []).filter((summary) => summary.month !== null && summary.month <= currentMonth)
          : (summaries || []);
        setMonthlySalesVsMarket(visibleSummaries.map((summary) => ({
          year: summary.year,
          month: summary.month,
          total_sales: Number(summary.total_sales ?? 0),
          total_quantity_oz: Number(summary.total_quantity_oz ?? 0),
          avg_sale_price: Number(summary.avg_sale_price ?? 0),
          avg_market_price: Number(summary.avg_market_price ?? 0),
          avg_variance_usd: Number(summary.avg_variance_usd ?? 0),
          avg_variance_percent: Number(summary.avg_variance_percent ?? 0),
          total_variance_usd: Number(summary.total_variance_usd ?? 0),
        })));
      }
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Le chargement des cours a échoué.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, currentMonth, currentYear, selectedMonth, selectedYear, viewMode]);

  useEffect(() => { void loadData(); }, [loadData]);

  const dailyRows = useMemo(() => buildDailyRows(dailyPrices), [dailyPrices]);
  const monthlyRows = useMemo(() => buildMonthlyRows(monthlyAggregates), [monthlyAggregates]);
  const salesRows = useMemo<SalesPriceRow[]>(() => salesAnalysis.map((sale, index) => ({
    ...sale,
    id: sale.sale_id || sale.sale_number || `${sale.sale_date}-${index}`,
  })), [salesAnalysis]);

  const latestPrice = dailyPrices.at(-1) || null;
  const previousPrice = dailyPrices.at(-2) || null;
  const priceChange = latestPrice && previousPrice ? latestPrice.london_am_rate - previousPrice.london_am_rate : null;
  const priceChangePercent = priceChange != null && previousPrice?.london_am_rate
    ? (priceChange / previousPrice.london_am_rate) * 100 : null;
  const dailyAverage = dailyPrices.length
    ? dailyPrices.reduce((sum, price) => sum + price.average_price, 0) / dailyPrices.length : 0;
  const yearlyAverage = monthlyAggregates.length
    ? monthlyAggregates.reduce((sum, item) => sum + item.average_price, 0) / monthlyAggregates.length : 0;
  const totalVariance = salesAnalysis.reduce((sum, sale) => sum + sale.variance_usd, 0);
  const averageSalePrice = salesAnalysis.length
    ? salesAnalysis.reduce((sum, sale) => sum + sale.sale_price_per_oz, 0) / salesAnalysis.length : 0;

  const dailyColumns: Column<DailyPriceRow>[] = [
    { key: 'date', header: 'Date', render: (row) => <strong>{formatPriceDate(row.price_date)}</strong> },
    { key: 'am', header: 'Fixing AM', numeric: true, render: (row) => usd.format(row.london_am_rate) },
    { key: 'pm', header: 'Fixing PM', numeric: true, render: (row) => row.london_pm_rate == null ? '—' : usd.format(row.london_pm_rate) },
    { key: 'spot', header: 'Spot', numeric: true, render: (row) => row.spot_price == null ? '—' : usd.format(row.spot_price) },
    { key: 'high', header: 'Plus haut', numeric: true, render: (row) => usd.format(row.high_price) },
    { key: 'low', header: 'Plus bas', numeric: true, render: (row) => usd.format(row.low_price) },
    { key: 'change', header: 'Variation', numeric: true, render: (row) => variationBadge(row.change) },
  ];
  const monthlyColumns: Column<MonthlyAggregateRow>[] = [
    { key: 'month', header: 'Mois', render: (row) => <strong>{MONTHS[row.month - 1] || 'Mois inconnu'}</strong> },
    { key: 'average', header: 'Moyenne', numeric: true, render: (row) => usd.format(row.average_price) },
    { key: 'high', header: 'Plus haut', numeric: true, render: (row) => usd.format(row.high_price) },
    { key: 'low', header: 'Plus bas', numeric: true, render: (row) => usd.format(row.low_price) },
    { key: 'open', header: 'Ouverture', numeric: true, render: (row) => row.opening_price == null ? '—' : usd.format(row.opening_price) },
    { key: 'close', header: 'Clôture', numeric: true, render: (row) => row.closing_price == null ? '—' : usd.format(row.closing_price) },
    { key: 'days', header: 'Séances', numeric: true, render: (row) => integer.format(row.total_days ?? 0) },
    { key: 'change', header: 'Variation', numeric: true, render: (row) => variationBadge(row.change, row.changePercent) },
  ];
  const salesColumns: Column<SalesPriceRow>[] = [
    { key: 'reference', header: 'Vente', render: (row) => <strong>{row.sale_number || 'Sans référence'}</strong> },
    { key: 'date', header: 'Date', render: (row) => formatPriceDate(row.sale_date) },
    { key: 'customer', header: 'Acheteur', render: (row) => row.customer_name },
    { key: 'quantity', header: 'Quantité', numeric: true, render: (row) => `${decimal.format(row.quantity_oz)} oz` },
    { key: 'sale', header: 'Prix de vente', numeric: true, render: (row) => `${usd.format(row.sale_price_per_oz)}/oz` },
    { key: 'market', header: 'Cours marché', numeric: true, render: (row) => `${usd.format(row.market_price_per_oz)}/oz` },
    { key: 'variance', header: 'Écart', numeric: true, render: (row) => variationBadge(row.variance_usd, row.variance_percent) },
  ];

  return (
    <NationalDashboardLayout>
      <main className="sn-page gold-prices">
        <PageHeader
          icon={Coins}
          title="Cours de l’or"
          subtitle="Références LBMA, agrégats mensuels et contrôle des prix de vente."
          breadcrumb={[{ label: 'Marchés internationaux', to: '/marches-internationaux' }, { label: 'Cours de l’or' }]}
          info={{ titre: 'Source et unité', contenu: <>Les cours historiques sont lus depuis la base SONASP et exprimés en USD par once troy.</> }}
          actions={
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={loading ? 'sn-spin' : undefined} aria-hidden="true" />
              {loading ? 'Actualisation…' : 'Actualiser'}
            </button>
          }
        />

        <div className="gold-prices__tabs">
          <Tabs
            value={viewMode}
            onChange={setViewMode}
            ariaLabel="Vue des cours de l’or"
            options={[
              { value: 'daily', label: 'Cours quotidiens', icon: CalendarDays, count: dailyPrices.length },
              { value: 'monthly', label: 'Synthèse mensuelle', icon: BarChart3, count: monthlyAggregates.length },
              { value: 'comparison', label: 'Ventes vs marché', icon: TrendingUp, count: salesAnalysis.length },
            ]}
          />
        </div>

        <Card className="gold-prices__filters" title="Période d’analyse" hint="Les sélecteurs actualisent la vue sans recharger l’application.">
          <div className="gold-prices__filter-grid">
            <label>
              <span>Année</span>
              <SelectControl value={String(selectedYear)} onChange={(value) => setSelectedYear(Number(value))} ariaLabel="Année d’analyse">
                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </SelectControl>
            </label>
            {viewMode !== 'monthly' && (
              <label>
                <span>Mois</span>
                <SelectControl value={String(selectedMonth)} onChange={(value) => setSelectedMonth(Number(value))} ariaLabel="Mois d’analyse">
                  {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </SelectControl>
              </label>
            )}
            <div className="gold-prices__source">
              <span>Référence</span>
              <strong>LBMA · USD / once troy</strong>
              <small>Données historiques validées dans la base SONASP</small>
            </div>
          </div>
        </Card>

        {error && (
          <div className="gold-prices__error">
            <Note tone="danger" icon={AlertCircle}>
              Impossible de charger les cours : {error}
              <button type="button" onClick={() => void loadData()}>Réessayer</button>
            </Note>
          </div>
        )}

        <div className="gold-prices__workspace">
          <div className="gold-prices__content">
            {viewMode === 'daily' && (
              <TabPanel value="daily">
                <div className="gold-prices__stats">
                  <StatGrid ariaLabel="Indicateurs quotidiens du cours de l’or" items={[
                    { label: 'Dernier fixing AM', value: latestPrice ? usd.format(latestPrice.london_am_rate) : '—', hint: latestPrice ? formatPriceDate(latestPrice.price_date) : 'Aucune cotation', icon: Coins, tone: 'gold' },
                    { label: 'Plus haut du mois', value: dailyPrices.length ? usd.format(Math.max(...dailyPrices.map((item) => item.high_price))) : '—', icon: ArrowUpRight, tone: 'green' },
                    { label: 'Plus bas du mois', value: dailyPrices.length ? usd.format(Math.min(...dailyPrices.map((item) => item.low_price))) : '—', icon: ArrowDownRight, tone: 'red' },
                    { label: 'Moyenne du mois', value: dailyPrices.length ? usd.format(dailyAverage) : '—', hint: `${integer.format(dailyPrices.length)} séance(s)`, icon: LineChartIcon, tone: 'blue' },
                  ]} />
                </div>

                {latestPrice && priceChange != null && (
                  <div className="gold-prices__variation-note">
                    <Note tone={priceChange >= 0 ? 'success' : 'danger'} icon={priceChange >= 0 ? ArrowUpRight : ArrowDownRight}>
                      Évolution depuis la cotation précédente : {priceChange >= 0 ? '+' : ''}{usd.format(priceChange)}
                      {priceChangePercent == null ? '' : ` (${priceChangePercent >= 0 ? '+' : ''}${decimal.format(priceChangePercent)} %)`}.
                    </Note>
                  </div>
                )}

                {!loading && dailyPrices.length === 0 ? (
                  <Card className="gold-prices__empty-card">
                    <EmptyState title="Aucun cours LBMA pour cette période" description={`Aucune cotation n’est enregistrée pour ${MONTHS[selectedMonth - 1]} ${selectedYear}. Contactez l’administration si un import historique est attendu.`} />
                  </Card>
                ) : (
                  <>
                    <Card title={`Évolution quotidienne · ${MONTHS[selectedMonth - 1]} ${selectedYear}`} hint="Fixings AM, moyenne et amplitude journalière." className="gold-prices__chart-card">
                      <div className="gold-prices__chart" role="img" aria-label="Graphique des cours quotidiens de l’or">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={dailyPrices}>
                            <XAxis dataKey="price_date" tickFormatter={(value) => String(new Date(`${String(value)}T00:00:00Z`).getUTCDate())} />
                            <YAxis domain={['dataMin - 10', 'dataMax + 10']} width={64} />
                            <Tooltip labelFormatter={(value) => formatPriceDate(String(value))} formatter={(value) => [usd.format(Number(value ?? 0)), '']} />
                            <Legend />
                            <Bar dataKey="high_price" fill="var(--sn-success-soft)" stroke="var(--sn-success)" name="Plus haut" />
                            <Bar dataKey="low_price" fill="var(--sn-danger-soft)" stroke="var(--sn-danger)" name="Plus bas" />
                            <Line type="monotone" dataKey="london_am_rate" stroke="var(--sn-gold-dark)" strokeWidth={3} dot={false} name="Fixing AM" />
                            <Line type="monotone" dataKey="average_price" stroke="var(--sn-info)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Moyenne" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                    <Card title="Détail des cotations" hint="Historique journalier provenant de la base de données." className="gold-prices__table-card">
                      <DataTable columns={dailyColumns} rows={dailyRows} loading={loading} empty="Aucune cotation pour cette période." caption="Cours quotidiens de l’or" />
                    </Card>
                  </>
                )}
              </TabPanel>
            )}

            {viewMode === 'monthly' && (
              <TabPanel value="monthly">
                <div className="gold-prices__stats">
                  <StatGrid ariaLabel="Indicateurs annuels du cours de l’or" items={[
                    { label: 'Moyenne annuelle', value: monthlyAggregates.length ? usd.format(yearlyAverage) : '—', hint: `${integer.format(monthlyAggregates.length)} mois consolidé(s)`, icon: Coins, tone: 'gold' },
                    { label: 'Plus haut annuel', value: monthlyAggregates.length ? usd.format(Math.max(...monthlyAggregates.map((item) => item.high_price))) : '—', icon: ArrowUpRight, tone: 'green' },
                    { label: 'Plus bas annuel', value: monthlyAggregates.length ? usd.format(Math.min(...monthlyAggregates.map((item) => item.low_price))) : '—', icon: ArrowDownRight, tone: 'red' },
                    { label: 'Séances consolidées', value: integer.format(monthlyAggregates.reduce((sum, item) => sum + (item.total_days ?? 0), 0)), icon: CalendarDays, tone: 'blue' },
                  ]} />
                </div>
                {!loading && monthlyAggregates.length === 0 ? (
                  <Card className="gold-prices__empty-card"><EmptyState title="Aucun agrégat mensuel" description={`Aucune synthèse n’est disponible pour ${selectedYear}.`} /></Card>
                ) : (
                  <>
                    <Card title={`Tendance mensuelle · ${selectedYear}`} hint="Moyenne, plus haut et plus bas par mois." className="gold-prices__chart-card">
                      <div className="gold-prices__chart" role="img" aria-label="Graphique des agrégats mensuels du cours de l’or">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyAggregates}>
                            <XAxis dataKey="month" tickFormatter={(value) => (MONTHS[Number(value) - 1] || '—').slice(0, 4)} />
                            <YAxis domain={['dataMin - 50', 'dataMax + 50']} width={64} />
                            <Tooltip labelFormatter={(value) => MONTHS[Number(value) - 1] || 'Mois inconnu'} formatter={(value) => [usd.format(Number(value ?? 0)), '']} />
                            <Legend />
                            <Bar dataKey="average_price" fill="var(--sn-info)" name="Moyenne" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="high_price" fill="var(--sn-success)" name="Plus haut" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="low_price" fill="var(--sn-danger)" name="Plus bas" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                    <Card title="Agrégats mensuels" hint="Ouverture, clôture et amplitude consolidées." className="gold-prices__table-card">
                      <DataTable columns={monthlyColumns} rows={monthlyRows} loading={loading} empty="Aucun agrégat pour cette année." caption="Agrégats mensuels des cours de l’or" />
                    </Card>
                  </>
                )}
              </TabPanel>
            )}

            {viewMode === 'comparison' && (
              <TabPanel value="comparison">
                <div className="gold-prices__stats">
                  <StatGrid ariaLabel="Indicateurs de comparaison des ventes au marché" items={[
                    { label: 'Ventes analysées', value: integer.format(salesAnalysis.length), hint: `${MONTHS[selectedMonth - 1]} ${selectedYear}`, icon: Coins, tone: 'gold' },
                    { label: 'Quantité vendue', value: `${decimal.format(salesAnalysis.reduce((sum, sale) => sum + sale.quantity_oz, 0))} oz`, icon: Scale, tone: 'blue' },
                    { label: 'Prix moyen de vente', value: usd.format(averageSalePrice), hint: 'Par once troy', icon: TrendingUp, tone: 'green' },
                    { label: 'Écart cumulé', value: usd.format(totalVariance), hint: totalVariance >= 0 ? 'Au-dessus du marché' : 'Sous le marché', icon: totalVariance >= 0 ? ArrowUpRight : ArrowDownRight, tone: totalVariance >= 0 ? 'green' : 'red' },
                  ]} />
                </div>
                {monthlySalesVsMarket.length > 0 && (
                  <Card title={`Prix de vente comparé au marché · ${selectedYear}`} hint="Évolution des prix moyens et des écarts mensuels." className="gold-prices__chart-card">
                    <div className="gold-prices__chart" role="img" aria-label="Graphique comparant les ventes au cours du marché">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={[...monthlySalesVsMarket].reverse()}>
                          <XAxis dataKey="month" tickFormatter={(value) => (MONTHS[Number(value) - 1] || '—').slice(0, 4)} />
                          <YAxis yAxisId="price" orientation="left" width={64} />
                          <YAxis yAxisId="variance" orientation="right" width={64} />
                          <Tooltip labelFormatter={(value) => MONTHS[Number(value) - 1] || 'Mois inconnu'} formatter={(value, name) => [usd.format(Number(value ?? 0)), String(name ?? 'Valeur')]} />
                          <Legend />
                          <Line yAxisId="price" type="monotone" dataKey="avg_sale_price" stroke="var(--sn-success)" strokeWidth={3} dot={false} name="Prix de vente" />
                          <Line yAxisId="price" type="monotone" dataKey="avg_market_price" stroke="var(--sn-info)" strokeWidth={3} strokeDasharray="5 5" dot={false} name="Cours marché" />
                          <Bar yAxisId="variance" dataKey="avg_variance_usd" fill="var(--sn-gold)" name="Écart moyen" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
                <Card title={`Analyse des ventes · ${MONTHS[selectedMonth - 1]} ${selectedYear}`} hint="Les écarts positifs et négatifs restent identifiables par leur libellé et leur icône." className="gold-prices__table-card">
                  {loading || salesRows.length > 0 ? (
                    <DataTable columns={salesColumns} rows={salesRows} loading={loading} empty="Aucune vente pour cette période." caption="Comparaison des ventes d’or avec le cours du marché" />
                  ) : (
                    <EmptyState title="Aucune vente à comparer" description="Aucune vente ne dispose d’un cours de référence sur la période sélectionnée." />
                  )}
                </Card>
              </TabPanel>
            )}
          </div>
          <LiveGoldMarketPanel variant="embedded" />
        </div>
      </main>
    </NationalDashboardLayout>
  );
}
