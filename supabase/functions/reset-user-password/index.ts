import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { urlModificationMotDePasse, urlRecuperationCompte } from '../_shared/application-url.ts';
import {
  ACCOUNT_MANAGEMENT_CAPABILITY,
  canManageAccountTarget,
} from '../_shared/account-role-policy.ts';
import {
  clesJsonValides,
  lireJsonLimite,
} from '../_shared/admin-account-edge.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAILLE_MAXIMALE_CORPS = 2_048;

class ErreurPublique extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

/**
 * Ouvre un parcours de récupération sans jamais fabriquer, journaliser ou
 * retourner un mot de passe provisoire. Le destinataire choisit lui-même son
 * nouveau secret depuis un lien GoTrue à usage limité.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'POST') {
    return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);
  }

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!urlSupabase || !cleService || !cleAnon) {
    return reponseJson(req, { success: false, error: 'Le service de récupération est indisponible.' }, 503);
  }

  const admin = createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const autorisation = req.headers.get('Authorization') ?? '';
    const jeton = autorisation.replace(/^Bearer\s+/i, '');
    if (!jeton) throw new ErreurPublique(401, 'Votre session a expiré. Reconnectez-vous.');

    const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(jeton);
    const acteur = donneesAuth.user;
    if (erreurAuth || !acteur) {
      throw new ErreurPublique(401, 'Votre session n’est plus valide. Reconnectez-vous.');
    }

    // Les RPC doivent recevoir le JWT utilisateur et non la clé de service :
    // `auth.uid()` reste ainsi l'autorité pour la capacité et la hiérarchie.
    const clientActeur = createClient(urlSupabase, cleAnon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: autorisation } },
    });

    const { data: profilActeur, error: erreurProfil } = await admin
      .from('user_profiles')
      .select('role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', acteur.id)
      .maybeSingle();
    const habilite = !erreurProfil
      && profilActeur?.is_active
      && profilActeur.mining_company_id === null
      && Boolean(profilActeur.mfa_enrolled_at)
      && niveauAssurance(jeton) === 'aal2';
    if (!habilite) {
      throw new ErreurPublique(403, 'Vous ne disposez pas du droit de réinitialiser ce compte.');
    }

    const { data: possedeCapacite, error: erreurCapacite } = await clientActeur
      .rpc('snp_actor_has_capability', { p_capability_code: ACCOUNT_MANAGEMENT_CAPABILITY });
    if (erreurCapacite) {
      console.error('[reset-user-password] Capacité indisponible.', erreurCapacite.message);
      throw new ErreurPublique(503, 'La vérification de vos habilitations est indisponible.');
    }
    if (possedeCapacite !== true) {
      throw new ErreurPublique(403, 'Vous ne disposez pas du droit de réinitialiser ce compte.');
    }

    const corps = await lireJsonLimite(req, TAILLE_MAXIMALE_CORPS);
    if (!clesJsonValides(corps, ['user_id'], ['user_id'])) {
      throw new ErreurPublique(400, 'La demande de récupération est invalide.');
    }
    const utilisateurId = String(corps?.user_id ?? '').trim();
    if (!UUID.test(utilisateurId)) {
      throw new ErreurPublique(400, 'La demande de récupération est invalide.');
    }
    if (utilisateurId === acteur.id) {
      throw new ErreurPublique(400, 'Utilisez la procédure « Mot de passe oublié » pour votre propre compte.');
    }

    const { data: cibleAdministrable, error: erreurHierarchie } = await clientActeur
      .rpc('snp_peut_administrer_compte', { p_target_id: utilisateurId });
    if (erreurHierarchie) {
      console.error('[reset-user-password] Hiérarchie indisponible.', erreurHierarchie.message);
      throw new ErreurPublique(503, 'La vérification de la hiérarchie des comptes est indisponible.');
    }
    if (cibleAdministrable !== true) {
      throw new ErreurPublique(403, 'Vous ne pouvez pas administrer ce compte.');
    }

    const { data: cible, error: erreurCible } = await admin
      .from('user_profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', utilisateurId)
      .maybeSingle();
    if (erreurCible || !cible?.email) {
      throw new ErreurPublique(404, 'Ce compte n’existe plus.');
    }
    if (!cible.is_active) {
      throw new ErreurPublique(409, 'Réactivez le compte avant d’ouvrir une récupération de mot de passe.');
    }
    if (!canManageAccountTarget({
      actorId: acteur.id,
      actorRole: String(profilActeur.role),
      targetId: cible.id,
      targetRole: String(cible.role),
    })) {
      throw new ErreurPublique(403, 'Vous ne pouvez pas administrer ce compte.');
    }

    const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: cible.email,
      options: { redirectTo: urlModificationMotDePasse(Deno.env.get('SONASP_APP_URL')) },
    });
    const jetonHache = lien?.properties?.hashed_token;
    if (erreurLien || !jetonHache) {
      console.error('[reset-user-password] Génération du lien impossible.', erreurLien?.message);
      throw new ErreurPublique(502, 'Le lien sécurisé n’a pas pu être généré. Réessayez.');
    }
    const lienAction = urlRecuperationCompte(jetonHache, Deno.env.get('SONASP_APP_URL'));

    const reponseCourriel = await fetch(`${urlSupabase}/functions/v1/envoyer-courriel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: autorisation,
        apikey: cleService,
      },
      body: JSON.stringify({
        action: 'reinitialisation',
        to: cible.email,
        nom_complet: cible.full_name,
        lien_activation: lienAction,
      }),
    });
    const resultatCourriel = await reponseCourriel.json().catch(() => ({}));
    if (!reponseCourriel.ok || resultatCourriel?.envoye !== true) {
      console.error('[reset-user-password] Courriel non envoyé.', resultatCourriel?.erreur);
      throw new ErreurPublique(503, 'Le courriel de récupération n’a pas pu être envoyé. Aucun mot de passe n’a été modifié.');
    }

    const { error: erreurMarquage } = await admin
      .from('user_profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', utilisateurId);
    if (erreurMarquage) {
      console.error('[reset-user-password] Marquage du compte impossible.', erreurMarquage.message);
      throw new ErreurPublique(500, 'Le courriel est parti, mais le compte n’a pas pu être verrouillé. Contactez l’administrateur technique.');
    }

    const { error: erreurAudit } = await admin.rpc('log_security_event', {
      p_user_id: utilisateurId,
      p_event_type: 'password_reset_requested_by_admin',
      p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      p_user_agent: req.headers.get('user-agent'),
      p_details: { reset_by: acteur.id },
    });
    if (erreurAudit) {
      console.warn('[reset-user-password] Journal de sécurité non écrit.', erreurAudit.message);
    }

    return reponseJson(req, {
      success: true,
      email_sent: true,
      requires_password_change: true,
      message: 'Un lien sécurisé a été envoyé au titulaire du compte.',
    });
  } catch (erreur) {
    const statut = erreur instanceof ErreurPublique ? erreur.statut : 500;
    const message = erreur instanceof ErreurPublique
      ? erreur.message
      : 'La récupération du compte n’a pas pu être lancée.';
    console.error('[reset-user-password]', erreur instanceof Error ? erreur.message : erreur);
    return reponseJson(req, { success: false, error: message }, statut);
  }
});
