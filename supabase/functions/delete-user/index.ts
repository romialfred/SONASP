import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES_SUPPRESSION = new Set(['owner', 'admin']);

interface RequeteSuppression {
  user_id?: unknown;
  motif?: unknown;
}

interface EvaluationSuppression {
  eligible: boolean;
  blockers: Array<{ source: string; column: string; count: number }>;
}

class ErreurPublique extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

const texte = (valeur: unknown, longueur: number) =>
  typeof valeur === 'string' ? valeur.trim().slice(0, longueur) : '';

const COLONNES_ACTIVITE = new Set([
  'user_id', 'created_by', 'updated_by', 'uploaded_by', 'approved_by',
  'shipped_by', 'received_by', 'added_by', 'changed_by', 'actor_id',
  'acteur_id', 'assigned_by', 'granted_by', 'reviewed_by', 'author_id',
  'handled_by', 'verified_by', 'processed_by', 'stocked_by',
  'validee_par', 'valide_par', 'repondu_par', 'declenche_par',
  'prepare_par', 'soumis_par', 'execute_par', 'rapproche_par',
  'ajoute_par', 'verifiee_par', 'affecte_par', 'annulee_par',
  'autorisee_par', 'envoye_par', 'released_by', 'requested_by',
  'approuve_par', 'supprime_par', 'enregistre_par', 'retenue_par',
  'emise_par', 'imputation_decidee_par', 'mfa_reset_by',
  'responsable_id', 'responsable_traitement', 'gestionnaire_id',
]);

// Ces lignes configurent ou sécurisent le compte sans constituer une
// opération métier réalisée par l'utilisateur.
const REFERENCES_TECHNIQUES = new Set([
  'user_permissions.user_id',
  'user_site_assignments.user_id',
  'artisanal_site_assignments.user_id',
  'user_sessions.user_id',
  'password_history.user_id',
  'password_history.changed_by',
  'user_activation_tokens.user_id',
  'user_activation_tokens.created_by',
  'user_2fa_setup.user_id',
  'user_acceptance_logs.user_id',
]);

type SchemaOpenApi = {
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
};

async function evaluerActiviteMetier(
  admin: ReturnType<typeof createClient>,
  urlSupabase: string,
  cleService: string,
  utilisateurId: string,
  email: string,
): Promise<EvaluationSuppression> {
  // Le schéma OpenAPI de PostgREST fournit le référentiel réel de la base
  // déployée. Le contrôle couvre ainsi les anciens et les futurs modules sans
  // maintenir une liste fragile de tables dans le code.
  const reponseSchema = await fetch(`${urlSupabase}/rest/v1/`, {
    headers: {
      apikey: cleService,
      Authorization: `Bearer ${cleService}`,
      Accept: 'application/openapi+json',
    },
  });
  if (!reponseSchema.ok) {
    throw new ErreurPublique(503, 'La vérification de l’activité du compte est indisponible.');
  }
  const schema = await reponseSchema.json() as SchemaOpenApi;
  const definitions = schema.definitions ?? schema.components?.schemas ?? {};
  const references = Object.entries(definitions)
    .flatMap(([table, definition]) => Object.keys(definition.properties ?? {}).map((column) => ({ table, column })))
    .filter(({ table, column }) => COLONNES_ACTIVITE.has(column) && !REFERENCES_TECHNIQUES.has(`${table}.${column}`));

  const blocages: EvaluationSuppression['blockers'] = [];
  const tailleLot = 16;
  for (let debut = 0; debut < references.length; debut += tailleLot) {
    const lot = references.slice(debut, debut + tailleLot);
    const resultats = await Promise.all(lot.map(async ({ table, column }) => {
      if (table === 'snp_achats_audit' && column === 'acteur_id') {
        const { data, error } = await admin
          .from(table)
          .select('objet, action')
          .eq(column, utilisateurId);
        if (error) return { table, column, error, count: 0 };
        const activites = (data ?? []).filter((ligne) => !(
          ligne.objet === 'user_profiles'
          && ['mfa_enrole', 'mfa_reinitialise', 'mot_de_passe_modifie'].includes(ligne.action)
        ));
        return { table, column, error: null, count: activites.length };
      }

      const { count, error } = await admin
        .from(table)
        .select(column, { count: 'exact', head: true })
        .eq(column, utilisateurId);
      return { table, column, error, count: count ?? 0 };
    }));

    const erreurLecture = resultats.find((resultat) => resultat.error);
    if (erreurLecture) {
      console.error('[delete-user] Colonne d’activité illisible.', {
        table: erreurLecture.table,
        column: erreurLecture.column,
        code: erreurLecture.error?.code,
      });
      throw new ErreurPublique(503, 'La vérification de l’activité du compte est indisponible.');
    }
    blocages.push(...resultats
      .filter((resultat) => resultat.count > 0)
      .map((resultat) => ({
        source: resultat.table,
        column: resultat.column,
        count: resultat.count,
      })));

    // Une seule preuve d'activité suffit. On évite de balayer le reste du
    // schéma lorsque la suppression est déjà impossible.
    if (blocages.length > 0) break;
  }

  // Deux journaux historiques identifient parfois l'acteur par son adresse
  // plutôt que par une colonne UUID ; ils ne doivent pas échapper au contrôle.
  if (blocages.length === 0 && definitions.audit_trail?.properties?.user_email) {
    const { count, error } = await admin
      .from('audit_trail')
      .select('user_email', { count: 'exact', head: true })
      .ilike('user_email', email);
    if (error) throw new ErreurPublique(503, 'La vérification de l’activité du compte est indisponible.');
    if ((count ?? 0) > 0) blocages.push({ source: 'audit_trail', column: 'user_email', count: count ?? 0 });
  }

  return { eligible: blocages.length === 0, blockers: blocages };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'POST') {
    return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);
  }

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!urlSupabase || !cleService) {
    console.error('[delete-user] Configuration Supabase incomplète.');
    return reponseJson(req, { success: false, error: 'Le service de suppression est indisponible.' }, 503);
  }

  const admin = createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const autorisation = req.headers.get('Authorization') ?? '';
    const jeton = autorisation.replace(/^Bearer\s+/i, '');
    if (!jeton) throw new ErreurPublique(401, 'Votre session a expiré. Reconnectez-vous.');

    const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(jeton);
    if (erreurAuth || !donneesAuth.user) {
      throw new ErreurPublique(401, 'Votre session n’est plus valide. Reconnectez-vous.');
    }
    const acteur = donneesAuth.user;

    const { data: profilActeur, error: erreurProfilActeur } = await admin
      .from('user_profiles')
      .select('id, email, role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', acteur.id)
      .maybeSingle();
    const roleActeur = texte(profilActeur?.role, 40).toLowerCase();
    const acteurAutorise = !erreurProfilActeur
      && profilActeur?.is_active
      && ROLES_SUPPRESSION.has(roleActeur)
      && profilActeur.mining_company_id === null
      && Boolean(profilActeur.mfa_enrolled_at)
      && niveauAssurance(jeton) === 'aal2';
    if (!acteurAutorise) {
      throw new ErreurPublique(403, 'Vous ne disposez pas du droit de supprimer définitivement un compte.');
    }

    const corps = await req.json().catch(() => null) as RequeteSuppression | null;
    const utilisateurId = texte(corps?.user_id, 64);
    const motif = texte(corps?.motif, 500);
    if (!UUID.test(utilisateurId)) throw new ErreurPublique(400, 'Le compte demandé est invalide.');
    if (motif.length < 5) throw new ErreurPublique(400, 'Un motif de cinq caractères au minimum est obligatoire.');
    if (utilisateurId === acteur.id) {
      throw new ErreurPublique(409, 'Vous ne pouvez pas supprimer votre propre compte.');
    }

    const { data: cible, error: erreurCible } = await admin
      .from('user_profiles')
      .select('id, email, full_name, role')
      .eq('id', utilisateurId)
      .maybeSingle();
    if (erreurCible) throw erreurCible;
    if (!cible) throw new ErreurPublique(404, 'Ce compte n’existe plus.');

    const roleCible = texte(cible.role, 40).toLowerCase();
    if (roleCible === 'owner') {
      throw new ErreurPublique(409, 'Le compte propriétaire est protégé et ne peut pas être supprimé.');
    }
    if (roleActeur === 'admin' && roleCible === 'admin') {
      throw new ErreurPublique(403, 'Seul le propriétaire peut supprimer un compte administrateur.');
    }

    const evaluation = await evaluerActiviteMetier(
      admin,
      urlSupabase,
      cleService,
      utilisateurId,
      cible.email,
    );
    if (!evaluation.eligible) {
      console.warn('[delete-user] Suppression bloquée par une activité.', {
        cible: utilisateurId,
        sources: (evaluation.blockers ?? []).map((blocage) => ({
          source: blocage.source,
          column: blocage.column,
          count: blocage.count,
        })),
      });
      throw new ErreurPublique(
        409,
        'Ce compte possède une activité métier et doit être désactivé plutôt que supprimé.',
      );
    }

    // L'API d'administration Auth reste l'unique point de suppression de
    // l'identité. Les cascades de clés étrangères éliminent uniquement le
    // profil et ses données techniques, après le contrôle métier ci-dessus.
    const { error: erreurSuppression } = await admin.auth.admin.deleteUser(utilisateurId);
    if (erreurSuppression) {
      console.error('[delete-user] Suppression Auth refusée.', {
        cible: utilisateurId,
        code: erreurSuppression.code,
        message: erreurSuppression.message,
      });
      throw new ErreurPublique(409, 'Le compte ne peut pas être supprimé car une dépendance le protège encore.');
    }

    const { error: erreurAudit } = await admin.from('audit_logs').insert({
      user_id: acteur.id,
      user_email: profilActeur?.email ?? acteur.email ?? null,
      action: 'suppression_compte_inactif',
      module: 'administration_utilisateurs',
      status: 'success',
      details: JSON.stringify({
        cible_id: utilisateurId,
        cible_email: cible.email,
        cible_nom: cible.full_name,
        cible_role: cible.role,
        motif,
      }),
    });
    if (erreurAudit) {
      // La suppression est déjà effective : on journalise l'incident sans
      // prétendre au client que le compte existe encore.
      console.error('[delete-user] Compte supprimé, mais audit non enregistré.', erreurAudit);
    }

    return reponseJson(req, {
      success: true,
      deleted_user_id: utilisateurId,
      message: 'Le compte sans activité a été supprimé définitivement.',
    });
  } catch (erreur) {
    if (erreur instanceof ErreurPublique) {
      return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
    }
    console.error('[delete-user] Échec inattendu.', erreur);
    return reponseJson(req, { success: false, error: 'La suppression du compte a échoué.' }, 500);
  }
});
