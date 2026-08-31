import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/create-user/index.ts'),
  'utf8',
);

describe('contrat de création sécurisée des comptes', () => {
  it('revalide une création Owner par le RPC acteur avant activation', () => {
    expect(source.indexOf('canCreateAccountRole(roleActeur, role)')).toBeLessThan(source.indexOf('admin.auth.admin.createUser'));
    expect(source).toContain("role: role === 'owner' ? 'customer' : role");
    expect(source).toContain("is_active: role === 'owner' ? false : actif");
    expect(source).toContain("clientActeur.rpc('snp_configurer_acces_compte'");
  });
  it('rattache tout nouveau comptoir à un ministère actif', () => {
    expect(source).toContain(".from('snp_ministries')");
    expect(source).toContain(".eq('code', 'MEMC')");
    expect(source).toContain('supervising_ministry_id: ministereTutelle.id');
  });

  it('applique le plafond serveur aux habilitations initiales', () => {
    expect(source).toContain("clientActeur.rpc('snp_remplacer_habilitations_compte'");
    expect(source).not.toMatch(/from\('user_permissions'\)\.insert/u);
  });

  it('contrôle les erreurs de chaque étape du retour arrière', () => {
    expect(source).toContain('const erreurs: string[] = []');
    expect(source).toContain('if (erreurAuth) erreurs.push');
    expect(source).toContain('if (erreurSuppressionOrganisation) throw erreurSuppressionOrganisation');
  });
});
