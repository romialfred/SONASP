import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  CalendarDays,
  CheckCircle,
  Clock,
  FileText,
  MoreHorizontal,
  Package,
  Plane,
  Plus,
  RefreshCw,
  Scale,
  SlidersHorizontal,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader, Card, StatGrid, Badge, Field, DataTable, SearchInput, Note } from '@/components/ui/sn';
import { Button } from '@/components/ui/Button';
import { ActionErrorDialog } from '@/components/ui/ActionErrorDialog';
import { presentError } from '@/lib/presentError';
import './logistics-workspace.css';

export interface LogisticsRow {
  id: string;
  reference: string;
  company?: string | null;
  date?: string | null;
  shippedAt?: string | null;
  status: string;
  grams?: number | null;
  boxes?: number | null;
  tracking?: string | null;
  href: string;
}

type RegisterPresentation = 'register' | 'shipment-preparations';

interface LogisticsRegisterProps {
  title: string;
  subtitle: string;
  loadRows: () => Promise<LogisticsRow[]>;
  statuses: Record<string, string>;
  createPath: string;
  createLabel: string;
  canCreate?: boolean;
  readyStatus: string;
  pendingStatus: string;
  presentation?: RegisterPresentation;
}

const SHIPPED_FILTER = '__shipped__';
const READY_FILTER = '__ready__';
const WIDE_REGISTER_QUERY = '(min-width: 1700px)';

export const logisticsNumber = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const logisticsDate = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

export const logisticsDateParts = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) return { date: '—', time: '' };
  const parsed = new Date(value);
  return {
    date: parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

function rowMatchesStatus(row: LogisticsRow, status: string) {
  if (status === 'all') return true;
  if (status === SHIPPED_FILTER) return Boolean(row.shippedAt);
  if (status === READY_FILTER) return row.status === 'ready_for_expedition' && !row.shippedAt;
  return row.status === status;
}

export function filterLogisticsRows(
  rows: LogisticsRow[],
  search: string,
  status: string,
  company: string,
  start: string,
  end: string,
) {
  const term = search.trim().toLocaleLowerCase();
  return rows.filter(row => (!term || [row.reference, row.company, row.tracking].some(text => text?.toLocaleLowerCase().includes(term)))
    && rowMatchesStatus(row, status)
    && (!company || row.company === company)
    && (!start || Boolean(row.date && row.date.slice(0, 10) >= start))
    && (!end || Boolean(row.date && row.date.slice(0, 10) <= end)));
}

function useWideShipmentRegister() {
  const readQuery = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(WIDE_REGISTER_QUERY).matches;
  const [wide, setWide] = useState(readQuery);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(WIDE_REGISTER_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return wide;
}

function shipmentLabel(row: LogisticsRow, statuses: Record<string, string>) {
  return row.shippedAt ? 'Expédiée' : statuses[row.status] || row.status;
}

function shipmentTone(row: LogisticsRow, pendingStatus: string, readyStatus: string) {
  if (row.shippedAt || row.status === readyStatus) return 'success' as const;
  if (row.status === pendingStatus) return 'warning' as const;
  return 'info' as const;
}

function ShipmentActions({ row }: { row: LogisticsRow }) {
  return (
    <details className="shipment-row-menu">
      <summary aria-label={`Autres actions pour ${row.reference}`}><MoreHorizontal aria-hidden="true" /></summary>
      <div role="menu"><Link role="menuitem" to={row.href}>Voir le détail</Link></div>
    </details>
  );
}

function ShipmentStatus({ row, statuses, pendingStatus, readyStatus, includeDate = false }: {
  row: LogisticsRow;
  statuses: Record<string, string>;
  pendingStatus: string;
  readyStatus: string;
  includeDate?: boolean;
}) {
  const displayDate = logisticsDateParts(row.shippedAt || row.date);
  const Icon = row.shippedAt ? Plane : row.status === pendingStatus ? Clock : CheckCircle;
  return (
    <div className="shipment-status-cell">
      <span className="shipment-status-icon"><Icon aria-hidden="true" /></span>
      <span>
        <Badge tone={shipmentTone(row, pendingStatus, readyStatus)}>{shipmentLabel(row, statuses)}</Badge>
        {includeDate && <small>{displayDate.date}{displayDate.time ? ` à ${displayDate.time}` : ''}</small>}
      </span>
    </div>
  );
}

function ShipmentPreparationList({ rows, loading, title, statuses, pendingStatus, readyStatus, wide }: {
  rows: LogisticsRow[];
  loading: boolean;
  title: string;
  statuses: Record<string, string>;
  pendingStatus: string;
  readyStatus: string;
  wide: boolean;
}) {
  if (loading) return <div className="shipment-register-empty"><RefreshCw className="sn-spin" aria-hidden="true" /><strong>Chargement des expéditions…</strong></div>;
  if (!rows.length) return <div className="shipment-register-empty"><Package aria-hidden="true" /><strong>Aucune expédition ne correspond à ces filtres.</strong><span>Modifiez les filtres ou créez une nouvelle préparation d’expédition.</span></div>;

  if (wide) {
    return (
      <div className="shipment-table-wrap">
        <table className="shipment-table">
          <caption className="sr-only">{title}</caption>
          <thead><tr><th>Statut</th><th>Lot d’expédition</th><th>Société minière</th><th>N° de scellé</th><th className="is-numeric">Colis</th><th className="is-numeric">Poids net (g)</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>{rows.map(row => {
            const displayDate = logisticsDateParts(row.shippedAt || row.date);
            return <tr key={row.id}>
              <td><ShipmentStatus row={row} statuses={statuses} pendingStatus={pendingStatus} readyStatus={readyStatus} includeDate /></td>
              <td><Link className="shipment-reference" to={row.href}>{row.reference}</Link></td>
              <td className="shipment-company">{row.company || '—'}</td>
              <td className="shipment-mono">{row.tracking || '—'}</td>
              <td className="is-numeric shipment-mono">{logisticsNumber(row.boxes, 0)}</td>
              <td className="is-numeric shipment-weight">{logisticsNumber(row.grams)}</td>
              <td><span className="shipment-date"><strong>{displayDate.date}</strong>{displayDate.time && <small>{displayDate.time}</small>}</span></td>
              <td><span className="shipment-table-actions"><Link className="shipment-detail-link" to={row.href}>Voir le détail</Link><ShipmentActions row={row} /></span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="shipment-card-grid">
      {rows.map(row => {
        const displayDate = logisticsDateParts(row.shippedAt || row.date);
        return <article className="shipment-card" key={row.id}>
          <header>
            <ShipmentStatus row={row} statuses={statuses} pendingStatus={pendingStatus} readyStatus={readyStatus} />
            <ShipmentActions row={row} />
          </header>
          <div className="shipment-card-main">
            <span className="shipment-card-plane"><Plane aria-hidden="true" /></span>
            <div><Link className="shipment-reference" to={row.href}>{row.reference}</Link><p>{row.company || 'Société non renseignée'}</p></div>
          </div>
          <dl className="shipment-card-metrics">
            <div><dt><Box aria-hidden="true" />N° de scellé</dt><dd>{row.tracking || '—'}</dd></div>
            <div><dt><Package aria-hidden="true" />Colis</dt><dd>{logisticsNumber(row.boxes, 0)}</dd></div>
            <div><dt><Scale aria-hidden="true" />Poids net</dt><dd>{logisticsNumber(row.grams)}{row.grams != null && Number.isFinite(row.grams) ? ' g' : ''}</dd></div>
          </dl>
          <footer><span><CalendarDays aria-hidden="true" />{displayDate.date}{displayDate.time ? ` à ${displayDate.time}` : ''}</span><Link className="shipment-detail-link" to={row.href}>Voir le détail</Link></footer>
        </article>;
      })}
    </div>
  );
}

export function LogisticsRegister({
  title,
  subtitle,
  loadRows,
  statuses,
  createPath,
  createLabel,
  canCreate = true,
  readyStatus,
  pendingStatus,
  presentation = 'register',
}: LogisticsRegisterProps) {
  const [rows, setRows] = useState<LogisticsRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof presentError> | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [company, setCompany] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAll, setShowAll] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wideShipmentRegister = useWideShipmentRegister();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await loadRows());
      setError(null);
      setLoaded(true);
    } catch (reason) {
      setError(presentError(reason));
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  }, [loadRows]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, company, start, end, pageSize]);

  const filtered = useMemo(
    () => filterLogisticsRows(rows, search, status, company, start, end),
    [rows, search, status, company, start, end],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const weightKnown = rows.every(row => row.grams != null && Number.isFinite(row.grams));
  const stat = (value: number) => loaded ? value : '—';
  const resetFilters = () => { setSearch(''); setStatus('all'); setCompany(''); setStart(''); setEnd(''); };

  if (presentation === 'shipment-preparations') {
    const pendingCount = rows.filter(row => row.status === pendingStatus && !row.shippedAt).length;
    const readyCount = rows.filter(row => row.status === readyStatus && !row.shippedAt).length;
    const shippedCount = rows.filter(row => Boolean(row.shippedAt)).length;
    const displayedRows = showAll
      ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      : filtered.slice(0, 6);
    const filterTo = (nextStatus: string) => { setStatus(nextStatus); setShowAll(true); setFiltersOpen(true); };
    const toggleAll = () => {
      if (showAll) { resetFilters(); setFiltersOpen(false); }
      setShowAll(previous => !previous);
    };

    return <NationalDashboardLayout><div className="sn-page logistics-workspace shipment-preparations-page">
      <PageHeader title={title} subtitle={subtitle} icon={Package}
        actions={canCreate && <Link className="sn-btn sn-btn--primary shipment-create-link" to={createPath}><Plus size={17} />{createLabel}</Link>} />

      <section className="shipment-kpi-grid" aria-label="Synthèse des expéditions">
        <button type="button" className="shipment-kpi shipment-kpi--total" onClick={() => filterTo('all')}>
          <span><small>Total</small><strong>{stat(rows.length)}</strong><em>Expéditions</em></span><i><FileText aria-hidden="true" /></i>
        </button>
        <button type="button" className="shipment-kpi shipment-kpi--pending" onClick={() => filterTo(pendingStatus)}>
          <span><small>En attente</small><strong>{stat(pendingCount)}</strong><em>À traiter</em></span><i><Clock aria-hidden="true" /></i>
        </button>
        <button type="button" className="shipment-kpi shipment-kpi--ready" onClick={() => filterTo(READY_FILTER)}>
          <span><small>Préparées</small><strong>{stat(readyCount)}</strong><em>Prêtes à expédier</em></span><i><Box aria-hidden="true" /></i>
        </button>
        <button type="button" className="shipment-kpi shipment-kpi--shipped" onClick={() => filterTo(SHIPPED_FILTER)}>
          <span><small>Expédiées</small><strong>{stat(shippedCount)}</strong><em>Envois effectués</em></span><i><CheckCircle aria-hidden="true" /></i>
        </button>
        <article className="shipment-kpi shipment-kpi--weight">
          <span><small>Poids total</small><strong>{loaded && weightKnown ? logisticsNumber(rows.reduce((sum, row) => sum + (row.grams ?? 0), 0) / 1000) : '—'}{loaded && weightKnown && <b> kg</b>}</strong><em>{weightKnown ? 'Poids net enregistré' : 'Certains poids sont indisponibles'}</em></span><i><Scale aria-hidden="true" /></i>
        </article>
      </section>

      {error && <Note tone="danger">{error.title}. {loaded ? 'Les dossiers déjà chargés restent visibles.' : 'Impossible de charger les dossiers.'}</Note>}

      {showAll && filtersOpen && <Card className="logistics-filters shipment-filter-panel">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un lot, une société ou un numéro de scellé…" />
        <Field label="Statut"><select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">Tous les statuts</option>
          {Object.entries(statuses).filter(([key]) => key !== readyStatus).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          <option value={READY_FILTER}>Prête pour l’expédition</option><option value={SHIPPED_FILTER}>Expédiée</option>
        </select></Field>
        <Field label="Société"><select value={company} onChange={event => setCompany(event.target.value)}><option value="">Toutes les sociétés</option>{[...new Set(rows.map(row => row.company).filter(Boolean))].sort().map(name => <option key={name} value={name!}>{name}</option>)}</select></Field>
        <Field label="Du"><input type="date" value={start} max={end || undefined} onChange={event => setStart(event.target.value)} /></Field>
        <Field label="Au"><input type="date" value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} /></Field>
        <Button type="button" variant="outline" onClick={resetFilters}>Réinitialiser</Button>
      </Card>}

      <section className="shipment-register" aria-labelledby="shipment-register-title">
        <header><h3 id="shipment-register-title">{showAll ? 'Toutes les expéditions' : 'Expéditions récentes'}</h3><div>
          {showAll && <Button type="button" variant="outline" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} />Filtres</Button>}
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} aria-label="Actualiser les expéditions"><RefreshCw className={loading ? 'sn-spin' : ''} size={16} /></Button>
          <Button type="button" variant="outline" className="shipment-show-all" onClick={toggleAll}>{showAll ? 'Afficher les expéditions récentes' : 'Voir toutes les expéditions'}<ArrowRight size={16} /></Button>
        </div></header>
        {!loaded && !loading
          ? <div className="shipment-register-empty"><Package aria-hidden="true" /><strong>Données indisponibles</strong><Button type="button" variant="outline" onClick={() => void load()}>Réessayer</Button></div>
          : <ShipmentPreparationList rows={displayedRows} loading={!loaded && loading} title={title} statuses={statuses} pendingStatus={pendingStatus} readyStatus={readyStatus} wide={wideShipmentRegister} />}
        {showAll && loaded && <div className="logistics-pagination"><span>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} sur {filtered.length}</span>
          <Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédent</Button><span>Page {currentPage} sur {pages}</span>
          <Button type="button" variant="outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Suivant</Button>
          <select aria-label="Lignes par page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} / page</option>)}</select></div>}
      </section>

      <ActionErrorDialog isOpen={errorOpen} onClose={() => setErrorOpen(false)} title={error?.title} message={error?.message || ''} recovery={error?.recovery}
        diagnosticCode={error?.code} onAction={() => { setErrorOpen(false); void load(); }} actionLabel="Recharger les dossiers" />
    </div></NationalDashboardLayout>;
  }

  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title={title} subtitle={subtitle} icon={Package} breadcrumb={[{ label: 'Expéditions', to: '/shipping/preparation' }, { label: title }]}
      actions={<><Button type="button" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16} />{loading ? 'Chargement…' : 'Actualiser'}</Button>
        {canCreate && <Link className="sn-btn sn-btn--primary" to={createPath}><Plus size={16} />{createLabel}</Link>}</>} />
    <StatGrid sober ariaLabel="Synthèse des expéditions" items={[
      { label: 'Total des dossiers', value: stat(rows.length), icon: Package, onClick: () => setStatus('all') },
      { label: statuses[pendingStatus], value: stat(rows.filter(row => row.status === pendingStatus).length), icon: Clock, tone: 'gold', onClick: () => setStatus(pendingStatus) },
      { label: statuses[readyStatus], value: stat(rows.filter(row => row.status === readyStatus).length), icon: CheckCircle, onClick: () => setStatus(readyStatus) },
      { label: 'Poids d’or fin', value: loaded && weightKnown ? `${logisticsNumber(rows.reduce((sum, row) => sum + (row.grams ?? 0), 0) / 1000)} kg` : '—', icon: Scale,
        hint: !weightKnown ? 'Certains poids sont indisponibles' : 'Poids enregistré, hors volume expédié' },
    ]} />
    {error && <Note tone="danger">{error.title}. {loaded ? 'Les dossiers déjà chargés restent visibles.' : 'Impossible de charger les dossiers.'}</Note>}
    <Card className="logistics-filters"><SearchInput value={search} onChange={setSearch} placeholder="Rechercher une référence, une société ou un numéro de suivi…" />
      <Field label="Statut"><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tous les statuts</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Société"><select value={company} onChange={event => setCompany(event.target.value)}><option value="">Toutes les sociétés</option>{[...new Set(rows.map(row => row.company).filter(Boolean))].sort().map(name => <option key={name} value={name!}>{name}</option>)}</select></Field>
      <Field label="Du"><input type="date" value={start} max={end || undefined} onChange={event => setStart(event.target.value)} /></Field>
      <Field label="Au"><input type="date" value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} /></Field>
      <Button type="button" variant="outline" onClick={resetFilters}>Réinitialiser</Button>
    </Card>
    <Card title="Registre des expéditions" hint={loaded ? `${filtered.length} dossier${filtered.length > 1 ? 's' : ''} correspondant${filtered.length > 1 ? 's' : ''}` : 'Chargement des dossiers'}>
      {!loaded && !loading ? <div className="sn-empty"><p>Données indisponibles</p><Button type="button" variant="outline" onClick={() => void load()}>Réessayer</Button></div> :
        <DataTable caption={title} rows={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)} empty={loading ? 'Chargement des dossiers…' : 'Aucun dossier ne correspond à ces filtres.'} columns={[
          { key: 'reference', header: 'Référence', render: row => <Link className="logistics-reference" to={row.href}>{row.reference}</Link> },
          { key: 'company', header: 'Société minière' }, { key: 'date', header: 'Date', render: row => logisticsDate(row.date) },
          { key: 'grams', header: 'Or fin (g)', numeric: true, render: row => logisticsNumber(row.grams) },
          { key: 'boxes', header: 'Colis', numeric: true, render: row => logisticsNumber(row.boxes, 0) },
          { key: 'tracking', header: 'Scellé / LTA' },
          { key: 'status', header: 'Statut', render: row => <Badge tone={row.status === pendingStatus ? 'warning' : row.status === readyStatus ? 'success' : 'neutral'}>{statuses[row.status] || row.status}</Badge> },
          { key: 'actions', header: 'Détails', render: row => <Link className="logistics-open" aria-label={`Ouvrir ${row.reference}`} to={row.href}><ArrowRight size={18} /></Link> },
        ]} />}
      <div className="logistics-pagination"><span>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} sur {filtered.length}</span>
        <Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédent</Button><span>Page {currentPage} sur {pages}</span>
        <Button type="button" variant="outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Suivant</Button>
        <select aria-label="Lignes par page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} / page</option>)}</select></div>
    </Card>
    <ActionErrorDialog isOpen={errorOpen} onClose={() => setErrorOpen(false)} title={error?.title} message={error?.message || ''} recovery={error?.recovery}
      diagnosticCode={error?.code} onAction={() => { setErrorOpen(false); void load(); }} actionLabel="Recharger les dossiers" />
  </div></NationalDashboardLayout>;
}
