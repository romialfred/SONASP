import { customerCountryLabel } from '@/lib/customerCountryLabels';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Plus, RefreshCw, Search, TrendingUp, Users, Wallet } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Card, PageHeader, StatGrid, Tabs } from '@/components/ui/sn';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessPrivateRoute } from '@/lib/routeAccessRegistry';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { customerActivity, customerStatusLabels, loadCustomerDirectory, loadCustomerSales, type CustomerRow, type CustomerSale } from '@/services/customerDossierService';
import './customers.css';

export function CustomerListing() {
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organization_id, user?.mining_company_id, user?.access_role_id, user?.role, user?.organization_type, user?.is_active, user?.capabilities, user?.module_codes]);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ scope: string; customers: CustomerRow[]; sales: CustomerSale[] | null; loading: boolean; error: string; salesError: string }>({ scope: '', customers: [], sales: null, loading: true, error: '', salesError: '' });
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const country = params.get('country') ?? 'all';
  const statusParam = params.get('status') ?? 'all';
  const status = ['all', 'active', 'inactive', 'pending', 'unknown'].includes(statusParam) ? statusParam : 'all';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const size = Number(params.get('size') ?? 10);
  const pageSize = [10, 25, 50].includes(size) ? size : 10;
  const changeFilter = (changes: Record<string, string | number>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    Object.entries(changes).forEach(([key, value]) => { if (value === '' || value === 'all') next.delete(key); else next.set(key, String(value)); });
    return next;
  }, { replace: true });
  const returnTo = `/customers${params.size ? `?${params.toString()}` : ''}`;
  useEffect(() => {
    let current = true;
    setState({ scope, customers: [], sales: null, loading: true, error: '', salesError: '' });
    void Promise.allSettled([loadCustomerDirectory(), loadCustomerSales()]).then(([customers, sales]) => {
      if (!current) return;
      setState({ scope, customers: customers.status === 'fulfilled' ? customers.value : [], sales: sales.status === 'fulfilled' ? sales.value : null, loading: false,
        error: customers.status === 'rejected' ? messageErreurUtilisateur(customers.reason, 'Impossible de charger les clients.') : '',
        salesError: sales.status === 'rejected' ? messageErreurUtilisateur(sales.reason, 'Impossible de charger les ventes.') : '' });
    });
    return () => { current = false; };
  }, [scope, reload]);
  const reset = () => setParams({});
  const base = state.customers.filter(customer => `${customer.name} ${customer.email}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')) && (country === 'all' || customer.country === country));
  const filtered = base.filter(customer => status === 'all' || (customer.status ?? 'unknown') === status);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const customerIds = new Set(state.customers.map(customer => customer.id));
  const activity = state.sales ? customerActivity(state.sales.filter(sale => sale.customer_id && customerIds.has(sale.customer_id))) : null;
  const activityByCustomer = new Map(state.customers.map(customer => [customer.id, state.sales ? customerActivity(state.sales.filter(sale => sale.customer_id === customer.id)) : null]));
  const totalLabel = (total: number | null | undefined, currency: string | null | undefined) => {
    if (total == null || !currency) return 'Non disponible';
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(total); } catch { return 'Devise à vérifier'; }
  };
  const ready = state.scope === scope && !state.loading;
  return <NationalDashboardLayout><div className="sn-page customer-page">
    <PageHeader title="Clients internationaux" subtitle="Répertoire des partenaires commerciaux et suivi des ventes." icon={Building2}
      breadcrumb={[{ label: 'Accueil', to: '/dashboard' }, { label: 'Clients internationaux' }]}
      actions={<><Button variant="outline" disabled={!ready} onClick={() => setReload(value => value + 1)}><RefreshCw className="h-4 w-4" />Actualiser</Button>{canAccessPrivateRoute(user, '/customers/new') && <Link to="/customers/new" className="sn-btn sn-btn--primary"><Plus />Ajouter un client</Link>}</>} />
    {!ready ? <Loading /> : state.error ? <Alert type="error" title="Répertoire indisponible">{state.error} Utilisez Actualiser pour réessayer.</Alert> : <>
      {state.salesError && <Alert type="error" title="Indicateurs indisponibles">{state.salesError} Les données commerciales restent indisponibles jusqu’au prochain chargement réussi.</Alert>}
      <StatGrid sober ariaLabel="Synthèse des clients" items={[
        { label: 'Clients enregistrés', value: state.customers.length, icon: Users, hint: 'Répertoire accessible' },
        { label: 'Clients actifs', value: state.customers.filter(customer => customer.status === 'active').length, icon: Building2, hint: 'Statut actif enregistré' },
        { label: 'Ventes approuvées', value: activity?.count ?? '—', icon: TrendingUp, hint: 'Clients du répertoire' },
        { label: 'Montant des ventes', value: totalLabel(activity?.total, activity?.currency), icon: Wallet, hint: activity?.count === 0 ? 'Aucune vente approuvée' : 'Sans conversion entre devises' },
        { label: 'Moyenne par vente', value: totalLabel(activity?.average, activity?.currency), icon: Wallet, hint: 'Sans conversion entre devises' },
      ]} />
      <Card className="customer-surface" title="Répertoire des clients" hint={`${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`}>
        <div className="customer-filters"><label className="customer-search"><Search aria-hidden="true" /><span className="sr-only">Rechercher un client</span><input value={search} onChange={event => { changeFilter({ q: event.target.value, page: 1 }); }} placeholder="Nom ou adresse électronique…" /></label>
          <label><span className="sr-only">Pays du client</span><select value={country} onChange={event => { changeFilter({ country: event.target.value, page: 1 }); }}><option value="all">Tous les pays</option>{[...new Set(state.customers.map(customer => customer.country))].sort().map(value => <option key={value} value={value}>{customerCountryLabel(value) || 'Non renseigné'}</option>)}</select></label>
          <Button variant="outline" onClick={reset}>Réinitialiser</Button>
        </div>
        <Tabs value={status} onChange={value => { changeFilter({ status: value, page: 1 }); }} ariaLabel="Filtrer les clients par statut" options={[
          { value: 'all', label: `Tous (${base.length})` }, ...Object.entries(customerStatusLabels).map(([value, label]) => ({ value, label: `${label} (${base.filter(customer => customer.status === value).length})` })),
          ...((status === 'unknown' || state.customers.some(customer => !customer.status)) ? [{ value: 'unknown', label: `Non renseigné (${base.filter(customer => !customer.status).length})` }] : []),
        ]} />
        <div id={`sn-panneau-${status}`} role="tabpanel" aria-labelledby={`sn-tab-${status}`} className="sn-table-wrap"><table className="sn-table"><thead><tr><th>Client</th><th>Pays</th><th className="sn-table__num">Ventes approuvées</th><th className="sn-table__num">Montant des ventes</th><th>Statut</th><th>Action</th></tr></thead><tbody>
          {rows.map(customer => { const metrics = activityByCustomer.get(customer.id); return <tr key={customer.id}><td><Link className="customer-name" to={`/customers/${customer.id}`} state={{ customersReturnTo: returnTo }}>{customer.name}</Link><small className="block text-gray-500">{customer.email}</small></td><td>{customerCountryLabel(customer.country) || 'Non renseigné'}</td><td className="sn-table__num">{metrics?.count ?? '—'}</td><td className="sn-table__num">{metrics?.count === 0 ? 'Aucune vente approuvée' : totalLabel(metrics?.total, metrics?.currency)}</td><td><Badge tone={customer.status === 'active' ? 'success' : customer.status === 'pending' ? 'warning' : 'neutral'}>{customerStatusLabels[customer.status ?? ''] ?? 'Non renseigné'}</Badge></td><td><Link className="customer-link" aria-label={`Consulter ${customer.name}`} to={`/customers/${customer.id}`} state={{ customersReturnTo: returnTo }}>Consulter</Link></td></tr>; })}
          {!rows.length && <tr><td colSpan={6} className="customer-empty">{state.customers.length ? 'Aucun client ne correspond aux filtres.' : 'Aucun client enregistré dans votre périmètre.'}</td></tr>}
        </tbody></table></div>
        <div className="customer-pagination"><label>Afficher <select aria-label="Clients par page" value={pageSize} onChange={event => { changeFilter({ size: Number(event.target.value), page: 1 }); }}>{[10,25,50].map(value => <option key={value}>{value}</option>)}</select></label><span aria-live="polite">{filtered.length ? (currentPage-1)*pageSize+1 : 0}–{Math.min(currentPage*pageSize,filtered.length)} sur {filtered.length}</span><div className="customer-actions"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => changeFilter({ page: currentPage-1 })}>Précédent</Button><span>{currentPage} / {pages}</span><Button variant="outline" size="sm" disabled={currentPage === pages} onClick={() => changeFilter({ page: currentPage+1 })}>Suivant</Button></div></div>
      </Card>
    </>}
  </div></NationalDashboardLayout>;
}
