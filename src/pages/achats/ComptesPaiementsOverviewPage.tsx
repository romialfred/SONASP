import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Grid2X2,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid, type BadgeTone } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  achatsIndustrielsService,
  LIBELLES_STATUT_FACTURE,
  type FactureAchat,
  type ReglementAchat,
} from '@/services/achatsIndustrielsService';
import {
  buildAchatsFinancialOverview,
  type AchatsFinancialOverview,
} from '@/services/achatsFinancialOverview';
import { LIBELLES_CYCLE, TONS_CYCLE, type StatutReglementCycle } from '@/services/reglementsAchatService';
import { formaterDate } from './DemandesAchatPage';
import { francs } from './PlansAchatPage';
import './achats.css';

const EMPTY_OVERVIEW: AchatsFinancialOverview = {
  totalPurchased: 0,
  totalPaid: 0,
  outstanding: 0,
  advances: 0,
  payments: { pending: 0, validated: 0, rejected: 0, correction: 0 },
  positions: [],
  recentPayments: [],
  recentInvoices: [],
  trend: [],
  alerts: { overdueInvoices: 0, disputedInvoices: 0, correctionPayments: 0, unmatchedAdvances: 0 },
};

const paymentLabel = (payment: ReglementAchat) => {
  const status = String(payment.statut) as StatutReglementCycle;
  return LIBELLES_CYCLE[status] || status;
};

const invoiceTone = (invoice: FactureAchat): BadgeTone => (
  invoice.statut === 'payee' ? 'success'
    : invoice.statut === 'annulee' || invoice.statut === 'contestee' || invoice.statut === 'echec_certification'
      ? 'danger'
      : invoice.statut === 'partiellement_payee' || invoice.statut === 'suspendue' ? 'warning' : 'info'
);

export function ComptesPaiementsOverviewPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AchatsFinancialOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const [invoices, payments, balances, companies] = await Promise.all([
        achatsIndustrielsService.listerFactures(),
        achatsIndustrielsService.listerReglements(),
        achatsIndustrielsService.balanceAgee(),
        achatsIndustrielsService.societesProductrices(),
      ]);
      setOverview(buildAchatsFinancialOverview({ invoices, payments, balances, companies }));
    } catch (reason) {
      setFailure(errorMessage(reason, 'Impossible de charger le pilotage des comptes et paiements.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const trendMaximum = useMemo(
    () => Math.max(1, ...overview.trend.map((point) => point.amount)),
    [overview.trend],
  );
  const totalAlerts = Object.values(overview.alerts).reduce((sum, count) => sum + count, 0);

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-page achats-overview">
        <PageHeader
          icon={Grid2X2}
          title="Vue d’ensemble des comptes & paiements"
          subtitle="Pilotage financier des achats aux mines, des factures, des règlements et des soldes ouverts."
          breadcrumb={[
            { label: 'Mine industrielle' },
            { label: 'Achat aux mines industrielles' },
            { label: 'Suivi des comptes & paiements' },
            { label: 'Vue d’ensemble' },
          ]}
          actions={(
            <>
              <button type="button" className="sn-btn" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={loading ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              <Link className="sn-btn sn-btn--primary" to="/achats/reglements/nouveau">
                <Banknote aria-hidden="true" /> Préparer un paiement
              </Link>
            </>
          )}
          info={{
            titre: 'Source des indicateurs',
            contenu: 'Les montants proviennent des factures, règlements et balances comptables exposés par la base. Les écritures et validations restent exécutées par les procédures sécurisées du module.',
          }}
        />

        {failure && <Note tone="danger" icon={AlertTriangle}>{failure}</Note>}

        <StatGrid
          ariaLabel="Synthèse financière des achats aux mines"
          items={[
            { label: 'Achats aux mines', value: francs(overview.totalPurchased), hint: 'Factures nettes des ajustements', icon: ReceiptText, tone: 'neutral' },
            { label: 'Total payé', value: francs(overview.totalPaid), hint: 'Montants affectés aux factures', icon: CheckCircle2, tone: 'green' },
            { label: 'Reste à payer', value: francs(overview.outstanding), hint: 'Solde comptable ouvert', icon: Clock3, tone: overview.outstanding > 0 ? 'gold' : 'green' },
            { label: 'Avances non affectées', value: francs(overview.advances), hint: 'Fonds exécutés à imputer', icon: WalletCards, tone: overview.advances > 0 ? 'blue' : 'neutral' },
          ]}
          sober
        />

        <StatGrid
          ariaLabel="État du circuit des paiements"
          items={[
            { label: 'En attente', value: overview.payments.pending, icon: Clock3, tone: 'gold', onClick: () => navigate('/achats/reglements') },
            { label: 'Validés / exécutés', value: overview.payments.validated, icon: CheckCircle2, tone: 'green', onClick: () => navigate('/achats/reglements') },
            { label: 'Rejetés', value: overview.payments.rejected, icon: XCircle, tone: 'red', onClick: () => navigate('/achats/reglements') },
            { label: 'À corriger', value: overview.payments.correction, icon: AlertTriangle, tone: 'violet', onClick: () => navigate('/achats/reglements') },
          ]}
          sober
        />

        <div className="achats-overview__grid">
          <Section id="allocation-mines" icon={Building2} title="Allocation et soldes par mine" description="Achats facturés, règlements affectés et exposition restante par société.">
            {overview.positions.length === 0 && !loading ? (
              <EmptyState title="Aucun mouvement financier" description="Les positions apparaîtront après émission des premières factures d’achat." />
            ) : (
              <div className="sn-table-wrap">
                <table className="sn-table">
                  <thead><tr><th>Mine</th><th className="is-right">Achats</th><th className="is-right">Payé</th><th className="is-right">Reste dû</th><th className="is-right">Avances</th><th className="is-right">Factures</th></tr></thead>
                  <tbody>{overview.positions.map((position) => (
                    <tr key={position.id}>
                      <td><strong>{position.name}</strong></td>
                      <td className="is-right">{francs(position.purchased)}</td>
                      <td className="is-right achats-overview__positive">{francs(position.paid)}</td>
                      <td className="is-right"><strong>{francs(position.outstanding)}</strong></td>
                      <td className="is-right">{francs(position.advances)}</td>
                      <td className="is-right">{position.invoices}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <div className="achats-overview__section-link"><Link to="/achats/comptes">Ouvrir les comptes des mines →</Link></div>
          </Section>

          <Section id="alertes-financieres" icon={AlertTriangle} title="Alertes de suivi" description={`${totalAlerts} point${totalAlerts > 1 ? 's' : ''} à examiner`} tone={totalAlerts > 0 ? 'amber' : 'emerald'}>
            <div className="achats-overview__alerts">
              {[
                ['Factures échues non soldées', overview.alerts.overdueInvoices, '/achats/comptes'],
                ['Factures contestées ou suspendues', overview.alerts.disputedInvoices, '/achats/comptes'],
                ['Paiements retournés en correction', overview.alerts.correctionPayments, '/achats/reglements'],
                ['Avances restant à affecter', overview.alerts.unmatchedAdvances, '/achats/reglements'],
              ].map(([label, count, to]) => (
                <Link to={String(to)} key={String(label)} className={Number(count) > 0 ? 'is-warning' : ''}>
                  <span>{label}</span><strong>{count}</strong>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <Section id="tendance-paiements" icon={TrendingUp} title="Évolution des paiements" description="Montants validés, exécutés ou rapprochés sur les douze derniers mois." tone="blue">
          <div className="achats-overview__trend" role="img" aria-label="Histogramme des paiements sur douze mois">
            {overview.trend.map((point) => (
              <div key={point.key} className="achats-overview__trend-point" title={`${point.label} : ${francs(point.amount)} — ${point.count} opération(s)`}>
                <strong>{point.amount > 0 ? francs(point.amount) : '—'}</strong>
                <span className="achats-overview__bar"><i style={{ height: `${Math.max(point.amount > 0 ? 8 : 2, (point.amount / trendMaximum) * 100)}%` }} /></span>
                <small>{point.label}</small>
              </div>
            ))}
          </div>
        </Section>

        <div className="achats-overview__grid achats-overview__grid--equal">
          <Section id="dernieres-operations" icon={CircleDollarSign} title="Dernières opérations de paiement" description="Circuit et montant des règlements les plus récents.">
            {overview.recentPayments.length === 0 ? <EmptyState title="Aucun paiement" description="Aucune opération n’a encore été enregistrée." /> : (
              <div className="sn-table-wrap"><table className="sn-table">
                <thead><tr><th>Référence</th><th>Mine</th><th>Date</th><th className="is-right">Montant</th><th>Statut</th></tr></thead>
                <tbody>{overview.recentPayments.map((payment) => {
                  const status = String(payment.statut) as StatutReglementCycle;
                  return <tr key={payment.id}><td><strong>{payment.reference_reglement}</strong></td><td>{payment.mining_company?.name || '—'}</td><td>{formaterDate(payment.date_reglement)}</td><td className="is-right">{francs(payment.montant_fcfa)}</td><td><Badge tone={TONS_CYCLE[status] || 'neutral'}>{paymentLabel(payment)}</Badge></td></tr>;
                })}</tbody>
              </table></div>
            )}
            <div className="achats-overview__section-link"><Link to="/achats/reglements">Voir tous les paiements →</Link></div>
          </Section>

          <Section id="dernieres-factures" icon={FileText} title="Factures récentes" description="Échéances et soldes des derniers achats aux mines." tone="violet">
            {overview.recentInvoices.length === 0 ? <EmptyState title="Aucune facture" description="Les factures émises par les mines apparaîtront ici." /> : (
              <div className="sn-table-wrap"><table className="sn-table">
                <thead><tr><th>Facture</th><th>Mine</th><th>Échéance</th><th className="is-right">Reste dû</th><th>État</th></tr></thead>
                <tbody>{overview.recentInvoices.map((invoice) => (
                  <tr key={invoice.id}><td><strong>{invoice.numero_facture}</strong></td><td>{invoice.mining_company?.name || '—'}</td><td>{formaterDate(invoice.date_echeance)}</td><td className="is-right">{francs(invoice.reste_du_fcfa || 0)}</td><td><Badge tone={invoiceTone(invoice)}>{LIBELLES_STATUT_FACTURE[invoice.statut]}</Badge></td></tr>
                ))}</tbody>
              </table></div>
            )}
            <div className="achats-overview__section-link"><Link to="/achats/comptes">Consulter les factures et relevés →</Link></div>
          </Section>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}

export default ComptesPaiementsOverviewPage;
