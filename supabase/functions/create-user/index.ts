import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import { urlModificationMotDePasse, urlRecuperationCompte } from '../_shared/application-url.ts';

const ROLES = new Set([
  'owner', 'admin', 'management', 'manager', 'mine',
  'factory', 'airport', 'refinery', 'customer',
]);
const ROLES_CREATEURS = new Set(['owner', 'admin', 'management']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PermissionModule {
  module_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_approve?: boolean;
  field_permissions?: Record<string, { can_view?: boolean; can_edit?: boolean }>;
}

interface RequeteCreation {
  email?: unknown;
  full_name?: unknown;
  phone?: unknown;
  role?: unknown;
  is_active?: unknown;
  mining_company_id?: unknown;
  permissions?: unknown;
}

class ErreurPublique extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

const texte = (valeur: unknown, longueur: number) =>
  typeof valeur === 'string' ? valeur.trim().slice(0, longueur) : '';

function motDePasseProvisoire(longueur = 24): string {
  const familles = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%*?',
  ];
  const tout = familles.join('');
  const choisir = (source: string) => {
    const valeur = new Uint32Array(1);
    crypto.getRandomValues(valeur);
    return source[valeur[0] % source.length];
  };
  const caracteres = familles.map(choisir);
  while (caracteres.length < longueur) caracteres.push(choisir(tout));

  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const valeur = new Uint32Array(1);
    crypto.getRandomValues(valeur);
    const j = valeur[0] % (i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

function normaliserPermissions(brut: unknown, role: string): PermissionModule[] {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return [];

  return Object.values(brut as Record<string, unknown>)
    .filter((valeur): valeur is PermissionModule => Boolean(valeur && typeof valeur === 'object'))
    .map((permission) => {
      const moduleId = texte(permission.module_id, 64);
      if (!UUID.test(moduleId)) throw new ErreurPublique(400, 'Une habilitation référence un module invalide.');

      const consultation = Boolean(permission.can_view);
      const lectureSeule = role === 'manager';
      return {
        module_id: moduleId,
        can_view: consultation,
        can_create: lectureSeule ? false : Boolean(permission.can_create),
        can_edit: lectureSeule ? false : Boolean(permission.can_edit),
        can_delete: lectureSeule ? false : Boolean(permission.can_delete),
        can_approve: lectureSeule ? false : Boolean(permission.can_approve),
        field_permissions: Object.fromEntries(
          Object.entries(permission.field_permissions ?? {})
            .slice(0, 100)
            .map(([champ, droits]) => [champ.slice(0, 100), {
              can_view: Boolean(droits?.can_view),
              can_edit: lectureSeule ? false : Boolean(droits?.can_edit),
            }]),
        ),
      };
    })
    .filter((permission) =>
      permission.can_view || permission.can_create || permission.can_edit
      || permission.can_delete || permission.can_approve
      || Object.values(permission.field_permissions ?? {}).some((droits) => droits.can_view || droits.can_edit)
    );
}

async function annulerCreation(admin: SupabaseClient, utilisateurId: string): Promise<void> {
  await admin.from('user_permissions').delete().eq('user_id', utilisateurId);
  await admin.from('user_profiles').delete().eq('id', utilisateurId);
  await admin.auth.admin.deleteUser(utilisateurId);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'POST') return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!urlSupabase || !cleService) {
    console.error('[create-user] Configuration Supabase incomplète.');
    return reponseJson(req, { success: false, error: 'Le service de création de compte est indisponible.' }, 503);
  }

  const admin = createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let utilisateurCree: string | null = null;

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
      .select('role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', acteur.id)
      .maybeSingle();
    if (erreurProfilActeur || !profilActeur?.is_active) {
      throw new ErreurPublique(403, 'Ce compte n’est pas autorisé à administrer les utilisateurs.');
    }

    // Le profil protégé en base est l'autorité d'habilitation. Les métadonnées
    // Auth accompagnent le jeton, mais ne doivent pas corriger silencieusement
    // un profil incohérent ou promouvoir un compte.
    const roleActeur = texte(profilActeur.role, 40).toLowerCase();
    if (!ROLES_CREATEURS.has(roleActeur) || (roleActeur !== 'owner' && profilActeur.mining_company_id)) {
      throw new ErreurPublique(403, 'Vous ne disposez pas du droit de créer un compte.');
    }
    if (!profilActeur.mfa_enrolled_at || niveauAssurance(jeton) !== 'aal2') {
      throw new ErreurPublique(
        403,
        'Validez votre second facteur avant d’administrer les comptes utilisateurs.',
      );
    }

    const corps = await req.json().catch(() => null) as RequeteCreation | null;
    if (!corps) throw new ErreurPublique(400, 'Les informations du compte sont illisibles.');

    const email = texte(corps.email, 254).toLowerCase();
    const nomComplet = texte(corps.full_name, 160);
    const telephone = texte(corps.phone, 40) || null;
    const role = texte(corps.role, 40).toLowerCase();
    const societeMiniere = texte(corps.mining_company_id, 64) || null;
    const actif = corps.is_active !== false;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErreurPublique(400, 'Renseignez une adresse e-mail valide.');
    }
    if (!nomComplet) throw new ErreurPublique(400, 'Le nom complet est obligatoire.');
    if (!ROLES.has(role)) throw new ErreurPublique(400, 'Le rôle sélectionné n’est pas reconnu.');
    if (role === 'owner' && roleActeur !== 'owner') {
      throw new ErreurPublique(403, 'Seul un propriétaire peut créer un autre compte propriétaire.');
    }
    if (role === 'mine' && (!societeMiniere || !UUID.test(societeMiniere))) {
      throw new ErreurPublique(400, 'Rattachez le compte à une société minière.');
    }
    if (role !== 'mine' && societeMiniere) {
      throw new ErreurPublique(400, 'Ce rôle ne peut pas recevoir un périmètre de société minière.');
    }

    if (societeMiniere) {
      const { data: societe } = await admin
        .from('mining_companies').select('id').eq('id', societeMiniere).maybeSingle();
      if (!societe) throw new ErreurPublique(400, 'La société minière sélectionnée est introuvable.');
    }

    const { data: profilExistant } = await admin
      .from('user_profiles').select('id').eq('email', email).maybeSingle();
    if (profilExistant) throw new ErreurPublique(409, 'Un compte utilise déjà cette adresse e-mail.');

    const permissions = normaliserPermissions(corps.permissions, role);
    if (permissions.length > 0) {
      const ids = [...new Set(permissions.map((permission) => permission.module_id))];
      const { data: modules, error: erreurModules } = await admin.from('modules').select('id').in('id', ids);
      if (erreurModules || (modules?.length ?? 0) !== ids.length) {
        throw new ErreurPublique(400, 'Une ou plusieurs habilitations ne correspondent plus au référentiel courant.');
      }
    }

    const { data: creationAuth, error: erreurCreationAuth } = await admin.auth.admin.createUser({
      email,
      password: motDePasseProvisoire(),
      email_confirm: true,
      user_metadata: { full_name: nomComplet, phone: telephone ?? '' },
      app_metadata: { role, mining_company_id: role === 'mine' ? societeMiniere : null },
    });
    if (erreurCreationAuth || !creationAuth.user) {
      const conflit = /already|registered|exist/i.test(erreurCreationAuth?.message ?? '');
      throw new ErreurPublique(
        conflit ? 409 : 400,
        conflit ? 'Un compte utilise déjà cette adresse e-mail.' : 'Le compte d’authentification n’a pas pu être créé.',
      );
    }
    utilisateurCree = creationAuth.user.id;

    const { error: erreurProfil } = await admin.from('user_profiles').insert({
      id: utilisateurCree,
      email,
      full_name: nomComplet,
      phone: telephone,
      role,
      mining_company_id: role === 'mine' ? societeMiniere : null,
      is_active: actif,
      two_factor_enabled: false,
      mfa_enrolled_at: null,
      must_change_password: true,
      password_changed_at: null,
    });
    if (erreurProfil) throw new Error(`profil: ${erreurProfil.message}`);

    if (permissions.length > 0) {
      const { error: erreurPermissions } = await admin.from('user_permissions').insert(
        permissions.map((permission) => ({
          user_id: utilisateurCree,
          module_id: permission.module_id,
          can_view: permission.can_view,
          can_create: permission.can_create,
          can_edit: permission.can_edit,
          can_delete: permission.can_delete,
          can_approve: permission.can_approve,
          can_read: permission.can_view,
          can_write: permission.can_edit,
          field_permissions: permission.field_permissions ?? {},
          granted_by: acteur.id,
        })),
      );
      if (erreurPermissions) throw new Error(`habilitations: ${erreurPermissions.message}`);
    }

    const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: urlModificationMotDePasse(Deno.env.get('SONASP_APP_URL')) },
    });
    const jetonHache = lien?.properties?.hashed_token;
    if (erreurLien || !jetonHache) throw new Error(`lien d’activation: ${erreurLien?.message ?? 'absent'}`);
    const lienActivation = urlRecuperationCompte(jetonHache, Deno.env.get('SONASP_APP_URL'));

    const reponseCourriel = await fetch(`${urlSupabase}/functions/v1/envoyer-courriel`, {
      method: 'POST',
      headers: {
        'Authorization': autorisation,
        // Appel serveur-à-serveur : la clé de service franchit la passerelle,
        // tandis que le jeton utilisateur reste l'identité vérifiée par la
        // fonction destinataire. La clé ne quitte jamais l'environnement Deno.
        'apikey': cleService,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'bienvenue',
        to: email,
        nom_complet: nomComplet,
        role,
        lien_activation: lienActivation,
      }),
    });
    const resultatCourriel = await reponseCourriel.json().catch(() => ({}));
    if (!reponseCourriel.ok || !resultatCourriel?.envoye) {
      console.error('[create-user] Courriel de bienvenue indisponible.', {
        statut: reponseCourriel.status,
        erreur: resultatCourriel?.erreur ?? 'réponse sans confirmation',
      });
      throw new ErreurPublique(
        503,
        'La messagerie n’a pas confirmé l’envoi du courriel de bienvenue. Aucun compte incomplet n’a été conservé.',
      );
    }

    const reponse = reponseJson(req, {
      success: true,
      user: { id: utilisateurCree, email, full_name: nomComplet, role },
      email_sent: true,
      requires_password_change: true,
      requires_mfa_enrollment: true,
      message: 'Compte créé. Le courriel de bienvenue a été envoyé.',
    }, 201);
    utilisateurCree = null;
    return reponse;
  } catch (erreur) {
    if (utilisateurCree) {
      await annulerCreation(admin, utilisateurCree).catch((raison) =>
        console.error('[create-user] Retour arrière incomplet.', raison)
      );
    }

    if (erreur instanceof ErreurPublique) {
      return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
    }
    console.error('[create-user] Échec de création.', erreur);
    return reponseJson(req, {
      success: false,
      error: 'La création n’a pas pu être finalisée. Aucun compte incomplet n’a été conservé.',
    }, 500);
  }
});
