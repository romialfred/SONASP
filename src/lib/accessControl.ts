import type { UserRole } from '@/types/auth';
import {
  CAPABILITIES,
  type OperationalCapabilityCode,
  type OperationalCapabilityMap,
} from '@/lib/capabilities';
import type { ModulePermission, PermissionModule } from '@/services/userPermissionsService';

export type PortalCode = 'sonasp' | 'dgmg' | 'dgi' | 'operator' | 'collector' | 'client';

export type AccountCreationRole = Extract<
  UserRole,
  'owner' | 'admin' | 'management' | 'dgmg' | 'mine' | 'comptoir' | 'dgi' | 'collector' | 'customer'
>;

export type OrganizationType =
  | 'sonasp'
  | 'dgmg'
  | 'dgi'
  | 'public_institution'
  | 'mine'
  | 'comptoir'
  | 'collector'
  | 'factory'
  | 'airport'
  | 'refinery'
  | 'customer';

export interface AccountRolePolicy {
  role: AccountCreationRole;
  label: string;
  shortLabel: string;
  description: string;
  portal: PortalCode;
  badgeTone: 'danger' | 'info' | 'success' | 'warning' | 'neutral';
  organizationType: OrganizationType | null;
  organizationRequired: boolean;
}

/** Rôles institutionnels proposés pour toute nouvelle création de compte. */
export const ACCOUNT_ROLE_POLICIES: readonly AccountRolePolicy[] = [
  {
    role: 'owner',
    label: 'Propriétaire (Owner)',
    shortLabel: 'Owner',
    description: 'Accès complet permanent et administration des autres comptes, y compris Owner.',
    portal: 'sonasp',
    badgeTone: 'danger',
    organizationType: 'sonasp',
    organizationRequired: false,
  },
  {
    role: 'admin',
    label: 'Administrateur',
    shortLabel: 'Administrateur',
    description: 'Administration système, utilisateurs, référentiels et paramètres.',
    portal: 'sonasp',
    badgeTone: 'danger',
    organizationType: 'sonasp',
    organizationRequired: false,
  },
  {
    role: 'management',
    label: 'Direction SONASP',
    shortLabel: 'Direction',
    description: 'Pilotage et opérations institutionnelles SONASP.',
    portal: 'sonasp',
    badgeTone: 'info',
    organizationType: 'sonasp',
    organizationRequired: false,
  },
  {
    role: 'dgmg',
    label: 'DGMG',
    shortLabel: 'DGMG',
    description: 'Supervision réglementaire et opérationnelle du secteur minier.',
    portal: 'dgmg',
    badgeTone: 'info',
    organizationType: 'dgmg',
    organizationRequired: true,
  },
  {
    role: 'mine',
    label: 'Société minière',
    shortLabel: 'Société minière',
    description: 'Compte institutionnel limité au périmètre de la société.',
    portal: 'operator',
    badgeTone: 'success',
    organizationType: 'mine',
    organizationRequired: true,
  },
  {
    role: 'comptoir',
    label: 'Comptoir d’achat',
    shortLabel: 'Comptoir d’achat',
    description: 'Collecte, achats, stocks, ventes et opérations du comptoir.',
    portal: 'operator',
    badgeTone: 'warning',
    organizationType: 'comptoir',
    organizationRequired: true,
  },
  {
    role: 'dgi',
    label: 'DGI',
    shortLabel: 'DGI',
    description: 'Suivi fiscal, taxes, royalties et comptes associés.',
    portal: 'dgi',
    badgeTone: 'warning',
    organizationType: 'dgi',
    organizationRequired: true,
  },
  {
    role: 'collector',
    label: 'Agent Collecteur',
    shortLabel: 'Collecteur',
    description: 'Collecte terrain, artisans et productions rattachées.',
    portal: 'collector',
    badgeTone: 'success',
    organizationType: 'collector',
    organizationRequired: true,
  },
  {
    role: 'customer',
    label: 'Client',
    shortLabel: 'Client',
    description: 'Consultation limitée à ses propres opérations et documents.',
    portal: 'client',
    badgeTone: 'neutral',
    organizationType: 'customer',
    organizationRequired: false,
  },
] as const;

export const ACCOUNT_CREATION_ROLES = ACCOUNT_ROLE_POLICIES.map(({ role }) => role);

export function accountRolePolicy(role: UserRole | ''): AccountRolePolicy | null {
  return ACCOUNT_ROLE_POLICIES.find((policy) => policy.role === role) ?? null;
}

export interface BusinessResponsibilityOption {
  code: OperationalCapabilityCode;
  label: string;
  description: string;
  roles: readonly AccountCreationRole[];
  requiredFor: readonly AccountCreationRole[];
}

/**
 * Les responsabilités sont un sous-ensemble nommé du catalogue de capabilities.
 * Elles restent distinctes des permissions CRUD et sont filtrées par rôle.
 */
export const BUSINESS_RESPONSIBILITIES: readonly BusinessResponsibilityOption[] = [
  {
    code: CAPABILITIES.SONASP_PREPARE,
    label: 'SONASP Gestionnaire',
    description: 'Prépare les dossiers et les soumet au contrôle.',
    roles: ['management'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.SONASP_APPROVE,
    label: 'SONASP Approbateur',
    description: 'Contrôle, approuve ou rejette sans pouvoir valider son propre dossier.',
    roles: ['management'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.FINANCE_EXECUTE,
    label: 'Finance — exécution',
    description: 'Exécute les règlements et joint les preuves bancaires.',
    roles: ['management'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.FINANCE_RECONCILE,
    label: 'Finance — rapprochement',
    description: 'Rapproche une opération exécutée par un autre acteur.',
    roles: ['management'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.REFINING_SUPERVISE,
    label: 'Raffinage',
    description: 'Suit les lots, résultats, écarts et réceptions autorisés.',
    roles: ['management', 'mine', 'comptoir'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.RECONCILIATION_MANAGE,
    label: 'Conciliation',
    description: 'Prépare et analyse les dossiers de conciliation de son périmètre.',
    roles: ['management'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.DGMG_SUPERVISE,
    label: 'Supervision DGMG',
    description: 'Contrôle les sites, opérateurs et déclarations relevant de la DGMG.',
    roles: ['dgmg'],
    requiredFor: ['dgmg'],
  },
  {
    code: CAPABILITIES.DGMG_PRODUCTION_VALIDATE,
    label: 'Validation production',
    description: 'Valide les déclarations de production dans le périmètre réglementaire.',
    roles: ['dgmg'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.MINE_PRODUCTION_MANAGE,
    label: 'Gestion de la production',
    description: 'Déclare la production et prépare les opérations de la société.',
    roles: ['mine'],
    requiredFor: ['mine'],
  },
  {
    code: CAPABILITIES.COMPTOIR_MANAGE,
    label: 'Gestion du comptoir',
    description: 'Gère les achats, ventes et stocks du comptoir. Les opérations financières sont attribuées séparément.',
    roles: ['comptoir'],
    requiredFor: ['comptoir'],
  },
  { code: CAPABILITIES.COMPTOIR_INVOICES_ISSUE, label: 'Facturation du comptoir', description: 'Émet les factures des ventes du comptoir rattaché.', roles: ['comptoir'], requiredFor: [] },
  { code: CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE, label: 'Paiements — exécution', description: 'Exécute les règlements et joint les justificatifs du comptoir.', roles: ['comptoir'], requiredFor: [] },
  { code: CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE, label: 'Paiements — contrôle', description: 'Contrôle les paiements préparés par un autre acteur du comptoir.', roles: ['comptoir'], requiredFor: [] },
  { code: CAPABILITIES.COMPTOIR_TAX_EXECUTE, label: 'Reversements fiscaux', description: 'Prépare et transmet les reversements du comptoir.', roles: ['comptoir'], requiredFor: [] },
  {
    code: CAPABILITIES.COLLECTORS_MANAGE,
    label: 'Gestion des collecteurs',
    description: 'Gère les rattachements historisés entre collecteurs et orpailleurs.',
    roles: ['management', 'comptoir', 'dgmg'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.DGI_FISCAL_CONTROL,
    label: 'Contrôle fiscal',
    description: 'Contrôle les assiettes, taxes, royalties et écarts fiscaux.',
    roles: ['dgi'],
    requiredFor: ['dgi'],
  },
  {
    code: CAPABILITIES.DGI_FISCAL_RECONCILE,
    label: 'Rapprochement fiscal',
    description: 'Rapproche les montants déclarés, appelés et payés.',
    roles: ['dgi'],
    requiredFor: [],
  },
  {
    code: CAPABILITIES.COLLECTOR_OPERATE,
    label: 'Collecte terrain',
    description: 'Enregistre les opérations des seuls orpailleurs qui lui sont rattachés.',
    roles: ['collector'],
    requiredFor: ['collector'],
  },
  { code: CAPABILITIES.COLLECTOR_PAYMENTS_EXECUTE, label: 'Collecteur — exécuter un paiement', description: 'Paie ses ventes approuvées lorsqu’une délégation de son organisme est en cours.', roles: ['collector'], requiredFor: [] },
] as const;

/** Séparations de fonctions qui ne peuvent jamais être cumulées sur un compte. */
export const RESPONSIBILITY_CONFLICTS: ReadonlyArray<readonly [OperationalCapabilityCode, OperationalCapabilityCode]> = [
  [CAPABILITIES.SONASP_PREPARE, CAPABILITIES.SONASP_APPROVE],
  [CAPABILITIES.FINANCE_EXECUTE, CAPABILITIES.FINANCE_RECONCILE],
  [CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE, CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE],
];

export function responsibilitiesForRole(role: UserRole | ''): readonly BusinessResponsibilityOption[] {
  return BUSINESS_RESPONSIBILITIES.filter((responsibility) =>
    responsibility.roles.includes(role as AccountCreationRole),
  );
}

export function defaultResponsibilitiesForRole(role: UserRole | ''): OperationalCapabilityMap {
  const result = Object.fromEntries(
    BUSINESS_RESPONSIBILITIES.map(({ code }) => [code, false]),
  ) as OperationalCapabilityMap;
  responsibilitiesForRole(role).forEach((responsibility) => {
    result[responsibility.code] = responsibility.requiredFor.includes(role as AccountCreationRole);
  });
  return result;
}

export function validateResponsibilities(
  role: UserRole | '',
  responsibilities: Partial<OperationalCapabilityMap>,
): string | null {
  if (!role) return 'Sélectionnez un rôle avant les responsabilités métier.';
  const compatible = new Set(responsibilitiesForRole(role).map(({ code }) => code));
  const selected = Object.entries(responsibilities)
    .filter(([, allowed]) => allowed)
    .map(([code]) => code as OperationalCapabilityCode);
  const incompatible = selected.find((code) => !compatible.has(code));
  if (incompatible) return 'Une responsabilité sélectionnée est incompatible avec ce rôle.';
  const conflict = RESPONSIBILITY_CONFLICTS.find(([left, right]) => (
    responsibilities[left] === true && responsibilities[right] === true
  ));
  if (conflict) {
    const left = BUSINESS_RESPONSIBILITIES.find(({ code }) => code === conflict[0])?.label ?? conflict[0];
    const right = BUSINESS_RESPONSIBILITIES.find(({ code }) => code === conflict[1])?.label ?? conflict[1];
    return `Séparation des fonctions : « ${left} » et « ${right} » ne peuvent pas être cumulées.`;
  }
  const missing = responsibilitiesForRole(role).find(
    ({ code, requiredFor }) => requiredFor.includes(role as AccountCreationRole) && !responsibilities[code],
  );
  return missing ? `La responsabilité « ${missing.label} » est obligatoire pour ce rôle.` : null;
}

export type ModuleDomain =
  | 'users'
  | 'settings'
  | 'sites'
  | 'artisans'
  | 'production'
  | 'purchases'
  | 'sales'
  | 'payments'
  | 'shipping'
  | 'refining'
  | 'inventory'
  | 'reconciliation'
  | 'tax'
  | 'contracts'
  | 'customers'
  | 'documents'
  | 'reports'
  | 'audit'
  | 'unknown';

/** Domaine fonctionnel autoritatif d'une route de la navigation nationale. */
export function moduleDomainForPath(path: string): ModuleDomain | null {
  if (/^\/artisan-minier\/(collecteurs|comptoirs)(\/|$)/u.test(path)) return 'artisans';
  if (/^\/collecte\/ventes(\/|$)/u.test(path)) return 'sales';
  if (/^\/admin\/audit(?:\/|$)|^\/audit(?:\/|$)/u.test(path)) return 'audit';
  if (/^\/users(?:\/|$)|^\/admin\/(?:users|permissions)(?:\/|$)/u.test(path)) return 'users';
  if (/^\/parameters(?:\/|$)|^\/admin\/(?:settings|modules|messagerie|status-manager|gold-sales-settings|workflow)(?:\/|$)/u.test(path)) return 'settings';
  if (/^\/artisan-sites(?:\/|$)/u.test(path)) return 'sites';
  if (/^\/artisan-minier\/(?:liste|cartes)(?:\/|$)|^\/artisan-minier\/?$/u.test(path)) return 'artisans';
  if (/^\/artisan-minier\/paiements(?:\/|$)|^\/payments(?:\/|$)/u.test(path)) return 'payments';
  if (/^\/artisan-minier\/rapports\/taxes(?:\/|$)/u.test(path)) return 'tax';
  if (/^\/artisan-minier\/rapports(?:\/|$)/u.test(path)) return 'reports';
  if (/^\/artisan-minier\/ventes-or(?:\/|$)|^\/sales(?:\/|$)/u.test(path)) return 'sales';
  if (/^\/production(?:\/|$)/u.test(path)) return 'production';
  if (/^\/(?:achats|requisitions)(?:\/|$)/u.test(path)) return 'purchases';
  if (/^\/contrats(?:\/|$)/u.test(path)) return 'contracts';
  if (/^\/(?:shipping|freight)(?:\/|$)|^\/freight-customs(?:\/|$)/u.test(path)) return 'shipping';
  if (/^\/refining(?:\/|$)/u.test(path)) return 'refining';
  if (/^\/inventory(?:\/|$)|\/stock(?:\/|$)/u.test(path)) return 'inventory';
  if (/^\/conciliation\/regles-fiscales(?:\/|$)/u.test(path)) return 'tax';
  if (/^\/conciliation(?:\/|$)/u.test(path)) return 'reconciliation';
  if (/^\/stakeholders\/organizations(?:\/|$)/u.test(path)) return 'settings';
  if (/^\/(?:customers|stakeholders)(?:\/|$)/u.test(path)) return 'customers';
  if (/^\/documents(?:\/|$)/u.test(path)) return 'documents';
  if (/^\/(?:dashboard|reports|analytics|gold-prices|fx-rates)(?:\/|$)/u.test(path)) return 'reports';
  return null;
}

const MODULE_DOMAINS = new Set<ModuleDomain>([
  'users','settings','sites','artisans','production','purchases','sales','payments',
  'shipping','refining','inventory','reconciliation','tax','contracts','customers',
  'documents','reports','audit','unknown',
]);

const MODULE_NAME_DOMAIN_RULES: ReadonlyArray<readonly [RegExp, ModuleDomain]> = [
  [/\b(user|users|account|accounts|administration)\b/, 'users'],
  [/\baudit\b/, 'audit'],
  [/\b(setting|settings|parameter|parameters|status|workflow|configuration|referential)\b/, 'settings'],
  [/\b(tax|taxes|fiscal|royalty|royalties|dgi)\b/, 'tax'],
  [/\b(conciliation|reconciliation|rapprochement)\b/, 'reconciliation'],
  // La production doit précéder « mine » : « mining production » est un
  // module Production, pas un module Sites.
  [/\b(production|forecast|budget)\b/, 'production'],
  [/\b(site|sites|mine|mines|mining)\b/, 'sites'],
  [/\b(artisan|artisans|orpailleur|orpailleurs|collector|collectors|collecte|collection)\b/, 'artisans'],
  [/\b(purchase|purchases|achat|achats|requisition|requisitions)\b/, 'purchases'],
  [/\b(payment|payments|paiement|paiements|reglement|reglements|invoice|invoices|facture|factures)\b/, 'payments'],
  [/\b(shipping|shipment|shipments|expedition|expeditions|freight|fret|douane)\b/, 'shipping'],
  [/\b(refining|refinery|raffinage|raffinerie)\b/, 'refining'],
  [/\b(inventory|stock|stocks|coffre|reserve)\b/, 'inventory'],
  [/\b(contract|contracts|contrat|contrats)\b/, 'contracts'],
  [/\b(customer|customers|client|clients|stakeholder|stakeholders)\b/, 'customers'],
  [/\b(document|documents|certificate|certificates|certificat|certificats|assay)\b/, 'documents'],
  [/\b(report|reports|rapport|rapports|analytics|dashboard)\b/, 'reports'],
  [/\b(sale|sales|vente|ventes|market|markets|marche|marches|negoce)\b/, 'sales'],
];

function domainFromStableModuleName(name: string | null | undefined): ModuleDomain {
  if (!name) return 'unknown';
  const normalizedName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return MODULE_NAME_DOMAIN_RULES.find(([pattern]) => pattern.test(normalizedName))?.[1] ?? 'unknown';
}

/**
 * Le domaine est un identifiant stable du référentiel SQL. Tant que la colonne
 * `modules.access_domain` n'est pas déployée, le nom technique immuable du
 * module fournit une compatibilité descendante. Les libellés traduisibles ne
 * participent jamais à la décision et toute valeur inconnue reste refusée.
 */
export function moduleDomain(
  module: Pick<PermissionModule, 'access_domain'> & Partial<Pick<PermissionModule, 'name'>>,
): ModuleDomain {
  const domain = module.access_domain;
  if (typeof domain === 'string') {
    return MODULE_DOMAINS.has(domain as ModuleDomain) ? domain as ModuleDomain : 'unknown';
  }
  return domainFromStableModuleName(module.name);
}

const ROLE_DOMAINS: Readonly<Record<AccountCreationRole, readonly ModuleDomain[]>> = {
  owner: [...MODULE_DOMAINS],
  admin: [
    'users', 'settings', 'sites', 'artisans', 'production', 'purchases', 'sales',
    'payments', 'shipping', 'refining', 'inventory', 'reconciliation', 'tax',
    'contracts', 'customers', 'documents', 'reports', 'audit',
  ],
  management: [
    'sites', 'artisans', 'production', 'purchases', 'sales', 'payments', 'shipping',
    'refining', 'inventory', 'reconciliation', 'tax', 'contracts', 'customers',
    'documents', 'reports', 'audit',
  ],
  dgmg: ['sites', 'artisans', 'production', 'documents', 'reports', 'audit'],
  mine: ['production', 'purchases', 'sales', 'payments', 'shipping', 'refining', 'inventory', 'contracts', 'customers', 'documents', 'reports'],
  comptoir: ['sites', 'artisans', 'production', 'sales', 'payments', 'inventory', 'tax', 'documents', 'reports'],
  dgi: ['production', 'sales', 'payments', 'reconciliation', 'tax', 'documents', 'reports', 'audit'],
  collector: ['sites', 'artisans', 'production', 'documents', 'reports', 'sales', 'payments'],
  customer: ['sales', 'payments', 'documents', 'reports'],
};

export interface ModulePermissionCeiling {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export const EMPTY_CEILING: ModulePermissionCeiling = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_approve: false,
};

const hasResponsibility = (
  responsibilities: Partial<OperationalCapabilityMap>,
  code: OperationalCapabilityCode,
) => responsibilities[code] === true;

/**
 * Plafond frontend, miroir défensif de la matrice SQL. Une case hors plafond
 * n'est jamais affichée comme disponible et le serveur répète le contrôle.
 */
export function permissionCeilingFor(
  role: UserRole | '',
  responsibilities: Partial<OperationalCapabilityMap>,
  module: PermissionModule,
): ModulePermissionCeiling {
  if (role === 'owner') return {
    can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true,
  };
  const policy = accountRolePolicy(role);
  const domain = moduleDomain(module);
  if (!policy || domain === 'unknown' || !ROLE_DOMAINS[policy.role].includes(domain)) return EMPTY_CEILING;

  const ceiling: ModulePermissionCeiling = { ...EMPTY_CEILING, can_view: true };
  if (role === 'admin') {
    // Un plafond autorise une attribution, il n'accorde aucun droit effectif.
    // L'Owner configure les modules de l'Administrateur ; les capacités métier,
    // la hiérarchie, la MFA et la séparation des fonctions restent distinctes.
    return { can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true };
  }

  if (role === 'management') {
    if (hasResponsibility(responsibilities, CAPABILITIES.SONASP_PREPARE)) {
      ceiling.can_create = [
        'production', 'purchases', 'sales', 'shipping', 'refining', 'inventory',
        'contracts', 'customers', 'documents',
      ].includes(domain);
      ceiling.can_edit = ceiling.can_create;
    }
    if (
      hasResponsibility(responsibilities, CAPABILITIES.SONASP_APPROVE)
      && ['production', 'purchases', 'sales', 'shipping', 'refining'].includes(domain)
    ) ceiling.can_approve = true;
    if (
      hasResponsibility(responsibilities, CAPABILITIES.FINANCE_EXECUTE)
      && domain === 'payments'
    ) {
      ceiling.can_create = true;
      ceiling.can_edit = true;
    }
    if (
      hasResponsibility(responsibilities, CAPABILITIES.FINANCE_RECONCILE)
      && ['payments', 'reconciliation'].includes(domain)
    ) ceiling.can_approve = true;
    if (
      hasResponsibility(responsibilities, CAPABILITIES.RECONCILIATION_MANAGE)
      && domain === 'reconciliation'
    ) {
      ceiling.can_create = true;
      ceiling.can_edit = true;
    }
    return ceiling;
  }

  if (role === 'dgmg') {
    if (hasResponsibility(responsibilities, CAPABILITIES.DGMG_SUPERVISE) && ['sites', 'artisans'].includes(domain)) {
      ceiling.can_create = true;
      ceiling.can_edit = true;
    }
    if (hasResponsibility(responsibilities, CAPABILITIES.DGMG_PRODUCTION_VALIDATE) && domain === 'production') {
      ceiling.can_approve = true;
    }
    return ceiling;
  }

  if (role === 'mine') {
    if (hasResponsibility(responsibilities, CAPABILITIES.MINE_PRODUCTION_MANAGE)) {
      ceiling.can_create = ['production', 'purchases', 'sales', 'shipping', 'contracts', 'documents'].includes(domain);
      ceiling.can_edit = ceiling.can_create;
    }
    return ceiling;
  }

  if (role === 'comptoir' && hasResponsibility(responsibilities, CAPABILITIES.COMPTOIR_MANAGE)) {
    ceiling.can_create = ['artisans', 'production', 'sales', 'payments', 'tax', 'documents'].includes(domain);
    if (domain === 'payments') {
      ceiling.can_create = hasResponsibility(responsibilities, CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE);
      ceiling.can_approve = hasResponsibility(responsibilities, CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE);
    }
    if (domain === 'tax') ceiling.can_create = hasResponsibility(responsibilities, CAPABILITIES.COMPTOIR_TAX_EXECUTE);
    ceiling.can_edit = ceiling.can_create;
    return ceiling;
  }

  if (role === 'dgi') {
    if (hasResponsibility(responsibilities, CAPABILITIES.DGI_FISCAL_CONTROL) && ['tax', 'reconciliation'].includes(domain)) {
      ceiling.can_edit = true;
    }
    if (hasResponsibility(responsibilities, CAPABILITIES.DGI_FISCAL_RECONCILE) && ['payments', 'reconciliation'].includes(domain)) {
      ceiling.can_approve = true;
    }
    return ceiling;
  }

  if (role === 'collector' && hasResponsibility(responsibilities, CAPABILITIES.COLLECTOR_OPERATE)) {
    ceiling.can_create = ['artisans', 'production', 'documents', 'sales'].includes(domain)
      || (domain === 'payments' && hasResponsibility(responsibilities, CAPABILITIES.COLLECTOR_PAYMENTS_EXECUTE));
    ceiling.can_edit = ceiling.can_create;
  }
  return ceiling;
}

export function availableModulesFor(
  role: UserRole | '',
  responsibilities: Partial<OperationalCapabilityMap>,
  modules: PermissionModule[],
): PermissionModule[] {
  return modules.filter((module) => permissionCeilingFor(role, responsibilities, module).can_view);
}

export type PermissionPreset = 'none' | 'read' | 'recommended' | 'all' | 'custom';

export function permissionsForPreset(
  role: UserRole | '',
  responsibilities: Partial<OperationalCapabilityMap>,
  modules: PermissionModule[],
  preset: Exclude<PermissionPreset, 'custom'>,
): Record<string, ModulePermission> {
  return Object.fromEntries(availableModulesFor(role, responsibilities, modules).map((module) => {
    const ceiling = permissionCeilingFor(role, responsibilities, module);
    const recommended = role === 'owner' || preset === 'all' || preset === 'recommended';
    // Ne pas transformer le gabarit par défaut en attribution globale implicite.
    const adminDefault = role === 'admin' && preset === 'recommended';
    const technical = ['users', 'settings'].includes(moduleDomain(module));
    return [module.id, {
      module_id: module.id,
      can_view: (role === 'owner' || preset !== 'none') && ceiling.can_view,
      can_create: recommended && ceiling.can_create && (!adminDefault || technical),
      can_edit: recommended && ceiling.can_edit && (!adminDefault || technical),
      can_delete: (role === 'owner' || preset === 'all') && ceiling.can_delete,
      can_approve: recommended && ceiling.can_approve && !adminDefault,
      field_permissions: {},
    } satisfies ModulePermission];
  }));
}

export function boundPermissionToCeiling(
  permission: ModulePermission,
  ceiling: ModulePermissionCeiling,
): ModulePermission {
  const canView = permission.can_view && ceiling.can_view;
  return {
    ...permission,
    can_view: canView,
    can_create: canView && permission.can_create && ceiling.can_create,
    can_edit: canView && permission.can_edit && ceiling.can_edit,
    can_delete: canView && permission.can_delete && ceiling.can_delete,
    can_approve: canView && permission.can_approve && ceiling.can_approve,
    field_permissions: canView ? permission.field_permissions : {},
  };
}
