import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Banknote,
  Boxes,
  ChevronRight,
  Coins,
  FileCheck2,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShoppingBasket,
  Store,
  Users,
} from 'lucide-react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useComptoirWorkspace } from '@/hooks/useComptoirWorkspace';
import {
  comptoirPortalService,
  type ComptoirDashboardData,
} from '@/services/comptoirPortalService';
import './comptoir-portal.css';

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fcfa = (value: number) => `${integer.format(value)} FCFA`;

const EMPTY: ComptoirDashboardData = {
  assignedMiners: 0,
  purchasesCount: 0,
  purchasedGrams: 0,
  pendingDgiInvoices: 0,
  certifiedDgiInvoices: 0,
  pendingPayments: 0,
  taxesCollectedFcfa: 0,
  taxesToRemitFcfa: 0,
  stockGrams: 0,
  salesToSonaspGrams: 0,
  recentPurchases: [],
  trend: [],
};

export default function ComptoirPortalPage() {
  const { workspace, displayName, loading: workspaceLoading } = useComptoirWorkspace();
  const [data, setData] = useState<ComptoirDashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await comptoirPortalService.getDashboard(workspace.id));
    } catch (loadError) {
      console.error(loadError);
      setError('Les indicateurs du comptoir ne sont pas disponibles pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspace?.id) void load();
    else if (!workspaceLoading) setLoading(false);
  }, [workspace?.id, workspaceLoading]);

  const complianceRate = useMemo(() => {
    const total = data.pendingDgiInvoices + data.certifiedDgiInvoices;
    return total === 0 ? 0 : Math.round((data.certifiedDgiInvoices / total) * 100);
  }, [data.certifiedDgiInvoices, data.pendingDgiInvoices]);

  if (!workspaceLoading && !workspace) {
    return (
      <NationalDashboardLayout>
        <main className="comptoir-page comptoir-empty">
          <Store aria-hidden="true" />
          <h1>Comptoir non rattaché</h1>
          <p>Votre compte possède une habilitation Comptoir, mais aucun périmètre actif ne lui est attribué.</p>
        </main>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <main className="comptoir-page" aria-busy={loading}>
        <header className="comptoir-page__heading">
          <div>
            <span className="comptoir-page__eyebrow">Pilotage du comptoir</span>
            <h1>{displayName}</h1>
            <p>Achats artisanaux, conformité fiscale et stock disponible.</p>
          </div>
          <button type="button" className="comptoir-button is-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'is-spinning' : ''} aria-hidden="true" />
            Actualiser
          </button>
        </header>

        {error && <div className="comptoir-alert" role="alert">{error}</div>}
        {loading && <div className="comptoir-progress" role="status"><RefreshCw className="is-spinning" aria-hidden="true" /> Mise à jour des indicateurs…</div>}

        <section className="comptoir-kpis" aria-label="Indicateurs clés du comptoir">
          <Kpi icon={Coins} label="Stock disponible" value={`${decimal.format(data.stockGrams / 1000)} kg`} detail={`${decimal.format(data.stockGrams)} g`} tone="copper" />
          <Kpi icon={ShoppingBasket} label="Achats enregistrés" value={integer.format(data.purchasesCount)} detail={`${decimal.format(data.purchasedGrams / 1000)} kg collectés`} tone="plum" />
          <Kpi icon={FileCheck2} label="Factures DGI" value={`${complianceRate} %`} detail={`${data.pendingDgiInvoices} à certifier`} tone="blue" />
          <Kpi icon={Landmark} label="Taxes collectées" value={fcfa(data.taxesCollectedFcfa)} detail={`${fcfa(data.taxesToRemitFcfa)} à reverser`} tone="gold" />
          <Kpi icon={Users} label="Orpailleurs rattachés" value={integer.format(data.assignedMiners)} detail="Périmètre autorisé" tone="green" />
        </section>

        <section className="comptoir-grid">
          <article className="comptoir-panel comptoir-trend">
            <div className="comptoir-panel__head">
              <div>
                <span>6 derniers mois</span>
                <h2>Collecte et fiscalité</h2>
              </div>
              <span className="comptoir-pill"><BadgeCheck aria-hidden="true" /> Périmètre sécurisé</span>
            </div>
            <div className="comptoir-chart" aria-label="Tendance mensuelle des achats et des taxes">
              {data.trend.length === 0 ? (
                <p className="comptoir-muted">Aucune donnée sur la période.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={data.trend} margin={{ top: 12, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="comptoir-purchases" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b4b3e" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#8b4b3e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eadfd9" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6b5a55', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="grams" tick={{ fill: '#6b5a55', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k g`} />
                    <YAxis yAxisId="taxes" orientation="right" tick={{ fill: '#6b5a55', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                    <Tooltip formatter={(value, name) => name === 'Taxes collectées' ? fcfa(Number(value)) : `${decimal.format(Number(value))} g`} />
                    <Area yAxisId="grams" type="monotone" dataKey="purchasesGrams" name="Or acheté" stroke="#8b4b3e" strokeWidth={2.5} fill="url(#comptoir-purchases)" />
                    <Area yAxisId="grams" type="monotone" dataKey="salesGrams" name="Cédé à la SONASP" stroke="#b7791f" strokeWidth={2} fill="transparent" />
                    <Line yAxisId="taxes" type="monotone" dataKey="taxesFcfa" name="Taxes collectées" stroke="#3e6594" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="sr-only">Le graphique compare les grammes achetés et cédés à la SONASP chaque mois.</p>
          </article>

          <aside className="comptoir-panel comptoir-priorities" aria-labelledby="priorities-title">
            <div className="comptoir-panel__head">
              <div><span>À traiter</span><h2 id="priorities-title">Priorités</h2></div>
            </div>
            <Priority icon={FileCheck2} value={data.pendingDgiInvoices} label="factures à certifier DGI" to="/artisan-minier/paiements" />
            <Priority icon={Banknote} value={data.pendingPayments} label="paiements en cours" to="/artisan-minier/paiements/historique" />
            <Priority icon={Landmark} value={fcfa(data.taxesToRemitFcfa)} label="de taxes à reverser" to="/artisan-minier/rapports/taxes" />
          </aside>
        </section>

        <section className="comptoir-panel comptoir-actions" aria-labelledby="actions-title">
          <div className="comptoir-panel__head">
            <div><span>Accès directs</span><h2 id="actions-title">Opérations du comptoir</h2></div>
          </div>
          <div className="comptoir-actions__grid">
            <QuickLink icon={ShoppingBasket} title="Nouvel achat" detail="Saisir la collecte" to="/artisan-minier/ventes-or/nouvelle" tone="plum" />
            <QuickLink icon={Users} title="Mes orpailleurs" detail="Voir les acteurs rattachés" to="/artisan-minier/liste" tone="green" />
            <QuickLink icon={ReceiptText} title="Factures & paiements" detail="Certifier puis régler" to="/artisan-minier/paiements" tone="blue" />
            <QuickLink icon={Boxes} title="Stock du comptoir" detail="Mouvements et disponibilité" to="/portail-comptoir/stock" tone="copper" />
            <QuickLink icon={Store} title="Cession SONASP" detail="Aucun accès international" to="/portail-comptoir/ventes-sonasp" tone="gold" />
          </div>
        </section>

        <section className="comptoir-panel comptoir-recent" aria-labelledby="recent-title">
          <div className="comptoir-panel__head">
            <div><span>Dernières opérations</span><h2 id="recent-title">Achats récents</h2></div>
            <Link to="/artisan-minier/ventes-or">Voir le registre <ChevronRight aria-hidden="true" /></Link>
          </div>
          <div className="comptoir-table-wrap">
            <table>
              <caption className="sr-only">Six derniers achats enregistrés par le comptoir</caption>
              <thead><tr><th>Référence</th><th>Orpailleur</th><th>Date</th><th className="is-number">Quantité</th><th className="is-number">Montant</th><th>État</th></tr></thead>
              <tbody>
                {data.recentPurchases.length === 0 ? (
                  <tr><td colSpan={6} className="comptoir-table-empty">Aucun achat enregistré.</td></tr>
                ) : data.recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td><strong>{purchase.reference}</strong></td>
                    <td>{purchase.artisanName}</td>
                    <td>{new Date(purchase.date).toLocaleDateString('fr-FR')}</td>
                    <td className="is-number">{decimal.format(purchase.quantityGrams)} g</td>
                    <td className="is-number">{fcfa(purchase.amountFcfa)}</td>
                    <td><span className={`comptoir-status is-${purchase.status}`}>{purchase.status.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </NationalDashboardLayout>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone }: { icon: typeof Coins; label: string; value: string; detail: string; tone: string }) {
  return <article className={`comptoir-kpi is-${tone}`}><span><Icon aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function Priority({ icon: Icon, value, label, to }: { icon: typeof Coins; value: string | number; label: string; to: string }) {
  return <Link className="comptoir-priority" to={to}><span><Icon aria-hidden="true" /></span><div><strong>{value}</strong><small>{label}</small></div><ChevronRight aria-hidden="true" /></Link>;
}

function QuickLink({ icon: Icon, title, detail, to, tone }: { icon: typeof Coins; title: string; detail: string; to: string; tone: string }) {
  return <Link className={`comptoir-quick is-${tone}`} to={to}><span><Icon aria-hidden="true" /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight aria-hidden="true" /></Link>;
}
