import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import { canManageAccountTarget } from '../_shared/account-role-policy.ts';
import { reponseJson } from '../_shared/cors.ts';
import {
  appelerRpcIdempotent,
  clesJsonValides,
  creerHandlerAdministration,
  lireJsonLimite,
  verifierSessionAdministration,
} from '../_shared/admin-account-edge.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function erreurAuthUtilisateurAbsent(
  erreur: { status?: number; code?: string; message?: string } | null,
): boolean {
  return Boolean(erreur && (
    erreur.status === 404
    || erreur.code === 'user_not_found'
    || /not found|does not exist/i.test(erreur.message ?? '')
  ));
}

async function verifierIdentiteAuthAbsente(
  admin: ReturnType<typeof createClient>,
  utilisateurId: string,
): Promise<'absente' | 'presente' | 'indeterminee'> {
  const { data, error } = await admin.auth.admin.getUserById(utilisateurId);
  if (!data?.user && erreurAuthUtilisateurAbsent(error)) return 'absente';
  if (data?.user) return 'presente';
  return 'indeterminee';
}

Deno.serve(creerHandlerAdministration({
  methods: ['POST'],
  unexpectedError: 'La suppression du compte a échoué.',
  execute: async (req, { token, authorization }) => {
    const urlSupabase = Deno.env.get('SUPABASE_URL');
    const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY');
    if (!urlSupabase || !cleService || !cleAnonyme) {
      return reponseJson(req, { success: false, error: 'Le service de suppression est indisponible.' }, 503);
    }

    const admin = createClient(urlSupabase, cleService, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const acteurDb = createClient(urlSupabase, cleAnonyme, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });

    try {
      const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(token);
      const acteur = donneesAuth.user;
      if (erreurAuth || !acteur) throw new ErreurPublique(401, 'Votre session n’est plus valide.');

      const garde = await verifierSessionAdministration(acteurDb, 'delete');
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
        throw new ErreurPublique(403, 'Vous ne disposez pas du droit de supprimer ce compte.');
      }

      const corps = await lireJsonLimite(req, 4_096);
      if (!clesJsonValides(corps, ['user_id', 'motif'], ['user_id', 'motif'])) {
        throw new ErreurPublique(400, 'La demande de suppression est invalide.');
      }
      const utilisateurId = texte(corps?.user_id, 64);
      const motif = texte(corps?.motif, 500);
      if (!UUID.test(utilisateurId) || motif.length < 10) {
        throw new ErreurPublique(400, 'La demande de suppression est invalide.');
      }
      if (utilisateurId === acteur.id) {
        throw new ErreurPublique(409, 'Vous ne pouvez pas supprimer votre propre compte.');
      }

      const { data: cible, error: erreurCible } = await admin
        .from('user_profiles')
        .select('id,email,role,is_active,version')
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
        throw new ErreurPublique(403, 'Vous ne pouvez pas supprimer ce compte.');
      }
      if (!Number.isSafeInteger(cible.version) || cible.version < 0) {
        throw new ErreurPublique(503, 'La version du compte est indisponible.');
      }

      const idempotence = crypto.randomUUID();
      const parametresPreparation = {
          p_target_id: utilisateurId,
          p_expected_version: cible.version,
          p_reason: motif,
          p_idempotency_key: idempotence,
      };
      const appelPreparation = await appelerRpcIdempotent(acteurDb,
        'snp_admin_compte_preparer_suppression', parametresPreparation,
      );
      const { data: preparation, error: erreurPreparation } = appelPreparation;
      if (erreurPreparation) {
        const statut = ['23503', '23514', '40001'].includes(erreurPreparation.code ?? '')
          ? 409
          : erreurPreparation.code === '42501'
            ? 403
            : 503;
        throw new ErreurPublique(statut, statut === 409
          ? 'Ce compte ne satisfait plus les conditions de suppression.'
          : 'La préparation sécurisée de la suppression est indisponible.');
      }
      const contrat = resultatRpc(preparation);
      if (
        contrat?.target_id !== utilisateurId
        || contrat?.status !== 'db_completed'
        || typeof contrat?.action_id !== 'string'
      ) {
        throw new ErreurPublique(503, 'La préparation sécurisée de la suppression est invalide.');
      }

      // `false` exige la suppression dure GoTrue. Une réponse 2xx ne suffit
      // pas : l'identité puis le profil en cascade sont relus avant d'annoncer
      // que l'adresse peut être réutilisée.
      const { error: erreurSuppressionInitiale } = await admin.auth.admin.deleteUser(utilisateurId, false);
      const etatAuth = await verifierIdentiteAuthAbsente(admin, utilisateurId);
      const verificationProfil = await admin
        .from('user_profiles')
        .select('id')
        .eq('id', utilisateurId)
        .maybeSingle();
      if (etatAuth === 'indeterminee' || verificationProfil.error) {
        return reponseJson(req, {
          success: false,
          operation_state: 'inactive_delete_outcome_unknown',
          error: 'Le résultat Auth est ambigu ; le compte reste bloqué en attendant une reprise.',
        }, 503);
      }
      if (etatAuth === 'absente' && verificationProfil.data !== null) {
        return reponseJson(req, {
          success: false,
          operation_state: 'identity_deleted_cleanup_pending',
          error: 'L’identité Auth a été retirée, mais un profil résiduel doit être purgé avant toute recréation.',
        }, 503);
      }
      const suppressionConfirmee = etatAuth === 'absente' && verificationProfil.data === null;
      const echecSuppressionCertain = etatAuth === 'presente';

      const codeFinal = echecSuppressionCertain
        ? texte(erreurSuppressionInitiale?.code, 80) || 'AUTH_DELETE_FAILED'
        : null;
      const parametresFinalisation = suppressionConfirmee
        ? {
            p_idempotency_key: idempotence,
            p_target_email: cible.email,
          }
        : {
            p_idempotency_key: idempotence,
            p_success: false,
            p_error_code: codeFinal || 'AUTH_DELETE_INCOMPLETE',
          };
      const appelFinalisation = await appelerRpcIdempotent(
        admin,
        suppressionConfirmee
          ? 'snp_admin_compte_finaliser_suppression'
          : 'snp_admin_compte_finaliser_action',
        parametresFinalisation,
      );
      const { data: finalisation, error: erreurFinalisation } = appelFinalisation;
      const final = resultatRpc(finalisation);
      const auditConfirme = !erreurFinalisation
        && final?.target_id === utilisateurId
        && final?.status === (suppressionConfirmee ? 'completed' : 'failed')
        && (!suppressionConfirmee || final?.email_reusable === true);

      if (!auditConfirme) {
        return reponseJson(req, {
          success: false,
          operation_state: suppressionConfirmee
            ? 'deleted_audit_pending'
            : 'inactive_delete_incomplete',
          error: suppressionConfirmee
            ? 'La suppression est effective mais sa finalisation d’audit doit être reprise.'
            : 'Le compte n’a pas été entièrement supprimé et reste bloqué.',
        }, 503);
      }
      if (echecSuppressionCertain) {
        throw new ErreurPublique(409, 'Le compte reste conservé car une dépendance le protège.');
      }
      return reponseJson(req, {
        success: true,
        deleted_user_id: utilisateurId,
        email_reusable: true,
        audit_action_id: contrat.action_id,
        message: 'Le compte a été supprimé définitivement. Son adresse e-mail peut être utilisée pour un nouveau compte.',
      });
    } catch (erreur) {
      if (erreur instanceof ErreurPublique) {
        return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
      }
      console.error('[delete-user] Échec inattendu sans donnée utilisateur.');
      return reponseJson(req, { success: false, error: 'La suppression du compte a échoué.' }, 500);
    }
  },
}));
