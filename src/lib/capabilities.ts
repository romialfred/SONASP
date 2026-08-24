import type { UserProfile, UserRole } from '@/types/auth';

export const CAPABILITIES = {
  ACCOUNTS_MANAGE: 'accounts.manage',
  REFERENTIALS_MANAGE: 'referentials.manage',
  SUPPORT_READ: 'support.read',
  REPORTS_READ: 'reports.read',
  SONASP_WORKFLOW_READ: 'sonasp.workflow.read',
  SONASP_PREPARE: 'sonasp.prepare',
  SONASP_APPROVE: 'sonasp.approve',
  FINANCE_EXECUTE: 'sonasp.finance.execute',
  FINANCE_RECONCILE: 'sonasp.finance.reconcile',
  COMPTOIR_MANAGE: 'comptoir.manage',
  COLLECTORS_MANAGE: 'collectors.manage',
  COLLECTOR_OPERATE: 'collector.operate',
  MINE_OPERATE: 'mine.operate',
  FACTORY_OPERATE: 'factory.operate',
  AIRPORT_OPERATE: 'airport.operate',
  REFINERY_OPERATE: 'refinery.operate',
  CUSTOMER_OPERATE: 'customer.operate',
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

  return ROLE_CAPABILITY_FALLBACK[user.role]?.includes(capability) ?? false;
}

export function hasAnyCapability(
  user: UserProfile | null | undefined,
  capabilities: CapabilityCode[],
): boolean {
  return capabilities.some((capability) => hasCapability(user, capability));
}
