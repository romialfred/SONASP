import { describe, expect, it } from 'vitest';
import { assignableRoles, canAssignRole, canManageAccount } from './roleHierarchy';
import { ALL_ROLES } from './roleLabels';

describe('hiérarchie d’administration des comptes', () => {
  it('réserve l’attribution du rôle Propriétaire à un Owner', () => {
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('management', 'owner')).toBe(false);
    expect(assignableRoles('owner', ALL_ROLES)).toContain('owner');
  });

  it('interdit la création d’un rôle supérieur à celui de l’acteur', () => {
    expect(canAssignRole('admin', 'management')).toBe(true);
    expect(canAssignRole('management', 'admin')).toBe(false);
    expect(canAssignRole('management', 'manager')).toBe(false);
    expect(canAssignRole('factory', 'customer')).toBe(false);
  });

  it('interdit toute administration de son propre compte', () => {
    expect(canManageAccount('owner', 'owner', 'moi', 'moi')).toBe(false);
    expect(canManageAccount('owner', 'owner', 'moi', 'autre')).toBe(true);
    expect(canManageAccount('admin', 'management', 'moi', 'autre')).toBe(true);
  });

  it('ne présente à un administrateur que les rôles qu’il peut attribuer', () => {
    expect(assignableRoles('admin', ALL_ROLES)).not.toContain('owner');
    expect(assignableRoles('admin', ALL_ROLES)).not.toContain('admin');
    expect(assignableRoles('management', ALL_ROLES)).not.toContain('admin');
    expect(assignableRoles('management', ALL_ROLES)).toEqual([]);
  });
});
