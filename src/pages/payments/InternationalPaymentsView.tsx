import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coins, Eye, Globe2, Layers3, MoreVertical, Plus, RefreshCw, Search, SlidersHorizontal, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, EmptyState, Note, PageHeader } from '@/components/ui/sn';
import type { InternationalPaymentRecord } from '@/services/internationalPaymentsListService';
import { salesPageNumbers } from '../sales/internationalSalesList';
import { EMPTY_PAYMENT_FILTERS, PAYMENT_LABELS, PAYMENT_TONES, calendarDate, filterPayments, paymentAmount, paymentCategory, paymentCurrency, paymentDate, paymentDays, paymentDueDate, paymentGroup, paymentMethod, paymentMoney, paymentSummary, paymentTotals, paymentTrend, sortPayments, type Grouping, type PaymentFilters, type PaymentSort } from './internationalPaymentsList';
import './payments.css';

export interface InternationalPaymentsViewProps {
  payments: InternationalPaymentRecord[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  canCreate: boolean;
  today: string;
  onRefresh: () => void;
  onOpenPayment: (id: string) => void;
  onOpenSale: (id: string) => void;
  onCreate: (saleId?: string) => void;
}

function Metric({ title, icon: Icon, tone, rows, hint, today, count = false, received = false, loading = false, unavailable = false }: {
  title: string; icon: LucideIcon; tone: string; rows: InternationalPaymentRecord[]; hint: string;
  today: string; count?: boolean; received?: boolean; loading?: boolean; unavailable?: boolean;
}) {
  const totals = paymentTotals(rows);
  const trend = paymentTrend(rows, today, received, count);
  const peak = Math.max(...trend, 1);
  const points = trend.map((value, i) => `${i * 17},${35 - value / peak * 28}`).join(' ');
  return <article className={`ip-list__metric ip-list__metric--${tone}`} aria-label={title}>
    <span className="ip-list__metric-icon"><Icon aria-hidden="true" /></span>
    <div className="ip-list__metric-copy"><h3>{title}</h3>
      {loading ? <span className="ip-list__placeholder" aria-label="Chargement" /> : unavailable ? <strong>—</strong> : count ? <strong>{rows.length}</strong>
        : totals.length ? totals.map((total) => <strong key={total.currency}>{paymentMoney(total.amount, total.currency)}</strong>)
          : <strong>—</strong>}
      <p>{loading ? 'Chargement…' : unavailable ? 'Données indisponibles' : hint}</p>
    </div>
    {!loading && !unavailable && trend.length > 0 && <svg className="ip-list__sparkline" viewBox="0 0 85 40" role="img" aria-label={`${title} : répartition mensuelle sur les six derniers mois`}>
      <title>{trend.map((value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)).join(' ; ')}{count ? ' règlements' : ` ${totals[0]?.currency}`}. {received ? 'Par mois de réception.' : 'Par mois d’échéance.'}</title>
      <polygon points={`0,40 ${points} 85,40`} /><polyline points={points} />
    </svg>}
  </article>;
}

export function InternationalPaymentsView({ payments, loading = false, refreshing = false, error, canCreate, today, onRefresh, onOpenPayment, onOpenSale, onCreate }: InternationalPaymentsViewProps) {
  const [filters, setFilters] = useState<PaymentFilters>({ ...EMPTY_PAYMENT_FILTERS });
  const [grouping, setGrouping] = useState<Grouping>('');
  const [sort, setSort] = useState<PaymentSort>('recent');
  const [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actions, setActions] = useState<InternationalPaymentRecord | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);
  const hasFilters = Object.values(filters).some(Boolean);
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);
  const filtered = useMemo(() => filterPayments(payments, filters, today), [payments, filters, today]);
  const ordered = useMemo(() => sortPayments(filtered, sort, grouping, today), [filtered, sort, grouping, today]);
  const summary = useMemo(() => paymentSummary(filtered, today), [filtered, today]);
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * pageSize;
  const visible = ordered.slice(offset, offset + pageSize);
  const options = useMemo(() => {
    const customers = new Map<string, string>();
    for (const payment of payments) if (payment.sale?.customer_id && payment.sale?.customer?.name) customers.set(payment.sale.customer_id, payment.sale.customer.name);
    const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'fr'));
    return { customers: [...customers].sort(([, a], [, b]) => a.localeCompare(b, 'fr')), currencies: unique(payments.map((p) => paymentCurrency(p.currency))), banks: unique(payments.map((p) => p.bank_name)), methods: unique(payments.map(paymentMethod)) };
  }, [payments]);
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const payment of filtered) { const key = paymentGroup(payment, grouping, today).key; counts.set(key, (counts.get(key) || 0) + 1); }
    return counts;
  }, [filtered, grouping, today]);
  function updateFilter<K extends keyof PaymentFilters>(key: K, value: PaymentFilters[K]) {
    setFilters((old) => ({ ...old, [key]: value })); setPage(1); setActions(null);
  }
  function reset() { setFilters({ ...EMPTY_PAYMENT_FILTERS }); setPage(1); setActions(null); }
  useEffect(() => {
    if (!actions) return;
    const close = (event: Event) => {
      if (!popover.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setActions(null);
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActions(null); trigger.current?.focus(); } };
    const leave = () => setActions(null);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', leave);
    window.addEventListener('scroll', leave, true);
    popover.current?.querySelector('button')?.focus();
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', keyboard); window.removeEventListener('resize', leave); window.removeEventListener('scroll', leave, true); };
  }, [actions]);
  const canPaySale = (p: InternationalPaymentRecord) => canCreate && p.sale?.seller_type === 'sonasp' && ['waiting_for_payment', 'virtual_payment'].includes(p.sale.status);
  return <div className="sn-page ip-list">
    <PageHeader icon={Wallet} title="Paiements clients" subtitle="Suivi des règlements attendus, encaissés et en retard."
      breadcrumb={[{ label: 'Vente internationale' }, { label: 'Ventes d’or internationales', to: '/sales' }, { label: 'Paiements clients' }]}
      actions={<><button type="button" className="sn-btn" disabled={loading || refreshing} onClick={onRefresh}><RefreshCw className={refreshing ? 'sn-spin' : ''} aria-hidden="true" />{refreshing ? 'Actualisation…' : 'Actualiser'}</button>
        {canCreate && <button type="button" className="sn-btn sn-btn--primary" onClick={() => onCreate()}><Plus aria-hidden="true" />Enregistrer un paiement</button>}</>} />
    <section className="ip-list__metrics" aria-label="Synthèse des paiements filtrés" aria-busy={loading || refreshing}>
      <Metric title="Total encaissé" icon={Wallet} tone="green" rows={summary.paid} today={today} received loading={loading} unavailable={Boolean(error)} hint={`${summary.paid.length} règlement(s) confirmé(s)`} />
      <Metric title="Total encaissable" icon={Clock3} tone="blue" rows={summary.receivable} today={today} loading={loading} unavailable={Boolean(error)} hint={`${summary.receivable.length} échéance(s) à recevoir`} />
      <Metric title="En attente" icon={Coins} tone="gold" rows={summary.processing} today={today} loading={loading} unavailable={Boolean(error)} hint={`${summary.processing.length} règlement(s) à confirmer`} />
      <Metric title="En retard" icon={AlertTriangle} tone="red" rows={summary.overdue} today={today} count loading={loading} unavailable={Boolean(error)} hint={summary.overdue.length ? 'Relances à engager' : 'Aucun retard constaté'} />
    </section>
    <section className="ip-list__filters" aria-label="Filtres des paiements">
      <div className="ip-list__filter-row">
        <label className="ip-list__search"><span className="sr-only">Rechercher un paiement</span><Search aria-hidden="true" /><input placeholder="Rechercher (facture, vente, client…)" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} /></label>
        <label className="ip-list__select"><span className="sr-only">Filtrer par statut</span><select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}><option value="">Tous les statuts</option>{Object.entries(PAYMENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown aria-hidden="true" /></label>
        <label className="ip-list__select"><span className="sr-only">Filtrer par période d’échéance</span><select value={filters.period} onChange={(e) => updateFilter('period', e.target.value)}><option value="">Toutes les périodes</option><option value="month">Échéances de ce mois</option><option value="upcoming">30 prochains jours</option><option value="30">30 derniers jours</option><option value="90">90 derniers jours</option><option value="365">12 derniers mois</option></select><ChevronDown aria-hidden="true" /></label>
        <div className="ip-list__date-range"><input type="date" aria-label="Échéance à partir du" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter('from', e.target.value)} /><ArrowRight aria-hidden="true" /><input type="date" aria-label="Échéance jusqu’au" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter('to', e.target.value)} /></div>
        <button type="button" className="sn-btn" aria-expanded={advanced} aria-controls="payments-advanced" onClick={() => setAdvanced(!advanced)}><SlidersHorizontal aria-hidden="true" />Filtres avancés{hasFilters && <span className="ip-list__filter-dot" />}</button>
      </div>
      {advanced && <div className="ip-list__advanced" id="payments-advanced">
        <label>Client<select value={filters.client} onChange={(e) => updateFilter('client', e.target.value)}><option value="">Tous les clients</option>{options.customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>Devise<select value={filters.currency} onChange={(e) => updateFilter('currency', e.target.value)}><option value="">Toutes les devises</option>{options.currencies.map((currency) => <option key={currency} value={currency}>{currency === 'XOF' ? 'FCFA (XOF)' : currency}</option>)}</select></label>
        <label>Banque<select value={filters.bank} onChange={(e) => updateFilter('bank', e.target.value)}><option value="">Toutes les banques</option>{options.banks.map((bank) => <option key={bank}>{bank}</option>)}</select></label>
        <label>Mode de paiement<select value={filters.method} onChange={(e) => updateFilter('method', e.target.value)}><option value="">Tous les modes</option>{options.methods.map((method) => <option key={method}>{method}</option>)}</select></label>
      </div>}
      {invalidDates && <p className="ip-list__validation" role="alert">La date de début doit précéder la date de fin.</p>}
    </section>
    <div className="ip-list__organize"><p aria-live="polite">{loading ? 'Chargement des règlements…' : error ? 'Registre indisponible' : `${filtered.length} règlement${filtered.length === 1 ? '' : 's'}`}{hasFilters && <button type="button" onClick={reset}><X aria-hidden="true" />Réinitialiser</button>}</p>
      <div><label><Layers3 aria-hidden="true" /><span>Regrouper par</span><select aria-label="Regrouper les paiements par" value={grouping} onChange={(e) => { setGrouping(e.target.value as Grouping); setPage(1); setActions(null); }}><option value="">Aucun regroupement</option><option value="client">Client</option><option value="status">Statut</option><option value="bank">Banque</option><option value="currency">Devise</option></select></label>
        <label><span>Trier par</span><select aria-label="Trier les paiements par" value={sort} onChange={(e) => { setSort(e.target.value as PaymentSort); setPage(1); }}><option value="recent">Plus récents</option><option value="due">Échéance croissante</option><option value="amount">Montant décroissant</option><option value="client">Client (A–Z)</option></select></label></div>
    </div>
    {error && <Note tone="danger" icon={AlertCircle}>{error} <button type="button" className="sn-btn sn-btn--sm" disabled={refreshing} onClick={onRefresh}>Réessayer</button></Note>}
    <section className="ip-list__results" aria-label="Registre des paiements" aria-busy={loading || refreshing}>
      <div className="ip-list__table-scroll" role="region" aria-label="Tableau des paiements" tabIndex={0}>
        <table className="ip-list__table"><caption className="sr-only">Règlements clients. Montants dans leur devise de règlement. Un paiement à confirmer n’est pas encore encaissé.</caption>
          <colgroup>{[10.5, 12.5, 16, 11, 12, 10, 13, 9, 6].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
          <thead><tr><th scope="col">Vente</th><th scope="col">Facture</th><th scope="col" aria-sort={sort === 'client' ? 'ascending' : 'none'}>Client</th><th scope="col" className="is-numeric" aria-sort={sort === 'amount' ? 'descending' : 'none'}>Montant</th><th scope="col" aria-sort={sort === 'due' ? 'ascending' : 'none'}>Échéance</th><th scope="col">Délai</th><th scope="col">Mode</th><th scope="col">Statut</th><th scope="col">Actions</th></tr></thead>
          <tbody>{loading ? Array.from({ length: 8 }, (_, index) => <tr key={index} className="ip-list__skeleton"><td colSpan={9}><span aria-hidden="true" /></td></tr>) : visible.map((payment, index) => {
            const category = paymentCategory(payment, today); const due = paymentDueDate(payment); const days = paymentDays(due, today);
            const pending = category === 'pending' || category === 'overdue';
            const group = paymentGroup(payment, grouping, today);
            const startGroup = grouping && (index === 0 || group.key !== paymentGroup(visible[index - 1], grouping, today).key);
            const received = calendarDate(payment.actual_date) || calendarDate(payment.approved_at);
            return <Fragment key={payment.id}>
              {startGroup && <tr className="ip-list__group"><th scope="rowgroup" colSpan={9}><Layers3 aria-hidden="true" />{group.label}<span>{groupCounts.get(group.key)} règlement(s) au total</span></th></tr>}
              <tr className={`ip-list__row ip-list__row--${category}`}>
                <td><button className="ip-list__reference" type="button" onClick={() => onOpenPayment(payment.id)}>{payment.sale?.sale_number || 'Vente non renseignée'}</button><small>{payment.is_virtual ? 'Échéance de vente' : 'Exportation'}</small></td>
                <td><strong className="ip-list__invoice">{payment.invoice_number || 'Non renseignée'}</strong></td>
                <td><strong>{payment.sale?.customer?.name || 'Client non renseigné'}</strong><small><Globe2 aria-hidden="true" />{payment.sale?.customer?.country || 'Pays non renseigné'}</small></td>
                <td className="is-numeric"><strong>{paymentMoney(paymentAmount(payment.amount), paymentCurrency(payment.currency))}</strong></td>
                <td><span className="ip-list__date"><CalendarDays aria-hidden="true" />{paymentDate(due)}</span>{pending && days !== null && <small className={days < 0 ? 'is-danger' : 'is-success'}>{days < 0 ? 'Échéance dépassée' : days === 0 ? 'Aujourd’hui' : `Dans ${days} jour${days > 1 ? 's' : ''}`}</small>}</td>
                <td>{category === 'paid' ? <><span className="ip-list__received"><CheckCircle2 aria-hidden="true" />Encaissé</span><small>{received ? paymentDate(received) : 'Date non renseignée'}</small></>
                  : category === 'processing' ? <><span>À rapprocher</span><small>Confirmation requise</small></> : pending && days !== null ? <><span className={days < 0 ? 'is-danger' : undefined}>{Math.abs(days)} jour{Math.abs(days) > 1 ? 's' : ''}</span><small className={days < 0 ? 'is-danger' : undefined}>{days < 0 ? 'de retard' : days === 0 ? 'Échoit aujourd’hui' : 'avant échéance'}</small></> : <span>—</span>}</td>
                <td><span>{payment.bank_name || 'Banque non renseignée'}</span><small>{paymentMethod(payment)}</small></td>
                <td><Badge tone={PAYMENT_TONES[category]}>{PAYMENT_LABELS[category]}</Badge></td>
                <td><div className="ip-list__actions"><button type="button" className="ip-list__eye" aria-label={`Voir le paiement ${payment.invoice_number || payment.sale?.sale_number || payment.id}`} onClick={() => onOpenPayment(payment.id)}><Eye aria-hidden="true" /></button>
                  <button type="button" aria-label={`Actions du paiement ${payment.invoice_number || payment.id}`} aria-expanded={actions?.id === payment.id} aria-controls={actions?.id === payment.id ? 'payment-row-actions' : undefined} onClick={(event) => { trigger.current = event.currentTarget; const rect = event.currentTarget.getBoundingClientRect(); setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 158)), left: Math.max(8, Math.min(rect.right - 225, window.innerWidth - 233)) }); setActions(actions?.id === payment.id ? null : payment); }}><MoreVertical aria-hidden="true" /></button></div></td>
              </tr>
            </Fragment>;
          })}</tbody>
        </table>
      </div>
      {!loading && !error && visible.length === 0 && <EmptyState title={hasFilters ? 'Aucun résultat' : 'Aucun paiement enregistré'} description={hasFilters ? 'Modifiez les filtres pour retrouver vos règlements.' : 'Les échéances et les versements de vos ventes apparaîtront ici.'} action={hasFilters ? <button type="button" className="sn-btn" onClick={reset}>Réinitialiser les filtres</button> : undefined} />}
      {!loading && !error && <footer className="ip-list__pagination"><p aria-live="polite">Affichage de {ordered.length ? offset + 1 : 0} à {Math.min(offset + pageSize, ordered.length)} sur {ordered.length} règlements</p>
        <nav aria-label="Pagination des paiements"><button type="button" aria-label="Page précédente" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setActions(null); }}><ChevronLeft aria-hidden="true" /></button>
          {salesPageNumbers(currentPage, pages).map((value) => typeof value === 'number' ? <button type="button" key={value} aria-label={`Page ${value}`} aria-current={value === currentPage ? 'page' : undefined} onClick={() => { setPage(value); setActions(null); }}>{value}</button> : <span key={value}>…</span>)}
          <button type="button" aria-label="Page suivante" disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); setActions(null); }}><ChevronRight aria-hidden="true" /></button></nav>
        <label className="ip-list__select"><span className="sr-only">Nombre de paiements par page</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); setActions(null); }}>{[10, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}</select><ChevronDown aria-hidden="true" /></label>
      </footer>}
    </section>
    {actions && createPortal(<div ref={popover} id="payment-row-actions" className="ip-list__popover" style={position} aria-label="Actions du paiement">
      <button type="button" onClick={() => { onOpenPayment(actions.id); setActions(null); }}><Eye aria-hidden="true" />Voir le paiement</button>
      {actions.sale && <button type="button" onClick={() => { onOpenSale(actions.sale_id); setActions(null); }}><ArrowRight aria-hidden="true" />Voir la vente</button>}
      {canPaySale(actions) && <button type="button" onClick={() => { onCreate(actions.sale_id); setActions(null); }}><Plus aria-hidden="true" />Enregistrer un versement</button>}
    </div>, document.body)}
  </div>;
}
