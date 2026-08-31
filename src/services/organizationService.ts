import { supabase } from '@/lib/supabase';
import type { OrganizationType } from '@/lib/accessControl';

export interface Ministry {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface OrganizationSummary {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  organization_type: OrganizationType;
  organization_subtype: string | null;
  supervising_ministry_id: string;
  parent_organization_id: string | null;
  mining_company_id: string | null;
  source_artisan_id: string | null;
  legal_form: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  administrative_region: string | null;
  zone_code: string | null;
  service_code: string | null;
  notes: string | null;
  is_active: boolean;
  scope_metadata: Record<string, unknown>;
  ministry: Pick<Ministry, 'id' | 'code' | 'name'> | null;
  parent: Pick<OrganizationSummary, 'id' | 'code' | 'name'> | null;
}

export interface OrganizationFormValues {
  code: string;
  name: string;
  shortName: string;
  organizationType: OrganizationType;
  organizationSubtype: string;
  supervisingMinistryId: string;
  parentOrganizationId: string;
  miningCompanyId: string;
  sourceArtisanId: string;
  legalForm: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  administrativeRegion: string;
  zoneCode: string;
  serviceCode: string;
  notes: string;
  isActive: boolean;
}

export interface OrganizationReferenceOption {
  id: string;
  code: string;
  name: string;
}

export interface CollectorOption {
  id: string;
  label: string;
}

export const EMPTY_ORGANIZATION_FORM: OrganizationFormValues = {
  code: '',
  name: '',
  shortName: '',
  organizationType: 'public_institution',
  organizationSubtype: '',
  supervisingMinistryId: '',
  parentOrganizationId: '',
  miningCompanyId: '',
  sourceArtisanId: '',
  legalForm: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  administrativeRegion: '',
  zoneCode: '',
  serviceCode: '',
  notes: '',
  isActive: true,
};

export const ORGANIZATION_TYPE_OPTIONS: ReadonlyArray<{
  value: OrganizationType;
  label: string;
  description: string;
}> = [
  { value: 'sonasp', label: 'SONASP', description: 'Entité et services de la SONASP' },
  { value: 'dgi', label: 'Administration fiscale (DGI)', description: 'DGI, perceptions et services fiscaux' },
  { value: 'dgmg', label: 'Administration minière (DGMG)', description: 'Direction et services de contrôle minier' },
  { value: 'public_institution', label: 'Établissement public', description: 'Office, bureau ou agence publique' },
  { value: 'mine', label: 'Société minière', description: 'Organisation liée à une société minière' },
  { value: 'comptoir', label: 'Comptoir d’achat', description: 'Comptoir professionnel d’achat d’or' },
  { value: 'collector', label: 'Structure de collecte', description: 'Organisation liée à un profil collecteur' },
  { value: 'factory', label: 'Usine', description: 'Site industriel de traitement' },
  { value: 'airport', label: 'Aéroport', description: 'Plateforme d’expédition aéroportuaire' },
  { value: 'refinery', label: 'Raffinerie', description: 'Installation de raffinage' },
  { value: 'customer', label: 'Client institutionnel', description: 'Organisation cliente de la plateforme' },
];

export const ORGANIZATION_SUBTYPES: Partial<Record<OrganizationType, ReadonlyArray<{ value: string; label: string }>>> = {
  sonasp: [
    { value: 'societe_etat', label: 'Société d’État' },
    { value: 'direction', label: 'Direction' },
    { value: 'service', label: 'Service' },
  ],
  dgi: [
    { value: 'direction_generale', label: 'Direction générale' },
    { value: 'perception_specialisee', label: 'Perception spécialisée' },
    { value: 'direction_regionale', label: 'Direction régionale' },
    { value: 'service_central', label: 'Service central' },
  ],
  dgmg: [
    { value: 'direction_generale', label: 'Direction générale' },
    { value: 'direction_technique', label: 'Direction technique' },
    { value: 'service_deconcentre', label: 'Service déconcentré' },
  ],
  public_institution: [
    { value: 'office_public', label: 'Office ou bureau public' },
    { value: 'agence_publique', label: 'Agence publique' },
    { value: 'etablissement_public', label: 'Établissement public' },
  ],
};

export function organizationTypeLabel(type: OrganizationType): string {
  return ORGANIZATION_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export function formFromOrganization(organization: OrganizationSummary): OrganizationFormValues {
  return {
    code: organization.code,
    name: organization.name,
    shortName: organization.short_name || '',
    organizationType: organization.organization_type,
    organizationSubtype: organization.organization_subtype || '',
    supervisingMinistryId: organization.supervising_ministry_id,
    parentOrganizationId: organization.parent_organization_id || '',
    miningCompanyId: organization.mining_company_id || '',
    sourceArtisanId: organization.source_artisan_id || '',
    legalForm: organization.legal_form || '',
    email: organization.email || '',
    phone: organization.phone || '',
    address: organization.address || '',
    website: organization.website || '',
    administrativeRegion: organization.administrative_region || '',
    zoneCode: organization.zone_code || '',
    serviceCode: organization.service_code || '',
    notes: organization.notes || '',
    isActive: organization.is_active,
  };
}

export function validateOrganization(values: OrganizationFormValues, currentId?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[A-Z0-9][A-Z0-9._-]{1,29}$/.test(values.code.trim().toUpperCase())) {
    errors.code = 'Utilisez 2 à 30 caractères : lettres, chiffres, point, tiret ou soulignement.';
  }
  if (values.name.trim().length < 3) errors.name = 'Le nom officiel doit contenir au moins 3 caractères.';
  if (!values.supervisingMinistryId) errors.supervisingMinistryId = 'Le ministère de tutelle est obligatoire.';
  if (values.organizationType === 'mine' && !values.miningCompanyId) {
    errors.miningCompanyId = 'Sélectionnez la société minière liée.';
  }
  if (values.organizationType === 'collector' && !values.sourceArtisanId) {
    errors.sourceArtisanId = 'Sélectionnez le collecteur lié.';
  }
  if (currentId && values.parentOrganizationId === currentId) {
    errors.parentOrganizationId = 'Une organisation ne peut pas être son propre parent.';
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'L’adresse e-mail est invalide.';
  }
  return errors;
}

export function buildOrganizationRpcPayload(values: OrganizationFormValues, id?: string) {
  const emptyToNull = (value: string) => value.trim() || null;
  return {
    p_id: id || null,
    p_code: values.code.trim().toUpperCase(),
    p_name: values.name.trim(),
    p_short_name: emptyToNull(values.shortName),
    p_organization_type: values.organizationType,
    p_organization_subtype: emptyToNull(values.organizationSubtype),
    p_supervising_ministry_id: values.supervisingMinistryId,
    p_parent_organization_id: emptyToNull(values.parentOrganizationId),
    p_mining_company_id: values.organizationType === 'mine' ? emptyToNull(values.miningCompanyId) : null,
    p_source_artisan_id: values.organizationType === 'collector' ? emptyToNull(values.sourceArtisanId) : null,
    p_legal_form: emptyToNull(values.legalForm),
    p_email: emptyToNull(values.email),
    p_phone: emptyToNull(values.phone),
    p_address: emptyToNull(values.address),
    p_website: emptyToNull(values.website),
    p_administrative_region: emptyToNull(values.administrativeRegion),
    p_zone_code: emptyToNull(values.zoneCode),
    p_service_code: emptyToNull(values.serviceCode),
    p_notes: emptyToNull(values.notes),
    p_is_active: values.isActive,
    p_scope_metadata: {
      scope: values.administrativeRegion || values.zoneCode ? 'territorial' : 'national',
    },
  };
}

const ORGANIZATION_SELECT = `
  id, code, name, short_name, organization_type, organization_subtype,
  supervising_ministry_id, parent_organization_id, mining_company_id,
  source_artisan_id, legal_form, email, phone, address, website,
  administrative_region, zone_code, service_code, notes, is_active, scope_metadata
`;

function normalizeOrganization(
  row: Record<string, unknown>,
  ministries: Map<string, Pick<Ministry, 'id' | 'code' | 'name'>>,
  parents: Map<string, Pick<OrganizationSummary, 'id' | 'code' | 'name'>>,
): OrganizationSummary {
  return {
    ...(row as unknown as Omit<OrganizationSummary, 'ministry' | 'parent'>),
    scope_metadata: (row.scope_metadata as Record<string, unknown>) || {},
    ministry: ministries.get(String(row.supervising_ministry_id)) || null,
    parent: row.parent_organization_id ? parents.get(String(row.parent_organization_id)) || null : null,
  };
}

export const organizationService = {
  async list(): Promise<OrganizationSummary[]> {
    const [organizationsResponse, ministriesResponse] = await Promise.all([
      (supabase as any).from('snp_organizations').select(ORGANIZATION_SELECT).order('name'),
      (supabase as any).from('snp_ministries').select('id, code, name').eq('is_active', true),
    ]);
    if (organizationsResponse.error) throw organizationsResponse.error;
    if (ministriesResponse.error) throw ministriesResponse.error;

    const rows = (organizationsResponse.data || []) as Record<string, unknown>[];
    const ministries = new Map<string, Pick<Ministry, 'id' | 'code' | 'name'>>(
      (ministriesResponse.data || []).map((ministry: Pick<Ministry, 'id' | 'code' | 'name'>) => [ministry.id, ministry]),
    );
    const parents = new Map<string, Pick<OrganizationSummary, 'id' | 'code' | 'name'>>(
      rows.map((row) => [String(row.id), { id: String(row.id), code: String(row.code), name: String(row.name) }]),
    );
    return rows.map((row) => normalizeOrganization(row, ministries, parents));
  },

  async get(id: string): Promise<OrganizationSummary> {
    const organization = (await this.list()).find((item) => item.id === id);
    if (!organization) throw new Error('Organisation introuvable.');
    return organization;
  },

  async listMinistries(): Promise<Ministry[]> {
    const { data, error } = await (supabase as any)
      .from('snp_ministries')
      .select('id, code, name, is_active')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async listMiningCompanies(): Promise<OrganizationReferenceOption[]> {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async listCollectors(): Promise<CollectorOption[]> {
    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .select('id, nom, prenoms, raison_sociale, numero_carte')
      .eq('actif', true)
      .eq('type_artisan', 'collecteur')
      .order('raison_sociale');
    if (error) throw error;
    return (data || []).map((collector) => ({
      id: collector.id,
      label: collector.raison_sociale
        || [collector.prenoms, collector.nom].filter(Boolean).join(' ')
        || collector.numero_carte
        || 'Collecteur sans nom',
    }));
  },

  async save(values: OrganizationFormValues, id?: string): Promise<string> {
    const errors = validateOrganization(values, id);
    if (Object.keys(errors).length > 0) throw new Error(Object.values(errors)[0]);
    const { data, error } = await (supabase as any).rpc(
      'snp_save_organization',
      buildOrganizationRpcPayload(values, id),
    );
    if (error) throw error;
    return data as string;
  },
};
