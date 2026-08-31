import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, FileCheck2, Landmark, Scale, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import { evaluatePrivateRouteAccess } from '@/lib/routeAccessRegistry';
import './institutional-portal.css';

type InstitutionalPortal = 'dgmg' | 'dgi';

interface Metric {
  label: string;
  value: number | null;
  hint: string;
}

async function loadMetricCounts(
  portal: InstitutionalPortal,
  allowedIndexes: readonly number[],
): Promise<Array<number | null>> {
  const loaders: Array<() => Promise<number | null>> = portal === 'dgmg'
    ? [
        async () => {
          const { count, error } = await supabase.from('mining_companies').select('id', { count: 'exact', head: true });
          return error ? null : count ?? 0;
        },
        async () => {
          const { count, error } = await supabase.from('artisanal_sites').select('id', { count: 'exact', head: true });
          return error ? null : count ?? 0;
        },
        async () => {
          const { count, error } = await supabase.from('daily_production').select('id', { count: 'exact', head: true });
          return error ? null : count ?? 0;
        },
      ]
    : [
        async () => {
          const { count, error } = await supabase.from('snp_regles_fiscales').select('id', { count: 'exact', head: true });
          return error ? null : count ?? 0;
        },
        async () => {
          const { count, error } = await supabase.from('snp_artisan_ventes_or').select('id', { count: 'exact', head: true });
          return error ? null : count ?? 0;
        },
        async () => {
          const { data, error } = await supabase.rpc('snp_dgi_lister_paiements_fiscaux', {
            p_limit: 200,
            p_offset: 0,
          });
          return error ? null : data?.length ?? 0;
        },
      ];

  return Promise.all(allowedIndexes.map((index) => loaders[index]?.() ?? Promise.resolve(null)));
}

const CONFIG = {
  dgmg: {
    label: 'Portail DGMG',
    subtitle: 'Supervision réglementaire des opérateurs, sites et productions minières.',
    icon: Landmark,
    metrics: [
      { label: 'Sociétés minières', hint: 'opérateurs visibles', to: '/artisan-sites' },
      { label: 'Sites artisanaux', hint: 'sites du périmètre', to: '/artisan-sites' },
      { label: 'Déclarations', hint: 'productions accessibles', to: '/production/daily' },
    ],
    workspaces: [
      { label: 'Registre des sites', description: 'Sites semi-mécanisés et périmètres réglementaires.', to: '/artisan-sites' },
      { label: 'Artisans et opérateurs', description: 'Acteurs visibles dans le périmètre DGMG.', to: '/artisan-minier/liste' },
      { label: 'Productions déclarées', description: 'Consultation des déclarations accessibles.', to: '/production/daily' },
      { label: 'Validations Réserve — niveau 1', description: 'File réglementaire limitée au premier contrôle indépendant.', to: '/portail-dgmg/reserve-validations' },
    ],
  },
  dgi: {
    label: 'Portail DGI',
    subtitle: 'Contrôle des assiettes, taxes, royalties et rapprochements fiscaux.',
    icon: Scale,
    metrics: [
      { label: 'Règles fiscales', hint: 'versions accessibles', to: '/conciliation/regles-fiscales' },
      { label: 'Ventes déclarées', hint: 'opérations du périmètre', to: '/artisan-minier/ventes-or' },
      { label: 'Paiements', hint: 'règlements rapprochables', to: '/portail-dgi/paiements' },
    ],
    workspaces: [
      { label: 'Observation production', description: 'Volumes et déclarations servant aux assiettes.', to: '/production/daily' },
      { label: 'Ventes déclarées', description: 'Valeurs, volumes et opérateurs accessibles.', to: '/artisan-minier/ventes-or' },
      { label: 'Paiements fiscaux', description: 'Montants payés et retenues, sans données bancaires ni preuves privées.', to: '/portail-dgi/paiements' },
      { label: 'Taxes et redevances', description: 'Assiettes, taux et historique fiscal.', to: '/artisan-minier/rapports/taxes' },
      { label: 'Conciliations', description: 'Écarts et dossiers fiscaux à analyser.', to: '/conciliation' },
      { label: 'Règles fiscales', description: 'Barèmes versionnés applicables.', to: '/conciliation/regles-fiscales' },
    ],
  },
} as const;

export function InstitutionalPortalPage({ portal }: { portal: InstitutionalPortal }) {
  const { user } = useAuth();
  const config = CONFIG[portal];
  const [organizationName, setOrganizationName] = useState<string>('Périmètre institutionnel');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const accessibleWorkspaces = useMemo(() => (
    config.workspaces.filter((workspace) => evaluatePrivateRouteAccess(user, workspace.to).allowed)
  ), [config.workspaces, user]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const allowedMetricIndexes = config.metrics.flatMap((metric, index) => (
        evaluatePrivateRouteAccess(user, metric.to).allowed ? [index] : []
      ));
      setMetrics(allowedMetricIndexes.map((index) => ({ ...config.metrics[index], value: null })));
      if (
        !user?.id
        || user.role !== portal
        || !user.organization_id
        || user.organization_type !== portal
      ) {
        if (active) {
          setLoadError('Le rattachement institutionnel de ce compte est absent ou incompatible.');
          setLoading(false);
        }
        return;
      }
      try {
        const [membership, counts] = await Promise.all([
          supabase
            .from('snp_user_organization_memberships')
            .select('organization_id, snp_organizations(name, organization_type)')
            .eq('user_id', user.id)
            .eq('organization_id', user.organization_id)
            .eq('is_primary', true)
            .is('valid_until', null)
            .maybeSingle(),
          loadMetricCounts(portal, allowedMetricIndexes),
        ]);
        if (!active) return;
        if (membership.error) throw membership.error;
        const organization = membership.data?.snp_organizations;
        if (!organization || organization.organization_type !== portal) {
          throw new Error('Rattachement institutionnel incompatible.');
        }
        setOrganizationName(organization.name);
        setMetrics(allowedMetricIndexes.map((metricIndex, index) => ({
          ...config.metrics[metricIndex],
          value: counts[index] ?? null,
        })));
        if (counts.some((count) => count === null)) {
          setLoadError('Certains indicateurs ne sont pas disponibles pour ce périmètre.');
        }
      } catch (error) {
        if (!active) return;
        setOrganizationName('Périmètre institutionnel indisponible');
        setLoadError(errorMessage(error, 'Impossible de charger le périmètre institutionnel.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [
    config.metrics,
    portal,
    user?.capabilities,
    user?.id,
    user?.is_active,
    user?.module_codes,
    user?.organization_id,
    user?.organization_type,
    user?.role,
  ]);

  const responsibilities = useMemo(() => (
    (user?.responsibilities ?? []).filter((code) => code.startsWith(`${portal}.`))
  ), [portal, user?.responsibilities]);

  return (
    <div className="sn-page institutional-portal" aria-busy={loading}>
      <PageHeader
        icon={config.icon}
        title={config.label}
        subtitle={config.subtitle}
        breadcrumb={[{ label: config.label }]}
        actions={<Badge tone="success">{organizationName}</Badge>}
      />

      {loadError && (
        <Note tone="danger" icon={AlertTriangle}>{loadError}</Note>
      )}

      <div className="institutional-portal__metrics">
        {metrics.map((metric) => (
          <article key={metric.label} className="institutional-portal__metric">
            <Building2 aria-hidden="true" />
            <div><span>{metric.label}</span><strong>{loading ? '—' : metric.value ?? 'Indisponible'}</strong><small>{metric.hint}</small></div>
          </article>
        ))}
      </div>

      {accessibleWorkspaces.length === 0 ? (
        <EmptyState
          title="Aucun espace de travail attribué"
          description="Contactez un Administrateur SONASP pour attribuer les modules nécessaires."
        />
      ) : (
        <section className="institutional-portal__workspaces" aria-label="Espaces de travail autorisés">
          {accessibleWorkspaces.map((workspace) => (
            <Link key={workspace.to} to={workspace.to}>
              <FileCheck2 aria-hidden="true" />
              <span><strong>{workspace.label}</strong><small>{workspace.description}</small></span>
            </Link>
          ))}
        </section>
      )}

      <Section
        id="institutional-responsibilities"
        icon={ShieldCheck}
        tone="emerald"
        title="Responsabilités actives"
        description="La navigation et les données restent limitées à ces responsabilités et à l’organisation rattachée."
      >
        {responsibilities.length === 0 ? (
          <EmptyState title="Aucune responsabilité active" description="Contactez un Administrateur SONASP pour corriger ce profil." />
        ) : (
          <ul className="institutional-portal__responsibilities">
            {responsibilities.map((responsibility) => <li key={responsibility}><FileCheck2 aria-hidden="true" />{responsibility}</li>)}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default InstitutionalPortalPage;
