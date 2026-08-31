import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  Download, Eye, FileDown, Filter, Loader2, MoreHorizontal, PackageCheck,
  Pencil, Plus, Search, ShieldCheck, Truck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Note, PageHeader } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errorMessage';
import {
  reserveAllocationService,
  type ReserveAllocation,
  type ReserveAllocationStatus,
} from '@/services/reserveAllocationService';
import {
  formatDate, formatDateTime, formatDepositType, formatEur, formatFcfa, formatGrams, formatPercent, formatUsd,
  RESERVE_STATUS_LABELS, RESERVE_STATUS_TONES, RESERVE_WORKFLOW,
} from './reserveAllocationPresentation';
import './reserve-allocations.css';

type RegisterTab = 'all' | 'mine' | 'pending' | 'rejected';

const NEXT_STATUS: Partial<Record<ReserveAllocationStatus, ReserveAllocationStatus>> = {
  SUBMITTED: 'UNDER_REVIEW',
  UNDER_REVIEW: 'VALIDATED_LEVEL_1',
  VALIDATED_LEVEL_1: 'VALIDATED_LEVEL_2',
  VALIDATED_LEVEL_2: 'TRANSFER_AUTHORIZED',
  TRANSFER_AUTHORIZED: 'IN_TRANSIT',
  IN_TRANSIT: 'RECEIVED',
  RECEIVED: 'RECONCILIATION_PENDING',
  RECONCILIATION_PENDING: 'RECONCILED',
  RECONCILED: 'ACTIVE',
};

const NEXT_ACTION_LABEL: Partial<Record<ReserveAllocationStatus, string>> = {
  SUBMITTED: 'Prendre en contrôle',
  UNDER_REVIEW: 'Valider niveau 1',
  VALIDATED_LEVEL_1: 'Valider niveau 2',
  VALIDATED_LEVEL_2: 'Autoriser le transfert',
  TRANSFER_AUTHORIZED: 'Déclarer en transit',
  IN_TRANSIT: 'Confirmer la réception',
  RECEIVED: 'Ouvrir le rapprochement',
  RECONCILIATION_PENDING: 'Confirmer le rapprochement',
  RECONCILED: 'Activer la réserve',
};

const TARGET_CAPABILITY: Partial<Record<ReserveAllocationStatus, string>> = {
  UNDER_REVIEW: 'reserve.allocations.validate_level_1',
  VALIDATED_LEVEL_1: 'reserve.allocations.validate_level_1',
  VALIDATED_LEVEL_2: 'reserve.allocations.validate_level_2',
  TRANSFER_AUTHORIZED: 'reserve.allocations.authorize_transfer',
  IN_TRANSIT: 'reserve.allocations.authorize_transfer',
  RECEIVED: 'reserve.allocations.confirm_receipt',
  RECONCILIATION_PENDING: 'reserve.allocations.reconcile',
  RECONCILED: 'reserve.allocations.reconcile',
  ACTIVE: 'reserve.allocations.reconcile',
};

const terminalStatuses = new Set<ReserveAllocationStatus>(['ACTIVE', 'REJECTED', 'CANCELLED']);

function downloadCsv(rows: ReserveAllocation[]) {
  const cells = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ['Référence', 'Date', 'Lots', 'Lingots', 'Poids fin (g)', 'Valeur FCFA', 'Dépositaire', 'Statut'],
    ...rows.map((row) => [
      row.reference, row.allocation_date, row.lot_count, row.ingot_count, row.fine_weight_grams,
      row.indicative_value_fcfa, row.depository?.short_name || row.depository?.name || '', RESERVE_STATUS_LABELS[row.status],
    ]),
  ].map((line) => line.map(cells).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `affectations-reserve-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReserveAllocationsPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [allocations, setAllocations] = useState<ReserveAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(routeId || null);
  const [tab, setTab] = useState<RegisterTab>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [depository, setDepository] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [minimumFineWeight, setMinimumFineWeight] = useState('');
  const [page, setPage] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const pageSize = 10;

  const hasCapability = useCallback((capability: string) => (
    user?.role === 'owner' || Boolean(user?.capabilities?.includes(capability))
  ), [user?.capabilities, user?.role]);
  const canCreate = hasCapability('reserve.allocations.create');
  const canEdit = hasCapability('reserve.allocations.edit');

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setFailure(null);
    try {
      const rows = await reserveAllocationService.list();
      setAllocations(rows);
      setSelectedId((current) => {
        const requested = routeId || current;
        return requested && rows.some((row) => row.id === requested) ? requested : rows[0]?.id || null;
      });
    } catch (reason) {
      setFailure(errorMessage(reason, 'Impossible de charger les affectations à la réserve.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (routeId) setSelectedId(routeId); }, [routeId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    const minimum = Number(minimumFineWeight || 0);
    return allocations.filter((allocation) => {
      if (tab === 'mine' && allocation.created_by !== user?.id) return false;
      if (tab === 'pending' && !['SUBMITTED', 'UNDER_REVIEW', 'VALIDATED_LEVEL_1', 'VALIDATED_LEVEL_2'].includes(allocation.status)) return false;
      if (tab === 'rejected' && allocation.status !== 'REJECTED') return false;
      if (status !== 'all' && allocation.status !== status) return false;
      if (depository !== 'all' && allocation.depository_organization_id !== depository) return false;
      if (fromDate && allocation.allocation_date < fromDate) return false;
      if (toDate && allocation.allocation_date > toDate) return false;
      if (minimum > 0 && allocation.fine_weight_grams < minimum) return false;
      if (!query) return true;
      return [
        allocation.reference, allocation.decision_reference, allocation.depository?.name,
        allocation.depository?.short_name, ...allocation.items.map((item) => item.lot_reference),
      ].some((value) => value?.toLocaleLowerCase('fr').includes(query));
    });
  }, [allocations, depository, fromDate, minimumFineWeight, search, status, tab, toDate, user?.id]);

  useEffect(() => { setPage(1); }, [tab, search, status, depository, fromDate, toDate, minimumFineWeight]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = allocations.find((row) => row.id === selectedId) || null;
  const depositories = useMemo(() => [...new Map(
    allocations.filter((item) => item.depository).map((item) => [item.depository!.id, item.depository!]),
  ).values()], [allocations]);

  const kpis = useMemo(() => ({
    total: allocations.length,
    progress: allocations.filter((item) => ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VALIDATED_LEVEL_1', 'VALIDATED_LEVEL_2'].includes(item.status)).length,
    transit: allocations.filter((item) => ['TRANSFER_AUTHORIZED', 'IN_TRANSIT'].includes(item.status)).length,
    reception: allocations.filter((item) => ['RECEIVED', 'RECONCILIATION_PENDING', 'DISCREPANCY_REVIEW'].includes(item.status)).length,
    active: allocations.filter((item) => item.status === 'ACTIVE').length,
  }), [allocations]);

  const selectAllocation = (allocation: ReserveAllocation) => {
    setOpenMenuId(null);
    setSelectedId(allocation.id);
    navigate(`/national-reserve/allocations/${allocation.id}`, { replace: true });
  };

  const advanceWorkflow = async () => {
    if (!selected) return;
    const target = NEXT_STATUS[selected.status];
    if (!target) return;
    const capability = TARGET_CAPABILITY[target];
    if (!capability || !hasCapability(capability)) return;
    const note = window.prompt(`Commentaire pour « ${NEXT_ACTION_LABEL[selected.status]} » (facultatif) :`) || '';
    setTransitioning(true);
    try {
      await reserveAllocationService.transition(selected.id, target, note);
      addToast(`Workflow mis à jour : ${RESERVE_STATUS_LABELS[target]}.`, 'success');
      await load(true);
    } catch (reason) {
      addToast(errorMessage(reason, 'La transition a été refusée par le serveur.'), 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const cancelDraft = async (allocation: ReserveAllocation) => {
    setOpenMenuId(null);
    if (!window.confirm(`Annuler le brouillon « ${allocation.reference} » et libérer les lingots réservés ?`)) return;
    setTransitioning(true);
    try {
      await reserveAllocationService.transition(allocation.id, 'CANCELLED', 'Brouillon annulé depuis le registre.');
      addToast('Brouillon annulé ; les lingots sont de nouveau disponibles.', 'success');
      await load(true);
    } catch (reason) {
      addToast(errorMessage(reason, 'L’annulation a été refusée par le serveur.'), 'error');
    } finally {
      setTransitioning(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <main className="sn-page reserve-page reserve-register">
        <PageHeader
          title="Affectations à la réserve"
          subtitle="Suivi des opérations d’affectation des lingots depuis les stocks vers la réserve nationale d’or."
          breadcrumb={[{ label: 'Réserve nationale', to: '/inventory' }, { label: 'Affectations à la réserve' }]}
          actions={(
            <>
              <button type="button" className="sn-btn" disabled={filtered.length === 0} onClick={() => downloadCsv(filtered)}>
                <FileDown aria-hidden="true" /> Exporter
              </button>
              {canCreate && <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/national-reserve/allocations/new')}>
                <Plus aria-hidden="true" /> Nouvelle affectation
              </button>}
            </>
          )}
        />

        {failure && <Note tone="danger">{failure} <button type="button" className="sn-link-button" onClick={() => void load()}>Réessayer</button></Note>}

        <section className="reserve-kpis" aria-label="Indicateurs des affectations">
          {[
            { label: 'Total affectations', value: kpis.total, hint: 'Depuis le début du registre', icon: PackageCheck, tone: 'gold' },
            { label: 'En cours', value: kpis.progress, hint: 'En attente d’étape suivante', icon: Clock3, tone: 'blue' },
            { label: 'En transit', value: kpis.transit, hint: 'Transfert vers dépositaire', icon: Truck, tone: 'green' },
            { label: 'Réception en attente', value: kpis.reception, hint: 'À confirmer ou rapprocher', icon: Download, tone: 'gold' },
            { label: 'Affectées (actives)', value: kpis.active, hint: 'Entrées en réserve finalisées', icon: ShieldCheck, tone: 'green' },
          ].map(({ label, value, hint, icon: Icon, tone }) => (
            <article key={label} className={`reserve-kpi reserve-kpi--${tone}`}>
              <span><Icon aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{hint}</p></div>
            </article>
          ))}
        </section>

        <div className="reserve-register__layout">
          <section className="reserve-card reserve-register__main" aria-label="Registre des affectations">
            <div className="reserve-tabs" role="tablist" aria-label="Vues du registre">
              {[
                ['all', 'Toutes les affectations'], ['mine', 'Mes affectations'],
                ['pending', 'En attente de validation'], ['rejected', 'Affectations rejetées'],
              ].map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value as RegisterTab)}>{label}</button>
              ))}
            </div>

            <div className="reserve-filters">
              <label className="reserve-search"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher (réf., lot, dépositaire...)" aria-label="Rechercher une affectation" /></label>
              <label><span>Statut</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tous</option>{Object.entries(RESERVE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" /></label>
              <label><span>Dépositaire</span><select value={depository} onChange={(event) => setDepository(event.target.value)}><option value="all">Tous</option>{depositories.map((item) => <option key={item.id} value={item.id}>{item.short_name || item.name}</option>)}</select><ChevronDown aria-hidden="true" /></label>
              <label className="reserve-period"><span>Période</span><CalendarDays aria-hidden="true" /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Date de début" /><b>→</b><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Date de fin" /></label>
              <button type="button" className={`sn-btn${advanced ? ' is-active' : ''}`} aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><Filter aria-hidden="true" /> Filtres</button>
            </div>
            {advanced && (
              <div className="reserve-advanced">
                <label>Poids fin minimal (g)<input type="number" min="0" value={minimumFineWeight} onChange={(event) => setMinimumFineWeight(event.target.value)} /></label>
                <button type="button" className="sn-link-button" onClick={() => { setMinimumFineWeight(''); setFromDate(''); setToDate(''); setStatus('all'); setDepository('all'); }}>Réinitialiser les filtres</button>
              </div>
            )}

            <div className="reserve-table-wrap">
              <table className="reserve-table">
                <caption className="sr-only">Liste des affectations à la réserve nationale</caption>
                <thead><tr><th>Référence</th><th>Date d’affectation</th><th>Lots / Lingots</th><th>Poids fin (g)</th><th>Valeur indicative</th><th>Dépositaire</th><th>Statut</th><th>Étape actuelle</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleRows.map((allocation) => (
                    <tr key={allocation.id} className={selectedId === allocation.id ? 'is-selected' : ''} onClick={() => selectAllocation(allocation)}>
                      <td><strong>{allocation.reference}</strong></td>
                      <td>{formatDate(allocation.allocation_date)}</td>
                      <td>{allocation.lot_count} lot(s) / {allocation.ingot_count} lingot(s)</td>
                      <td className="is-num">{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(allocation.fine_weight_grams)}</td>
                      <td className="is-num">{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(allocation.indicative_value_fcfa)}</td>
                      <td>{allocation.depository?.short_name || allocation.depository?.name || 'À définir'}</td>
                      <td><Badge tone={RESERVE_STATUS_TONES[allocation.status]}>{RESERVE_STATUS_LABELS[allocation.status]}</Badge></td>
                      <td>{RESERVE_STATUS_LABELS[allocation.status]}</td>
                      <td><div className="reserve-row-actions">
                        <button type="button" aria-label={`Voir ${allocation.reference}`} onClick={(event) => { event.stopPropagation(); selectAllocation(allocation); }}><Eye aria-hidden="true" /></button>
                        {canEdit && allocation.status === 'DRAFT' && <button type="button" aria-label={`Modifier ${allocation.reference}`} onClick={(event) => { event.stopPropagation(); navigate(`/national-reserve/allocations/${allocation.id}/edit`); }}><Pencil aria-hidden="true" /></button>}
                        <button type="button" aria-label={`Plus d’actions pour ${allocation.reference}`} aria-haspopup="menu" aria-expanded={openMenuId === allocation.id} onClick={(event) => { event.stopPropagation(); setOpenMenuId((current) => current === allocation.id ? null : allocation.id); }}><MoreHorizontal aria-hidden="true" /></button>
                        {openMenuId === allocation.id && <div className="reserve-row-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" role="menuitem" onClick={() => selectAllocation(allocation)}><Eye aria-hidden="true" /> Ouvrir le détail</button>
                          <button type="button" role="menuitem" onClick={() => { downloadCsv([allocation]); setOpenMenuId(null); }}><FileDown aria-hidden="true" /> Exporter la ligne</button>
                          {canEdit && allocation.status === 'DRAFT' && <button type="button" role="menuitem" className="is-danger" disabled={transitioning} onClick={() => void cancelDraft(allocation)}><Clock3 aria-hidden="true" /> Annuler le brouillon</button>}
                        </div>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="reserve-empty"><Loader2 className="sn-spin" aria-hidden="true" /> Chargement des affectations…</div>}
              {!loading && visibleRows.length === 0 && <div className="reserve-empty">Aucune affectation ne correspond aux filtres.</div>}
            </div>
            <footer className="reserve-pagination">
              <span>Affichage {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} à {Math.min(page * pageSize, filtered.length)} sur {filtered.length} affectation(s)</span>
              <div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Page précédente"><ChevronLeft /></button><b>{page}</b><span>/ {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Page suivante"><ChevronRight /></button></div>
            </footer>
          </section>

          <aside className="reserve-detail" aria-label="Détails de l’affectation sélectionnée">
            <header><h3>Détails de l’affectation</h3><button type="button" onClick={() => void load(true)} aria-label="Actualiser les détails" disabled={refreshing}>{refreshing ? <Loader2 className="sn-spin" /> : <ChevronDown />}</button></header>
            {!selected ? <div className="reserve-empty">Sélectionnez une affectation.</div> : <>
              <div className="reserve-detail__identity"><strong>{selected.reference}</strong><Badge tone={RESERVE_STATUS_TONES[selected.status]}>{RESERVE_STATUS_LABELS[selected.status]}</Badge></div>
              <DetailGroup title="Informations générales" rows={[
                ['Date d’affectation', formatDate(selected.allocation_date)],
                ['Référence décision', selected.decision_reference || 'À renseigner'],
                ['Autorité décisionnelle', selected.decision_authority || 'À renseigner'],
                ['Motif', selected.reason || 'À renseigner'],
                ['Créé par', selected.creator_name],
              ]} />
              <DetailGroup title="Quantités" rows={[
                ['Nombre de lots', String(selected.lot_count)], ['Nombre de lingots', String(selected.ingot_count)],
                ['Poids brut total', formatGrams(selected.gross_weight_grams)], ['Pureté moyenne', formatPercent(selected.weighted_fineness)],
                ['Poids d’or fin total', formatGrams(selected.fine_weight_grams)], ['Valeur indicative', formatFcfa(selected.indicative_value_fcfa)],
                ['Valeur indicative (USD)', formatUsd(selected.indicative_value_usd)], ['Valeur indicative (EUR)', formatEur(selected.indicative_value_eur)],
                ['Source des cours', selected.valuation_source], ['Valorisée le', formatDateTime(selected.valuation_at)],
              ]} />
              <DetailGroup title="Dépositaire & destination" rows={[
                ['Dépositaire', selected.depository?.short_name || selected.depository?.name || 'À définir'],
                ['Type de dépôt', formatDepositType(selected.deposit_type)],
                ['Localisation', selected.depository?.address || selected.depository?.administrative_region || 'À définir'],
                ['Réf. dépôt prévue', selected.planned_deposit_reference || 'À renseigner'],
                ['Date prévue', formatDate(selected.planned_transfer_date)],
              ]} />
              {canEdit && selected.status === 'DRAFT' ? (
                <button type="button" className="sn-btn reserve-detail__button" onClick={() => navigate(`/national-reserve/allocations/${selected.id}/edit`)}><Pencil aria-hidden="true" /> Modifier le brouillon</button>
              ) : NEXT_STATUS[selected.status] && TARGET_CAPABILITY[NEXT_STATUS[selected.status]!] && hasCapability(TARGET_CAPABILITY[NEXT_STATUS[selected.status]!]!) ? (
                <button type="button" className="sn-btn sn-btn--primary reserve-detail__button" onClick={() => void advanceWorkflow()} disabled={transitioning}>
                  {transitioning ? <Loader2 className="sn-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{NEXT_ACTION_LABEL[selected.status]}
                </button>
              ) : null}
              <button type="button" className="sn-btn reserve-detail__button" onClick={() => document.querySelector('.reserve-workflow')?.scrollIntoView({ behavior: 'smooth' })}>Voir le détail complet <ChevronRight aria-hidden="true" /></button>
            </>}
          </aside>
        </div>

        {selected && (
          <section className="reserve-card reserve-workflow" aria-label="Processus d’affectation">
            <h3>Processus d’affectation</h3>
            <ol>
              {RESERVE_WORKFLOW.map((step, index) => {
                const event = selected.events.find((item) => item.status_to === step.status);
                const currentIndex = RESERVE_WORKFLOW.findIndex((item) => item.status === selected.status);
                const complete = Boolean(event) || (!terminalStatuses.has(selected.status) && currentIndex >= index);
                return <li key={step.status} className={complete ? 'is-complete' : ''}>
                  <span>{complete ? <CheckCircle2 aria-hidden="true" /> : index + 1}</span>
                  <strong>{step.label}</strong><small>{event ? formatDateTime(event.occurred_at) : 'En attente'}</small><small>{event?.actor_name || '—'}</small>
                </li>;
              })}
            </ol>
          </section>
        )}
      </main>
    </NationalDashboardLayout>
  );
}

function DetailGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <section className="reserve-detail__group"><h4>{title}</h4><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

export default ReserveAllocationsPage;
