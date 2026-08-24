import { describe, expect, it } from 'vitest';
import { INTERACTIVE_ACCOUNT_ROLES, isInteractiveAccountRole } from './account-role-policy';

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
