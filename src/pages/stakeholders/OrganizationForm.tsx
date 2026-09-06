import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Contact,
  Landmark,
  Loader2,
  MapPinned,
  Save,
  Shapes,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canManageMiningRegistry } from '@/lib/miningRegistryAccess';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Field, FormActions, Note, PageHeader, Section, Segmented } from '@/components/ui/sn';
import { BURKINA_REGIONS } from '@/data/burkinaRegions';
import { messageErreurUtilisateur } from '@/lib/presentError';
import type { OrganizationType } from '@/lib/accessControl';
import {
  EMPTY_ORGANIZATION_FORM,
  ORGANIZATION_SUBTYPES,
  ORGANIZATION_TYPE_OPTIONS,
  formFromOrganization,
  organizationService,
  validateOrganization,
  type CollectorOption,
  type Ministry,
  type OrganizationFormValues,
  type OrganizationReferenceOption,
  type OrganizationSummary,
} from '@/services/organizationService';
import '../admin/admin.css';
import './organizations.css';

const ORGANIZATION_TYPES = new Set(ORGANIZATION_TYPE_OPTIONS.map((option) => option.value));

export function OrganizationForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDgmg = user?.role === 'dgmg';
  const canCreateComptoir = canManageMiningRegistry(user);
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const requestedType = (isDgmg ? 'comptoir' : searchParams.get('type')) as OrganizationType | null;
  const isEdit = Boolean(id);

  const [form, setForm] = useState<OrganizationFormValues>(() => ({
    ...EMPTY_ORGANIZATION_FORM,
    organizationType: requestedType && ORGANIZATION_TYPES.has(requestedType)
      ? requestedType
      : EMPTY_ORGANIZATION_FORM.organizationType,
  }));
  const allowedTypes = ORGANIZATION_TYPE_OPTIONS.filter(option => isDgmg ? option.value === 'comptoir' : isEdit || canCreateComptoir || option.value !== 'comptoir');
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<OrganizationReferenceOption[]>([]);
  const [collectors, setCollectors] = useState<CollectorOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setFailure(null);
    try {
      const [organizationRows, ministryRows, miningRows, collectorRows, current] = await Promise.all([
        organizationService.list(),
        organizationService.listMinistries(),
        isDgmg ? Promise.resolve([]) : organizationService.listMiningCompanies(),
        isDgmg ? Promise.resolve([]) : organizationService.listCollectors(),
        id ? organizationService.get(id) : Promise.resolve(null),
      ]);
      setOrganizations(organizationRows);
      setMinistries(ministryRows);
      setMiningCompanies(miningRows);
      setCollectors(collectorRows);
      if (id && (!current || (isDgmg && current.organization_type !== 'comptoir'))) throw new Error('Comptoir introuvable ou inaccessible.');
      if (current) setForm(formFromOrganization(current));
      else {
        setForm((previous) => {
          const preferredCode = previous.organizationType === 'dgi' ? 'MEF' : 'MEMC';
          return {
            ...previous,
            supervisingMinistryId: previous.supervisingMinistryId
              || ministryRows.find((ministry) => ministry.code === preferredCode)?.id
              || (ministryRows.length === 1 ? ministryRows[0].id : ''),
          };
        });
      }
    } catch (reason) {
      setLoadFailed(true);
      setFailure(messageErreurUtilisateur(reason, 'Impossible de charger le formulaire d’organisation.'));
    } finally {
      setLoading(false);
    }
  }, [id, isDgmg]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof OrganizationFormValues>(key: K, value: OrganizationFormValues[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const changeType = (organizationType: OrganizationType) => {
    const preferredMinistry = ministries.find((ministry) => ministry.code === (organizationType === 'dgi' ? 'MEF' : 'MEMC'));
    setForm((previous) => ({
      ...previous,
      organizationType,
      organizationSubtype: '',
      supervisingMinistryId: preferredMinistry?.id || previous.supervisingMinistryId,
      miningCompanyId: organizationType === 'mine' ? previous.miningCompanyId : '',
      sourceArtisanId: organizationType === 'collector' ? previous.sourceArtisanId : '',
    }));
    setErrors({});
  };

  const subtypeOptions = ORGANIZATION_SUBTYPES[form.organizationType] || [];
  const typeDescription = ORGANIZATION_TYPE_OPTIONS.find((option) => option.value === form.organizationType)?.description;
  const institutional = ['sonasp', 'dgi', 'dgmg', 'public_institution'].includes(form.organizationType);
  const parentOptions = organizations.filter((organization) => organization.id !== id && organization.is_active);

  const formTitle = isDgmg ? (isEdit ? 'Modifier un comptoir' : 'Créer un comptoir') : isEdit ? 'Modifier une organisation' : 'Créer une organisation';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || loading || loadFailed) return;
    if ((isDgmg && form.organizationType !== 'comptoir') || (!isEdit && form.organizationType === 'comptoir' && !canCreateComptoir)) {
      setFailure('La création des comptoirs est réservée à la DGMG et à l’administrateur.'); return;
    }
    const nextErrors = validateOrganization(form, id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFailure('Certains champs obligatoires ou invalides doivent être corrigés.');
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await organizationService.save(form, id);
      navigate('/stakeholders/organizations', { replace: true });
    } catch (reason) {
      setFailure(messageErreurUtilisateur(reason, 'Impossible d’enregistrer l’organisation.'));
    } finally {
      setSaving(false);
    }
  };

  const ministryHint = useMemo(() => {
    const selected = ministries.find((ministry) => ministry.id === form.supervisingMinistryId);
    return selected ? selected.name : 'Obligatoire pour toute organisation.';
  }, [ministries, form.supervisingMinistryId]);

  return (
    <NationalDashboardLayout>
      <main className="sn-page admin-page organisation-form">
        <PageHeader
          icon={Landmark}
          title={formTitle}
          subtitle="Le formulaire adapte les rattachements et le périmètre au type sélectionné."
          breadcrumb={[
            { label: 'Parties prenantes' },
            { label: 'Organisations', to: '/stakeholders/organizations' },
            { label: isEdit ? 'Modification' : 'Nouvelle organisation' },
          ]}
          actions={(
            <button type="button" className="sn-btn" onClick={() => navigate('/stakeholders/organizations')}>
              <ArrowLeft aria-hidden="true" /> Retour au registre
            </button>
          )}
        />

        {failure && <Note tone="danger" icon={AlertTriangle}>{failure}</Note>}

        {loading ? (
          <div className="admin-page__loading"><Loader2 className="sn-spin" aria-hidden="true" /> Chargement du formulaire…</div>
        ) : (
          <form className="admin-form" onSubmit={submit} noValidate>
            <Section
              id="identification-organisation"
              icon={Building2}
              tone="emerald"
              title="Identification"
              description="Dénomination officielle et état dans le référentiel."
            >
              <div className="admin-form__row is-deux">
                <Field label="Nom officiel" required htmlFor="organization-name" error={errors.name}>
                  <input
                    id="organization-name"
                    value={form.name}
                    maxLength={180}
                    aria-invalid={Boolean(errors.name)}
                    onChange={(event) => set('name', event.target.value)}
                    placeholder="Ex. Perception spécialisée de la DGI"
                  />
                </Field>
                <Field label="Sigle ou nom court" htmlFor="organization-short-name">
                  <input id="organization-short-name" value={form.shortName} maxLength={80} onChange={(event) => set('shortName', event.target.value)} placeholder="Ex. DGI – Perception spécialisée" />
                </Field>
              </div>
              <div className="admin-form__row is-deux" style={{ marginTop: 14 }}>
                <Field label="Code unique" required htmlFor="organization-code" error={errors.code} hint="Majuscules, sans espace.">
                  <input
                    id="organization-code"
                    value={form.code}
                    maxLength={30}
                    aria-invalid={Boolean(errors.code)}
                    onChange={(event) => set('code', event.target.value.toUpperCase().replace(/\s+/g, '-'))}
                    placeholder="DGI-PS"
                  />
                </Field>
                <Field label="État" htmlFor="organization-state">
                  <div className="organisation-form__status">
                    <Segmented
                      name="organization-state"
                      value={form.isActive ? 'active' : 'inactive'}
                      ariaLabel="État de l’organisation"
                      onChange={(value) => set('isActive', value === 'active')}
                      options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                    />
                  </div>
                </Field>
              </div>
            </Section>

            <Section
              id="classification-organisation"
              icon={Shapes}
              tone="violet"
              title="Type et tutelle"
              description="Le type pilote automatiquement les champs de rattachement disponibles."
            >
              <div className="admin-form__row is-trois">
                <Field label="Type d’organisation" required htmlFor="organization-type">
                  <select id="organization-type" value={form.organizationType} onChange={(event) => changeType(event.target.value as OrganizationType)}>
                    {allowedTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <span className="organisation-form__type-help">{typeDescription}</span>
                </Field>
                <Field label="Ministère de tutelle" required htmlFor="organization-ministry" error={errors.supervisingMinistryId} hint={ministryHint}>
                  <select
                    id="organization-ministry"
                    value={form.supervisingMinistryId}
                    aria-invalid={Boolean(errors.supervisingMinistryId)}
                    onChange={(event) => set('supervisingMinistryId', event.target.value)}
                  >
                    <option value="">Sélectionner un ministère…</option>
                    {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.code} — {ministry.name}</option>)}
                  </select>
                </Field>
                <Field label="Sous-type" htmlFor="organization-subtype" hint={subtypeOptions.length ? 'Valeurs adaptées au type choisi.' : 'Classification libre si nécessaire.'}>
                  {subtypeOptions.length ? (
                    <select id="organization-subtype" value={form.organizationSubtype} onChange={(event) => set('organizationSubtype', event.target.value)}>
                      <option value="">Sélectionner…</option>
                      {subtypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input id="organization-subtype" value={form.organizationSubtype} onChange={(event) => set('organizationSubtype', event.target.value)} placeholder="Catégorie facultative" />
                  )}
                </Field>
              </div>
            </Section>

            {(institutional || form.organizationType === 'comptoir') && (
              <Section
                id="perimetre-organisation"
                icon={MapPinned}
                tone="amber"
                title="Périmètre institutionnel"
                description="Hiérarchie administrative et portée territoriale de l’organisation."
              >
                <div className="admin-form__row is-deux">
                  <Field label="Organisation parente" htmlFor="organization-parent" error={errors.parentOrganizationId} hint="Ex. la DGI pour une perception spécialisée.">
                    <select id="organization-parent" value={form.parentOrganizationId} onChange={(event) => set('parentOrganizationId', event.target.value)}>
                      <option value="">Aucune — portée autonome</option>
                      {parentOptions.map((organization) => <option key={organization.id} value={organization.id}>{organization.code} — {organization.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Code du service" htmlFor="organization-service-code">
                    <input id="organization-service-code" value={form.serviceCode} onChange={(event) => set('serviceCode', event.target.value.toUpperCase())} placeholder="DGI-PS" />
                  </Field>
                </div>
                <div className="admin-form__row is-deux" style={{ marginTop: 14 }}>
                  <Field label="Région administrative" htmlFor="organization-region">
                    <select id="organization-region" value={form.administrativeRegion} onChange={(event) => set('administrativeRegion', event.target.value)}>
                      <option value="">Portée nationale</option>
                      {BURKINA_REGIONS.map((region) => <option key={region.name} value={region.name}>{region.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Code de zone ou ressort" htmlFor="organization-zone">
                    <input id="organization-zone" value={form.zoneCode} onChange={(event) => set('zoneCode', event.target.value.toUpperCase())} placeholder="Ex. CENTRE, OUAGA-01" />
                  </Field>
                </div>
              </Section>
            )}

            {form.organizationType === 'mine' && (
              <Section
                id="rattachement-mine"
                icon={Building2}
                tone="blue"
                title="Rattachement à une société minière"
                description="Cette organisation hérite du périmètre de données de la société sélectionnée."
              >
                <Field label="Société minière" required htmlFor="organization-mining-company" error={errors.miningCompanyId}>
                  <select id="organization-mining-company" value={form.miningCompanyId} onChange={(event) => set('miningCompanyId', event.target.value)}>
                    <option value="">Sélectionner une société…</option>
                    {miningCompanies.map((company) => <option key={company.id} value={company.id}>{company.code} — {company.name}</option>)}
                  </select>
                </Field>
              </Section>
            )}

            {form.organizationType === 'collector' && (
              <Section
                id="rattachement-collecteur"
                icon={Building2}
                tone="blue"
                title="Rattachement à un collecteur"
                description="La structure porte le périmètre opérationnel du collecteur sélectionné."
              >
                <Field label="Profil collecteur" required htmlFor="organization-collector" error={errors.sourceArtisanId}>
                  <select id="organization-collector" value={form.sourceArtisanId} onChange={(event) => set('sourceArtisanId', event.target.value)}>
                    <option value="">Sélectionner un collecteur…</option>
                    {collectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.label}</option>)}
                  </select>
                </Field>
              </Section>
            )}

            <Section
              id="contact-organisation"
              icon={Contact}
              tone="slate"
              title="Coordonnées et informations complémentaires"
              description="Contacts administratifs et précisions utiles au référentiel."
            >
              <div className="admin-form__row is-trois">
                <Field label="Forme juridique" htmlFor="organization-legal-form">
                  <input id="organization-legal-form" value={form.legalForm} onChange={(event) => set('legalForm', event.target.value)} placeholder="Administration publique, société d’État…" />
                </Field>
                <Field label="Adresse e-mail" htmlFor="organization-email" error={errors.email}>
                  <input id="organization-email" type="email" value={form.email} aria-invalid={Boolean(errors.email)} onChange={(event) => set('email', event.target.value)} placeholder="contact@organisation.bf" />
                </Field>
                <Field label="Téléphone" htmlFor="organization-phone">
                  <input id="organization-phone" value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="+226 …" />
                </Field>
              </div>
              <div className="admin-form__row is-deux" style={{ marginTop: 14 }}>
                <Field label="Site web" htmlFor="organization-website">
                  <input id="organization-website" type="url" value={form.website} onChange={(event) => set('website', event.target.value)} placeholder="https://…" />
                </Field>
                <Field label="Adresse" htmlFor="organization-address">
                  <input id="organization-address" value={form.address} onChange={(event) => set('address', event.target.value)} placeholder="Adresse administrative" />
                </Field>
              </div>
              <Field label="Notes internes" wide htmlFor="organization-notes">
                <textarea id="organization-notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Informations complémentaires…" />
              </Field>
            </Section>

            <FormActions>
              <button type="button" className="sn-btn" onClick={() => navigate('/stakeholders/organizations')} disabled={saving}>
                Annuler
              </button>
              <button type="submit" className="sn-btn sn-btn--primary" disabled={saving || loadFailed}>
                {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                {isEdit ? 'Enregistrer les modifications' : isDgmg ? 'Créer le comptoir' : 'Créer l’organisation'}
              </button>
            </FormActions>
          </form>
        )}
      </main>
    </NationalDashboardLayout>
  );
}
