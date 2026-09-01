import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const lire = (path: string) => readFileSync(path, 'utf8');

const ADMIN_FUNCTIONS = [
  'delete-user',
  'get-users',
  'get-user-details',
  'manage-user-status',
] as const;

describe('contrat statique des Edge d’administration', () => {
  it.each(ADMIN_FUNCTIONS)('%s vérifie le registre de session avant service_role', (fonction) => {
    const source = lire(`supabase/functions/${fonction}/index.ts`);
    expect(source).toContain('verifierSessionAdministration');
    expect(source).toMatch(/auth\.getUser\((?:token|jeton)\)/);
    expect(source).toContain("['owner', 'admin']");
  });

  it('délègue le statut au RPC atomique et synchronise Auth sans DML session', () => {
    const source = lire('supabase/functions/manage-user-status/index.ts');
    expect(source).toContain("'snp_admin_compte_definir_statut'");
    expect(source).toContain('auth.admin.updateUserById');
    expect(source).toContain("'snp_admin_compte_finaliser_action'");
    expect(source).not.toContain(".from('user_sessions')");
    expect(source).not.toContain(".from('user_profiles')\n        .update");
  });

  it('prépare la suppression en DB et délègue la désactivation atomique au RPC', () => {
    const source = lire('supabase/functions/delete-user/index.ts');
    expect(source).toContain(".select('id,role,is_active,version')");
    expect(source).not.toContain('cible.is_active !== false');
    expect(source).toContain("'snp_admin_compte_preparer_suppression'");
    expect(source).toContain('auth.admin.deleteUser');
    expect(source).not.toContain('application/openapi+json');
  });

  it('ne restitue pas les IP et erreurs brutes dans la fiche compte', () => {
    const source = lire('supabase/functions/get-user-details/index.ts');
    expect(source).not.toContain("'last_login_ip'");
    expect(source).not.toContain(".select('id, event_type, user_agent, ip_address, details, created_at')");
    expect(source).not.toContain('status, error_message, ip_address, user_agent, created_at');
  });

  it.each([
    'create-user',
    'reset-user-password',
    'envoyer-courriel',
    'manage-user-status',
    'delete-user',
    'get-user-details',
  ])('%s utilise le lecteur JSON borné et un contrat de clés', (fonction) => {
    const source = lire(`supabase/functions/${fonction}/index.ts`);
    expect(source).toContain('lireJsonLimite');
    expect(source).toContain('clesJsonValides');
    expect(source).not.toMatch(/\breq\.json\s*\(/u);
  });
});

describe('configuration reproductible des fonctions', () => {
  const config = lire('supabase/config.toml');

  it.each([
    ...ADMIN_FUNCTIONS,
    'revoke-user-sessions',
    'public-assistance',
    'sensitive-upload',
  ])('déclare explicitement %s', (fonction) => {
    expect(config).toMatch(new RegExp(`\\[functions\\.${fonction}\\]\\s+verify_jwt\\s*=\\s*false`));
  });

  it('aligne les redirects locaux sur le port Vite strict', () => {
    expect(config).toContain('http://localhost:5180/modifier-mot-de-passe');
    expect(config).toContain('http://127.0.0.1:5180/modifier-mot-de-passe');
    expect(config).not.toContain('localhost:5173/modifier-mot-de-passe');
  });

  it('épingle la version Supabase des fonctions administratives', () => {
    for (const fonction of ADMIN_FUNCTIONS) {
      expect(lire(`supabase/functions/${fonction}/index.ts`))
        .toContain("npm:@supabase/supabase-js@2.57.4");
    }
  });
});
