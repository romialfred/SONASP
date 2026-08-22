import type { UserRole } from '@/types/auth';

export type RoleTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Libellés métier des rôles, en français.
 * Les écrans d'administration affichaient les identifiants techniques anglais
 * (« Owner », « Factory ») sur une plateforme intégralement francophone.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  management: 'Direction',
  manager: 'Manager · lecture seule',
  factory: 'Usine',
  airport: 'Aéroport',
  refinery: 'Raffinerie',
  customer: 'Client',
  mine: 'Société minière',
};

export const ROLE_TONES: Record<UserRole, RoleTone> = {
  owner: 'warning',
  admin: 'danger',
  management: 'info',
  manager: 'neutral',
  factory: 'success',
  airport: 'info',
  refinery: 'warning',
  customer: 'neutral',
  mine: 'success',
};

/** Tous les rôles du référentiel, dans l'ordre décroissant de privilège. */
export const ALL_ROLES: UserRole[] = ['owner', 'admin', 'management', 'manager', 'mine', 'factory', 'airport', 'refinery', 'customer'];

export const roleLabel = (role?: string | null): string =>
  (role && ROLE_LABELS[role as UserRole]) || role || 'Rôle non défini';

export const roleTone = (role?: string | null): RoleTone => ROLE_TONES[role as UserRole] || 'neutral';

/** Rôles disposant d'un accès d'administration ; ils ne doivent jamais être masqués des filtres. */
export const ROLES_PRIVILEGIES: UserRole[] = ['owner', 'admin'];
