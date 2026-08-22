import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  ChevronDown,
  Check,
  ClipboardCheck,
  FileCheck2,
  FileSignature,
  FlaskConical,
  FolderOpen,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
  UserRound,
  WalletCards,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMinePortalAccess } from '@/components/auth/MinePortalGuard';
import { Loading } from '@/components/ui/Loading';
import { cn } from '@/utils/cn';
import {
  MinePortalDataError,
  minePortalService,
  type MinePortalCompany,
  type MinePortalDocument,
  type MinePortalPayment,
  type MinePortalRequest,
  type MinePortalSnapshot,
  type MinePaymentDecision,
  type MineRequestDecision,
} from '@/services/minePortalService';
import './mine-portal.css';

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

type PortalSection =
  | 'tableau-de-bord'
  | 'previsions'
  | 'production'
  | 'demandes'
  | 'contrats'
  | 'finances'
  | 'documents'
  | 'notifications'
  | 'historique'
  | 'compte';

type PortalNavigationItem = {
  id: PortalSection;
  label: string;
  icon: LucideIcon;
};

const portalNavigation: PortalNavigationItem[] = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'previsions', label: 'Budgets et prévisions', icon: TrendingUp },
  { id: 'production', label: 'Production journalière', icon: BarChart3 },
  { id: 'demandes', label: 'Demandes de la SONASP', icon: ClipboardCheck },
  { id: 'contrats', label: 'Contrats', icon: FileSignature },
  { id: 'finances', label: 'Factures et paiements', icon: WalletCards },
  { id: 'documents', label: 'Documents et justificatifs', icon: FolderOpen },
  { id: 'notifications', label: 'Alertes', icon: Bell },
  { id: 'historique', label: 'Historique', icon: History },
  { id: 'compte', label: 'Mon compte', icon: UserRound },
];

const validSections = new Set<PortalSection>(portalNavigation.map((item) => item.id));

function formatDate(value: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date non renseignée'
    : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    actif: 'Actif', signe: 'Signé', suspendu: 'Suspendu', echu: 'Échu', cloture: 'Clôturé',
    soumise: 'Soumise', envoyee: 'Envoyée', acceptee: 'Acceptée', approuvee: 'Approuvée', rejetee: 'Rejetée',
    emise: 'Émise', partiellement_payee: 'Partiellement payée', payee: 'Payée', en_retard: 'En retard',
    execute: 'Exécuté', rapproche: 'Rapproché', en_attente: 'En attente', analysee: 'Analysée', tranchee: 'Tranchée',
    notifiee: 'Notifiée', accusee: 'Accusée', en_execution: 'En exécution', executee: 'Exécutée',
    prepared: 'Préparée', ready_for_customs: 'Prête à expédier', shipped: 'Expédiée', cancelled: 'Annulée',
    a_confirmer: 'À confirmer', confirmee: 'Réception confirmée', contestee: 'Contestée', non_requise: 'Sans confirmation',
  };
  return labels[value] || value.split('_').join(' ');
}

function sectionFromPath(pathname: string): PortalSection {
  const candidate = pathname.replace(/^\/portail-mine\/?/, '').split('/')[0] as PortalSection;
  return validSections.has(candidate) ? candidate : 'tableau-de-bord';
}

function portalPath(section: PortalSection, companyId: string, ownerMode: boolean): string {
  const pathname = section === 'tableau-de-bord' ? '/portail-mine' : `/portail-mine/${section}`;
  return ownerMode ? `${pathname}?mine=${encodeURIComponent(companyId)}` : pathname;
}

export default function MinePortalPage() {
  const { companyId, canChooseCompany, user } = useMinePortalAccess();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const currentNavigation = portalNavigation.find((item) => item.id === section) || portalNavigation[0];
  const [companies, setCompanies] = useState<MinePortalCompany[]>([]);
  const [data, setData] = useState<MinePortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [snapshot, availableCompanies] = await Promise.all([
        silent
          ? minePortalService.load(companyId, { force: true })
          : minePortalService.load(companyId),
        canChooseCompany ? minePortalService.listCompanies() : Promise.resolve([]),
      ]);

      if (canChooseCompany && !availableCompanies.some((company) => company.id === companyId)) {
        throw new MinePortalDataError('Cette société minière est introuvable, inactive ou non autorisée.');
      }

      setData(snapshot);
      setCompanies(availableCompanies);
    } catch (loadError) {
      setData(null);
      setCompanies([]);
      setError(loadError instanceof MinePortalDataError
        ? loadError.message
        : 'Le Portail Mine est momentanément indisponible. Réessayez plus tard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canChooseCompany, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname, location.search]);

  const displayName = user.full_name?.trim() || user.email;

  if (loading) {
    return (
      <div className="mine-portal-loading" aria-live="polite">
        <img src="/sonasp_logo.png" alt="SONASP" />
        <Loading size="lg" />
        <p>Ouverture du périmètre de la société…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <main className="mine-portal-error">
        <section role="alert" aria-labelledby="mine-error-title">
          <img src="/sonasp_logo.png" alt="SONASP" />
          <p className="mine-portal-eyebrow">Portail Mine</p>
          <h1 id="mine-error-title">Périmètre indisponible</h1>
          <p>{error || 'La société demandée ne peut pas être affichée.'}</p>
          <div>
            <button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Réessayer</button>
            {canChooseCompany ? <Link to="/dashboard">Retour à l’espace SONASP</Link> : <Link to="/">Retour à l’accueil</Link>}
          </div>
        </section>
      </main>
    );
  }

  const sidebar = (
    <aside className="mine-sidebar" aria-label="Navigation du Portail Mine">
      <div className="mine-sidebar__brand">
        <img src="/sonasp-logo-clair.png" alt="SONASP" />
        <div>
          <strong>Portail Mine</strong>
          <span>Espace partenaire</span>
        </div>
      </div>

      <div className="mine-sidebar__company">
        <span className="mine-sidebar__company-mark"><Building2 aria-hidden="true" /></span>
        <div>
          <small>Société consultée</small>
          <strong>{data.company.abbreviation || data.company.name}</strong>
          {data.company.code && <span>{data.company.code}</span>}
        </div>
      </div>

      <nav className="mine-sidebar__nav">
        <p>ESPACE DE TRAVAIL</p>
        {portalNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={portalPath(item.id, companyId, canChooseCompany)}
              className={cn(item.id === section && 'is-active')}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mine-sidebar__footer">
        <span className="mine-sidebar__avatar"><UserRound aria-hidden="true" /></span>
        <div><strong>{displayName}</strong><small>{canChooseCompany ? 'Consultation Owner' : 'Compte société'}</small></div>
      </div>
    </aside>
  );

  return (
    <div className="mine-portal-shell">
      <a href="#mine-main" className="mine-skip-link">Aller au contenu</a>
      <div className="mine-portal-shell__desktop-sidebar">{sidebar}</div>
      {mobileNavigationOpen && (
        <div className="mine-portal-shell__mobile-sidebar">
          <button type="button" aria-label="Fermer la navigation" onClick={() => setMobileNavigationOpen(false)} />
          {sidebar}
        </div>
      )}

      <div className="mine-portal-shell__body">
        <header className="mine-topbar">
          <button type="button" className="mine-topbar__menu" onClick={() => setMobileNavigationOpen(true)} aria-label="Ouvrir la navigation">
            <Menu aria-hidden="true" />
          </button>
          <div className="mine-topbar__title">
            <small>{data.company.abbreviation || data.company.name}</small>
            <strong>{currentNavigation.label}</strong>
          </div>

          <div className="mine-topbar__actions">
            {canChooseCompany && (
              <label className="mine-topbar__company-switcher">
                <span>Mine</span>
                <select
                  aria-label="Changer de société minière"
                  value={companyId}
                  onChange={(event) => navigate(portalPath(section, event.target.value, true))}
                >
                  {companies.map((company) => (
                    <option value={company.id} key={company.id}>{company.abbreviation || company.name}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </label>
            )}
            {canChooseCompany && (
              <Link className="mine-topbar__back" to="/dashboard"><ArrowLeft aria-hidden="true" /><span>SONASP</span></Link>
            )}
            <button
              type="button"
              className="mine-topbar__logout"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              aria-label="Se déconnecter"
            >
              <LogOut aria-hidden="true" /><span>Déconnexion</span>
            </button>
          </div>
        </header>

        <main id="mine-main" className="mine-portal-content">
          {canChooseCompany && (
            <div className="mine-owner-context" role="status">
              <ShieldCheck aria-hidden="true" />
              <span><strong>Mode consultation Owner</strong> — vous consultez le portail de {data.company.name}. Le rattachement des comptes reste inchangé.</span>
            </div>
          )}
          <PortalSectionContent section={section} data={data} userName={displayName} ownerMode={canChooseCompany} onChanged={() => load(true)} />
        </main>
      </div>
    </div>
  );
}

function PortalSectionContent({ section, data, userName, ownerMode, onChanged }: {
  section: PortalSection;
  data: MinePortalSnapshot;
  userName: string;
  ownerMode: boolean;
  onChanged: () => Promise<void>;
}) {
  switch (section) {
    case 'previsions': return <ForecastSection data={data} canAct={!ownerMode} onChanged={onChanged} />;
    case 'production': return <ProductionSection data={data} canAct={!ownerMode} onChanged={onChanged} />;
    case 'demandes': return <RequestsSection data={data} canAct={!ownerMode} onChanged={onChanged} />;
    case 'contrats': return <ContractsSection data={data} canAct={!ownerMode} />;
    case 'finances': return <FinancesSection data={data} canAct={!ownerMode} onChanged={onChanged} />;
    case 'documents': return <DocumentsSection data={data} canAct={!ownerMode} onChanged={onChanged} />;
    case 'notifications': return <AlertsSection data={data} />;
    case 'historique': return <HistorySection data={data} />;
    case 'compte': return <AccountSection data={data} userName={userName} ownerMode={ownerMode} />;
    default: return <OverviewSection data={data} userName={userName} ownerMode={ownerMode} />;
  }
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mine-section-heading">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}

function OverviewSection({ data, userName, ownerMode }: { data: MinePortalSnapshot; userName: string; ownerMode: boolean }) {
  const pendingAnalyses = data.analyses.filter((item) => !['tranchee', 'annulee'].includes(item.statut)).length;
  const pendingRequests = data.requests.filter((item) => !['approuvee', 'rejetee', 'annulee'].includes(item.statut)).length;
  const recentProduction = data.productions.reduce((total, item) => total + Number(item.estimated_oz || 0), 0);
  const firstName = userName.split(/[\s@.]/)[0];

  return (
    <div className="mine-portal-stack">
      <SectionHeading
        eyebrow="Vue opérationnelle"
        title={ownerMode ? `Portail de ${data.company.abbreviation || data.company.name}` : `Bonjour ${firstName}`}
        description="Retrouvez ici les échanges, échéances et documents qui relient votre société à la SONASP."
      />
      <section aria-label="Indicateurs du Portail Mine" className="mine-metrics">
        <Metric icon={BarChart3} label="Production récente" value={`${quantity.format(recentProduction)} oz`} note={`${data.productions.length} déclaration(s)`} tone="green" />
        <Metric icon={ClipboardCheck} label="Demandes en cours" value={String(pendingRequests)} note={`${data.requisitions.length} réquisition(s)`} tone="blue" />
        <Metric icon={WalletCards} label="Solde à recevoir" value={`${money.format(data.situation?.reste_du || 0)} FCFA`} note={`${data.situation?.nb_ouvertes || 0} facture(s) ouverte(s)`} tone="gold" />
        <Metric icon={FlaskConical} label="Analyses en cours" value={String(pendingAnalyses)} note={`${data.analyses.length} dossier(s) visible(s)`} tone="purple" />
      </section>

      <div className="mine-overview-grid">
        <Panel title="Demandes et réquisitions récentes" icon={ClipboardCheck} empty="Aucune demande ne requiert votre attention.">
          {data.requests.slice(0, 3).map((request) => (
            <Row key={request.id} title={request.numero_demande} subtitle={`Réponse avant le ${formatDate(request.date_limite_reponse)}`} value={`${quantity.format(request.quantite_demandee_oz)} oz`} status={request.statut} />
          ))}
          {data.requisitions.slice(0, Math.max(0, 3 - data.requests.length)).map((requisition) => (
            <Row key={requisition.id} title={requisition.reference} subtitle={requisition.objet} value={requisition.quantite_oz == null ? null : `${quantity.format(requisition.quantite_oz)} ${requisition.unite}`} status={requisition.statut} />
          ))}
        </Panel>
        <Panel title="Situation financière" icon={ReceiptText} empty="Aucune facture ou aucun règlement enregistré.">
          {data.invoices.slice(0, 4).map((invoice) => (
            <Row key={invoice.id} title={invoice.numero_facture} subtitle={`Échéance ${formatDate(invoice.date_echeance)}`} value={`${money.format(invoice.montant_ttc_fcfa)} ${invoice.devise}`} status={invoice.statut} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function ForecastSection({ data, canAct, onChanged }: { data: MinePortalSnapshot; canAct: boolean; onChanged: () => Promise<void> }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [submissionType, setSubmissionType] = useState<'budget' | 'forecast'>('forecast');
  const [forecastOz, setForecastOz] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const latestBudget = data.budgets[0];
  const latestMonthly = latestBudget
    ? data.monthlyBudgets.filter((item) => item.annual_budget_id === latestBudget.id)
    : [];
  const latestForecasts = latestBudget
    ? data.forecasts.filter((item) => item.annual_budget_id === latestBudget.id)
    : [];
  const budgetTotal = latestMonthly.reduce((total, item) => total + Number(item.budget_oz || 0), 0);
  const forecastTotal = latestForecasts.reduce((total, item) => total + Number(item.forecast_oz || 0), 0);

  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Planification" title="Budgets et prévisions" description="Une lecture consolidée des objectifs déclarés et de leurs dernières révisions." />
      <section className="mine-metrics mine-metrics--compact" aria-label="Synthèse des prévisions">
        <Metric icon={CalendarRange} label="Exercice" value={latestBudget ? String(latestBudget.year) : '—'} note={`${latestMonthly.length} mois renseigné(s)`} tone="blue" />
        <Metric icon={BarChart3} label="Budget annuel" value={`${quantity.format(budgetTotal)} oz`} note="Somme des objectifs mensuels" tone="green" />
        <Metric icon={TrendingUp} label="Prévision révisée" value={`${quantity.format(forecastTotal)} oz`} note={`${latestForecasts.length} révision(s)`} tone="gold" />
      </section>
      {canAct && (
        <form
          className="mine-action-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setFeedback(null);
            try {
              if (submissionType === 'budget') {
                await minePortalService.submitMonthlyBudget({ year, month, budgetOz: Number(forecastOz) });
              } else {
                await minePortalService.submitForecast({ year, month, forecastOz: Number(forecastOz), notes });
              }
              setFeedback({ tone: 'success', text: submissionType === 'budget' ? 'L’objectif mensuel a été transmis à la SONASP.' : 'La prévision a été transmise à la SONASP.' });
              setForecastOz('');
              setNotes('');
              await onChanged();
            } catch (actionError) {
              setFeedback({ tone: 'error', text: actionError instanceof Error ? actionError.message : 'La prévision n’a pas pu être transmise.' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <header><span><Send aria-hidden="true" /></span><div><h2>Transmettre un objectif</h2><p>Renseignez le budget mensuel ou sa prévision révisée. Une nouvelle transmission remplace la valeur du même mois.</p></div></header>
          <div className="mine-form-grid mine-form-grid--forecast">
            <label>Nature<select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as 'budget' | 'forecast')}><option value="budget">Budget mensuel</option><option value="forecast">Prévision révisée</option></select></label>
            <label>Exercice<input type="number" min={today.getFullYear() - 1} max={today.getFullYear() + 5} value={year} onChange={(event) => setYear(Number(event.target.value))} required /></label>
            <label>Mois<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
            <label>Volume (oz)<input type="number" min="0" step="0.01" value={forecastOz} onChange={(event) => setForecastOz(event.target.value)} required /></label>
            {submissionType === 'forecast' && <label className="mine-form-grid__wide">Hypothèses<textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexte, capacité prévue ou contrainte connue" /></label>}
          </div>
          <ActionNotice feedback={feedback} />
          <button className="mine-primary-action" type="submit" disabled={submitting}>{submitting ? 'Transmission…' : 'Transmettre à la SONASP'}<Send aria-hidden="true" /></button>
        </form>
      )}
      <Panel title="Objectifs mensuels" icon={CalendarRange} empty="Aucun budget n’est encore disponible pour cette société.">
        {latestMonthly.map((budget) => {
          const forecast = latestForecasts.find((item) => item.month === budget.month);
          return <Row key={budget.id} title={monthNames[budget.month - 1]} subtitle={`Cible quotidienne ${quantity.format(budget.daily_budget_oz)} oz`} value={forecast ? `${quantity.format(forecast.forecast_oz)} oz prévus` : `${quantity.format(budget.budget_oz)} oz`} status={forecast ? 'révisé' : 'budget'} />;
        })}
      </Panel>
    </div>
  );
}

function ProductionSection({ data, canAct, onChanged }: { data: MinePortalSnapshot; canAct: boolean; onChanged: () => Promise<void> }) {
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [bullionGrams, setBullionGrams] = useState('');
  const [finenessPct, setFinenessPct] = useState('');
  const [barReference, setBarReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const totalOz = data.productions.reduce((total, item) => total + Number(item.estimated_oz || 0), 0);
  const totalGrams = data.productions.reduce((total, item) => total + Number(item.bullion_grams || 0), 0);
  const averageFineness = data.productions.length
    ? data.productions.reduce((total, item) => total + Number(item.estimated_fineness_pct || 0), 0) / data.productions.length
    : 0;

  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Production" title="Production journalière" description="Les déclarations rattachées à la société et les analyses de teneur associées." />
      <section className="mine-metrics mine-metrics--compact" aria-label="Synthèse de production">
        <Metric icon={BarChart3} label="Volume déclaré" value={`${quantity.format(totalOz)} oz`} note={`${quantity.format(totalGrams / 1000)} kg de lingots`} tone="green" />
        <Metric icon={PackageCheck} label="Déclarations" value={String(data.productions.length)} note="Période visible" tone="blue" />
        <Metric icon={FlaskConical} label="Finesse moyenne" value={`${quantity.format(averageFineness)} %`} note={`${data.analyses.length} analyse(s)`} tone="purple" />
      </section>
      {canAct && (
        <form
          className="mine-action-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setFeedback(null);
            try {
              await minePortalService.declareProduction({
                productionDate,
                bullionGrams: Number(bullionGrams),
                finenessPct: Number(finenessPct),
                barReference,
                notes,
              });
              setFeedback({ tone: 'success', text: 'La production a été déclarée et placée dans le circuit de contrôle.' });
              setBullionGrams('');
              setFinenessPct('');
              setBarReference('');
              setNotes('');
              await onChanged();
            } catch (actionError) {
              setFeedback({ tone: 'error', text: actionError instanceof Error ? actionError.message : 'La déclaration n’a pas pu être transmise.' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <header><span><BarChart3 aria-hidden="true" /></span><div><h2>Déclarer une production</h2><p>La quantité d’or fin et les onces sont calculées et contrôlées côté serveur.</p></div></header>
          <div className="mine-form-grid">
            <label>Date de production<input type="date" max={new Date().toISOString().slice(0, 10)} value={productionDate} onChange={(event) => setProductionDate(event.target.value)} required /></label>
            <label>Poids du doré (g)<input type="number" min="0.01" step="0.01" value={bullionGrams} onChange={(event) => setBullionGrams(event.target.value)} required /></label>
            <label>Teneur estimée (%)<input type="number" min="0.01" max="100" step="0.01" value={finenessPct} onChange={(event) => setFinenessPct(event.target.value)} required /></label>
            <label>Référence de barre <small>facultatif</small><input value={barReference} maxLength={80} onChange={(event) => setBarReference(event.target.value)} placeholder="Générée automatiquement si vide" /></label>
            <label className="mine-form-grid__wide">Observations<textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          <ActionNotice feedback={feedback} />
          <button className="mine-primary-action" type="submit" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Déclarer la production'}<Send aria-hidden="true" /></button>
        </form>
      )}
      <div className="mine-overview-grid">
        <Panel title="Dernières productions" icon={BarChart3} empty="Aucune production n’est enregistrée pour ce périmètre.">
          {data.productions.map((production) => (
            <Row key={production.id} title={production.bar_reference || `Production du ${formatDate(production.production_date)}`} subtitle={`${quantity.format(production.bullion_grams)} g · finesse ${quantity.format(production.estimated_fineness_pct)} %`} value={`${quantity.format(production.estimated_oz)} oz`} status={production.status} />
          ))}
        </Panel>
        <Panel title="Analyses de teneur" icon={FlaskConical} empty="Aucune analyse de teneur disponible.">
          {data.analyses.map((analysis) => (
            <Row key={analysis.id} title={analysis.reference} subtitle={`Prélèvement ${formatDate(analysis.date_prelevement)}`} value={analysis.teneur_retenue_pct == null ? `Déclarée ${quantity.format(analysis.teneur_declaree_pct)} %` : `Retenue ${quantity.format(analysis.teneur_retenue_pct)} %`} status={analysis.statut} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function RequestsSection({ data, canAct, onChanged }: { data: MinePortalSnapshot; canAct: boolean; onChanged: () => Promise<void> }) {
  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Échanges SONASP" title="Demandes et réquisitions" description="Les sollicitations adressées à votre société, leur échéance et leur état de traitement." />
      <div className="mine-overview-grid">
        <Panel title="Demandes d’achat" icon={ClipboardCheck} empty="Aucune demande d’achat n’est accessible.">
          {data.requests.map((request) => <RequestWorkflowRow key={request.id} request={request} canAct={canAct} onChanged={onChanged} />)}
        </Panel>
        <Panel title="Réquisitions" icon={FileCheck2} empty="Aucune réquisition n’est accessible.">
          {data.requisitions.map((item) => <Row key={item.id} title={item.reference} subtitle={`${item.objet} · notification ${formatDate(item.date_notification)}`} value={item.quantite_oz == null ? null : `${quantity.format(item.quantite_oz)} ${item.unite}`} status={item.statut} />)}
        </Panel>
      </div>
    </div>
  );
}

function ContractsSection({ data, canAct }: { data: MinePortalSnapshot; canAct: boolean }) {
  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Engagements" title="Contrats" description="Les contrats de fourniture signés avec la SONASP et leurs principales échéances." />
      {canAct && data.contracts.length > 0 && <Link className="mine-inline-action" to="/portail-mine/documents"><Upload aria-hidden="true" /> Ajouter une pièce à un contrat</Link>}
      <Panel title={`${data.contracts.length} contrat(s) visible(s)`} icon={FileSignature} empty="Aucun contrat accessible dans votre périmètre.">
        {data.contracts.map((contract) => <Row key={contract.id} title={contract.numero_contrat} subtitle={`${contract.intitule} · échéance ${formatDate(contract.date_fin)}`} value={contract.quantite_totale == null ? null : `${quantity.format(contract.quantite_totale)} ${contract.unite}`} status={contract.statut} />)}
      </Panel>
    </div>
  );
}

function FinancesSection({ data, canAct, onChanged }: { data: MinePortalSnapshot; canAct: boolean; onChanged: () => Promise<void> }) {
  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Situation financière" title="Factures et paiements" description="Les montants facturés, réglés et restant dus sur le périmètre de votre société." />
      <section className="mine-metrics mine-metrics--compact" aria-label="Situation financière">
        <Metric icon={ReceiptText} label="Facturé" value={`${money.format(data.situation?.facture_total || 0)} FCFA`} note={`${data.situation?.nb_factures || 0} facture(s)`} tone="blue" />
        <Metric icon={WalletCards} label="Réglé" value={`${money.format(data.situation?.facture_payee || 0)} FCFA`} note={`${money.format(data.situation?.reglements_total || 0)} FCFA versés`} tone="green" />
        <Metric icon={AlertTriangle} label="Reste dû" value={`${money.format(data.situation?.reste_du || 0)} FCFA`} note={`${data.situation?.nb_echues || 0} échéance(s) dépassée(s)`} tone="gold" />
      </section>
      <div className="mine-overview-grid">
        <Panel title="Factures" icon={ReceiptText} empty="Aucune facture enregistrée.">
          {data.invoices.map((invoice) => <Row key={invoice.id} title={invoice.numero_facture} subtitle={`Émise le ${formatDate(invoice.date_emission)} · échéance ${formatDate(invoice.date_echeance)}`} value={`${money.format(invoice.montant_ttc_fcfa)} ${invoice.devise}`} status={invoice.statut} />)}
        </Panel>
        <Panel title="Paiements reçus" icon={WalletCards} empty="Aucun paiement enregistré.">
          {data.payments.map((payment) => <PaymentWorkflowRow key={payment.id} payment={payment} canAct={canAct} onChanged={onChanged} />)}
        </Panel>
      </div>
    </div>
  );
}

function DocumentsSection({ data, canAct, onChanged }: { data: MinePortalSnapshot; canAct: boolean; onChanged: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('document_legal');
  const [contractId, setContractId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Dossiers partagés" title="Documents et justificatifs" description="Les pièces rattachées au profil de la société. Aucun document d’une autre mine n’est affiché." />
      {canAct && (
        <form
          className="mine-action-card"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (!file) return;
            setSubmitting(true);
            setFeedback(null);
            try {
              await minePortalService.uploadDocument({ file, documentType, contractId: contractId || undefined });
              setFile(null);
              setFeedback({ tone: 'success', text: 'Le document a été ajouté au dossier de la société.' });
              const input = form.elements.namedItem('mine-document-file') as HTMLInputElement | null;
              if (input) input.value = '';
              await onChanged();
            } catch (actionError) {
              setFeedback({ tone: 'error', text: actionError instanceof Error ? actionError.message : 'Le document n’a pas pu être ajouté.' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <header><span><Upload aria-hidden="true" /></span><div><h2>Ajouter un document</h2><p>PDF, image ou document Word, jusqu’à 15 Mo. Le fichier reste privé dans le périmètre de votre société.</p></div></header>
          <div className="mine-form-grid">
            <label>Catégorie<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="document_legal">Document légal</option><option value="contrat_signe">Contrat signé</option><option value="avenant">Avenant</option><option value="attestation">Attestation</option><option value="laboratoire">Résultat de laboratoire</option><option value="justificatif">Justificatif</option><option value="autre">Autre</option></select></label>
            <label>Contrat associé <small>facultatif</small><select value={contractId} onChange={(event) => setContractId(event.target.value)}><option value="">Aucun contrat</option>{data.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.numero_contrat}</option>)}</select></label>
            <label className="mine-form-grid__wide">Fichier<input name="mine-document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>
          </div>
          <ActionNotice feedback={feedback} />
          <button className="mine-primary-action" type="submit" disabled={submitting || !file}>{submitting ? 'Téléversement…' : 'Ajouter au dossier'}<Upload aria-hidden="true" /></button>
        </form>
      )}
      <Panel title={`${data.documents.length} document(s)`} icon={FolderOpen} empty="Aucun document n’est encore rattaché à cette société.">
        {data.documents.map((document) => (
          <DocumentWorkflowRow key={document.id} document={document} />
        ))}
      </Panel>
    </div>
  );
}

function AlertsSection({ data }: { data: MinePortalSnapshot }) {
  const alerts = useMemo(() => {
    const now = Date.now();
    const next30Days = now + 30 * 24 * 60 * 60 * 1000;
    const items: Array<{ title: string; description: string; tone: string }> = [];
    data.requests.forEach((request) => {
      if (!request.date_limite_reponse || ['approuvee', 'rejetee', 'annulee'].includes(request.statut)) return;
      const deadline = new Date(`${request.date_limite_reponse}T23:59:59`).getTime();
      if (deadline <= next30Days) items.push({ title: request.numero_demande, description: `Réponse attendue avant le ${formatDate(request.date_limite_reponse)}`, tone: deadline < now ? 'danger' : 'warning' });
    });
    data.invoices.forEach((invoice) => {
      if (invoice.statut === 'payee') return;
      const deadline = new Date(`${invoice.date_echeance}T23:59:59`).getTime();
      if (deadline < now) items.push({ title: invoice.numero_facture, description: `Échéance dépassée depuis le ${formatDate(invoice.date_echeance)}`, tone: 'danger' });
    });
    data.analyses.forEach((analysis) => {
      if (!['tranchee', 'annulee'].includes(analysis.statut)) items.push({ title: analysis.reference, description: 'Analyse de teneur en cours de traitement', tone: 'info' });
    });
    return items;
  }, [data]);

  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Points d’attention" title="Alertes" description="Des rappels calculés à partir des échéances et statuts réels de votre périmètre." />
      {alerts.length ? (
        <section className="mine-alert-list" aria-label="Alertes du périmètre">
          {alerts.map((alert, index) => (
            <article key={`${alert.title}-${index}`} className={`is-${alert.tone}`}>
              <AlertTriangle aria-hidden="true" /><div><h2>{alert.title}</h2><p>{alert.description}</p></div>
            </article>
          ))}
        </section>
      ) : <EmptyState icon={Bell} title="Aucune alerte active" description="Les échéances et traitements visibles ne nécessitent aucune action immédiate." />}
    </div>
  );
}

function HistorySection({ data }: { data: MinePortalSnapshot }) {
  const events = useMemo(() => [
    ...data.productions.map((item) => ({ date: item.production_date, title: item.bar_reference || 'Production déclarée', description: `${quantity.format(item.estimated_oz)} oz · ${statusLabel(item.status)}`, icon: BarChart3 })),
    ...data.payments.map((item) => ({ date: item.date_reglement, title: item.reference_reglement, description: `Paiement de ${money.format(item.montant_fcfa)} ${item.devise}`, icon: WalletCards })),
    ...data.invoices.map((item) => ({ date: item.date_emission, title: item.numero_facture, description: `Facture ${statusLabel(item.statut)}`, icon: ReceiptText })),
    ...data.requisitions.map((item) => ({ date: item.date_notification || '', title: item.reference, description: item.objet, icon: FileCheck2 })),
  ].filter((event) => event.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 24), [data]);

  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Traçabilité" title="Historique" description="Une chronologie constituée uniquement à partir des opérations disponibles pour cette société." />
      {events.length ? (
        <section className="mine-timeline" aria-label="Historique des opérations">
          {events.map((event, index) => {
            const Icon = event.icon;
            return <article key={`${event.title}-${event.date}-${index}`}><span><Icon aria-hidden="true" /></span><div><time>{formatDate(event.date)}</time><h2>{event.title}</h2><p>{event.description}</p></div></article>;
          })}
        </section>
      ) : <EmptyState icon={History} title="Historique vide" description="Aucune opération datée n’est accessible dans ce périmètre." />}
    </div>
  );
}

function AccountSection({ data, userName, ownerMode }: { data: MinePortalSnapshot; userName: string; ownerMode: boolean }) {
  const place = [data.company.localite, data.company.province, data.company.region, data.company.country].filter(Boolean).join(' · ');
  return (
    <div className="mine-portal-stack">
      <SectionHeading eyebrow="Identité et périmètre" title={data.company.name} description="Les informations de référence qui définissent le contexte actuellement consulté." />
      <div className="mine-account-grid">
        <section className="mine-account-card">
          <span><Building2 aria-hidden="true" /></span><div><small>Société minière</small><h2>{data.company.name}</h2><dl><div><dt>Code</dt><dd>{data.company.code || 'Non renseigné'}</dd></div><div><dt>Localisation</dt><dd>{place || 'Non renseignée'}</dd></div></dl></div>
        </section>
        <section className="mine-account-card">
          <span><UserRound aria-hidden="true" /></span><div><small>Session active</small><h2>{userName}</h2><dl><div><dt>Type d’accès</dt><dd>{ownerMode ? 'Owner · consultation globale' : 'Compte de société minière'}</dd></div><div><dt>Périmètre</dt><dd>{data.company.abbreviation || data.company.name}</dd></div></dl></div>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: string; note: string; tone: 'green' | 'blue' | 'gold' | 'purple' }) {
  return (
    <article className={`mine-metric is-${tone}`}>
      <span className="mine-metric__icon"><Icon aria-hidden="true" /></span>
      <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function Panel({ title, icon: Icon, empty, children }: { title: string; icon: LucideIcon; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return (
    <section className="mine-panel">
      <header><span><Icon aria-hidden="true" /></span><h2>{title}</h2></header>
      {items.length > 0 ? <div className="mine-panel__rows">{children}</div> : <p className="mine-panel__empty">{empty}</p>}
    </section>
  );
}

function Row({ title, subtitle, value, status }: { title: string; subtitle: string; value: string | null; status: string }) {
  return (
    <article className="mine-data-row">
      <div><h3>{title}</h3><p>{subtitle}</p></div>
      <div>{value && <strong>{value}</strong>}<span>{statusLabel(status)}</span></div>
    </article>
  );
}

function RequestWorkflowRow({ request, canAct, onChanged }: {
  request: MinePortalRequest;
  canAct: boolean;
  onChanged: () => Promise<void>;
}) {
  const [decision, setDecision] = useState<MineRequestDecision | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const actionable = canAct && request.statut === 'soumise';

  return (
    <article className="mine-workflow-row">
      <div className="mine-data-row">
        <div><h3>{request.numero_demande}</h3><p>Réponse avant le {formatDate(request.date_limite_reponse)}</p></div>
        <div><strong>{quantity.format(request.quantite_demandee_oz)} oz</strong><span>{statusLabel(request.statut)}</span></div>
      </div>
      {actionable && !decision && (
        <div className="mine-row-actions" aria-label={`Répondre à ${request.numero_demande}`}>
          <button type="button" className="is-approve" onClick={() => setDecision('approuver')}><Check aria-hidden="true" /> Approuver</button>
          <button type="button" onClick={() => setDecision('clarification')}>Demander une précision</button>
          <button type="button" className="is-reject" onClick={() => setDecision('rejeter')}><X aria-hidden="true" /> Rejeter</button>
        </div>
      )}
      {actionable && decision && (
        <form
          className="mine-inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setFeedback(null);
            try {
              await minePortalService.respondToRequest(request.id, decision, reason);
              setFeedback({ tone: 'success', text: 'Votre réponse a été enregistrée.' });
              await onChanged();
            } catch (actionError) {
              setFeedback({ tone: 'error', text: actionError instanceof Error ? actionError.message : 'La réponse n’a pas pu être enregistrée.' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {decision !== 'approuver' && <label>Motif<textarea minLength={5} maxLength={1000} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
          <ActionNotice feedback={feedback} />
          <div><button type="button" onClick={() => { setDecision(null); setReason(''); }}>Annuler</button><button type="submit" className="is-primary" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Confirmer la réponse'}</button></div>
        </form>
      )}
    </article>
  );
}

function PaymentWorkflowRow({ payment, canAct, onChanged }: {
  payment: MinePortalPayment;
  canAct: boolean;
  onChanged: () => Promise<void>;
}) {
  const [decision, setDecision] = useState<MinePaymentDecision | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const actionable = canAct
    && ['execute', 'rapproche'].includes(payment.statut)
    && (payment.reception_statut || 'a_confirmer') === 'a_confirmer';
  const displayedStatus = payment.reception_statut && payment.reception_statut !== 'a_confirmer'
    ? payment.reception_statut
    : payment.statut;

  return (
    <article className="mine-workflow-row">
      <div className="mine-data-row">
        <div><h3>{payment.reference_reglement}</h3><p>Règlement du {formatDate(payment.date_reglement)}</p></div>
        <div><strong>{money.format(payment.montant_fcfa)} {payment.devise}</strong><span>{statusLabel(displayedStatus)}</span></div>
      </div>
      {actionable && !decision && (
        <div className="mine-row-actions">
          <button type="button" className="is-approve" onClick={() => setDecision('confirmer')}><Check aria-hidden="true" /> Confirmer la réception</button>
          <button type="button" className="is-reject" onClick={() => setDecision('contester')}>Signaler un écart</button>
        </div>
      )}
      {actionable && decision && (
        <form
          className="mine-inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setFeedback(null);
            try {
              await minePortalService.respondToPayment(payment.id, decision, reason);
              setFeedback({ tone: 'success', text: decision === 'confirmer' ? 'La réception du règlement est confirmée.' : 'L’écart a été signalé à la SONASP.' });
              await onChanged();
            } catch (actionError) {
              setFeedback({ tone: 'error', text: actionError instanceof Error ? actionError.message : 'La réponse n’a pas pu être enregistrée.' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {decision === 'contester' && <label>Écart constaté<textarea minLength={5} maxLength={1000} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
          <ActionNotice feedback={feedback} />
          <div><button type="button" onClick={() => { setDecision(null); setReason(''); }}>Annuler</button><button type="submit" className="is-primary" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Valider'}</button></div>
        </form>
      )}
    </article>
  );
}

function ActionNotice({ feedback }: { feedback: { tone: 'success' | 'error'; text: string } | null }) {
  if (!feedback) return null;
  return <p className={`mine-action-notice is-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>;
}

function DocumentWorkflowRow({ document }: { document: MinePortalDocument }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <article className="mine-workflow-row">
      <div className="mine-data-row">
        <div><h3>{document.file_name}</h3><p>{document.doc_type ? statusLabel(document.doc_type) : 'Document'} · ajouté le {formatDateTime(document.created_at)}</p></div>
        <div>{document.file_size ? <strong>{quantity.format(document.file_size / 1024)} Ko</strong> : null}<span>{document.mime_type?.split('/')[1]?.toUpperCase() || 'fichier'}</span></div>
      </div>
      <div className="mine-row-actions">
        <button
          type="button"
          disabled={opening}
          onClick={async () => {
            setOpening(true);
            setError(null);
            try {
              const url = await minePortalService.getDocumentUrl(document.file_path);
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (openError) {
              setError(openError instanceof Error ? openError.message : 'Le document ne peut pas être ouvert.');
            } finally {
              setOpening(false);
            }
          }}
        ><ExternalLink aria-hidden="true" /> {opening ? 'Ouverture…' : 'Ouvrir le document'}</button>
        {error && <span className="mine-row-error" role="alert">{error}</span>}
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <section className="mine-empty-state"><span><Icon aria-hidden="true" /></span><h2>{title}</h2><p>{description}</p></section>;
}
