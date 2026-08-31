import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_MANAGEMENT_CAPABILITY,
  accountOrganizationType,
  canManageAccountTarget,
  canCreateAccountRole,
  INTERACTIVE_ACCOUNT_ROLES,
  isInteractiveAccountRole,
} from './account-role-policy';

describe('politique des rôles attribuables depuis le portail', () => {
  it.each([
    ['owner', 'sonasp'], ['admin', 'sonasp'], ['management', 'sonasp'],
    ['dgmg', 'dgmg'], ['dgi', 'dgi'], ['mine', 'mine'], ['comptoir', 'comptoir'],
    ['collector', 'comptoir'], ['customer', 'customer'],
  ])('valide le rattachement %s au type %s', (role, organizationType) => {
    expect(accountOrganizationType(role)).toBe(organizationType);
  });
  it('inclut Propriétaire dans le catalogue, sans lui donner un droit d’attribution implicite', () => {
    expect(INTERACTIVE_ACCOUNT_ROLES).toContain('owner');
    expect(isInteractiveAccountRole('owner')).toBe(true);
  });

  it.each(INTERACTIVE_ACCOUNT_ROLES)('conserve le rôle de portail %s', (role) => {
    expect(isInteractiveAccountRole(role)).toBe(true);
  });

  it('refuse une valeur inconnue', () => {
    expect(isInteractiveAccountRole('super-admin')).toBe(false);
  });
});

describe('hiérarchie des comptes administrables', () => {
  it('vérifie chaque attribution avant création Auth', () => {
    expect(canCreateAccountRole('owner', 'owner')).toBe(true);
    expect(canCreateAccountRole('admin', 'owner')).toBe(false);
    expect(canCreateAccountRole('admin', 'admin')).toBe(false);
    expect(canCreateAccountRole('management', 'customer')).toBe(false);
    expect(canCreateAccountRole('owner', 'invented')).toBe(false);
  });
  const policy = (actorRole: string, targetRole: string, targetId = 'target') =>
    canManageAccountTarget({ actorId: 'actor', actorRole, targetId, targetRole });

  it('emploie la capacité dédiée à l’administration des comptes', () => {
    expect(ACCOUNT_MANAGEMENT_CAPABILITY).toBe('accounts.manage');
  });

  it('interdit sa propre cible et réserve un autre Owner à un Owner', () => {
    expect(policy('owner', 'admin', 'actor')).toBe(false);
    expect(policy('owner', 'owner')).toBe(true);
    expect(policy('owner', 'owner', 'actor')).toBe(false);
    expect(policy('admin', 'owner')).toBe(false);
  });

  it('réserve les comptes Administrateur au Propriétaire', () => {
    expect(policy('owner', 'admin')).toBe(true);
    expect(policy('admin', 'admin')).toBe(false);
  });

  it('autorise un Administrateur uniquement sur les niveaux inférieurs', () => {
    expect(policy('admin', 'management')).toBe(true);
    expect(policy('admin', 'mine')).toBe(true);
  });

  it('refuse une capacité déléguée si le rôle ne porte pas la hiérarchie requise', () => {
    expect(policy('management', 'manager')).toBe(false);
    expect(policy('manager', 'mine')).toBe(false);
    expect(policy('super-admin', 'admin')).toBe(false);
  });
});
