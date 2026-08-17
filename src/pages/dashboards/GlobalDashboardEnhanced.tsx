import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowUp, Bell, Boxes, CalendarDays, ChevronDown, ChevronRight,
  AlertCircle, Coins, Download, FileCheck2, Filter, Percent, RefreshCw,
  SlidersHorizontal, Workflow, X,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { supabase } from '@/lib/supabase';
import './global-dashboard-enhanced.css';

type ChartMode = 'volume' | 'value';
type MonthlyMetric = { month: string; volume: number; value: number };
type DashboardTransaction = {
  reference: string; actor: string; type: string; quantity: number; amount: number;
  status: 'validated' | 'control' | 'pending'; date: string;
};
type DashboardData = {
  collectedGold: number; salesValue: number; availableStock: number; royalties: number;
  transactionsCount: number; pendingCount: number; monthlyMetrics: MonthlyMetric[];
  transactions: DashboardTransaction[];
};
type RawSale = {
  sale_number?: string | null; quantity_oz?: number | null; total_amount?: number | null;
  gross_proceeds?: number | null; royalty_amount?: number | null; sale_date?: string | null;
  created_at?: string | null; status?: string | null; seller_type?: string | null;
  customers?: { name?: string | null } | Array<{ name?: string | null }> | null;
};
type RawProduction = { production_date?: string | null; estimated_oz?: number | null; pure_gold_grams?: number | null };
type RawInventory = { quantity_available_oz?: number | null };

const FALLBACK_MONTHS: MonthlyMetric[] = [
  { month: 'Sep 2025', volume: 108, value: 218 }, { month: 'Oct 2025', volume: 119, value: 232 },
  { month: 'Nov 2025', volume: 140, value: 254 }, { month: 'Déc 2025', volume: 164, value: 281 },
  { month: 'Jan 2026', volume: 188, value: 315 }, { month: 'Fév 2026', volume: 146, value: 266 },
  { month: 'Mar 2026', volume: 159, value: 278 }, { month: 'Avr 2026', volume: 173, value: 302 },
  { month: 'Mai 2026', volume: 188.4, value: 326 }, { month: 'Juin 2026', volume: 156, value: 286 },
  { month: 'Juil 2026', volume: 157, value: 291 }, { month: 'Août 2026', volume: 150, value: 284 },
];
const FALLBACK_TRANSACTIONS: DashboardTransaction[] = [
  { reference: 'VTE-2026-0842', actor: 'Burkina Gold Refinery', type: 'Vente locale', quantity: 52.4, amount: 128_600_000, status: 'validated', date: '17/08/2026 09:15' },
  { reference: 'COL-2026-0317', actor: 'Comptoir Kadiogo', type: 'Collecte', quantity: 18.75, amount: 45_900_000, status: 'control', date: '16/08/2026 16:42' },
  { reference: 'EXP-2026-0129', actor: 'SONASP', type: 'Exportation', quantity: 120, amount: 294_000_000, status: 'validated', date: '15/08/2026 11:08' },
  { reference: 'COL-2026-0315', actor: 'Artisanat Minier du Nord', type: 'Collecte', quantity: 9.2, amount: 22_500_000, status: 'pending', date: '15/08/2026 08:21' },
];
const FALLBACK_DATA: DashboardData = {
  collectedGold: 1244.23, salesValue: 2_840_000_000, availableStock: 386.4,
  royalties: 85_200_000, transactionsCount: 248, pendingCount: 12,
  monthlyMetrics: FALLBACK_MONTHS, transactions: FALLBACK_TRANSACTIONS,
};
const ORIGIN_DATA = [
  { name: 'Mines industrielles', value: 62, color: '#dda000' },
  { name: 'Comptoirs', value: 24, color: '#10976b' },
  { name: 'Artisans miniers', value: 14, color: '#3975d6' },
];
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const PENDING_STATUSES = new Set(['draft', 'pending', 'pending_approval', 'submitted', 'under_review']);

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
function formatCompactFcfa(value: number) {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value / 1_000_000_000)} Mds FCFA`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}
function formatTableAmount(value: number) {
  return value >= 1_000_000
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`
    : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}
function formatTransactionDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date).replace(',', '');
}
function normalizeStatus(status?: string | null): DashboardTransaction['status'] {
  if (!status || PENDING_STATUSES.has(status)) return 'pending';
  return ['processing', 'in_review', 'under_control'].includes(status) ? 'control' : 'validated';
}
function customerName(customers: RawSale['customers']) {
  return Array.isArray(customers) ? customers[0]?.name || 'SONASP' : customers?.name || 'SONASP';
}
function createEmptyMonths(referenceDate: Date): MonthlyMetric[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (11 - index), 1);
    return { month: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`, volume: 0, value: 0 };
  });
}
function monthKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function ChartTooltipContent({ active, payload, label, mode }: {
  active?: boolean; payload?: Array<{ value?: number }>; label?: string | number; mode: ChartMode;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value || 0);
  return (
    <div className="national-chart-tooltip">
      <strong>{label}</strong><span className="national-chart-tooltip__dot" aria-hidden="true" />
      <span>{mode === 'volume' ? `${formatNumber(value, 1)} oz` : formatCompactFcfa(value * 1_000_000)}</span>
    </div>
  );
}

export function GlobalDashboardEnhanced() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(FALLBACK_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('volume');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-08-17');
  const [datePanelOpen, setDatePanelOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('10:42');

  const loadDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    const chartStart = new Date(`${endDate}T00:00:00`);
    chartStart.setMonth(chartStart.getMonth() - 11, 1);
    try {
      const [salesResult, productionResult, inventoryResult] = await Promise.all([
        supabase.from('sales').select('sale_number, quantity_oz, total_amount, gross_proceeds, royalty_amount, sale_date, created_at, status, seller_type, customers(name)').gte('sale_date', startDate).lte('sale_date', endDate).order('sale_date', { ascending: false }),
        supabase.from('daily_production').select('production_date, estimated_oz, pure_gold_grams').gte('production_date', chartStart.toISOString().slice(0, 10)).lte('production_date', endDate).order('production_date', { ascending: true }),
        supabase.from('gold_inventory').select('quantity_available_oz').gt('quantity_available_oz', 0),
      ]);
      const salesAvailable = !salesResult.error && Array.isArray(salesResult.data);
      const productionAvailable = !productionResult.error && Array.isArray(productionResult.data);
      const inventoryAvailable = !inventoryResult.error && Array.isArray(inventoryResult.data);
      if (!salesAvailable && !productionAvailable && !inventoryAvailable) return;

      const sales = salesAvailable ? (salesResult.data as RawSale[]) : [];
      const productions = productionAvailable ? (productionResult.data as RawProduction[]) : [];
      const inventory = inventoryAvailable ? (inventoryResult.data as RawInventory[]) : [];
      const monthlyMetrics = createEmptyMonths(new Date(`${endDate}T00:00:00`));
      const monthMap = new Map(monthlyMetrics.map((metric) => [metric.month, metric]));
      sales.forEach((sale) => {
        const metric = monthMap.get(monthKey(sale.sale_date || sale.created_at) || '');
        if (metric) metric.value += Number(sale.total_amount ?? sale.gross_proceeds ?? 0) / 1_000_000;
      });
      productions.forEach((production) => {
        const metric = monthMap.get(monthKey(production.production_date) || '');
        if (metric) metric.volume += Number(production.estimated_oz ?? 0) || Number(production.pure_gold_grams ?? 0) / 31.1034768;
      });
      const liveTransactions = sales.slice(0, 4).map((sale, index) => ({
        reference: sale.sale_number || `VTE-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
        actor: customerName(sale.customers), type: sale.seller_type === 'artisan' ? 'Collecte' : 'Vente locale',
        quantity: Number(sale.quantity_oz || 0), amount: Number(sale.total_amount ?? sale.gross_proceeds ?? 0),
        status: normalizeStatus(sale.status), date: formatTransactionDate(sale.sale_date || sale.created_at),
      }));

      setData((current) => ({
        collectedGold: productionAvailable ? productions.reduce((sum, item) => sum + (Number(item.estimated_oz ?? 0) || Number(item.pure_gold_grams ?? 0) / 31.1034768), 0) : current.collectedGold,
        salesValue: salesAvailable ? sales.reduce((sum, sale) => sum + Number(sale.total_amount ?? sale.gross_proceeds ?? 0), 0) : current.salesValue,
        availableStock: inventoryAvailable ? inventory.reduce((sum, item) => sum + Number(item.quantity_available_oz || 0), 0) : current.availableStock,
        royalties: salesAvailable ? sales.reduce((sum, sale) => sum + Number(sale.royalty_amount || 0), 0) : current.royalties,
        transactionsCount: salesAvailable ? sales.length : current.transactionsCount,
        pendingCount: salesAvailable ? sales.filter((sale) => PENDING_STATUSES.has(sale.status || '')).length : current.pendingCount,
        monthlyMetrics: productionAvailable || salesAvailable ? monthlyMetrics : current.monthlyMetrics,
        transactions: salesAvailable ? liveTransactions : current.transactions,
      }));
      setUpdatedAt(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
    } catch (error) {
      console.warn('Tableau de bord national indisponible, affichage du jeu de repli.', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [endDate, startDate]);

  useEffect(() => { void loadDashboardData(); }, [loadDashboardData]);
  const visibleTransactions = useMemo(
    () => pendingOnly ? data.transactions.filter((transaction) => transaction.status === 'pending') : data.transactions,
    [data.transactions, pendingOnly],
  );
  const chartDataKey = chartMode === 'volume' ? 'volume' : 'value';

  const exportDashboard = () => {
    const rows = [
      ['Référence', 'Acteur', 'Type', 'Quantité (oz)', 'Montant (FCFA)', 'Statut', 'Date'],
      ...visibleTransactions.map((item) => [item.reference, item.actor, item.type, item.quantity.toString(), item.amount.toString(), item.status, item.date]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `tableau-de-bord-national-${endDate}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <NationalDashboardLayout>
      <div className="national-dashboard">
        <section className="national-dashboard__intro" aria-labelledby="national-dashboard-title">
          <div><h2 id="national-dashboard-title">Tableau de bord national</h2><p>Vue consolidée de la collecte, des stocks et des ventes d’or</p></div>
          <div className="national-dashboard__controls">
            <div className="national-dashboard__control-popover">
              <button type="button" className="national-dashboard__control national-dashboard__date-control" onClick={() => { setDatePanelOpen((open) => !open); setFilterPanelOpen(false); }} aria-expanded={datePanelOpen}>
                <CalendarDays aria-hidden="true" /><span>01 jan. – 17 août 2026</span><ChevronDown aria-hidden="true" />
              </button>
              {datePanelOpen && <div className="national-dashboard__popover national-dashboard__date-panel">
                <label>Du<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label>Au<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
                <button type="button" onClick={() => setDatePanelOpen(false)}>Appliquer</button>
              </div>}
            </div>
            <div className="national-dashboard__control-popover">
              <button type="button" className="national-dashboard__control" onClick={() => { setFilterPanelOpen((open) => !open); setDatePanelOpen(false); }} aria-expanded={filterPanelOpen}>
                <Filter aria-hidden="true" /><span>Filtres</span>
              </button>
              {filterPanelOpen && <div className="national-dashboard__popover national-dashboard__filter-panel">
                <div className="national-dashboard__popover-title"><SlidersHorizontal aria-hidden="true" /> Affichage</div>
                <label><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />Transactions à valider uniquement</label>
                <button type="button" onClick={() => setFilterPanelOpen(false)}>Fermer</button>
              </div>}
            </div>
            <button type="button" className="national-dashboard__export" onClick={exportDashboard}><Download aria-hidden="true" /><span>Exporter</span></button>
            <div className="national-dashboard__updated"><RefreshCw className={isRefreshing ? 'is-spinning' : ''} aria-hidden="true" /><span>Données actualisées à {updatedAt}</span></div>
          </div>
        </section>

        <section className="national-dashboard__metrics" aria-label="Indicateurs nationaux">
          <article className="national-metric-card national-metric-card--gold"><span className="national-metric-card__icon"><Workflow aria-hidden="true" /></span><div><h3>Or collecté</h3><strong>{formatNumber(data.collectedGold)} oz</strong></div><p className="is-positive"><ArrowUp aria-hidden="true" /> +8,4 % <span>vs période précédente</span></p></article>
          <article className="national-metric-card national-metric-card--green"><span className="national-metric-card__icon"><FileCheck2 aria-hidden="true" /></span><div><h3>Valeur des ventes</h3><strong>{formatCompactFcfa(data.salesValue)}</strong></div><p className="is-positive"><ArrowUp aria-hidden="true" /> +12,1 % <span>vs période précédente</span></p></article>
          <article className="national-metric-card national-metric-card--gold"><span className="national-metric-card__icon"><Boxes aria-hidden="true" /></span><div><h3>Stock disponible</h3><strong>{formatNumber(data.availableStock)} oz</strong></div><p className="is-gold">31 % <span>du volume</span></p></article>
          <article className="national-metric-card national-metric-card--green"><span className="national-metric-card__icon"><Percent aria-hidden="true" /></span><div><h3>Redevances dues</h3><strong>{formatCompactFcfa(data.royalties)}</strong></div><p className="is-positive">Taux 3 %</p></article>
          <article className="national-metric-card national-metric-card--blue"><span className="national-metric-card__icon"><Coins aria-hidden="true" /></span><div><h3>Transactions</h3><strong>{new Intl.NumberFormat('fr-FR').format(data.transactionsCount)}</strong></div><p className="is-danger">{data.pendingCount} à valider</p></article>
        </section>

        <section className="national-dashboard__analytics-grid">
          <article className="national-panel national-volume-panel">
            <div className="national-panel__header"><h3>Évolution des volumes collectés</h3><div className="national-chart-toggle" aria-label="Donnée du graphique">
              <button type="button" className={chartMode === 'volume' ? 'is-active' : ''} onClick={() => setChartMode('volume')}>Volume</button>
              <button type="button" className={chartMode === 'value' ? 'is-active' : ''} onClick={() => setChartMode('value')}>Valeur</button>
            </div></div>
            <div className="national-volume-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.monthlyMetrics} margin={{ top: 24, right: 18, left: 1, bottom: 0 }}>
              <defs><linearGradient id="nationalVolumeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2a000" stopOpacity={0.2} /><stop offset="100%" stopColor="#e2a000" stopOpacity={0.015} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#dde5ec" strokeDasharray="2 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#aab8c7' }} tick={{ fill: '#61748a', fontSize: 10 }} />
              <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} width={38} tick={{ fill: '#51657d', fontSize: 10 }} tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} label={{ value: chartMode === 'volume' ? 'oz' : 'M', position: 'top', offset: 12, fill: '#10243e', fontSize: 10, fontWeight: 700 }} />
              <Tooltip content={({ active, payload, label }) => <ChartTooltipContent active={active} payload={payload?.map((item) => ({ value: Number(item.value || 0) }))} label={label} mode={chartMode} />} cursor={{ stroke: '#dda000', strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey={chartDataKey} stroke="#dda000" strokeWidth={2} fill="url(#nationalVolumeFill)" activeDot={{ r: 5, fill: '#dda000', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 3.5, fill: '#fff', stroke: '#dda000', strokeWidth: 2 }} />
            </AreaChart></ResponsiveContainer></div>
          </article>

          <article className="national-panel national-origin-panel">
            <div className="national-panel__header"><h3>Répartition par origine</h3></div>
            <div className="national-origin-panel__content"><div className="national-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={ORIGIN_DATA} dataKey="value" innerRadius={66} outerRadius={100} startAngle={90} endAngle={-270} paddingAngle={1} stroke="#fff" strokeWidth={1}>{ORIGIN_DATA.map((origin) => <Cell key={origin.name} fill={origin.color} />)}</Pie><Tooltip formatter={(value) => `${value}%`} /></PieChart></ResponsiveContainer><div className="national-donut__center"><strong>{new Intl.NumberFormat('fr-FR').format(Math.round(data.collectedGold))}</strong><span>oz</span><small>Total</small></div></div>
              <ul className="national-origin-legend">{ORIGIN_DATA.map((origin) => <li key={origin.name}><span className="national-origin-legend__dot" style={{ background: origin.color }} /><span>{origin.name}</span><strong>{origin.value} %</strong></li>)}</ul>
            </div>
          </article>
        </section>

        <section className="national-dashboard__bottom-grid">
          <article className="national-panel national-transactions-panel">
            <div className="national-panel__header"><h3>Dernières transactions</h3></div>
            <div className="national-transactions-table-wrap"><table className="national-transactions-table"><thead><tr><th>Référence</th><th>Acteur</th><th>Type</th><th>Quantité</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead><tbody>
              {visibleTransactions.map((item) => <tr key={item.reference}><td><strong>{item.reference}</strong></td><td>{item.actor}</td><td>{item.type}</td><td>{formatNumber(item.quantity)} oz</td><td>{formatTableAmount(item.amount)}</td><td><span className={`national-status national-status--${item.status}`}>{item.status === 'validated' ? 'Validée' : item.status === 'control' ? 'En contrôle' : 'À valider'}</span></td><td>{item.date}</td></tr>)}
            </tbody></table>{visibleTransactions.length === 0 && <p className="national-transactions-empty">Aucune transaction à afficher.</p>}</div>
            <button type="button" className="national-transactions-panel__link" onClick={() => navigate('/sales')}>Voir toutes les transactions <ChevronRight aria-hidden="true" /></button>
          </article>

          <article className="national-panel national-alerts-panel">
            <div className="national-panel__header"><h3>Points d’attention</h3></div>
            <div className="national-alerts-list">
              <button type="button" onClick={() => navigate('/sales')}><span className="national-alerts-list__icon is-orange"><Bell aria-hidden="true" /></span><span><strong><b>{data.pendingCount}</b> transactions à valider</strong><small>Actions requises pour validation</small></span><ChevronRight aria-hidden="true" /></button>
              <button type="button" onClick={() => navigate('/artisan-minier/cartes/expirations')}><span className="national-alerts-list__icon is-gold"><AlertTriangle aria-hidden="true" /></span><span><strong>3 agréments expirent sous 30 jours</strong><small>Pensez à anticiper les renouvellements</small></span><ChevronRight aria-hidden="true" /></button>
              <button type="button" onClick={() => navigate('/inventory')}><span className="national-alerts-list__icon is-red"><AlertCircle aria-hidden="true" /></span><span><strong>Écart de stock à investiguer</strong><small>1 écart détecté sur le stock disponible</small></span><ChevronRight aria-hidden="true" /></button>
            </div>
          </article>
        </section>

        {(datePanelOpen || filterPanelOpen) && <button type="button" className="national-dashboard__popover-backdrop" aria-label="Fermer les options" onClick={() => { setDatePanelOpen(false); setFilterPanelOpen(false); }}><X aria-hidden="true" /></button>}
      </div>
    </NationalDashboardLayout>
  );
}
