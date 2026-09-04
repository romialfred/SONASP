import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/resend-welcome-email/index.ts', 'utf8');

describe('contrat de relance de l’enrôlement', () => {
  it('réserve le renvoi aux comptes actifs dont l’enrôlement est incomplet', () => {
    expect(source).toContain("verifierSessionAdministration(acteurDb, 'edit')");
    expect(source).toContain(".rpc('snp_peut_administrer_compte'");
    expect(source).toContain('canManageAccountTarget');
    expect(source).toContain('const enrôlementIncomplet');
    expect(source).toContain('!cible.mfa_enrolled_at');
    expect(source).toContain('!cible.password_changed_at && !cible.last_login_at');
  });

  it('remplace le jeton, impose le nouveau mot de passe et envoie le gabarit de bienvenue', () => {
    const marquage = source.indexOf('.update({ must_change_password: true');
    const generation = source.indexOf('admin.auth.admin.generateLink');
    const envoi = source.indexOf("action: 'bienvenue'");
    expect(marquage).toBeGreaterThan(0);
    expect(marquage).toBeLessThan(generation);
    expect(generation).toBeLessThan(envoi);
    expect(source).toContain("type: 'recovery'");
    expect(source).toContain('previous_link_replaced: true');
    expect(source).toContain("p_event_type: 'welcome_email_resent_by_admin'");
  });

  it('ne restitue jamais le jeton au navigateur', () => {
    const blocRetour = source.slice(source.indexOf('return reponseJson(req, {\n        success: true'));
    expect(blocRetour).not.toContain('jetonHache');
    expect(blocRetour).not.toContain('lienActivation');
  });
});
