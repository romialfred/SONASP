import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import {
  ACCOUNT_MANAGEMENT_CAPABILITY,
} from '../_shared/account-role-policy.ts';
import { canRequestSessionRevocation } from '../_shared/session-revocation-policy.ts';
import {
  createRevokeUserSessionsHandler,
  type AutorisationRevocation,
  type ResultatRevocationApplicative,
} from './handler.ts';

const urlSupabase = Deno.env.get('SUPABASE_URL');
const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY');

if (!urlSupabase || !cleService || !cleAnonyme) {
  throw new Error('Configuration Supabase incomplète pour revoke-user-sessions.');
}

const admin = createClient(urlSupabase, cleService, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function clientActeur(token: string) {
  return createClient(urlSupabase!, cleAnonyme!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const handler = createRevokeUserSessionsHandler({
  async authorize({ token, requestedTargetUserId }): Promise<AutorisationRevocation> {
    const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(token);
    const acteur = donneesAuth.user;
    if (erreurAuth || !acteur) return { allowed: false, status: 401 };

    const { data: profilActeur, error: erreurProfil } = await admin
      .from('user_profiles')
      .select('role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', acteur.id)
      .maybeSingle();
    if (erreurProfil) return { allowed: false, status: 503 };
    if (!profilActeur) return { allowed: false, status: 403 };

    const targetUserId = requestedTargetUserId ?? acteur.id;
    if (targetUserId === acteur.id) {
      if (!canRequestSessionRevocation({
        actorId: acteur.id,
        actorRole: String(profilActeur.role),
        actorIsActive: profilActeur.is_active === true,
        actorMiningCompanyId: profilActeur.mining_company_id,
        actorHasMfa: Boolean(profilActeur.mfa_enrolled_at),
        actorAal: niveauAssurance(token),
        targetId: targetUserId,
        targetRole: String(profilActeur.role),
        hasAccountManagementCapability: false,
        hierarchyAllowsTarget: false,
      })) return { allowed: false, status: 403 };
      return { allowed: true, targetUserId, isSelf: true };
    }

    const acteurDb = clientActeur(token);
    const [capacite, hierarchie, cible] = await Promise.all([
      acteurDb.rpc('snp_actor_has_capability', {
        p_capability_code: ACCOUNT_MANAGEMENT_CAPABILITY,
      }),
      acteurDb.rpc('snp_peut_administrer_compte', { p_target_id: targetUserId }),
      admin
        .from('user_profiles')
        .select('id, role')
        .eq('id', targetUserId)
        .maybeSingle(),
    ]);
    if (capacite.error || hierarchie.error || cible.error) {
      return { allowed: false, status: 503 };
    }
    if (!canRequestSessionRevocation({
      actorId: acteur.id,
      actorRole: String(profilActeur.role),
      actorIsActive: profilActeur.is_active === true,
      actorMiningCompanyId: profilActeur.mining_company_id,
      actorHasMfa: Boolean(profilActeur.mfa_enrolled_at),
      actorAal: niveauAssurance(token),
      targetId: targetUserId,
      targetRole: cible.data ? String(cible.data.role) : null,
      hasAccountManagementCapability: capacite.data === true,
      hierarchyAllowsTarget: hierarchie.data === true,
    })) return { allowed: false, status: 403 };

    return { allowed: true, targetUserId, isSelf: false };
  },

  async revokeApplicationSessions({
    token,
    targetUserId,
    exceptCurrentSession,
    reason,
  }): Promise<ResultatRevocationApplicative> {
    const { data, error } = await clientActeur(token).rpc('snp_sessions_revoquer_toutes', {
      p_user_id: targetUserId,
      p_excepter_session_courante: exceptCurrentSession,
      p_motif: reason,
    });
    if (error) {
      const statut = ['42501', '22023', 'P0002'].includes(error.code) ? 403 : 503;
      console.warn('[revoke-user-sessions] Révocation applicative refusée ou indisponible.');
      return { ok: false, status: statut };
    }
    if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0) {
      console.warn('[revoke-user-sessions] Réponse RPC de révocation invalide.');
      return { ok: false, status: 503 };
    }
    return { ok: true, revokedCount: data };
  },

  async revokeOwnRefreshTokens({ token, scope }): Promise<boolean> {
    const { error } = await admin.auth.admin.signOut(token, scope);
    if (error) {
      console.warn('[revoke-user-sessions] Révocation GoTrue non confirmée.');
      return false;
    }
    return true;
  },
});

Deno.serve(handler);
