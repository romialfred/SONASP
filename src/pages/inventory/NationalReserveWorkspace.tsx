import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coins,
  FileClock,
  Landmark,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  TrendingUp,
  Truck,
  Vault,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  Section,
  StatGrid,
  type Column,
} from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errorMessage';
import {
  loadNationalReserveSnapshot,
  type NationalReserveSnapshot,
  type ReserveAuditEntry,
  type ReservePhysicalAsset,
} from '@/services/nationalReserveDashboardService';
import type {
  ReserveAllocation,
  ReserveAllocationStatus,
} from '@/services/reserveAllocationService';
import {
  formatDate,
  formatDateTime,
  formatDepositType,
  formatEur,
  formatFcfa,
  formatGrams,
  formatPercent,
  formatUsd,
  RESERVE_STATUS_LABELS,
  RESERVE_STATUS_TONES,
  RESERVE_WORKFLOW,
} from './reserveAllocationPresentation';
import './national-reserve.css';

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 2 });

const EMPTY_SNAPSHOT: NationalReserveSnapshot = {
  allocations: [],
  activeAllocations: [],
  pendingControls: [],
  physicalAssets: [],
  auditEntries: [],
  depositories: [],
  trend: [],
  totalGrossWeightGrams: 0,
  totalFineWeightGrams: 0,
  totalLotCount: 0,
  totalIngotCount: 0,
  weightedFineness: 0,
  indicativeValueFcfa: 0,
  indicativeValueUsd: 0,
  indicativeValueEur: 0,
  latestValuationAt: null,
};

const formatKg = (grams: number) => `${decimal.format((grams || 0) / 1_000)} kg`;
const formatTonnes = (grams: number) => `${decimal.format((grams || 0) / 1_000_000)} t`;
const formatCompactFcfa = (value: number) => `${compact.format(value || 0)} FCFA`;

function useReserveSnapshot() {
  const [snapshot, setSnapshot] = useState<NationalReserveSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setFailure(null);
    try {
      setSnapshot(await loadNationalReserveSnapshot());
    } catch (reason) {
      setFailure(errorMessage(reason, 'Impossible de charger les données de la Réserve nationale.'));
      setSnapshot(EMPTY_SNAPSHOT);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { snapshot, loading, refreshing, failure, refresh: () => load(true) };
}

function ReservePageState({
  loading,
  failure,
  children,
}: {
  loading: boolean;
  failure: string | null;
  children: React.ReactNode;
}) {
  if (loading) {
    return <div className="reserve-workspace__loading"><Loader2 className="sn-spin" aria-hidden="true" /> Chargement des données patrimoniales…</div>;
  }
  return <>{failure && <Note tone="danger" icon={AlertTriangle}>{failure}</Note>}{children}</>;
}

function RefreshAction({ refreshing, onClick }: { refreshing: boolean; onClick: () => void }) {
  return (
    <button type="button" className="sn-btn" onClick={onClick} disabled={refreshing}>
      <RefreshCw className={refreshing ? 'sn-spin' : ''} aria-hidden="true" />
      Actualiser
    </button>
  );
}

function StatusBadge({ status }: { status: ReserveAllocationStatus }) {
  return <Badge tone={RESERVE_STATUS_TONES[status]}>{RESERVE_STATUS_LABELS[status]}</Badge>;
}

function ReserveTrend({ snapshot, mode = 'weight' }: { snapshot: NationalReserveSnapshot; mode?: 'weight' | 'value' }) {
  const points = snapshot.trend;
  const values = points.map((point) => mode === 'weight' ? point.fineWeightGrams : point.indicativeValueFcfa);
  const max = Math.max(...values, 0);
  const width = 720;
  const height = 210;
  const padding = 20;
  const x = (index: number) => padding + index * (width - padding * 2) / Math.max(points.length - 1, 1);
  const y = (value: number) => height - padding - (max > 0 ? value / max * (height - padding * 2) : 0);
  const path = points.map((point, index) => {
    const value = mode === 'weight' ? point.fineWeightGrams : point.indicativeValueFcfa;
    return `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`;
  }).join(' ');
  const insight = mode === 'weight'
    ? `${formatTonnes(snapshot.totalFineWeightGrams)} d’or fin actif`
    : `${formatCompactFcfa(snapshot.indicativeValueFcfa)} de valorisation enregistrée`;

  if (points.length === 0) {
    return <EmptyState title="Aucune évolution disponible" description="La courbe apparaîtra après l’activation de la première affectation." />;
  }

  return (
    <figure className="reserve-trend" aria-label={`Évolution de la réserve : ${insight}`}>
      <figcaption><strong>{insight}</strong><span>{points.length} jalon(s) d’activation</span></figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={insight}>
        <defs>
          <linearGradient id={`reserve-gradient-${mode}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c8a5f" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0c8a5f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1={padding} x2={width - padding} y1={height - padding - ratio * (height - padding * 2)} y2={height - padding - ratio * (height - padding * 2)} />)}
        <path className="reserve-trend__area" d={`${path} L ${x(points.length - 1)} ${height - padding} L ${x(0)} ${height - padding} Z`} fill={`url(#reserve-gradient-${mode})`} />
        <path className="reserve-trend__line" d={path} />
        {points.map((point, index) => {
          const value = mode === 'weight' ? point.fineWeightGrams : point.indicativeValueFcfa;
          return <circle key={`${point.date}-${index}`} cx={x(index)} cy={y(value)} r="4"><title>{formatDate(point.date)} · {mode === 'weight' ? formatKg(value) : formatFcfa(value)}</title></circle>;
        })}
      </svg>
      <div className="reserve-trend__axis"><span>{formatDate(points[0]?.date)}</span><span>{formatDate(points.at(-1)?.date)}</span></div>
    </figure>
  );
}

function DepositoryDistribution({ snapshot }: { snapshot: NationalReserveSnapshot }) {
  if (snapshot.depositories.length === 0) {
    return <EmptyState title="Aucun dépositaire actif" description="Aucune affectation active n’est encore rattachée à un dépositaire." />;
  }
  return (
    <div className="reserve-depositories">
      {snapshot.depositories.map((depository) => (
        <article key={depository.id}>
          <header><div><strong>{depository.name}</strong><small>{formatDepositType(depository.depositType)}</small></div><b>{decimal.format(depository.share)} %</b></header>
          <div className="reserve-progress" role="progressbar" aria-label={`Part déposée auprès de ${depository.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(depository.share)}><span style={{ width: `${Math.min(depository.share, 100)}%` }} /></div>
          <footer><span>{formatTonnes(depository.fineWeightGrams)}</span><span>{integer.format(depository.ingotCount)} lingot(s)</span></footer>
        </article>
      ))}
    </div>
  );
}

function WorkflowSummary({ allocations }: { allocations: ReserveAllocation[] }) {
  const counts = new Map<ReserveAllocationStatus, number>();
  allocations.forEach((allocation) => counts.set(allocation.status, (counts.get(allocation.status) || 0) + 1));
  return (
    <div className="reserve-workflow-summary">
      {RESERVE_WORKFLOW.map(({ status, label }, index) => (
        <div key={status} className={counts.get(status) ? 'is-populated' : undefined}>
          <span>{index + 1}</span>
          <strong>{label}</strong>
          <b>{counts.get(status) || 0}</b>
        </div>
      ))}
    </div>
  );
}

export function NationalReserveOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { snapshot, loading, refreshing, failure, refresh } = useReserveSnapshot();
  const canCreate = user?.role === 'owner' || user?.role === 'management';

  return (
    <NationalDashboardLayout>
      <main className="sn-page reserve-workspace">
        <PageHeader
          icon={Landmark}
          title="Réserve nationale"
          subtitle="Patrimoine aurifère souverain, affectations, conservation et contrôle."
          breadcrumb={[{ label: 'Réserve d’or du Burkina Faso' }, { label: 'Réserve nationale d’or' }, { label: 'Vue d’ensemble' }]}
          info={{ titre: 'Périmètre patrimonial', contenu: 'Seules les affectations arrivées à l’état actif sont comptées dans la réserve physique.' }}
          actions={<><RefreshAction refreshing={refreshing} onClick={refresh} />{canCreate && <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/national-reserve/allocations/new')}><Plus aria-hidden="true" /> Nouvelle affectation</button>}</>}
        />
        <ReservePageState loading={loading} failure={failure}>
          <StatGrid ariaLabel="Indicateurs de la Réserve nationale" items={[
            { label: 'Patrimoine d’or fin', value: formatTonnes(snapshot.totalFineWeightGrams), hint: formatGrams(snapshot.totalFineWeightGrams), icon: Coins, tone: 'gold' },
            { label: 'Valeur enregistrée', value: formatCompactFcfa(snapshot.indicativeValueFcfa), hint: formatDateTime(snapshot.latestValuationAt), icon: TrendingUp, tone: 'green' },
            { label: 'Pureté pondérée', value: formatPercent(snapshot.weightedFineness), hint: `${integer.format(snapshot.totalIngotCount)} lingot(s)`, icon: ShieldCheck, tone: 'green' },
            { label: 'Affectations actives', value: integer.format(snapshot.activeAllocations.length), hint: `${integer.format(snapshot.pendingControls.length)} contrôle(s) en attente`, icon: PackageCheck, tone: snapshot.pendingControls.length ? 'gold' : 'green' },
          ]} />

          <div className="reserve-workspace__overview-grid">
            <Section id="reserve-evolution" icon={BarChart3} title="Évolution du patrimoine" description="Cumul des affectations effectivement activées."><ReserveTrend snapshot={snapshot} /></Section>
            <Section id="reserve-depositories" icon={Vault} tone="slate" title="Répartition par dépositaire" description="Poids d’or fin réellement actif."><DepositoryDistribution snapshot={snapshot} /></Section>
          </div>

          <Section id="reserve-workflow" icon={Truck} tone="blue" title="Chaîne d’affectation" description="Vision consolidée des dossiers à chaque jalon serveur."><WorkflowSummary allocations={snapshot.allocations} /></Section>

          <div className="reserve-workspace__overview-grid reserve-workspace__overview-grid--balanced">
            <Section id="reserve-recent" icon={FileClock} title="Dernières affectations" description="Dossiers les plus récents, toutes étapes confondues.">
              <DataTable
                caption="Dernières affectations à la réserve"
                rows={snapshot.allocations.slice(0, 6)}
                columns={[
                  { key: 'reference', header: 'Référence', render: (row) => <strong>{row.reference}</strong> },
                  { key: 'allocation_date', header: 'Date', render: (row) => formatDate(row.allocation_date) },
                  { key: 'fine_weight_grams', header: 'Or fin', numeric: true, render: (row) => formatKg(row.fine_weight_grams) },
                  { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
                ]}
                onRowClick={(row) => navigate(`/national-reserve/allocations/${row.id}`)}
                empty="Aucune affectation enregistrée."
              />
              <button type="button" className="sn-btn reserve-workspace__section-action" onClick={() => navigate('/national-reserve/allocations')}>Voir le registre <ArrowRight aria-hidden="true" /></button>
            </Section>
            <Section id="reserve-integrity" icon={ShieldCheck} tone={snapshot.pendingControls.length ? 'amber' : 'emerald'} title="Conformité et contrôle" description="Synthèse des contrôles encore nécessaires.">
              <div className="reserve-integrity">
                <article><span><CheckCircle2 aria-hidden="true" /></span><div><strong>{snapshot.activeAllocations.length}</strong><small>Affectation(s) active(s)</small></div></article>
                <article><span><ClipboardCheck aria-hidden="true" /></span><div><strong>{snapshot.pendingControls.length}</strong><small>Contrôle(s) ou rapprochement(s)</small></div></article>
                <article><span><AlertTriangle aria-hidden="true" /></span><div><strong>{snapshot.allocations.filter((item) => item.status === 'DISCREPANCY_REVIEW').length}</strong><small>Écart(s) à analyser</small></div></article>
              </div>
              <button type="button" className="sn-btn reserve-workspace__section-action" onClick={() => navigate('/national-reserve/controls')}>Ouvrir les contrôles <ArrowRight aria-hidden="true" /></button>
            </Section>
          </div>
        </ReservePageState>
      </main>
    </NationalDashboardLayout>
  );
}

export function ReservePhysicalPage() {
  const { snapshot, loading, refreshing, failure, refresh } = useReserveSnapshot();
  const columns: Column<ReservePhysicalAsset>[] = [
    { key: 'lot_reference', header: 'Lot / lingot', render: (row) => <div className="reserve-cell-stack"><strong>{row.lot_reference}</strong><small>{row.certificate_number || 'Sans certificat renseigné'}</small></div> },
    { key: 'depositoryName', header: 'Dépositaire', render: (row) => <div className="reserve-cell-stack"><strong>{row.depositoryName}</strong><small>{formatDepositType(row.depositType)}</small></div> },
    { key: 'gross_weight_grams', header: 'Poids brut', numeric: true, render: (row) => formatGrams(row.gross_weight_grams) },
    { key: 'fine_weight_grams', header: 'Poids fin', numeric: true, render: (row) => formatGrams(row.fine_weight_grams) },
    { key: 'fineness_percentage', header: 'Pureté', numeric: true, render: (row) => formatPercent(row.fineness_percentage) },
    { key: 'allocationReference', header: 'Affectation', render: (row) => row.allocationReference },
  ];
  return (
    <NationalDashboardLayout><main className="sn-page reserve-workspace">
      <PageHeader icon={Vault} title="Réserve physique" subtitle="Actifs effectivement rapprochés et activés dans le patrimoine national." breadcrumb={[{ label: 'Réserve d’or du Burkina Faso' }, { label: 'Réserve nationale d’or', to: '/national-reserve' }, { label: 'Réserve physique' }]} actions={<RefreshAction refreshing={refreshing} onClick={refresh} />} />
      <ReservePageState loading={loading} failure={failure}>
        <StatGrid ariaLabel="Position physique de la réserve" items={[
          { label: 'Quantité d’or fin', value: formatTonnes(snapshot.totalFineWeightGrams), hint: formatKg(snapshot.totalFineWeightGrams), icon: Coins, tone: 'gold' },
          { label: 'Nombre de lingots', value: integer.format(snapshot.totalIngotCount), hint: `${integer.format(snapshot.totalLotCount)} lot(s)`, icon: Boxes, tone: 'blue' },
          { label: 'Pureté moyenne', value: formatPercent(snapshot.weightedFineness), hint: 'Pondérée par le poids brut', icon: ShieldCheck, tone: 'green' },
          { label: 'Dépositaires', value: integer.format(snapshot.depositories.length), hint: 'Périmètre actif', icon: Landmark, tone: 'neutral' },
        ]} />
        <div className="reserve-workspace__overview-grid reserve-workspace__overview-grid--physical">
          <Section id="physical-depositories" icon={Landmark} title="Position par dépositaire" description="Répartition contrôlée de l’or fin actif."><DepositoryDistribution snapshot={snapshot} /></Section>
          <Section id="physical-quality" icon={Scale} tone="blue" title="Bilan matière" description="Le poids fin ne peut dépasser le poids brut.">
            <dl className="reserve-balance-sheet"><div><dt>Poids brut actif</dt><dd>{formatKg(snapshot.totalGrossWeightGrams)}</dd></div><div><dt>Poids d’or fin</dt><dd>{formatKg(snapshot.totalFineWeightGrams)}</dd></div><div><dt>Écart matière</dt><dd>{formatKg(Math.max(snapshot.totalGrossWeightGrams - snapshot.totalFineWeightGrams, 0))}</dd></div><div><dt>Rendement fin</dt><dd>{formatPercent(snapshot.totalGrossWeightGrams > 0 ? snapshot.totalFineWeightGrams / snapshot.totalGrossWeightGrams * 100 : 0)}</dd></div></dl>
          </Section>
        </div>
        <Section id="physical-assets" icon={Boxes} tone="slate" title={`Registre des actifs (${snapshot.physicalAssets.length})`} description="Lots rattachés aux seules affectations actives."><DataTable columns={columns} rows={snapshot.physicalAssets} caption="Actifs physiques de la Réserve nationale" empty="Aucun actif n’a encore atteint l’état actif." /></Section>
      </ReservePageState>
    </main></NationalDashboardLayout>
  );
}

export function ReserveControlsPage() {
  const navigate = useNavigate();
  const { snapshot, loading, refreshing, failure, refresh } = useReserveSnapshot();
  return (
    <NationalDashboardLayout><main className="sn-page reserve-workspace">
      <PageHeader icon={ClipboardCheck} title="Contrôles et rapprochements" subtitle="Réceptions, écarts et rapprochements nécessitant une décision indépendante." breadcrumb={[{ label: 'Réserve d’or du Burkina Faso' }, { label: 'Réserve nationale d’or', to: '/national-reserve' }, { label: 'Contrôles et rapprochements' }]} actions={<RefreshAction refreshing={refreshing} onClick={refresh} />} />
      <ReservePageState loading={loading} failure={failure}>
        <StatGrid ariaLabel="État des contrôles" sober items={[
          { label: 'Réceptions à confirmer', value: snapshot.allocations.filter((item) => item.status === 'RECEIVED').length, icon: PackageCheck, tone: 'gold' },
          { label: 'Rapprochements', value: snapshot.allocations.filter((item) => item.status === 'RECONCILIATION_PENDING').length, icon: Scale, tone: 'blue' },
          { label: 'Écarts à analyser', value: snapshot.allocations.filter((item) => item.status === 'DISCREPANCY_REVIEW').length, icon: AlertTriangle, tone: 'red' },
          { label: 'Dossiers actifs', value: snapshot.activeAllocations.length, icon: CheckCircle2, tone: 'green' },
        ]} />
        <Section id="control-workflow" icon={ShieldCheck} tone="blue" title="Séparation des contrôles" description="Préparation, transfert, réception, rapprochement et activation sont des responsabilités distinctes."><WorkflowSummary allocations={snapshot.allocations} /></Section>
        <Section id="control-queue" icon={Clock3} tone={snapshot.pendingControls.length ? 'amber' : 'emerald'} title={`File de contrôle (${snapshot.pendingControls.length})`} description="Les transitions sont validées atomiquement par le serveur.">
          <DataTable
            caption="Affectations en attente de contrôle"
            rows={snapshot.pendingControls}
            columns={[
              { key: 'reference', header: 'Référence', render: (row) => <strong>{row.reference}</strong> },
              { key: 'depository', header: 'Dépositaire', render: (row) => row.depository?.short_name || row.depository?.name || 'À définir' },
              { key: 'fine_weight_grams', header: 'Or fin', numeric: true, render: (row) => formatKg(row.fine_weight_grams) },
              { key: 'planned_transfer_date', header: 'Transfert prévu', render: (row) => formatDate(row.planned_transfer_date) },
              { key: 'status', header: 'Étape', render: (row) => <StatusBadge status={row.status} /> },
            ]}
            onRowClick={(row) => navigate(`/national-reserve/allocations/${row.id}`)}
            empty="Aucun contrôle en attente."
          />
        </Section>
      </ReservePageState>
    </main></NationalDashboardLayout>
  );
}

export function ReserveValuationPage() {
  const { snapshot, loading, refreshing, failure, refresh } = useReserveSnapshot();
  return (
    <NationalDashboardLayout><main className="sn-page reserve-workspace">
      <PageHeader icon={TrendingUp} title="Valorisation et analyse" subtitle="Valeurs de référence enregistrées lors de chaque affectation active." breadcrumb={[{ label: 'Réserve d’or du Burkina Faso' }, { label: 'Réserve nationale d’or', to: '/national-reserve' }, { label: 'Valorisation et analyse' }]} actions={<RefreshAction refreshing={refreshing} onClick={refresh} />} info={{ titre: 'Méthode', contenu: 'Cette page agrège les valorisations horodatées et leurs sources. Elle ne remplace pas une réévaluation comptable au cours courant.' }} />
      <ReservePageState loading={loading} failure={failure}>
        <Note tone="info" icon={ShieldCheck}>Les valeurs sont calculées à partir des cours et taux de change horodatés dans chaque affectation, sans réécriture rétroactive.</Note>
        <StatGrid ariaLabel="Valorisation enregistrée de la réserve" items={[
          { label: 'Valeur en FCFA', value: formatCompactFcfa(snapshot.indicativeValueFcfa), hint: formatDateTime(snapshot.latestValuationAt), icon: Coins, tone: 'green' },
          { label: 'Valeur en USD', value: formatUsd(snapshot.indicativeValueUsd), hint: 'Cumul des affectations actives', icon: TrendingUp, tone: 'blue' },
          { label: 'Valeur en EUR', value: formatEur(snapshot.indicativeValueEur), hint: 'Cumul des affectations actives', icon: BarChart3, tone: 'violet' },
          { label: 'Valeur moyenne / g fin', value: snapshot.totalFineWeightGrams > 0 ? formatFcfa(snapshot.indicativeValueFcfa / snapshot.totalFineWeightGrams) : '—', hint: 'Valeur pondérée enregistrée', icon: Scale, tone: 'gold' },
        ]} />
        <div className="reserve-workspace__overview-grid">
          <Section id="valuation-trend" icon={TrendingUp} title="Évolution de la valeur enregistrée" description="Cumul chronologique des affectations actives."><ReserveTrend snapshot={snapshot} mode="value" /></Section>
          <Section id="valuation-breakdown" icon={Landmark} tone="slate" title="Valorisation par dépositaire" description="Répartition sur la valeur indicative historique.">
            {snapshot.depositories.length === 0 ? <EmptyState title="Aucune valorisation disponible" /> : <div className="reserve-valuation-list">{snapshot.depositories.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{formatTonnes(item.fineWeightGrams)} d’or fin</small></div><b>{formatCompactFcfa(item.indicativeValueFcfa)}</b></article>)}</div>}
          </Section>
        </div>
      </ReservePageState>
    </main></NationalDashboardLayout>
  );
}

export function ReserveAuditPage() {
  const { snapshot, loading, refreshing, failure, refresh } = useReserveSnapshot();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr');
    if (!normalized) return snapshot.auditEntries;
    return snapshot.auditEntries.filter((entry) => [
      entry.allocationReference,
      entry.actor_name,
      entry.actor_role,
      entry.event_type,
      entry.comment,
      RESERVE_STATUS_LABELS[entry.status_to],
    ].some((value) => String(value || '').toLocaleLowerCase('fr').includes(normalized)));
  }, [query, snapshot.auditEntries]);
  type ReserveAuditTableRow = Omit<ReserveAuditEntry, 'id'> & { id: string };
  const tableRows = useMemo<ReserveAuditTableRow[]>(
    () => filtered.map((entry) => ({ ...entry, id: String(entry.id) })),
    [filtered],
  );
  const columns: Column<ReserveAuditTableRow>[] = [
    { key: 'occurred_at', header: 'Date / heure', render: (row) => formatDateTime(row.occurred_at) },
    { key: 'actor_name', header: 'Utilisateur', render: (row) => <div className="reserve-cell-stack"><strong>{row.actor_name}</strong><small>{row.actor_role || 'Système'}</small></div> },
    { key: 'event_type', header: 'Action', render: (row) => row.event_type.replaceAll('_', ' ') },
    { key: 'allocationReference', header: 'Référence', render: (row) => <strong>{row.allocationReference}</strong> },
    { key: 'status_to', header: 'Nouvel état', render: (row) => <StatusBadge status={row.status_to} /> },
    { key: 'comment', header: 'Commentaire', render: (row) => row.comment || '—' },
  ];
  return (
    <NationalDashboardLayout><main className="sn-page reserve-workspace">
      <PageHeader icon={FileClock} title="Rapports et audit" subtitle="Journal métier des affectations et de leurs transitions d’état." breadcrumb={[{ label: 'Réserve d’or du Burkina Faso' }, { label: 'Réserve nationale d’or', to: '/national-reserve' }, { label: 'Rapports et audit' }]} actions={<RefreshAction refreshing={refreshing} onClick={refresh} />} />
      <ReservePageState loading={loading} failure={failure}>
        <StatGrid ariaLabel="Indicateurs du journal" sober items={[
          { label: 'Événements', value: snapshot.auditEntries.length, icon: FileClock, tone: 'neutral' },
          { label: 'Transitions réussies', value: snapshot.auditEntries.filter((entry) => entry.status_from !== entry.status_to).length, icon: CheckCircle2, tone: 'green' },
          { label: 'Acteurs distincts', value: new Set(snapshot.auditEntries.map((entry) => entry.actor_id).filter(Boolean)).size, icon: ShieldCheck, tone: 'blue' },
          { label: 'Dossiers tracés', value: new Set(snapshot.auditEntries.map((entry) => entry.allocation_id)).size, icon: ClipboardCheck, tone: 'gold' },
        ]} />
        <Section id="reserve-audit-log" icon={FileClock} tone="slate" title="Journal des événements" description="Chaque ligne provient du registre serveur des affectations.">
          <label className="reserve-audit-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, utilisateur, action ou statut…" aria-label="Rechercher dans le journal" /></label>
          <DataTable columns={columns} rows={tableRows} caption="Journal d’audit de la Réserve nationale" empty="Aucun événement ne correspond à la recherche." />
        </Section>
      </ReservePageState>
    </main></NationalDashboardLayout>
  );
}
