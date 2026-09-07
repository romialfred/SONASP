import { customerCountryLabel } from '@/lib/customerCountryLabels';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CreditCard, Edit, Mail, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Card, PageHeader, Section, StatGrid, Tabs } from '@/components/ui/sn';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { BankAccountForm } from '@/components/customers/BankAccountForm';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessPrivateRoute } from '@/lib/routeAccessRegistry';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { customerActivity, customerStatusLabels, loadCustomerDossier, loadCustomerSales, paymentTermLabels, type CustomerDossier, type CustomerSale } from '@/services/customerDossierService';
import { internationalSalesCopy } from '@/pages/sales/internationalSalesCopy';
import './customers.css';

const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('fr-FR') : 'Non renseignée';
const amountLabel = (value: number | null, currency: string | null) => {
  if (value === null || !Number.isFinite(value) || !currency) return 'Non disponible';
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value); } catch { return 'Devise à vérifier'; }
};

export function CustomerProfile() {
  const { id } = useParams();
  const location = useLocation();
  const previous = location.state?.customersReturnTo;
  const returnTo = typeof previous === 'string' && /^\/customers(?:\?[^#]*)?$/.test(previous) ? previous : '/customers';
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organization_id, user?.mining_company_id, user?.access_role_id, user?.role, user?.organization_type, user?.is_active, user?.capabilities, user?.module_codes]);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; dossier: CustomerDossier | null; sales: CustomerSale[] | null; error: string; salesError: string; loading: boolean }>({ key: '', dossier: null, sales: null, error: '', salesError: '', loading: true });
  const [tab, setTab] = useState<'overview' | 'transactions'>('overview');
  const key = `${scope}:${id}`;
  useEffect(() => {
    let current = true;
    setState({ key, dossier: null, sales: null, error: '', salesError: '', loading: true });
    if (!id) return;
    void Promise.allSettled([loadCustomerDossier(id), loadCustomerSales(id)]).then(([dossier, sales]) => {
      if (!current) return;
      setState({ key, dossier: dossier.status === 'fulfilled' ? dossier.value : null,
        sales: sales.status === 'fulfilled' ? sales.value : null, loading: false,
        error: dossier.status === 'rejected' ? messageErreurUtilisateur(dossier.reason, 'Impossible de charger le dossier client.') : '',
        salesError: sales.status === 'rejected' ? messageErreurUtilisateur(sales.reason, 'Impossible de charger les ventes du client.') : '' });
    });
    return () => { current = false; };
  }, [id, key, reload]);
  const refresh = <Button variant="outline" onClick={() => setReload(value => value + 1)}><RefreshCw className="h-4 w-4" />Actualiser</Button>;
  if (state.key !== key || state.loading) return <NationalDashboardLayout><Loading /></NationalDashboardLayout>;
  if (state.error || !state.dossier) return <NationalDashboardLayout><div className="sn-page customer-page"><PageHeader title="Dossier client indisponible" icon={Building2} actions={refresh} /><Alert type="error">{state.error || 'Le client est introuvable ou inaccessible.'}</Alert><Link to={returnTo} className="customer-link">Retour aux clients</Link></div></NationalDashboardLayout>;
  const { customer, banks } = state.dossier;
  const activity = state.sales ? customerActivity(state.sales) : null;
  const monthly = new Map<string, number>();
  if (activity?.total !== null && activity?.currency) activity.approved.forEach(sale => {
    if (sale.created_at && Number.isFinite(Date.parse(sale.created_at))) { const month = sale.created_at.slice(0, 7); monthly.set(month, (monthly.get(month) ?? 0) + sale.final_proceeds!); }
  });
  const series = [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ name: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }), amount }));
  const facts = [
    ['Raison sociale', customer.name], ['Personne à contacter', customer.contact_person], ['Adresse électronique', customer.email], ['Téléphone', customer.phone],
    ['Pays', customerCountryLabel(customer.country)], ['Adresse', customer.address], ['Identifiant fiscal / immatriculation', customer.tax_id],
    ['Conditions de paiement', paymentTermLabels[customer.payment_terms ?? ''] ?? customer.payment_terms],
    ['Limite de crédit', customer.credit_limit === null ? null : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(customer.credit_limit)], ['Création du dossier', dateLabel(customer.created_at)],
  ];
  return <NationalDashboardLayout><div className="sn-page customer-page">
    <PageHeader title={customer.name} subtitle="Dossier commercial et activité du client international." icon={Building2}
      breadcrumb={[{ label: 'Clients internationaux', to: returnTo }, { label: customer.name }]}
      actions={<>{refresh}{canAccessPrivateRoute(user, `/customers/${id}/edit`) && <Link className="sn-btn sn-btn--primary" to={`/customers/${id}/edit`}><Edit />Modifier le dossier</Link>}</>} />
    <div className="customer-context"><Badge tone={customer.status === 'active' ? 'success' : customer.status === 'pending' ? 'warning' : 'neutral'}>{customerStatusLabels[customer.status ?? ''] ?? 'Non renseigné'}</Badge><span>{customerCountryLabel(customer.country) || 'Pays non renseigné'}</span><Link className="customer-link" to={returnTo}><ArrowLeft className="h-4 w-4" />Retour au répertoire</Link></div>
    {state.salesError && <Alert type="error" title="Indicateurs indisponibles">{state.salesError} Les montants et les ventes ne peuvent pas être affichés.</Alert>}
    <StatGrid sober ariaLabel="Activité commerciale du client" items={[
      { label: 'Ventes approuvées', value: activity?.count ?? '—', icon: TrendingUp, hint: 'Périmètre des ventes approuvées' },
      { label: 'Montant des ventes', value: activity ? amountLabel(activity.total, activity.currency) : '—', icon: Wallet, hint: !activity ? 'Ventes indisponibles' : activity.count ? 'Aucune conversion entre devises' : 'Aucune vente approuvée' },
      { label: 'Moyenne par vente', value: activity ? amountLabel(activity.average, activity.currency) : '—', icon: CreditCard, hint: 'Montant / nombre de ventes approuvées' },
      { label: 'Banques actives', value: banks.length, icon: Building2, hint: `${banks.filter(bank => bank.isPrimary).length} compte principal` },
    ]} />
    <Tabs value={tab} onChange={setTab} ariaLabel="Sections du dossier client" options={[{ value: 'overview', label: 'Vue d’ensemble' }, { value: 'transactions', label: state.sales ? `Transactions (${state.sales.length})` : 'Transactions' }]} />
    <div id={`sn-panneau-${tab}`} role="tabpanel" aria-labelledby={`sn-tab-${tab}`}>
    {tab === 'overview' ? <div className="customer-detail-grid">
      <div className="space-y-5"><Section id="customer-identity" title="Identité et conditions commerciales" icon={Building2}><dl className="customer-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Non renseigné'}</dd></div>)}</dl></Section>
      <Section id="customer-banks" title="Coordonnées bancaires" icon={Wallet}><BankAccountForm banks={banks} onChange={() => undefined} readOnly /></Section>
      <Card className="customer-surface" title="Évolution des ventes approuvées" hint="Montants regroupés par mois de création de la vente.">{series.length && activity?.currency ? <><LineChartWidget height={240} data={series} lines={[{ dataKey: 'amount', color: '#bb870b', name: activity.currency }]} /><details><summary>Données du graphique</summary><dl className="customer-facts">{series.map(point => <div key={point.name}><dt>{point.name}</dt><dd>{amountLabel(point.amount, activity.currency)}</dd></div>)}</dl></details></> : <p className="customer-empty">{state.salesError ? 'Ventes indisponibles.' : activity?.count ? 'Montants incomplets ou devises différentes : aucun total consolidé.' : 'Aucune vente approuvée à représenter.'}</p>}</Card></div>
      <aside className="space-y-5"><Card className="customer-surface" title="Suivi du client"><dl className="customer-facts"><div><dt>Dernière vente approuvée</dt><dd>{activity ? activity.lastDate ? dateLabel(activity.lastDate) : 'Aucune' : 'Non disponible'}</dd></div><div><dt>Ventes réglées ou clôturées</dt><dd>{activity ? `${activity.paidCount} / ${activity.count}` : 'Non disponible'}</dd></div></dl><p className="text-sm text-gray-500 mt-3">Le statut des ventes ne représente pas un taux d’encaissement. Consultez les paiements pour connaître les règlements.</p></Card>
      <Card className="customer-surface" title="Actions"><div className="customer-quick-actions">
        {canAccessPrivateRoute(user, '/sales/new') && <Link className="sn-btn sn-btn--primary" to="/sales/new"><TrendingUp />Créer une vente</Link>}
        {canAccessPrivateRoute(user, '/payments') && <Link className="sn-btn" to="/payments"><CreditCard />Registre des paiements</Link>}
        {customer.email ? <a className="sn-btn" href={`mailto:${encodeURIComponent(customer.email)}`}><Mail />Écrire au client</a> : <p>Adresse électronique non renseignée.</p>}
      </div></Card></aside>
    </div> : <Card className="customer-surface" title="Ventes du client" hint="Chaque ligne ouvre la vente enregistrée correspondante."><div className="sn-table-wrap"><table className="sn-table"><thead><tr><th>Référence</th><th>Date de création</th><th className="sn-table__num">Quantité</th><th className="sn-table__num">Montant</th><th>Statut</th><th>Action</th></tr></thead><tbody>
      {state.sales?.map(sale => <tr key={sale.id}><td><strong>{sale.sale_number || 'Sans référence'}</strong></td><td>{dateLabel(sale.created_at)}</td><td className="sn-table__num">{sale.quantity_oz === null ? 'Non renseignée' : `${sale.quantity_oz.toLocaleString('fr-FR')} oz`}</td><td className="sn-table__num">{amountLabel(sale.final_proceeds, sale.currency)}</td><td>{internationalSalesCopy.fr.statuses[sale.status ?? ''] ?? 'À vérifier'}</td><td><Link className="customer-link" aria-label={`Consulter la vente ${sale.sale_number || sale.id}`} to={`/sales/${sale.id}`}>Consulter</Link></td></tr>)}
      {!state.sales?.length && <tr><td colSpan={6} className="customer-empty">{state.salesError ? 'Ventes indisponibles. Utilisez Actualiser pour réessayer.' : 'Aucune vente enregistrée pour ce client.'}</td></tr>}
    </tbody></table></div></Card>}
    </div>
  </div></NationalDashboardLayout>;
}
