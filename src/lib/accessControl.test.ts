import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '@/lib/capabilities';
import { EMPTY_PERMISSION, type PermissionModule } from '@/services/userPermissionsService';
import {
  ACCOUNT_CREATION_ROLES,
  availableModulesFor,
  boundPermissionToCeiling,
  defaultResponsibilitiesForRole,
  moduleDomain,
  permissionCeilingFor,
  permissionsForPreset,
  responsibilitiesForRole,
  validateResponsibilities,
} from './accessControl';

const module = (id: string, name: string, displayName = name): PermissionModule => ({
  id,
  name,
  display_name: displayName,
  description: null,
  category: null,
  access_domain: id,
});

describe('matrice institutionnelle', () => {
  it('référence Owner et les huit rôles cibles, la hiérarchie filtre leur attribution', () => {
    expect(ACCOUNT_CREATION_ROLES).toEqual([
      'owner', 'admin', 'management', 'dgmg', 'mine', 'comptoir', 'dgi', 'collector', 'customer',
    ]);
  });

  it('filtre les responsabilités selon le rôle et impose les responsabilités structurelles', () => {
    expect(responsibilitiesForRole('dgi').map(({ code }) => code)).toEqual([
      CAPABILITIES.DGI_FISCAL_CONTROL,
      CAPABILITIES.DGI_FISCAL_RECONCILE,
    ]);
    expect(defaultResponsibilitiesForRole('collector')[CAPABILITIES.COLLECTOR_OPERATE]).toBe(true);
    expect(validateResponsibilities('collector', { [CAPABILITIES.COLLECTOR_OPERATE]: false })).toMatch(/obligatoire/i);
    expect(validateResponsibilities('dgi', { [CAPABILITIES.SONASP_APPROVE]: true })).toMatch(/incompatible/i);
    expect(validateResponsibilities('management', {
      [CAPABILITIES.SONASP_PREPARE]: true,
      [CAPABILITIES.SONASP_APPROVE]: true,
    })).toMatch(/séparation des fonctions/i);
  });
});

describe('plafond de permissions', () => {
  it('garantit tous les droits Owner, y compris pour un module sans domaine', () => {
    const newModule = module('unknown', 'new-module');
    expect(permissionCeilingFor('owner', {}, newModule)).toEqual({
      can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true,
    });
    for (const preset of ['none', 'read', 'recommended'] as const) {
      expect(permissionsForPreset('owner', {}, [newModule], preset).unknown).toMatchObject({
        can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true,
      });
    }
  });
  const users = module('users', 'users-management', 'Gestion des utilisateurs');
  const production = module('production', 'daily-production', 'Production journalière');
  const taxes = module('tax', 'tax-rules', 'Règles fiscales');
  const sales = module('sales', 'gold-sales', 'Ventes d’or');
  const payments = module('payments', 'payments', 'Paiements');

  it('classe les modules à partir du référentiel réel et refuse les inconnus', () => {
    expect(moduleDomain(users)).toBe('users');
    expect(moduleDomain(taxes)).toBe('tax');
    expect(moduleDomain({ name: 'Users Management' })).toBe('users');
    expect(moduleDomain({ name: 'Gold Sales Settings' })).toBe('settings');
    expect(moduleDomain({ name: 'Mining Production' })).toBe('production');
    expect(moduleDomain({ ...module('mystery', 'something-unmapped'), access_domain: null })).toBe('unknown');
    expect(moduleDomain({ name: 'something-unmapped' })).toBe('unknown');
  });

  it('permet une attribution explicite à Admin, sans attribution automatique ni domaine inconnu', () => {
    for (const target of [users, production, taxes, sales, payments, module('refining', 'refining'), module('inventory', 'national_reserve')]) {
      expect(permissionCeilingFor('admin', {}, target)).toEqual({
        can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true,
      });
    }
    expect(permissionCeilingFor('admin', {}, module('unknown', 'mystery')).can_view).toBe(false);
    expect(permissionsForPreset('admin', {}, [sales], 'recommended').sales).toMatchObject({
      can_view: true, can_create: false, can_approve: false,
    });
    expect(permissionsForPreset('admin', {}, [sales], 'all').sales).toMatchObject({
      can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true,
    });
    expect(permissionsForPreset('admin', {}, [sales], 'none').sales.can_view).toBe(false);
  });

  it('limite une société à ses modules et responsabilités', () => {
    const responsibilities = defaultResponsibilitiesForRole('mine');
    expect(permissionCeilingFor('mine', responsibilities, production)).toMatchObject({
      can_view: true,
      can_create: true,
      can_approve: false,
    });
    expect(permissionCeilingFor('mine', responsibilities, users)).toEqual({
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
    });
  });

  it('retire entièrement les modules incompatibles au lieu de les désactiver', () => {
    const modules = [users, production, taxes, sales];
    expect(availableModulesFor('dgi', defaultResponsibilitiesForRole('dgi'), modules).map(({ id }) => id))
      .toEqual(['production', 'tax', 'sales']);
  });

  it('borne chaque personnalisation au plafond du rôle', () => {
    const requested = { ...EMPTY_PERMISSION('users'), can_view: true, can_create: true, can_approve: true };
    expect(boundPermissionToCeiling(requested, permissionCeilingFor('management', {}, sales))).toMatchObject({
      can_view: true,
      can_create: false,
      can_approve: false,
    });
  });

  it('aligne les opérations fiscales du Comptoir et le rapprochement DGI', () => {
    const comptoir = { ...defaultResponsibilitiesForRole('comptoir'), [CAPABILITIES.COMPTOIR_TAX_EXECUTE]: true };
    const dgi = {
      ...defaultResponsibilitiesForRole('dgi'),
      [CAPABILITIES.DGI_FISCAL_RECONCILE]: true,
    };
    expect(permissionCeilingFor('comptoir', comptoir, taxes)).toMatchObject({
      can_view: true,
      can_create: true,
      can_edit: true,
    });
    expect(permissionCeilingFor('dgi', dgi, payments)).toMatchObject({
      can_view: true,
      can_approve: true,
    });
  });

  it('attribue explicitement la finance Comptoir et sépare exécution et contrôle', () => {
    const base = defaultResponsibilitiesForRole('comptoir');
    expect(base[CAPABILITIES.COMPTOIR_INVOICES_ISSUE]).toBe(false);
    expect(permissionCeilingFor('comptoir', base, payments)).toMatchObject({ can_create: false, can_approve: false });
    expect(permissionCeilingFor('comptoir', { ...base, [CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE]: true }, payments))
      .toMatchObject({ can_create: true, can_edit: true, can_approve: false });
    expect(permissionCeilingFor('comptoir', { ...base, [CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE]: true }, payments))
      .toMatchObject({ can_create: false, can_edit: false, can_approve: true });
    expect(validateResponsibilities('comptoir', { ...base, [CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE]: true, [CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE]: true }))
      .toMatch(/séparation des fonctions/i);
    expect(validateResponsibilities('mine', { [CAPABILITIES.COMPTOIR_INVOICES_ISSUE]: true })).toMatch(/incompatible/i);
  });

  it('applique les gabarits lecture et recommandé sans dépasser le plafond', () => {
    const responsibilities = defaultResponsibilitiesForRole('collector');
    const none = permissionsForPreset('collector', responsibilities, [production, users], 'none');
    const read = permissionsForPreset('collector', responsibilities, [production, users], 'read');
    const recommended = permissionsForPreset('collector', responsibilities, [production, users], 'recommended');
    expect(Object.keys(read)).toEqual(['production']);
    expect(none.production).toMatchObject({ can_view: false, can_create: false });
    expect(read.production).toMatchObject({ can_view: true, can_create: false });
    expect(recommended.production).toMatchObject({ can_view: true, can_create: true, can_approve: false });
  });
});
