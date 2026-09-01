import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/create-user/index.ts'),
  'utf8',
);
const transactionalMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260901153000_creation_compte_transactionnelle.sql'),
  'utf8',
);

describe('contrat de création sécurisée des comptes', () => {
  it('revalide une création Owner par le RPC acteur avant activation', () => {
    expect(source.indexOf('canCreateAccountRole(roleActeur, role)')).toBeLessThan(source.indexOf('admin.auth.admin.createUser'));
    expect(source).toContain('p_role: role');
    expect(source).toContain("p_permissions: role === 'owner' ? [] : permissions");
    expect(source).toContain("'snp_creer_compte_postgresql_transactionnel'");
    expect(transactionalMigration).toContain("v_actor_role:=public.snp_creation_compte_require_actor(p_role)");
    expect(transactionalMigration).toContain("PERFORM public.snp_configurer_acces_compte(");
  });
  it('rattache tout nouveau comptoir à un ministère actif', () => {
    expect(transactionalMigration).toContain('FROM public.snp_ministries ministry');
    expect(transactionalMigration).toContain("WHERE ministry.code='MEMC' AND ministry.is_active");
    expect(transactionalMigration).toContain('code,name,organization_type,supervising_ministry_id,is_active,created_by');
  });

  it('applique le plafond serveur aux habilitations initiales', () => {
    expect(source).toContain("'snp_creer_compte_postgresql_transactionnel'");
    expect(transactionalMigration).toContain('PERFORM public.snp_configurer_acces_compte(');
    expect(source).not.toMatch(/from\('user_permissions'\)\.insert/u);
  });

  it('contrôle les erreurs de chaque étape du retour arrière', () => {
    expect(source).toContain("clientActeur.rpc('snp_annuler_creation_compte_postgresql'");
    expect(source).toContain('await supprimerIdentiteAuthEtVerifier(admin, utilisateurId)');
    expect(source).toContain('for (let tentative = 0; tentative < 2; tentative += 1)');
    expect(transactionalMigration).toContain('DELETE FROM public.snp_organizations organization');
    expect(transactionalMigration).toContain("RAISE EXCEPTION 'Le Comptoir créé ne peut pas être annulé sans contrôle manuel.'");
  });
});
