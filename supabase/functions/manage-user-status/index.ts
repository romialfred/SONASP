import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import { canManageAccountTarget } from '../_shared/account-role-policy.ts';
import { reponseJson } from '../_shared/cors.ts';
import {
  appelerRpcIdempotent,
  creerHandlerAdministration,
  lireJsonLimite,
  verifierSessionAdministration,
} from '../_shared/admin-account-edge.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DUREE_BANNISSEMENT_COMPTE_INACTIF = '876000h';

class ErreurPublique extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

const texte = (valeur: unknown, longueur: number) =>
  typeof valeur === 'string' ? valeur.trim().slice(0, longueur) : '';

function resultatRpc(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
}

Deno.serve(creerHandlerAdministration({
  methods: ['POST'],
  unexpectedError: 'Le statut du compte n’a pas pu être modifié.',
  execute: async (req, { token, authorization }) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !cleService || !cleAnonyme) {
      return reponseJson(req, { success: false, error: 'Le service des comptes est indisponible.' }, 503);
    }

    const admin = createClient(supabaseUrl, cleService, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const acteurDb = createClient(supabaseUrl, cleAnonyme, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });

    try {
      const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(token);
      const acteur = donneesAuth.user;
      if (erreurAuth || !acteur) throw new ErreurPublique(401, 'Votre session n’est plus valide.');

      const garde = await verifierSessionAdministration(acteurDb);
      if (!garde.ok) {
        throw new ErreurPublique(
          garde.status,
          garde.status === 503
            ? 'La vérification de vos habilitations est indisponible.'
            : 'Votre session administrative n’est plus autorisée.',
        );
      }

      const { data: profilActeur, error: erreurProfil } = await admin
        .from('user_profiles')
        .select('role,is_active,mining_company_id,mfa_enrolled_at')
        .eq('id', acteur.id)
        .maybeSingle();
      const roleActeur = texte(profilActeur?.role, 40).toLowerCase();
      if (
        erreurProfil
        || profilActeur?.is_active !== true
        || profilActeur.mining_company_id !== null
        || !profilActeur.mfa_enrolled_at
        || niveauAssurance(token) !== 'aal2'
        || !['owner', 'admin'].includes(roleActeur)
      ) {
        throw new ErreurPublique(403, 'Vous ne disposez pas du droit de modifier ce compte.');
      }

      const corps = await lireJsonLimite(req, 4_096);
      const utilisateurId = texte(corps?.user_id, 64);
      const motif = texte(corps?.reason, 500);
      const actif = corps?.is_active;
      if (!UUID.test(utilisateurId) || typeof actif !== 'boolean' || motif.length < 10) {
        throw new ErreurPublique(400, 'La demande de changement de statut est invalide.');
      }
      if (utilisateurId === acteur.id) {
        throw new ErreurPublique(409, 'Vous ne pouvez pas modifier votre propre compte.');
      }

      const { data: cible, error: erreurCible } = await admin
        .from('user_profiles')
        .select('id,role,is_active,version')
        .eq('id', utilisateurId)
        .maybeSingle();
      if (erreurCible) throw new ErreurPublique(503, 'La vérification du compte est indisponible.');
      if (!cible) throw new ErreurPublique(404, 'Ce compte n’existe plus.');
      if (!canManageAccountTarget({
        actorId: acteur.id,
        actorRole: roleActeur,
        targetId: cible.id,
        targetRole: texte(cible.role, 40),
      })) {
        throw new ErreurPublique(403, 'Vous ne pouvez pas modifier ce compte.');
      }
      if (!Number.isSafeInteger(cible.version) || cible.version < 0) {
        throw new ErreurPublique(503, 'La version du compte est indisponible.');
      }

      const idempotence = crypto.randomUUID();
      const parametresStatut = {
          p_target_id: utilisateurId,
          p_expected_version: cible.version,
          p_is_active: actif,
          p_reason: motif,
          p_idempotency_key: idempotence,
      };
      const appelStatut = await appelerRpcIdempotent(
        acteurDb, 'snp_admin_compte_definir_statut', parametresStatut,
      );
      const { data: resultatStatut, error: erreurStatut } = appelStatut;
      if (erreurStatut) {
        const statut = ['40001', '23514'].includes(erreurStatut.code ?? '')
          ? 409
          : erreurStatut.code === '42501'
            ? 403
            : 503;
        throw new ErreurPublique(statut, statut === 409
          ? 'Le compte a changé. Rechargez sa fiche avant de réessayer.'
          : 'Le changement sécurisé de statut est indisponible.');
      }
      const contrat = resultatRpc(resultatStatut);
      if (
        contrat?.target_id !== utilisateurId
        || contrat?.status !== 'db_completed'
        || contrat?.is_active !== actif
        || typeof contrat?.action_id !== 'string'
      ) {
        throw new ErreurPublique(503, 'Le résultat du changement de statut est invalide.');
      }

      const { error: erreurAuthInitiale } = await admin.auth.admin.updateUserById(utilisateurId, {
        ban_duration: actif ? 'none' : DUREE_BANNISSEMENT_COMPTE_INACTIF,
      });
      let authSynchronise = !erreurAuthInitiale;
      let echecAuthCertain = false;
      if (erreurAuthInitiale) {
        const verification = await admin.auth.admin.getUserById(utilisateurId);
        if (verification.error || !verification.data.user) {
          return reponseJson(req, {
            success: false,
            operation_state: actif ? 'profile_active_auth_outcome_unknown' : 'profile_inactive_auth_outcome_unknown',
            error: 'Le résultat Auth est ambigu ; l’état applicatif sécurisé est conservé pour reprise.',
          }, 503);
        }
        const bannissement = new Date(verification.data.user.banned_until ?? '').getTime();
        const estBanni = Number.isFinite(bannissement) && bannissement > Date.now();
        authSynchronise = actif ? !estBanni : estBanni;
        echecAuthCertain = !authSynchronise;
      }

      const codeFinal = echecAuthCertain
        ? texte(erreurAuthInitiale?.code, 80) || 'AUTH_STATUS_SYNC_FAILED'
        : null;
      const parametresFinalisation = {
          p_idempotency_key: idempotence,
          p_success: authSynchronise,
          p_error_code: codeFinal,
      };
      const appelFinalisation = await appelerRpcIdempotent(
        admin, 'snp_admin_compte_finaliser_action', parametresFinalisation,
      );
      const { data: finalisation, error: erreurFinalisation } = appelFinalisation;
      const final = resultatRpc(finalisation);
      const auditConfirme = !erreurFinalisation
        && final?.target_id === utilisateurId
        && final?.status === (authSynchronise ? 'completed' : 'failed');

      if (echecAuthCertain) {
        return reponseJson(req, {
          success: false,
          operation_state: actif ? 'profile_active_auth_banned' : 'profile_inactive_auth_sync_pending',
          error: 'Le compte est placé dans un état sécurisé, mais la synchronisation Auth doit être reprise.',
        }, 503);
      }
      if (!auditConfirme) {
        return reponseJson(req, {
          success: false,
          operation_state: 'auth_synced_audit_pending',
          error: 'Le statut est appliqué, mais sa finalisation d’audit doit être reprise.',
        }, 503);
      }

      return reponseJson(req, {
        success: true,
        user_id: utilisateurId,
        is_active: actif,
        version: contrat.version,
        audit_action_id: contrat.action_id,
        application_sessions_revoked: actif ? false : true,
        auth_access_restricted: !actif,
        access_tokens_revoked: false,
        message: actif ? 'Compte réactivé.' : 'Compte désactivé et accès futurs bloqués.',
      });
    } catch (erreur) {
      if (erreur instanceof ErreurPublique) {
        return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
      }
      console.error('[manage-user-status] Échec inattendu sans donnée utilisateur.');
      return reponseJson(req, { success: false, error: 'Le statut du compte n’a pas pu être modifié.' }, 500);
    }
  },
}));
