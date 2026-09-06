import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Landmark, Loader2, PencilLine, Plus, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, DataTable, Field, Note, PageHeader, StatGrid, type Column } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  ORGANIZATION_TYPE_OPTIONS,
  organizationService,
  organizationTypeLabel,
  type Ministry,
  type OrganizationSummary,
} from '@/services/organizationService';
import '../admin/admin.css';
import './organizations.css';

type StateFilter = 'all' | 'active' | 'inactive';

export function OrganizationsPage({ comptoirsOnly = false }: { comptoirsOnly?: boolean } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isDgmg = user?.role === 'dgmg' || comptoirsOnly;
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [ministry, setMinistry] = useState('all');
  const [state, setState] = useState<StateFilter>('active');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [organizationRows, ministryRows] = await Promise.all([
        organizationService.list(),
        organizationService.listMinistries(),
      ]);
      setOrganizations(isDgmg ? organizationRows.filter(item => item.organization_type === 'comptoir') : organizationRows);
      setMinistries(ministryRows);
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de charger le référentiel des organisations.'));
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [isDgmg]);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return organizations.filter((organization) => {
      const matchesSearch = !needle || [
        organization.name,
        organization.short_name,
        organization.code,
        organization.ministry?.name,
        organization.service_code,
      ].some((value) => value?.toLowerCase().includes(needle));
      const matchesType = type === 'all' || organization.organization_type === type;
      const matchesMinistry = ministry === 'all' || organization.supervising_ministry_id === ministry;
      const matchesState = state === 'all'
        || (state === 'active' ? organization.is_active : !organization.is_active);
      return matchesSearch && matchesType && matchesMinistry && matchesState;
    });
  }, [organizations, search, type, ministry, state]);

  const columns: Column<OrganizationSummary>[] = [
    {
      key: 'name',
      header: 'Organisation',
      render: (row) => (
        <div className="organisations__identity">
          <span aria-hidden="true"><Building2 /></span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.short_name || row.code}</small>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (row) => <code>{row.code}</code> },
    { key: 'type', header: 'Type', render: (row) => organizationTypeLabel(row.organization_type) },
    {
      key: 'ministry',
      header: 'Ministère de tutelle',
      render: (row) => (
        <>
          <strong>{row.ministry?.code || '—'}</strong>
          <small>{row.ministry?.name || 'Non renseigné'}</small>
        </>
      ),
    },
    {
      key: 'scope',
      header: 'Périmètre',
      render: (row) => row.parent
        ? <><strong>{row.parent.code}</strong><small>Organisation parente</small></>
        : row.administrative_region || row.zone_code || 'National',
    },
    {
      key: 'status',
      header: 'État',
      render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <button
          type="button"
          className="sn-btn sn-btn--icon"
          aria-label={`Modifier ${row.name}`}
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/stakeholders/organizations/${row.id}/edit`);
          }}
        >
          <PencilLine aria-hidden="true" />
        </button>
      ),
    },
  ];

  const institutionalTypes = new Set(['sonasp', 'dgi', 'dgmg', 'public_institution']);

  if (isDgmg) return <Navigate replace to="/artisan-minier/comptoirs" />;

  return (
    <NationalDashboardLayout>
      <main className="sn-page admin-page organisations">
        <PageHeader
          icon={Landmark}
          title={isDgmg ? 'Comptoirs' : 'Organisations'}
          subtitle="Référentiel institutionnel, rattachements métier et ministères de tutelle."
          breadcrumb={[{ label: 'Parties prenantes' }, { label: 'Organisations' }]}
          actions={(
            <button className="sn-btn sn-btn--primary" type="button" onClick={() => navigate(isDgmg ? '/stakeholders/organizations/new?type=comptoir' : '/stakeholders/organizations/new')}>
              <Plus aria-hidden="true" /> {isDgmg ? 'Nouveau comptoir' : 'Nouvelle organisation'}
            </button>
          )}
        />

        {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}

        <StatGrid
          ariaLabel="Synthèse des organisations"
          sober
          items={[
            { label: 'Organisations', value: organizations.length, icon: Building2, tone: 'blue' },
            { label: 'Actives', value: organizations.filter((item) => item.is_active).length, icon: ShieldCheck, tone: 'green' },
            { label: 'Institutionnelles', value: organizations.filter((item) => institutionalTypes.has(item.organization_type)).length, icon: Landmark, tone: 'gold' },
            { label: 'Ministères de tutelle', value: new Set(organizations.map((item) => item.supervising_ministry_id)).size, icon: Landmark, tone: 'violet' },
          ]}
        />

        <section className="sn-card admin-page__filtres" aria-label="Filtres des organisations">
          <Field label="Rechercher" htmlFor="organization-search" wide>
            <input
              id="organization-search"
              type="search"
              value={search}
              placeholder="Nom, sigle, code, ministère…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field label="Type" htmlFor="organization-type">
            <select id="organization-type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">Tous les types</option>
              {ORGANIZATION_TYPE_OPTIONS.filter(option => !isDgmg || option.value === 'comptoir').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Ministère" htmlFor="organization-ministry">
            <select id="organization-ministry" value={ministry} onChange={(event) => setMinistry(event.target.value)}>
              <option value="all">Tous les ministères</option>
              {ministries.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </Field>
          <Field label="État" htmlFor="organization-state">
            <select id="organization-state" value={state} onChange={(event) => setState(event.target.value as StateFilter)}>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
              <option value="all">Toutes</option>
            </select>
          </Field>
        </section>

        <section className="sn-card organisations__table" aria-label="Liste des organisations">
          {loading && organizations.length === 0 ? (
            <div className="admin-page__loading"><Loader2 className="sn-spin" aria-hidden="true" /> Chargement des organisations…</div>
          ) : (
            <DataTable
              columns={columns}
              rows={visible}
              caption="Référentiel des organisations"
              empty="Aucune organisation ne correspond aux filtres."
              onRowClick={(row) => navigate(`/stakeholders/organizations/${row.id}/edit`)}
            />
          )}
        </section>
      </main>
    </NationalDashboardLayout>
  );
}
