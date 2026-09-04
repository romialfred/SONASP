import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260904170000_finaliser_suppression_et_reutilisation_email.sql',
  'utf8',
);

describe('contrat de suppression totale et de recréation', () => {
  it('certifie l’absence de l’identité et de toute adresse Auth homonyme', () => {
    expect(migration).toContain('FROM auth.users utilisateur');
    expect(migration).toContain('utilisateur.id=v_action.target_id');
    expect(migration).toContain("lower(trim(coalesce(utilisateur.email,'')))=v_email");
    expect(migration).toContain("'email_reusable',true");
  });

  it('purge les secrets et l’idempotence de création sans effacer les audits', () => {
    expect(migration).toContain("('snp_account_creation_operations','auth_user_id')");
    expect(migration).toContain("('user_activation_tokens','user_id')");
    expect(migration).toContain("('user_2fa_setup','user_id')");
    expect(migration).toContain("('password_history','user_id')");
    expect(migration).toContain('DELETE FROM public.user_invitations');
    expect(migration).not.toMatch(/DELETE FROM public\.snp_account_lifecycle_audit/i);
    expect(migration).not.toMatch(/DELETE FROM public\.security_events/i);
  });

  it('ferme le RPC au navigateur et l’autorise uniquement au service Edge', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.snp_admin_compte_finaliser_suppression(uuid,text)',
    );
    expect(migration).toContain('FROM PUBLIC,anon,authenticated;');
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.snp_admin_compte_finaliser_suppression(uuid,text)',
    );
    expect(migration).toContain('TO service_role;');
  });
});
