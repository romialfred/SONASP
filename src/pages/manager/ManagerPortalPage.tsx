import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart3, Building2, FileSignature, ReceiptText,
  RefreshCw, ShieldCheck, WalletCards, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loading } from '@/components/ui/Loading';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { formatStatusFr } from '@/utils/statusFormatter';
import {
  ManagerPortalDataError, managerPortalService, type ManagerPortalSnapshot,
} from '@/services/managerPortalService';
import './manager-portal.css';

import { navigation, type Section } from './managerNavigation';
const validSections = new Set(navigation.map((item) => item.id));
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function sectionFromPath(path: string): Section {
  const value = path.replace(/^\/portail-direction\/?/, '').split('/')[0] as Section;
  return validSections.has(value) ? value : 'synthese';
}

function fmtDate(value: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR');
}

export default function ManagerPortalPage() {
  return <NationalDashboardLayout><ManagerPortalContent /></NationalDashboardLayout>;
}

function ManagerPortalContent() {
  const { user } = useAuth();
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const [snapshot, setSnapshot] = useState<ManagerPortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await managerPortalService.load());
    } catch (loadError) {
      setSnapshot(null);
      setError(loadError instanceof ManagerPortalDataError ? loadError.message : 'La vue Direction est momentanément indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="manager-loading"><img src="/sonasp_logo.png" alt="SONASP" /><Loading size="lg" /><p>Consolidation des indicateurs…</p></div>;
  if (error || !snapshot) return <main className="manager-error" role="alert"><img src="/sonasp_logo.png" alt="SONASP" /><h1>Vue Direction indisponible</h1><p>{error}</p><button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Réessayer</button></main>;

  return (
    <div className="manager-content">
      <div className="manager-access-note"><ShieldCheck aria-hidden="true" /> Consultation uniquement · Direction SONASP <button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Actualiser</button></div>
          <SectionContent section={section} data={snapshot} userName={user?.full_name || user?.email || 'Manager'} />
    </div>
  );
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="manager-heading"><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></header>;
}

function SectionContent({ section, data, userName }: { section: Section; data: ManagerPortalSnapshot; userName: string }) {
  const companyNames = useMemo(() => new Map(data.companies.map((company) => [company.id, company.abbreviation || company.name])), [data.companies]);
  const productionTotal = data.productions.reduce((sum, row) => sum + Number(row.estimated_oz || 0), 0);
  const invoiceTotal = data.invoices.reduce((sum, row) => sum + Number(row.montant_ttc_fcfa || 0), 0);
  const paidTotal = data.payments.reduce((sum, row) => sum + Number(row.montant_fcfa || 0), 0);
  const name = (companyId: string) => companyNames.get(companyId) || 'Société non renseignée';

  if (section === 'compte') return <><Heading eyebrow="Mon compte" title={userName} description="Votre accès Direction est transversal et strictement consultatif." /><Empty icon={ShieldCheck} title="Droits de consultation" text="La création, la modification, la suppression et la validation sont interdites par la base de données pour ce rôle." /></>;

  if (section === 'production') return <><Heading eyebrow="Production" title="Production nationale" description="Volumes et teneurs déclarés par l’ensemble des sociétés visibles." /><DataPanel title="Dernières productions" rows={data.productions.map((row) => ({ key: row.id, title: name(row.mining_company_id), subtitle: `${fmtDate(row.production_date)} · teneur ${number.format(row.estimated_fineness_pct)} %`, value: `${number.format(row.estimated_oz)} oz`, status: row.status }))} /></>;
  if (section === 'previsions') return <><Heading eyebrow="Planification" title="Budgets et prévisions" description="Objectifs annuels et révisions consolidés par société." /><DataPanel title="Dernières prévisions" rows={data.forecasts.map((row) => ({ key: row.id, title: name(row.mining_company_id), subtitle: `Trimestre ${row.quarter} · mois ${row.month} · révision ${fmtDate(row.revision_date)}`, value: `${number.format(row.forecast_oz)} oz`, status: 'prévision' }))} /></>;
  if (section === 'achats') return <><Heading eyebrow="Approvisionnement" title="Achats et demandes" description="Demandes adressées aux sociétés et échéances de réponse." /><DataPanel title="Demandes récentes" rows={data.requests.map((row) => ({ key: row.id, title: row.numero_demande, subtitle: `${name(row.mining_company_id)} · limite ${fmtDate(row.date_limite_reponse)}`, value: `${number.format(row.quantite_demandee_oz)} oz`, status: row.statut }))} /></>;
  if (section === 'contrats') return <><Heading eyebrow="Engagements" title="Contrats" description="Portefeuille contractuel national, sans action de validation." /><DataPanel title="Contrats visibles" rows={data.contracts.map((row) => ({ key: row.id, title: row.numero_contrat, subtitle: `${name(row.mining_company_id)} · ${row.intitule} · fin ${fmtDate(row.date_fin)}`, value: row.quantite_totale == null ? '—' : `${number.format(row.quantite_totale)} ${row.unite}`, status: row.statut }))} /></>;
  if (section === 'finances') return <><Heading eyebrow="Finance" title="Factures et paiements" description="Situation consolidée des montants facturés et réglés." /><div className="manager-two-columns"><DataPanel title="Factures" rows={data.invoices.map((row) => ({ key: row.id, title: row.numero_facture, subtitle: `${name(row.mining_company_id)} · échéance ${fmtDate(row.date_echeance)}`, value: `${money.format(row.montant_ttc_fcfa)} ${row.devise}`, status: row.statut }))} /><DataPanel title="Paiements" rows={data.payments.map((row) => ({ key: row.id, title: row.reference_reglement, subtitle: `${name(row.mining_company_id)} · ${fmtDate(row.date_reglement)}`, value: `${money.format(row.montant_fcfa)} ${row.devise}`, status: row.statut }))} /></div></>;
  if (section === 'performance') return <><Heading eyebrow="Performance" title="Lecture par société" description="Volumes produits, demandes et analyses regroupés par partenaire." /><CompanyPerformance data={data} /></>;
  if (section === 'rapports') return <><Heading eyebrow="Rapports" title="Synthèses disponibles" description="Des jeux de données consolidés prêts à être consultés; aucun export fictif n’est proposé." /><div className="manager-cards"><Empty icon={BarChart3} title="Production" text={`${data.productions.length} déclaration(s) disponibles pour l’analyse.`} /><Empty icon={WalletCards} title="Finance" text={`${data.invoices.length} facture(s) et ${data.payments.length} paiement(s) visibles.`} /><Empty icon={FileSignature} title="Contrats" text={`${data.contracts.length} engagement(s) contractuel(s) visible(s).`} /></div></>;
  if (section === 'alertes') {
    const now = Date.now();
    const rows = [
      ...data.requests.filter((row) => row.date_limite_reponse && new Date(`${row.date_limite_reponse}T23:59:59`).getTime() < now && !['approuvee', 'rejetee', 'annulee'].includes(row.statut)).map((row) => ({ key: row.id, title: row.numero_demande, subtitle: `${name(row.mining_company_id)} · réponse dépassée le ${fmtDate(row.date_limite_reponse)}`, value: '', status: 'en retard' })),
      ...data.invoices.filter((row) => new Date(`${row.date_echeance}T23:59:59`).getTime() < now && row.statut !== 'payee').map((row) => ({ key: row.id, title: row.numero_facture, subtitle: `${name(row.mining_company_id)} · échéance dépassée le ${fmtDate(row.date_echeance)}`, value: `${money.format(row.montant_ttc_fcfa - row.montant_paye_fcfa)} ${row.devise}`, status: 'à surveiller' })),
    ];
    return <><Heading eyebrow="Points d’attention" title="Alertes consolidées" description="Échéances dépassées calculées à partir des données opérationnelles." /><DataPanel title="Alertes actives" rows={rows} /></>;
  }

  return <><Heading eyebrow="Vue exécutive" title="Pilotage national" description="Une vue consolidée, en lecture seule, des opérations des sociétés minières." /><section className="manager-metrics"><Metric icon={Building2} label="Sociétés actives" value={String(data.companies.length)} /><Metric icon={BarChart3} label="Production visible" value={`${number.format(productionTotal)} oz`} /><Metric icon={ReceiptText} label="Montant facturé" value={`${money.format(invoiceTotal)} FCFA`} /><Metric icon={WalletCards} label="Paiements" value={`${money.format(paidTotal)} FCFA`} /></section><div className="manager-two-columns"><DataPanel title="Demandes récentes" rows={data.requests.slice(0, 6).map((row) => ({ key: row.id, title: row.numero_demande, subtitle: name(row.mining_company_id), value: `${number.format(row.quantite_demandee_oz)} oz`, status: row.statut }))} /><DataPanel title="Analyses récentes" rows={data.analyses.slice(0, 6).map((row) => ({ key: row.id, title: row.reference, subtitle: name(row.mining_company_id), value: row.teneur_retenue_pct == null ? `${number.format(row.teneur_declaree_pct)} % déclarée` : `${number.format(row.teneur_retenue_pct)} % retenue`, status: row.statut }))} /></div></>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) { return <article className="manager-metric"><span><Icon aria-hidden="true" /></span><div><p>{label}</p><strong>{value}</strong></div></article>; }
type DisplayRow = { key: string; title: string; subtitle: string; value: string; status: string };
function DataPanel({ title, rows }: { title: string; rows: DisplayRow[] }) { return <section className="manager-panel"><header><h2>{title}</h2><span>{rows.length} élément(s)</span></header>{rows.length ? <div>{rows.map((row) => <article key={row.key}><div><h3>{row.title}</h3><p>{row.subtitle}</p></div><div><strong>{row.value}</strong><span>{formatStatusFr(row.status)}</span></div></article>)}</div> : <p className="manager-panel__empty">Aucune donnée disponible dans le périmètre autorisé.</p>}</section>; }
function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) { return <section className="manager-empty"><Icon aria-hidden="true" /><h2>{title}</h2><p>{text}</p></section>; }
function CompanyPerformance({ data }: { data: ManagerPortalSnapshot }) {
  return <section className="manager-company-grid">{data.companies.map((company) => { const productions = data.productions.filter((row) => row.mining_company_id === company.id); const volume = productions.reduce((sum, row) => sum + Number(row.estimated_oz || 0), 0); const openRequests = data.requests.filter((row) => row.mining_company_id === company.id && !['approuvee', 'rejetee', 'annulee'].includes(row.statut)).length; return <article key={company.id}><span><Building2 aria-hidden="true" /></span><h2>{company.abbreviation || company.name}</h2><p>{company.name}</p><dl><div><dt>Production</dt><dd>{number.format(volume)} oz</dd></div><div><dt>Demandes ouvertes</dt><dd>{openRequests}</dd></div><div><dt>Analyses</dt><dd>{data.analyses.filter((row) => row.mining_company_id === company.id).length}</dd></div></dl></article>; })}</section>;
}
