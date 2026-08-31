import type { UserProfile, UserRole } from '@/types/auth';

export const CAPABILITIES = {
  ACCOUNTS_MANAGE: 'accounts.manage',
  EMAIL_SETTINGS_MANAGE: 'email.settings.manage',
  PLATFORM_SETTINGS_READ: 'platform.settings.read',
  PLATFORM_SETTINGS_MANAGE: 'platform.settings.manage',
  REFERENTIALS_MANAGE: 'referentials.manage',
  SUPPORT_READ: 'support.read',
  REPORTS_READ: 'reports.read',
  SONASP_WORKFLOW_READ: 'sonasp.workflow.read',
  SONASP_PREPARE: 'sonasp.prepare',
  SONASP_APPROVE: 'sonasp.approve',
  FINANCE_EXECUTE: 'sonasp.finance.execute',
  FINANCE_RECONCILE: 'sonasp.finance.reconcile',
  SONASP_TAX_RECONCILE: 'sonasp.tax.reconcile',
  COMPTOIR_MANAGE: 'comptoir.manage',
  COMPTOIR_INVOICES_ISSUE: 'comptoir.invoices.issue',
  COMPTOIR_PAYMENTS_EXECUTE: 'comptoir.payments.execute',
  COMPTOIR_PAYMENTS_RECONCILE: 'comptoir.payments.reconcile',
  COMPTOIR_TAX_EXECUTE: 'comptoir.tax.execute',
  COLLECTORS_MANAGE: 'collectors.manage',
  COLLECTOR_OPERATE: 'collector.operate',
  DGMG_SUPERVISE: 'dgmg.supervise',
  DGMG_PRODUCTION_VALIDATE: 'dgmg.production.validate',
  RESERVE_ALLOCATIONS_VALIDATE_LEVEL_1: 'reserve.allocations.validate_level_1',
  DGI_FISCAL_CONTROL: 'dgi.fiscal.control',
  DGI_FISCAL_RECONCILE: 'dgi.fiscal.reconcile',
  MINE_PRODUCTION_MANAGE: 'mine.production.manage',
  REFINING_SUPERVISE: 'refining.supervise',
  RECONCILIATION_MANAGE: 'reconciliation.manage',
  ARTISAN_CARDS_MANAGE: 'artisan.cards.manage',
  ARTISAN_PAYMENT_METHODS_MANAGE: 'artisan.payment-methods.manage',
  MINE_OPERATE: 'mine.operate',
  FACTORY_OPERATE: 'factory.operate',
  AIRPORT_OPERATE: 'airport.operate',
  REFINERY_OPERATE: 'refinery.operate',
  CUSTOMER_OPERATE: 'customer.operate',
  RECONCILIATION_READ: 'reconciliation.read',
  RECONCILIATION_CREATE: 'reconciliation.create',
  RECONCILIATION_EDIT: 'reconciliation.edit',
  RECONCILIATION_SUBMIT: 'reconciliation.submit',
  RECONCILIATION_APPROVE: 'reconciliation.approve',
  RECONCILIATION_REJECT: 'reconciliation.reject',
  RECONCILIATION_DISPUTE: 'reconciliation.dispute',
  RECONCILIATION_CLOSE: 'reconciliation.close',
  RECONCILIATION_EXPORT: 'reconciliation.export',
  RECONCILIATION_TAX_ADJUST: 'reconciliation.tax.adjust',
  RECONCILIATION_CREDIT_APPLY: 'reconciliation.credit.apply',
  TAX_RULES_READ: 'tax.rules.read',
  TAX_RULES_MANAGE: 'tax.rules.manage',
} as const;

export type CapabilityCode = typeof CAPABILITIES[keyof typeof CAPABILITIES];

export const OPERATIONAL_CAPABILITY_OPTIONS = [
  {
    code: CAPABILITIES.SONASP_PREPARE,
    label: 'SONASP Gestionnaire',
    description: 'Prépare les dossiers et les soumet au contrôle.',
  },
  {
    code: CAPABILITIES.SONASP_APPROVE,
    label: 'SONASP Approbateur',
    description: 'Contrôle, approuve ou rejette sans pouvoir valider son propre dossier.',
  },
  {
    code: CAPABILITIES.FINANCE_EXECUTE,
    label: 'SONASP Finances — exécution',
    description: 'Exécute le règlement et joint la preuve bancaire.',
  },
  {
    code: CAPABILITIES.FINANCE_RECONCILE,
    label: 'SONASP Finances — rapprochement',
    description: 'Rapproche une opération exécutée par un autre acteur.',
  },
  {
    code: CAPABILITIES.COMPTOIR_MANAGE,
    label: 'Comptoir d’achat',
    description: 'Gère achats, factures DGI, paiements, ventes et stock de son comptoir.',
  },
  { code: CAPABILITIES.COMPTOIR_INVOICES_ISSUE, label: 'Comptoir — facturation', description: 'Émet les factures des ventes du comptoir.' },
  { code: CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE, label: 'Comptoir — exécution des paiements', description: 'Exécute les règlements et joint leurs justificatifs.' },
  { code: CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE, label: 'Comptoir — contrôle des paiements', description: 'Contrôle les paiements préparés par un autre acteur.' },
  { code: CAPABILITIES.COMPTOIR_TAX_EXECUTE, label: 'Comptoir — reversements fiscaux', description: 'Prépare et transmet les reversements fiscaux.' },
  {
    code: CAPABILITIES.COLLECTORS_MANAGE,
    label: 'Gestion des collecteurs',
    description: 'Crée les rattachements historisés entre collecteurs et orpailleurs.',
  },
  {
    code: CAPABILITIES.COLLECTOR_OPERATE,
    label: 'Agent Collecteur',
    description: 'Enregistre les opérations des seuls orpailleurs qui lui sont rattachés.',
  },
  {
    code: CAPABILITIES.DGMG_SUPERVISE,
    label: 'Supervision DGMG',
    description: 'Contrôle les sites, opérateurs et déclarations du secteur minier.',
  },
  {
    code: CAPABILITIES.DGMG_PRODUCTION_VALIDATE,
    label: 'Validation production',
    description: 'Valide les déclarations de production relevant de la DGMG.',
  },
  {
    code: CAPABILITIES.DGI_FISCAL_CONTROL,
    label: 'Contrôle fiscal',
    description: 'Contrôle les assiettes, taxes, redevances et royalties.',
  },
  {
    code: CAPABILITIES.DGI_FISCAL_RECONCILE,
    label: 'Rapprochement fiscal',
    description: 'Rapproche les montants déclarés, appelés et payés.',
  },
  {
    code: CAPABILITIES.MINE_PRODUCTION_MANAGE,
    label: 'Gestion de la production',
    description: 'Déclare la production et prépare les opérations de la société.',
  },
  {
    code: CAPABILITIES.REFINING_SUPERVISE,
    label: 'Raffinage',
    description: 'Suit les lots, résultats, écarts et réceptions autorisés.',
  },
  {
    code: CAPABILITIES.RECONCILIATION_MANAGE,
    label: 'Conciliation',
    description: 'Prépare et analyse les dossiers de conciliation.',
  },
] as const;

export type OperationalCapabilityCode = typeof OPERATIONAL_CAPABILITY_OPTIONS[number]['code'];

export type OperationalCapabilityMap = Record<OperationalCapabilityCode, boolean>;

export function emptyOperationalCapabilities(): OperationalCapabilityMap {
  return Object.fromEntries(
    OPERATIONAL_CAPABILITY_OPTIONS.map(({ code }) => [code, false]),
  ) as OperationalCapabilityMap;
}

export function operationalCapabilitiesForRole(role: UserRole | ''): OperationalCapabilityMap {
  const result = emptyOperationalCapabilities();
  // La Direction reçoit ses responsabilités explicitement. Aucun cumul
  // préparer/approuver ou exécuter/rapprocher n'est déduit du rôle.
  if (role === 'dgmg') result[CAPABILITIES.DGMG_SUPERVISE] = true;
  if (role === 'dgi') result[CAPABILITIES.DGI_FISCAL_CONTROL] = true;
  if (role === 'mine') result[CAPABILITIES.MINE_PRODUCTION_MANAGE] = true;
  if (role === 'comptoir') result[CAPABILITIES.COMPTOIR_MANAGE] = true;
  if (role === 'collector') result[CAPABILITIES.COLLECTOR_OPERATE] = true;
  return result;
}

/**
 * Compatibilité lorsque la migration de capacités n'est pas encore disponible
 * dans un environnement de reprise. Hormis le périmètre global du Owner, le
 * serveur reste toujours l'autorité : dès qu'il fournit `user.capabilities`,
 * aucune permission locale supplémentaire n'est inventée.
 */
const ROLE_CAPABILITY_FALLBACK: Record<UserRole, CapabilityCode[]> = {
  owner: [
    CAPABILITIES.ACCOUNTS_MANAGE,
    CAPABILITIES.EMAIL_SETTINGS_MANAGE,
    CAPABILITIES.PLATFORM_SETTINGS_READ,
    CAPABILITIES.PLATFORM_SETTINGS_MANAGE,
    CAPABILITIES.REFERENTIALS_MANAGE,
    CAPABILITIES.SUPPORT_READ,
    CAPABILITIES.REPORTS_READ,
  ],
  admin: [
    CAPABILITIES.ACCOUNTS_MANAGE,
    CAPABILITIES.EMAIL_SETTINGS_MANAGE,
    CAPABILITIES.PLATFORM_SETTINGS_READ,
    CAPABILITIES.PLATFORM_SETTINGS_MANAGE,
    CAPABILITIES.REFERENTIALS_MANAGE,
    CAPABILITIES.SUPPORT_READ,
    CAPABILITIES.REPORTS_READ,
  ],
  management: [
    CAPABILITIES.REPORTS_READ,
    CAPABILITIES.SONASP_WORKFLOW_READ,
    CAPABILITIES.PLATFORM_SETTINGS_READ,
  ],
  manager: [
    CAPABILITIES.REPORTS_READ,
    CAPABILITIES.SONASP_WORKFLOW_READ,
    CAPABILITIES.PLATFORM_SETTINGS_READ,
  ],
  dgmg: [CAPABILITIES.DGMG_SUPERVISE],
  dgi: [CAPABILITIES.DGI_FISCAL_CONTROL],
  mine: [CAPABILITIES.MINE_OPERATE],
  comptoir: [CAPABILITIES.COMPTOIR_MANAGE],
  collector: [CAPABILITIES.COLLECTOR_OPERATE],
  factory: [CAPABILITIES.FACTORY_OPERATE],
  airport: [CAPABILITIES.AIRPORT_OPERATE],
  refinery: [CAPABILITIES.REFINERY_OPERATE],
  customer: [CAPABILITIES.CUSTOMER_OPERATE],
};

export function hasCapability(
  user: UserProfile | null | undefined,
  capability: CapabilityCode,
): boolean {
  if (!user?.is_active) return false;

  // Le Owner actif est le super-administrateur transversal. Ce raccourci ne
  // s'applique pas aux opérations sensibles, contrôlées séparément ci-dessous.
  if (user.role === 'owner') return true;

  if (Array.isArray(user.capabilities)) {
    return user.capabilities.includes(capability);
  }

  // Compatibilité des profils historiques : avant l'introduction du rôle
  // `mine`, les comptes de sociétés étaient parfois enregistrés `customer`.
  // Le rattachement ne vaut que lorsque le serveur n'a encore renvoyé aucune
  // liste autoritative de capacités.
  if (capability === CAPABILITIES.MINE_OPERATE && user.mining_company_id) {
    return true;
  }

  return ROLE_CAPABILITY_FALLBACK[user.role]?.includes(capability) ?? false;
}

/**
 * Une capability sensible n'est jamais déduite du rôle ni du statut Owner.
 * Sa présence dans la liste autoritative prouve que le serveur a aussi validé
 * les conditions de session (notamment l'AAL2 et les overrides actifs).
 */
export function hasSensitiveCapability(
  user: UserProfile | null | undefined,
  capability: CapabilityCode,
): boolean {
  return Boolean(
    user?.is_active
    && Array.isArray(user.capabilities)
    && user.capabilities.includes(capability),
  );
}

export function hasAnyCapability(
  user: UserProfile | null | undefined,
  capabilities: CapabilityCode[],
): boolean {
  return capabilities.some((capability) => hasCapability(user, capability));
}
