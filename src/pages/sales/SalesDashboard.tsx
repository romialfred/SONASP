import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Eye, FileText, Globe2, Loader2, MoreVertical, Plus, Search, ShoppingCart, SlidersHorizontal, X } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';
import { downloadExcelWorkbook } from '@/lib/excelExport';
import { listInternationalSales, type InternationalSaleRecord } from '@/services/internationalSalesListService';
import { confirmedPaidAmount, EMPTY_SALES_FILTERS, filterInternationalSales, finiteAmount, paymentPercent, pricePerGram, quantityGrams, saleCurrency, salesCategory, salesPageNumbers, sellerKey, type SalesCategory, type SalesFilters } from './internationalSalesList';
import { internationalSalesCopy } from './internationalSalesCopy';
import './international-sales-list.css';

const BASE_CATEGORIES: SalesCategory[] = ['all', 'unpaid', 'partial', 'paid', 'disputed', 'cancelled'];
const EXTRA_CATEGORIES: SalesCategory[] = ['approval', 'rejected', 'unconfirmed'];

interface SalesRegisterProps {
  sales: InternationalSaleRecord[];
  loading: boolean;
  failed: boolean;
  canCreate: boolean;
  canFilterSellers?: boolean;
  onRetry: () => void;
}

/** Pure presentation used by component tests; no alternate live data path. */
export function InternationalSalesRegister({ sales, loading, failed, canCreate, canFilterSellers = true, onRetry }: SalesRegisterProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const copy = internationalSalesCopy[locale === 'en-GB' ? 'en' : 'fr'];
  const [filters, setFilters] = useState<SalesFilters>({ ...EMPTY_SALES_FILTERS });
  const [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [openActions, setOpenActions] = useState<string | null>(null);
  const actionContainer = useRef<HTMLDivElement>(null);
  const actionTrigger = useRef<HTMLButtonElement | null>(null);
  const actionPopover = useRef<HTMLDivElement>(null);
  const [actionPosition, setActionPosition] = useState({ left: 0, top: 0 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const weight = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const format = (value: number | null, precise = false) => value === null ? '—' : (precise ? weight : number).format(value);
  const currencyLabel = (value: string | null) => value === 'XOF' ? 'FCFA' : value || '—';
  const date = (value: string | null) => {
    if (!value) return copy.noShipment;
    const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? copy.noShipment : parsed.toLocaleDateString(locale);
  };
  const setFilter = <K extends keyof SalesFilters>(name: K, value: SalesFilters[K]) => {
    setFilters((current) => ({ ...current, [name]: value })); setPage(1); setOpenActions(null);
  };
  const reset = () => { setFilters({ ...EMPTY_SALES_FILTERS }); setPage(1); };
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== EMPTY_SALES_FILTERS[key as keyof SalesFilters]);
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);
  const filtered = useMemo(() => filterInternationalSales(sales, filters), [sales, filters]);
  const counts = useMemo(() => {
    const result: Record<SalesCategory, number> = { all: 0, unpaid: 0, partial: 0, paid: 0, disputed: 0, cancelled: 0, approval: 0, rejected: 0, unconfirmed: 0 };
    filterInternationalSales(sales, { ...filters, category: 'all' }).forEach((sale) => { result.all++; result[salesCategory(sale)]++; });
    return result;
  }, [sales, filters]);
  const categories = [...BASE_CATEGORIES, ...EXTRA_CATEGORIES.filter((item) => counts[item] || filters.category === item)];
  const customers = useMemo(() => [...new Map(sales.map((s) => [s.customer_id, s.customer?.name || copy.noCustomer])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], locale)), [sales, copy.noCustomer, locale]);
  const sellers = useMemo(() => [...new Map(sales.map((s) => [sellerKey(s), s.companyName || copy.noCompany])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], locale)), [sales, copy.noCompany, locale]);
  const currencies = [...new Set(sales.map(saleCurrency).filter((v): v is string => Boolean(v)))].sort();
  const currencyHeading = filters.currency ? currencyLabel(filters.currency) : currencies.length === 1 ? currencyLabel(currencies[0]) : copy.currency;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const visible = filtered.slice(offset, offset + pageSize);
  const setCurrentPage = (value: number) => { setPage(value); setOpenActions(null); };

  // Portal outside the horizontally scrolling table: even a single result must
  // not clip the action menu. Reposition on viewport/table scrolling.
  useLayoutEffect(() => {
    if (!openActions) return;
    const position = () => {
      if (!actionTrigger.current || !actionPopover.current) return;
      const anchor = actionTrigger.current.getBoundingClientRect();
      const menu = actionPopover.current.getBoundingClientRect();
      setActionPosition({
        left: Math.max(12, Math.min(anchor.right - menu.width, window.innerWidth - menu.width - 12)),
        top: anchor.bottom + menu.height + 6 <= window.innerHeight - 12
          ? anchor.bottom + 6 : Math.max(12, anchor.top - menu.height - 6),
      });
    };
    position();
    actionPopover.current?.querySelector('a')?.focus();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true); };
  }, [openActions]);

  useEffect(() => {
    if (!openActions) return;
    const close = (event: PointerEvent) => {
      if (!actionContainer.current?.contains(event.target as Node) && !actionPopover.current?.contains(event.target as Node)) setOpenActions(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpenActions(null); actionTrigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [openActions]);

  async function exportSales() {
    setExporting(true); setActionError('');
    try {
      await downloadExcelWorkbook([{ name: copy.allSales, rows: filtered.map((sale) => ({
        [copy.reference]: sale.sale_number, [copy.invoice]: sale.invoiceNumber,
        [copy.client]: sale.customer?.name ?? null, [copy.company]: sale.companyName,
        [copy.license]: sale.licenseNumber, [copy.shippingDate]: sale.shipmentDate?.slice(0, 10) ?? null,
        [`${copy.quantity} (g)`]: quantityGrams(sale), [copy.price]: pricePerGram(sale),
        [copy.total]: finiteAmount(sale.final_proceeds), [copy.paidAmount]: confirmedPaidAmount(sale),
        [copy.currency]: saleCurrency(sale), [copy.percentage]: paymentPercent(sale),
        [copy.status]: copy.singular[salesCategory(sale)], [copy.workflow]: copy.statuses[sale.status] || sale.status,
      })) }], `ventes-internationales-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { setActionError(copy.exportError); }
    finally { setExporting(false); }
  }
  async function copyReference(reference: string) {
    try { await navigator.clipboard.writeText(reference); setFeedback(copy.copied); }
    catch { setActionError(copy.copyError); }
    setOpenActions(null); actionTrigger.current?.focus();
  }

  return <div className="sn-page international-sales">
    <PageHeader title={copy.title} subtitle={copy.subtitle} icon={ShoppingCart}
      breadcrumb={[{ label: 'Vente internationale' }, { label: 'Ventes d’or internationales', to: '/sales' }, { label: copy.allSales }]}
      actions={<>
        <button className="sn-btn sn-btn--sm" type="button" disabled={loading || failed || !filtered.length || exporting} onClick={() => void exportSales()}>
          {exporting ? <Loader2 className="is-spinning" aria-hidden="true" /> : <Download aria-hidden="true" />}{copy.export}
        </button>
        {canCreate && <Link className="sn-btn sn-btn--primary sn-btn--sm" to="/sales/new"><Plus aria-hidden="true" />{copy.newSale}</Link>}
      </>} />
    <div className="international-sales__statuses" role="group" aria-label={copy.status}>
      {categories.map((category) => <button key={category} type="button" aria-pressed={filters.category === category}
        className={`international-sales__chip international-sales__tone--${category}${filters.category === category ? ' is-selected' : ''}`}
        onClick={() => { setFilter('category', category); }}>
        {copy[category]}{' '}<span>{loading || failed ? '—' : counts[category]}</span>
      </button>)}
    </div>
    <section className="international-sales__filters" aria-label={copy.filters}>
      <div className={`international-sales__filter-row${canFilterSellers ? '' : ' is-scoped'}`}>
        <label className="international-sales__search"><span className="sr-only">{copy.searchLabel}</span>
          <Search aria-hidden="true" /><input type="search" value={filters.search} placeholder={copy.search} onChange={(e) => { setFilter('search', e.target.value); }} />
        </label>
        <label className="international-sales__status-filter"><span>{copy.status}</span><div className="international-sales__select"><select value={filters.category} onChange={(e) => { setFilter('category', e.target.value as SalesCategory); }}>
          {[...BASE_CATEGORIES, ...EXTRA_CATEGORIES].map((item) => <option key={item} value={item}>{item === 'all' ? copy.allOptions : copy[item]}</option>)}
        </select><ChevronDown aria-hidden="true" /></div></label>
        <fieldset className="international-sales__dates"><legend>{copy.shippingDate}</legend><div>
          <input type="date" aria-label={copy.from} value={filters.from} max={filters.to || undefined} aria-invalid={invalidDates} onChange={(e) => { setFilter('from', e.target.value); }} />
          <ArrowRight aria-hidden="true" />
          <input type="date" aria-label={copy.to} value={filters.to} min={filters.from || undefined} aria-invalid={invalidDates} onChange={(e) => { setFilter('to', e.target.value); }} />
        </div></fieldset>
        <label><span>{copy.client}</span><div className="international-sales__select"><select value={filters.customer} onChange={(e) => { setFilter('customer', e.target.value); }}>
          <option value="">{copy.allOptions}</option>{customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select><ChevronDown aria-hidden="true" /></div></label>
        {canFilterSellers && <label><span>{copy.company}</span><div className="international-sales__select"><select value={filters.seller} onChange={(e) => { setFilter('seller', e.target.value); }}>
          <option value="">{copy.allOptions}</option>{sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select><ChevronDown aria-hidden="true" /></div></label>}
        <button type="button" className="sn-btn sn-btn--sm international-sales__filter-toggle" aria-expanded={advanced} aria-controls="international-sales-advanced" onClick={() => { setAdvanced((v) => !v); }}>
          <SlidersHorizontal aria-hidden="true" />{copy.filters}{(filters.currency || filters.workflow) && <span className="international-sales__filter-dot" />}
        </button>
      </div>
      {advanced && <div id="international-sales-advanced" className="international-sales__advanced">
        <label><span>{copy.currency}</span><select value={filters.currency} onChange={(e) => { setFilter('currency', e.target.value); }}>
          <option value="">{copy.allOptions}</option>{currencies.map((currency) => <option key={currency} value={currency}>{currencyLabel(currency)}</option>)}
        </select></label>
        <label><span>{copy.workflow}</span><select value={filters.workflow} onChange={(e) => { setFilter('workflow', e.target.value); }}>
          <option value="">{copy.allOptions}</option>{[...new Set(sales.map((s) => s.status))].sort().map((status) => <option key={status} value={status}>{copy.statuses[status] || status}</option>)}
        </select></label>
        <button className="sn-btn sn-btn--sm" type="button" onClick={reset} disabled={!hasFilters}><X aria-hidden="true" />{copy.reset}</button>
      </div>}
      {invalidDates && <p className="international-sales__validation" role="alert">{copy.invalidDates}</p>}
    </section>
    {actionError && <Note tone="danger" icon={AlertCircle}>{actionError}</Note>}
    <span className="sr-only" role="status">{feedback}</span>
    {hasFilters && !advanced && <div className="international-sales__active-filter"><span>{filtered.length} {copy.rows}</span><button type="button" onClick={reset}><X aria-hidden="true" />{copy.reset}</button></div>}
    {failed ? <div className="international-sales__error" role="alert"><AlertCircle aria-hidden="true" /><p>{copy.loadError}</p><button type="button" className="sn-btn sn-btn--sm" onClick={onRetry}>{copy.retry}</button></div>
      : <section className="international-sales__results" aria-label={copy.allSales} aria-busy={loading}>
        <div className="international-sales__table-scroll" role="region" aria-label={copy.allSales} tabIndex={0}>
          <table className="international-sales__table">
            <caption className="sr-only">{copy.allSales}. {copy.paymentHint}</caption>
            <colgroup>{[12, 13, 14, 10, 7, 8, 9, 9, 12, 6].map((w, i) => <col key={i} style={{ width: `${String(w)}%` }} />)}</colgroup>
            <thead><tr>
              <th scope="col">{copy.reference}</th><th scope="col">{copy.client}</th><th scope="col">{copy.company}</th><th scope="col">{copy.shippingDate}</th>
              <th scope="col" className="is-numeric">{copy.quantity}<small>({copy.grams})</small></th>
              <th scope="col" className="is-numeric">{copy.price}<small>({currencyHeading})</small></th>
              <th scope="col" className="is-numeric">{copy.total}<small>({currencyHeading})</small></th>
              <th scope="col" className="is-numeric" title={copy.paymentHint}>{copy.paidAmount}<small>({currencyHeading})</small></th>
              <th scope="col">{copy.status}</th><th scope="col">{copy.actions}</th>
            </tr></thead>
            <tbody>{loading ? Array.from({ length: 6 }, (_, i) => <tr key={i} className="international-sales__skeleton"><td colSpan={10}><span aria-hidden="true" />{i === 0 && <span className="sr-only">{copy.loading}</span>}</td></tr>)
              : visible.map((sale) => {
                const category = salesCategory(sale);
                const paid = confirmedPaidAmount(sale);
                const percent = paymentPercent(sale);
                const currency = currencyLabel(saleCurrency(sale));
                return <tr key={sale.id} className={`international-sales__tone--${category}`}>
                  <td><Link className="international-sales__reference" to={`/sales/${sale.id}`}>{sale.sale_number}</Link>
                    <span className="international-sales__secondary" title={sale.invoiceNumber || copy.noInvoice}>{sale.invoiceNumber || '—'}{sale.invoiceNumber && <FileText aria-label={copy.invoice} />}</span></td>
                  <td><strong className="international-sales__ellipsis" title={sale.customer?.name || copy.noCustomer}>{sale.customer?.name || copy.noCustomer}</strong>
                    <span className="international-sales__secondary"><Globe2 aria-hidden="true" />{sale.customer?.country || copy.noCountry}</span></td>
                  <td><strong className="international-sales__ellipsis" title={sale.companyName || copy.noCompany}>{sale.companyName || copy.noCompany}</strong>
                    {sale.licenseNumber ? <span className="international-sales__license" title={`${copy.license} ${sale.licenseNumber}`}>{copy.license} {sale.licenseNumber}</span>
                      : <span className="international-sales__secondary">{copy.noLicense}</span>}</td>
                  <td className={!sale.shipmentDate ? 'is-muted' : ''}>{date(sale.shipmentDate)}</td>
                  <td className="is-numeric"><strong>{format(quantityGrams(sale), true)}</strong><small>g</small></td>
                  <td className="is-numeric"><strong>{format(pricePerGram(sale), true)}</strong><small>{currency}</small></td>
                  <td className="is-numeric"><strong>{format(finiteAmount(sale.final_proceeds))}</strong><small>{currency}</small></td>
                  <td className="is-numeric" title={paid === null ? copy.unknownPayment : copy.paymentHint}><strong>{format(paid)}</strong>
                    <small>{currency}{percent !== null && <span className={`international-sales__percent ${percent >= 100 ? 'is-paid' : percent > 0 ? 'is-partial' : ''}`} aria-label={`${copy.percentage} : ${format(percent)} %`}>{format(percent)}%</span>}</small></td>
                  <td><span className="international-sales__badge" title={copy.statuses[sale.status] || sale.status}>{copy.singular[category]}</span>
                    {category === 'approval' && <small className="international-sales__workflow">{copy.statuses[sale.status] || sale.status}</small>}</td>
                  <td><div className="international-sales__row-actions" ref={openActions === sale.id ? actionContainer : undefined}>
                    <Link className="international-sales__icon-button" to={`/sales/${sale.id}`} aria-label={`${copy.details} ${sale.sale_number}`} title={copy.details}><Eye aria-hidden="true" /></Link>
                    <button type="button" className="international-sales__more" aria-label={`${copy.more} ${sale.sale_number}`} aria-expanded={openActions === sale.id}
                      aria-controls={openActions === sale.id ? `sale-actions-${sale.id}` : undefined}
                      onClick={(event) => { actionTrigger.current = event.currentTarget; setOpenActions(openActions === sale.id ? null : sale.id); }}><MoreVertical aria-hidden="true" /></button>
                    {openActions === sale.id && createPortal(<div ref={actionPopover} id={`sale-actions-${sale.id}`} className="international-sales__popover" style={actionPosition}>
                      <Link to={`/sales/${sale.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{copy.newTab}</Link>
                      <button type="button" onClick={() => void copyReference(sale.sale_number)}><Copy aria-hidden="true" />{copy.copy}</button>
                    </div>, document.body)}
                  </div></td>
                </tr>;
              })}</tbody>
          </table>
        </div>
        {!loading && !filtered.length && <EmptyState title={hasFilters ? copy.noResults : copy.empty} description={hasFilters ? copy.noResultsHint : copy.emptyHint} />}
      </section>}
    {!loading && !failed && <footer className="international-sales__pagination">
      <p aria-live="polite">{copy.range} {filtered.length ? offset + 1 : 0} {locale === 'fr-FR' ? 'à' : '–'} {Math.min(offset + pageSize, filtered.length)} {copy.on} {filtered.length} {filtered.length === 1 ? copy.row : copy.rows}</p>
      <nav aria-label="Pagination"><button type="button" disabled={currentPage === 1} onClick={() => { setCurrentPage(currentPage - 1); }} aria-label={copy.previous}><ChevronLeft aria-hidden="true" /></button>
        {salesPageNumbers(currentPage, totalPages).map((p) => typeof p === 'number'
          ? <button key={p} type="button" aria-label={`${copy.page} ${String(p)}`} aria-current={currentPage === p ? 'page' : undefined} onClick={() => { setCurrentPage(p); }}>{p}</button>
          : <span key={p} aria-hidden="true">…</span>)}
        <button type="button" disabled={currentPage === totalPages} onClick={() => { setCurrentPage(currentPage + 1); }} aria-label={copy.next}><ChevronRight aria-hidden="true" /></button>
      </nav>
      <div className="international-sales__select"><select aria-label={copy.pageSize} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); setOpenActions(null); }}>
        {[10, 25, 50].map((size) => <option key={size} value={size}>{size} {copy.perPage}</option>)}
      </select><ChevronDown aria-hidden="true" /></div>
    </footer>}
  </div>;
}

export function SalesDashboard() {
  const { user } = useAuth();
  // Scalars, not the profile object: an auth refresh must not reload the register.
  const scopeKey = [user?.id, user?.email, user?.role, user?.is_active, user?.mining_company_id, user?.organization_id,
    [...(user?.capabilities ?? [])].sort().join(','), [...(user?.module_codes ?? [])].sort().join(',')].join('|');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ scope: string; sales: InternationalSaleRecord[]; loading: boolean; failed: boolean }>({ scope: '', sales: [], loading: true, failed: false });
  const active = Boolean(user?.is_active);
  useEffect(() => {
    const controller = new AbortController();
    setState({ scope: scopeKey, sales: [], loading: active, failed: false });
    if (active) void listInternationalSales(controller.signal).then((sales) => {
      if (!controller.signal.aborted) setState({ scope: scopeKey, sales, loading: false, failed: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ scope: scopeKey, sales: [], loading: false, failed: true });
    });
    return () => { controller.abort(); };
  }, [scopeKey, active, retry]);
  const sameScope = state.scope === scopeKey;
  const canCreate = hasPermission(user, PERMISSIONS.SALES_CREATE)
    && (hasCapability(user, CAPABILITIES.SONASP_PREPARE) || hasCapability(user, CAPABILITIES.MINE_OPERATE));
  return <NationalDashboardLayout><InternationalSalesRegister key={scopeKey}
    sales={sameScope ? state.sales : []} loading={!sameScope || state.loading} failed={sameScope && state.failed}
    canCreate={canCreate} canFilterSellers={['owner', 'admin', 'management', 'manager'].includes(user?.role ?? '')}
    onRetry={() => { setRetry((v) => v + 1); }} /></NationalDashboardLayout>;
}
