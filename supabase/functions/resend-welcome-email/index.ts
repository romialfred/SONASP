import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import { urlModificationMotDePasse, urlRecuperationCompte } from '../_shared/application-url.ts';
import { canManageAccountTarget } from '../_shared/account-role-policy.ts';
import { reponseJson } from '../_shared/cors.ts';
import {
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

/**
 * Relance un enrôlement incomplet avec un nouveau jeton GoTrue. La génération
 * d'un jeton recovery remplace le précédent côté Auth : aucun lien déjà
 * consommé ou égaré n'est réutilisé et aucun secret ne transite par le client.
 */
Deno.serve(creerHandlerAdministration({
  methods: ['POST'],
  unexpectedError: 'Le courriel de bienvenue n’a pas pu être renvoyé.',
  execute: async (req, { token, authorization }) => {
    const urlSupabase = Deno.env.get('SUPABASE_URL');
    const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY');
    if (!urlSupabase || !cleService || !cleAnonyme) {
      return reponseJson(req, { success: false, error: 'Le service d’enrôlement est indisponible.' }, 503);
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
      if (erreurAuth || !acteur) {
        throw new ErreurPublique(401, 'Votre session n’est plus valide. Reconnectez-vous.');
      }

      const garde = await verifierSessionAdministration(acteurDb, 'edit');
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
        throw new ErreurPublique(403, 'Vous ne disposez pas du droit de relancer cet enrôlement.');
      }

      const corps = await lireJsonLimite(req, 2_048);
      if (!clesJsonValides(corps, ['user_id'], ['user_id'])) {
        throw new ErreurPublique(400, 'La demande de renvoi est invalide.');
      }
      const utilisateurId = texte(corps?.user_id, 64);
      if (!UUID.test(utilisateurId) || utilisateurId === acteur.id) {
        throw new ErreurPublique(400, 'La demande de renvoi est invalide.');
      }

      const { data: cibleAdministrable, error: erreurHierarchie } = await acteurDb
        .rpc('snp_peut_administrer_compte', { p_target_id: utilisateurId });
      if (erreurHierarchie) {
        console.error('[resend-welcome-email] Hiérarchie indisponible.', erreurHierarchie.message);
        throw new ErreurPublique(503, 'La vérification de la hiérarchie des comptes est indisponible.');
      }
      if (cibleAdministrable !== true) {
        throw new ErreurPublique(403, 'Vous ne pouvez pas administrer ce compte.');
      }

      const { data: cible, error: erreurCible } = await admin
        .from('user_profiles')
        .select('id,email,full_name,role,is_active,last_login_at,password_changed_at,mfa_enrolled_at,must_change_password')
        .eq('id', utilisateurId)
        .maybeSingle();
      if (erreurCible || !cible?.email) {
        throw new ErreurPublique(404, 'Ce compte n’existe plus.');
      }
      if (!cible.is_active) {
        throw new ErreurPublique(409, 'Réactivez le compte avant de relancer son enrôlement.');
      }
      if (!canManageAccountTarget({
        actorId: acteur.id,
        actorRole: roleActeur,
        targetId: cible.id,
        targetRole: texte(cible.role, 40),
      })) {
        throw new ErreurPublique(403, 'Vous ne pouvez pas administrer ce compte.');
      }

      const enrôlementIncomplet = cible.must_change_password === true
        || !cible.mfa_enrolled_at
        || (!cible.password_changed_at && !cible.last_login_at);
      if (!enrôlementIncomplet) {
        throw new ErreurPublique(
          409,
          'L’enrôlement de ce compte est déjà finalisé. Utilisez la réinitialisation du mot de passe si nécessaire.',
        );
      }

      // Le marqueur est posé avant l'envoi : un lien reçu ne peut pas ouvrir
      // une session normale sans imposer le choix d'un nouveau mot de passe.
      const { error: erreurMarquage } = await admin
        .from('user_profiles')
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .eq('id', utilisateurId);
      if (erreurMarquage) {
        console.error('[resend-welcome-email] Marquage impossible.', erreurMarquage.message);
        throw new ErreurPublique(503, 'Le compte n’a pas pu être préparé pour un nouvel enrôlement.');
      }

      const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: cible.email,
        options: { redirectTo: urlModificationMotDePasse(Deno.env.get('SONASP_APP_URL')) },
      });
      const jetonHache = lien?.properties?.hashed_token;
      if (erreurLien || !jetonHache) {
        console.error('[resend-welcome-email] Génération du lien impossible.', erreurLien?.message);
        throw new ErreurPublique(502, 'Le nouveau lien sécurisé n’a pas pu être généré. Réessayez.');
      }
      const lienActivation = urlRecuperationCompte(jetonHache, Deno.env.get('SONASP_APP_URL'));

      const reponseCourriel = await fetch(`${urlSupabase}/functions/v1/envoyer-courriel`, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          apikey: cleService,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bienvenue',
          to: cible.email,
          nom_complet: cible.full_name,
          role: cible.role,
          lien_activation: lienActivation,
        }),
      });
      const resultatCourriel = await reponseCourriel.json().catch(() => ({}));
      if (!reponseCourriel.ok || resultatCourriel?.envoye !== true) {
        console.error('[resend-welcome-email] Courriel non confirmé.', resultatCourriel?.erreur);
        throw new ErreurPublique(503, 'Le nouveau lien a été préparé, mais le courriel n’a pas pu être envoyé. Réessayez le renvoi.');
      }

      const { error: erreurAudit } = await admin.rpc('log_security_event', {
        p_user_id: utilisateurId,
        p_event_type: 'welcome_email_resent_by_admin',
        p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        p_user_agent: req.headers.get('user-agent'),
        p_details: { resent_by: acteur.id, previous_link_replaced: true },
      });
      if (erreurAudit) {
        console.warn('[resend-welcome-email] Journal de sécurité non écrit.', erreurAudit.message);
      }

      return reponseJson(req, {
        success: true,
        email_sent: true,
        previous_link_replaced: true,
        requires_password_change: true,
        requires_mfa_enrollment: !cible.mfa_enrolled_at,
        message: 'Un nouveau courriel de bienvenue a été envoyé. Le lien précédent n’est plus utilisable.',
      });
    } catch (erreur) {
      if (erreur instanceof ErreurPublique) {
        return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
      }
      console.error('[resend-welcome-email] Échec inattendu sans donnée utilisateur.');
      return reponseJson(req, { success: false, error: 'Le courriel de bienvenue n’a pas pu être renvoyé.' }, 500);
    }
  },
}));
