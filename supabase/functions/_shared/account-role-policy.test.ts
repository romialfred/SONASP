import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_MANAGEMENT_CAPABILITY,
  canManageAccountTarget,
  INTERACTIVE_ACCOUNT_ROLES,
  isInteractiveAccountRole,
} from './account-role-policy';

describe('politique des rôles attribuables depuis le portail', () => {
  it('exclut toujours le rôle Propriétaire', () => {
    expect(INTERACTIVE_ACCOUNT_ROLES).not.toContain('owner');
    expect(isInteractiveAccountRole('owner')).toBe(false);
  });

  it.each(INTERACTIVE_ACCOUNT_ROLES)('conserve le rôle de portail %s', (role) => {
    expect(isInteractiveAccountRole(role)).toBe(true);
  });

  it('refuse une valeur inconnue', () => {
    expect(isInteractiveAccountRole('super-admin')).toBe(false);
  });
});

describe('hiérarchie des comptes administrables', () => {
  const policy = (actorRole: string, targetRole: string, targetId = 'target') =>
    canManageAccountTarget({ actorId: 'actor', actorRole, targetId, targetRole });

  it('emploie la capacité dédiée à l’administration des comptes', () => {
    expect(ACCOUNT_MANAGEMENT_CAPABILITY).toBe('accounts.manage');
  });

  it('interdit sa propre cible et tout compte Propriétaire', () => {
    expect(policy('owner', 'admin', 'actor')).toBe(false);
    expect(policy('owner', 'owner')).toBe(false);
    expect(policy('admin', 'owner')).toBe(false);
  });

  it('autorise un Administrateur sur son niveau et les niveaux inférieurs', () => {
    expect(policy('admin', 'admin')).toBe(true);
    expect(policy('admin', 'management')).toBe(true);
    expect(policy('admin', 'mine')).toBe(true);
  });

  it('refuse une capacité déléguée si le rôle ne porte pas la hiérarchie requise', () => {
    expect(policy('management', 'manager')).toBe(false);
    expect(policy('manager', 'mine')).toBe(false);
    expect(policy('super-admin', 'admin')).toBe(false);
  });
});
