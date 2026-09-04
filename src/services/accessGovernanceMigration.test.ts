import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260904193000_refonte_gouvernance_acces_portails.sql'), 'utf8');

describe('migration de gouvernance des accès', () => {
  it('modélise les portails, rôles, catégories, matrices et restrictions négatives', () => {
    ['snp_actor_categories','snp_access_portals','snp_access_roles','snp_access_role_permissions','snp_user_access_assignments','snp_user_permission_restrictions','snp_access_audit_log'].forEach((table) => {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    });
    expect(migration).toContain('FOREIGN KEY(portal_id,role_id)');
    expect(migration).toContain('denied boolean NOT NULL DEFAULT true CHECK (denied)');
    expect(migration).toContain("permission_code IN ('edit','submit','validate','reject')");
  });

  it('applique le refus par défaut à toutes les frontières et conserve le plafond historique', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.snp_effective_access_for_user');
    expect(migration).toContain('NOT context.account_active OR NOT context.assignment_active');
    expect(migration).toContain('context.role_portal_id<>context.portal_id');
    expect(migration).toContain('snp_user_permission_restrictions restriction');
    expect(migration).toContain('public.snp_access_legacy_user_permission_allowed');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.snp_actor_can_module_action');
  });

  it('protège les mutations et réserve la création de portails au Owner', () => {
    expect(migration).toContain("IF p_portal_id IS NULL AND v_actor_role<>'owner' THEN");
    expect(migration).toContain('La création d’un portail est réservée au Super Administrateur.');
    expect(migration).toMatch(/snp_access_portal_archive[\s\S]*snp_access_admin_authorized\(true,true\)/);
    expect(migration).toContain('Un Administrateur standard ne peut pas gérer ce niveau de compte.');
    expect(migration).toContain("Une restriction est invalide ou tenterait d’accorder un droit.");
    expect(migration).toContain("AND (CASE v_category.resource_kind");
  });

  it('rend l’audit immuable et refuse tout accès direct aux tables depuis le navigateur', () => {
    expect(migration).toContain('CREATE TRIGGER trg_snp_access_audit_immutable');
    expect(migration).toContain('Le journal d’audit des accès est immuable.');
    expect(migration).toContain('FROM PUBLIC,anon,authenticated;');
    expect(migration).toContain("procedure.proname LIKE 'snp_access_%'");
  });

  it('migre tous les comptes et vérifie les invariants avant validation', () => {
    expect(migration).toContain('INSERT INTO public.snp_user_access_assignments');
    expect(migration).toContain('GROUP BY policy.portal_code');
    expect(migration).toContain('count(DISTINCT policy.organization_type)=1');
    expect(migration).toContain('Affectation sans perte de tous les profils existants');
    expect(migration).toContain('Postflight gouvernance des accès : invariants incomplets.');
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });
});
