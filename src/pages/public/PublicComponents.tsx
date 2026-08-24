import {
  ArrowRight,
  BarChart3,
  Banknote,
  CalendarClock,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileCheck2,
  FileInput,
  FileSignature,
  Gauge,
  HandCoins,
  History,
  KeyRound,
  Landmark,
  Link2,
  ListChecks,
  Menu,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Ship,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, type ImgHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

const PublicPortalCharts = lazy(() => import('./PublicPortalCharts'));

const iconMap: Record<string, LucideIcon> = {
  'file-input': FileInput,
  'package-check': PackageCheck,
  'hand-coins': HandCoins,
  'chart-no-axes-combined': BarChart3,
  'key-round': KeyRound,
  'list-checks': ListChecks,
  'shield-check': ShieldCheck,
  'database-backup': DatabaseBackup,
};

export function PublicIcon({ name }: { name: string }) {
  const Icon = iconMap[name] ?? ShieldCheck;
  return <Icon aria-hidden="true" />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  as = 'h2',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
}) {
  const Heading = as;
  return (
    <div className={`public-section-heading public-section-heading--${align}`}>
      <span className="public-section-heading__eyebrow">{eyebrow}</span>
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
    </div>
  );
}

export function AccessibleButton({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
}) {
  return (
    <Link className={`public-button public-button--${variant}`} to={to}>
      {children}
    </Link>
  );
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="public-status-badge">
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function DocumentLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="public-document-link" href={href} target="_blank" rel="noreferrer">
      <Download aria-hidden="true" />
      {children}
    </a>
  );
}

export function ResponsiveImage({
  alt,
  eager = false,
  className,
}: {
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  const priorityProps = eager
    ? ({ fetchpriority: 'high' } as unknown as ImgHTMLAttributes<HTMLImageElement>)
    : {};
  return (
    <picture className={className}>
      <source
        type="image/avif"
        srcSet="/institutional/mine-hero-reference-960.avif 960w, /institutional/mine-hero-reference-1600.avif 1600w"
        sizes="(max-width: 900px) 100vw, 58vw"
      />
      <source
        type="image/webp"
        srcSet="/institutional/mine-hero-reference-960.webp 960w, /institutional/mine-hero-reference-1600.webp 1600w"
        sizes="(max-width: 900px) 100vw, 58vw"
      />
      <img
        {...priorityProps}
        src="/institutional/mine-hero-reference-1600.webp"
        alt={alt}
        width="1600"
        height="900"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </picture>
  );
}

const portalMetrics = [
  { label: 'Production', value: '18,42 t', change: '+8,4 %', icon: BarChart3, tone: 'green' },
  { label: 'Expéditions', value: '32', change: '28 expédiées', icon: Ship, tone: 'gold' },
  { label: 'Factures', value: '96 %', change: '24 traitées', icon: ReceiptText, tone: 'blue' },
  { label: 'Paiements', value: '84 %', change: '12 rapprochés', icon: HandCoins, tone: 'red' },
];

function PublicPortalChartsFallback({ compact }: { compact: boolean }) {
  return (
    <div className="portal-preview__charts" aria-busy="true">
      <div className="portal-preview__chart-card portal-preview__chart-card--trend">
        <div className="portal-preview__chart-head">
          <div><strong>Flux mensuels</strong><span>Tonnes déclarées et expédiées</span></div>
          <span className="portal-preview__chart-change">+18,6 %</span>
        </div>
        <div className="portal-preview__chart-canvas" aria-hidden="true" />
        <div className="portal-preview__legend"><i />Production <i />Expéditions</div>
      </div>
      {compact && (
        <div className="portal-preview__chart-card portal-preview__chart-card--operations">
          <div className="portal-preview__chart-head"><div><strong>Opérations</strong><span>État du traitement</span></div></div>
          <div className="portal-preview__chart-canvas" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export function MinePortalPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`portal-preview${compact ? ' portal-preview--section' : ' portal-preview--hero'}`} aria-label="Aperçu du tableau de bord du Portail Mine">
      <div className="portal-preview__header">
        <div className="portal-preview__brand">
          <img src="/SONASP v2.png" alt="SONASP" width="621" height="211" />
          <span><strong>Espace Mines</strong><small>Vue opérationnelle</small></span>
        </div>
        <div className="portal-preview__tools"><Menu aria-hidden="true" /></div>
      </div>
      <div className="portal-preview__titlebar">
        <div><span>Pilotage consolidé</span><h2>Tableau de bord</h2></div>
        <small>30 derniers jours</small>
      </div>
      <div className="portal-preview__kpis">
        {portalMetrics.map(({ label, value, change, icon: Icon, tone }) => (
          <article className={`portal-preview__kpi portal-preview__kpi--${tone}`} key={label}>
            <span className="portal-preview__kpi-icon"><Icon aria-hidden="true" /></span>
            <div><small>{label}</small><strong>{value}</strong><em>{change}</em></div>
          </article>
        ))}
      </div>
      <Suspense fallback={<PublicPortalChartsFallback compact={compact} />}>
        <PublicPortalCharts compact={compact} />
      </Suspense>
      <div className="portal-preview__sync">
        <strong><span aria-hidden="true" />Données synchronisées</strong>
        <small>Aujourd’hui, 08:15</small>
      </div>
    </div>
  );
}

export function PortalContractPreview({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const flowIcons = [FileSignature, CalendarClock, Truck, FileCheck2];
  const copy = locale === 'fr'
    ? {
        eyebrow: 'Pilotage contractuel',
        title: 'Portefeuille d’engagements',
        preview: 'Aperçu fonctionnel',
        cards: [
          { label: 'Cadre contractuel', value: 'Contrats & avenants', icon: FileSignature },
          { label: 'Exécution', value: 'Expéditions suivies', icon: Gauge },
          { label: 'Échéances', value: 'Alertes partagées', icon: CalendarClock },
        ],
        flowTitle: 'Cycle de suivi d’un engagement',
        flow: ['Contractualiser', 'Planifier', 'Exécuter', 'Rapprocher'],
        note: 'Les données réelles sont accessibles uniquement aux organisations autorisées.',
      }
    : {
        eyebrow: 'Contract management',
        title: 'Commitment portfolio',
        preview: 'Functional preview',
        cards: [
          { label: 'Contract framework', value: 'Contracts & amendments', icon: FileSignature },
          { label: 'Performance', value: 'Tracked shipments', icon: Gauge },
          { label: 'Deadlines', value: 'Shared alerts', icon: CalendarClock },
        ],
        flowTitle: 'Commitment monitoring cycle',
        flow: ['Contract', 'Plan', 'Deliver', 'Reconcile'],
        note: 'Actual data is available only to authorized organizations.',
      };

  return (
    <div className="public-contract-board" aria-label={copy.title}>
      <div className="public-contract-board__head">
        <div>
          <span>{copy.eyebrow}</span>
          <strong>{copy.title}</strong>
        </div>
        <span className="public-contract-board__badge"><CheckCircle2 aria-hidden="true" />{copy.preview}</span>
      </div>

      <div className="public-contract-board__summary">
        {copy.cards.map(({ label, value, icon: Icon }, index) => (
          <div className={`public-contract-board__metric public-contract-board__metric--${index + 1}`} key={label}>
            <span><Icon aria-hidden="true" /></span>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="public-contract-board__flow">
        <div className="public-contract-board__flow-head">
          <strong>{copy.flowTitle}</strong>
          <span aria-hidden="true"><i /><i /><i /></span>
        </div>
        <ol>
          {copy.flow.map((item, index) => {
            const FlowIcon = flowIcons[index] ?? FileCheck2;
            return (
              <li key={item}>
                <span aria-hidden="true"><FlowIcon /></span>
                <strong>{item}</strong>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="public-contract-board__note"><FileCheck2 aria-hidden="true" />{copy.note}</p>
    </div>
  );
}

export function PaymentPreview({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const copy = locale === 'fr'
    ? {
        aria: 'Aperçu fonctionnel du cycle de règlement',
        eyebrow: 'Cycle de règlement',
        title: 'Une opération, toutes ses pièces reliées',
        badge: 'Aperçu fonctionnel',
        relationship: 'Dossier financier consolidé',
        links: ['Expédition d’origine', 'Compte validé', 'Historique de validation'],
        note: 'Les montants et justificatifs réels restent réservés aux organisations autorisées.',
        stages: [
          { label: 'Facture contrôlée', detail: 'Pièce reliée à l’expédition', icon: ReceiptText },
          { label: 'Paiement rapproché', detail: 'Écriture et compte validés', icon: Banknote },
          { label: 'Preuve archivée', detail: 'Justificatif disponible', icon: FileCheck2 },
        ],
      }
    : {
        aria: 'Functional preview of the settlement cycle',
        eyebrow: 'Settlement cycle',
        title: 'One operation, every record connected',
        badge: 'Functional preview',
        relationship: 'Consolidated financial record',
        links: ['Source shipment', 'Validated account', 'Approval history'],
        note: 'Actual amounts and supporting records remain restricted to authorized organizations.',
        stages: [
          { label: 'Invoice checked', detail: 'Record linked to the shipment', icon: ReceiptText },
          { label: 'Payment reconciled', detail: 'Entry and account validated', icon: Banknote },
          { label: 'Evidence archived', detail: 'Supporting record available', icon: FileCheck2 },
        ],
      };

  return (
    <div className="public-finance-preview public-finance-preview--v2" aria-label={copy.aria}>
      <div className="public-finance-preview__head">
        <div>
          <span className="public-finance-preview__head-icon"><Banknote aria-hidden="true" /></span>
          <span><small>{copy.eyebrow}</small><strong>{copy.title}</strong></span>
        </div>
        <span className="public-finance-preview__badge"><CheckCircle2 aria-hidden="true" />{copy.badge}</span>
      </div>

      <ol className="public-finance-preview__flow">
        {copy.stages.map(({ label, detail, icon: Icon }, index) => (
          <li key={label}>
            <span className="public-finance-preview__stage-icon"><Icon aria-hidden="true" /></span>
            <span><strong>{label}</strong><small>{detail}</small></span>
            {index < copy.stages.length - 1 && <ArrowRight aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="public-finance-preview__relationship">
        <div><Link2 aria-hidden="true" /><strong>{copy.relationship}</strong></div>
        <ul>
          {copy.links.map((link, index) => {
            const Icon = [ReceiptText, Landmark, History][index] ?? FileCheck2;
            return <li key={link}><Icon aria-hidden="true" /><span>{link}</span></li>;
          })}
        </ul>
      </div>

      <p className="public-finance-preview__note"><FileCheck2 aria-hidden="true" />{copy.note}</p>
    </div>
  );
}
