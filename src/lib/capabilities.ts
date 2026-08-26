import type { UserProfile, UserRole } from '@/types/auth';

export const CAPABILITIES = {
  ACCOUNTS_MANAGE: 'accounts.manage',
  EMAIL_SETTINGS_MANAGE: 'email.settings.manage',
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
  if (role === 'management') {
    result[CAPABILITIES.SONASP_PREPARE] = true;
    result[CAPABILITIES.SONASP_APPROVE] = true;
    result[CAPABILITIES.FINANCE_EXECUTE] = true;
    result[CAPABILITIES.FINANCE_RECONCILE] = true;
    result[CAPABILITIES.COMPTOIR_MANAGE] = true;
    result[CAPABILITIES.COLLECTORS_MANAGE] = true;
  }
  return result;
}

/**
 * Compatibilité lorsque la migration de capacités n'est pas encore disponible
 * dans un environnement de reprise. Le serveur reste toujours l'autorité : dès
 * qu'il fournit `user.capabilities`, aucune permission locale supplémentaire
 * n'est inventée.
 */
const ROLE_CAPABILITY_FALLBACK: Record<UserRole, CapabilityCode[]> = {
  owner: Object.values(CAPABILITIES),
  admin: [
    CAPABILITIES.ACCOUNTS_MANAGE,
    CAPABILITIES.EMAIL_SETTINGS_MANAGE,
    CAPABILITIES.REFERENTIALS_MANAGE,
    CAPABILITIES.SUPPORT_READ,
    CAPABILITIES.REPORTS_READ,
  ],
  management: [
    CAPABILITIES.REPORTS_READ,
    CAPABILITIES.SONASP_WORKFLOW_READ,
    CAPABILITIES.SONASP_PREPARE,
    CAPABILITIES.SONASP_APPROVE,
    CAPABILITIES.FINANCE_EXECUTE,
    CAPABILITIES.FINANCE_RECONCILE,
    CAPABILITIES.COMPTOIR_MANAGE,
    CAPABILITIES.COLLECTORS_MANAGE,
  ],
  manager: [CAPABILITIES.REPORTS_READ, CAPABILITIES.SONASP_WORKFLOW_READ],
  mine: [CAPABILITIES.MINE_OPERATE],
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
