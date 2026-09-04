import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260904220000_completer_filtre_acteurs_audit_acces.sql',
), 'utf8');

describe('migration du filtre des acteurs de l’audit', () => {
  it('agrège les trois journaux sans exposer leurs tables', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.snp_access_audit_actors()');
    expect(migration).toContain('FROM public.snp_access_audit_log audit');
    expect(migration).toContain('FROM public.snp_account_admin_audit account');
    expect(migration).toContain('FROM public.audit_logs legacy');
    expect(migration).toContain("public.snp_access_admin_authorized(false,false)");
    expect(migration).toContain("public.snp_actor_has_capability('reports.read')");
  });

  it('réserve l’exécution aux comptes authentifiés et termine atomiquement', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.snp_access_audit_actors() FROM PUBLIC,anon;');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.snp_access_audit_actors() TO authenticated;');
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });
});
