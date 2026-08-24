import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import { isInteractiveAccountRole } from '../_shared/account-role-policy.ts';
import { urlModificationMotDePasse, urlRecuperationCompte } from '../_shared/application-url.ts';

const ROLES_CREATEURS = new Set(['owner', 'admin']);
const NIVEAUX_ROLE: Record<string, number> = {
  owner: 100,
  admin: 80,
  management: 60,
  manager: 40,
  mine: 20,
  factory: 20,
  airport: 20,
  refinery: 20,
  customer: 20,
};
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
  account_type?: unknown;
  organization_id?: unknown;
  organization_code?: unknown;
  organization_name?: unknown;
  permissions?: unknown;
  capabilities?: unknown;
}

const CAPACITES_OPERATIONNELLES = new Set([
  'sonasp.prepare',
  'sonasp.approve',
  'sonasp.finance.execute',
  'sonasp.finance.reconcile',
  'comptoir.manage',
  'collectors.manage',
  'collector.operate',
]);

function normaliserCapacites(brut: unknown, role: string): Array<{ code: string; allowed: boolean }> {
  if (brut === undefined || brut === null) return [];
  if (typeof brut !== 'object' || Array.isArray(brut)) {
    throw new ErreurPublique(400, 'Les responsabilités métier sont illisibles.');
  }

  const entries = Object.entries(brut as Record<string, unknown>);
  if (entries.some(([code, allowed]) => !CAPACITES_OPERATIONNELLES.has(code) || typeof allowed !== 'boolean')) {
    throw new ErreurPublique(400, 'Une responsabilité métier est inconnue ou invalide.');
  }
  if (role === 'manager' && entries.some(([, allowed]) => allowed)) {
    throw new ErreurPublique(400, 'Le profil Manager est strictement limité à la lecture.');
  }
  return entries.map(([code, allowed]) => ({ code, allowed: allowed as boolean }));
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
  let organisationCreee: string | null = null;

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
    const typeCompte = texte(corps.account_type, 40).toLowerCase() || null;
    const organisationDemandee = texte(corps.organization_id, 64) || null;
    const codeOrganisation = texte(corps.organization_code, 20).toUpperCase() || null;
    const nomOrganisation = texte(corps.organization_name, 160) || null;
    const actif = corps.is_active !== false;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErreurPublique(400, 'Renseignez une adresse e-mail valide.');
    }
    if (!nomComplet) throw new ErreurPublique(400, 'Le nom complet est obligatoire.');
    if (role === 'owner') {
      throw new ErreurPublique(
        403,
        'Le rôle Propriétaire est réservé au script sécurisé de continuité.',
      );
    }
    if (!isInteractiveAccountRole(role)) {
      throw new ErreurPublique(400, 'Le rôle sélectionné n’est pas reconnu ou attribuable.');
    }
    if ((NIVEAUX_ROLE[role] ?? Number.POSITIVE_INFINITY) > (NIVEAUX_ROLE[roleActeur] ?? -1)) {
      throw new ErreurPublique(403, 'Vous ne pouvez pas créer un compte d’un niveau supérieur au vôtre.');
    }
    if (role === 'mine' && (!societeMiniere || !UUID.test(societeMiniere))) {
      throw new ErreurPublique(400, 'Rattachez le compte à une société minière.');
    }
    if (role !== 'mine' && societeMiniere) {
      throw new ErreurPublique(400, 'Ce rôle ne peut pas recevoir un périmètre de société minière.');
    }
    if (typeCompte && typeCompte !== 'comptoir') {
      throw new ErreurPublique(400, 'Le type de compte sélectionné n’est pas reconnu.');
    }
    if (typeCompte === 'comptoir') {
      if (role !== 'customer') {
        throw new ErreurPublique(400, 'Le profil Comptoir doit utiliser le rôle partenaire sécurisé.');
      }
      const rattachementExistant = Boolean(organisationDemandee);
      const nouveauRattachement = Boolean(codeOrganisation || nomOrganisation);
      if (rattachementExistant === nouveauRattachement) {
        throw new ErreurPublique(400, 'Sélectionnez un comptoir existant ou renseignez un nouveau comptoir.');
      }
      if (organisationDemandee && !UUID.test(organisationDemandee)) {
        throw new ErreurPublique(400, 'Le comptoir sélectionné est invalide.');
      }
      if (nouveauRattachement) {
        if (!codeOrganisation || !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(codeOrganisation)) {
          throw new ErreurPublique(400, 'Le code du comptoir est invalide.');
        }
        if (!nomOrganisation || nomOrganisation.length < 3) {
          throw new ErreurPublique(400, 'Le nom du comptoir est obligatoire.');
        }
      }
    } else if (organisationDemandee || codeOrganisation || nomOrganisation) {
      throw new ErreurPublique(400, 'Ce profil ne peut pas recevoir un périmètre Comptoir.');
    }

    if (societeMiniere) {
      const { data: societe, error: erreurSociete } = await admin
        .from('mining_companies')
        .select('id, is_active')
        .eq('id', societeMiniere)
        .maybeSingle();
      if (erreurSociete) throw new Error(`société minière: ${erreurSociete.message}`);
      if (!societe?.is_active) {
        throw new ErreurPublique(400, 'La société minière sélectionnée est inactive ou introuvable.');
      }

      // Cette vérification fournit une réponse immédiate et lisible. L'index
      // unique et le verrou de base restent l'autorité en cas de deux requêtes
      // simultanées entre cette lecture et l'insertion du profil.
      const { data: comptesSociete, error: erreurCompteSociete } = await admin
        .from('user_profiles')
        .select('id')
        .eq('role', 'mine')
        .eq('mining_company_id', societeMiniere)
        .limit(1);
      if (erreurCompteSociete) {
        throw new Error(`contrôle du compte minier: ${erreurCompteSociete.message}`);
      }
      if ((comptesSociete?.length ?? 0) > 0) {
        throw new ErreurPublique(409, 'Cette société minière possède déjà un compte.');
      }
    }

    const { data: profilExistant } = await admin
      .from('user_profiles').select('id').eq('email', email).maybeSingle();
    if (profilExistant) throw new ErreurPublique(409, 'Un compte utilise déjà cette adresse e-mail.');

    const permissions = normaliserPermissions(corps.permissions, role);
    const capacites = normaliserCapacites(corps.capabilities, role);
    if (typeCompte === 'comptoir' && !capacites.some(
      (capacite) => capacite.code === 'comptoir.manage' && capacite.allowed
    )) {
      throw new ErreurPublique(400, 'L’habilitation Comptoir d’achat est obligatoire pour ce profil.');
    }
    if (typeCompte !== 'comptoir' && role === 'customer' && capacites.some(
      (capacite) => capacite.code === 'comptoir.manage' && capacite.allowed
    )) {
      throw new ErreurPublique(400, 'L’habilitation Comptoir exige un périmètre Comptoir actif.');
    }

    if (typeCompte === 'comptoir' && organisationDemandee) {
      const { data: organisation, error: erreurOrganisation } = await admin
        .from('snp_organizations')
        .select('id')
        .eq('id', organisationDemandee)
        .eq('organization_type', 'comptoir')
        .eq('is_active', true)
        .maybeSingle();
      if (erreurOrganisation) throw new Error(`comptoir: ${erreurOrganisation.message}`);
      if (!organisation) throw new ErreurPublique(400, 'Le comptoir sélectionné est inactif ou introuvable.');
    }
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
    if (erreurProfil) {
      const conflitCompteMine = role === 'mine' && (
        erreurProfil.code === '23505'
        || /compte_mine|mining_company|société minière/i.test(erreurProfil.message)
      );
      if (conflitCompteMine) {
        throw new ErreurPublique(409, 'Cette société minière possède déjà un compte.');
      }
      throw new Error(`profil: ${erreurProfil.message}`);
    }

    if (typeCompte === 'comptoir') {
      let organisationId = organisationDemandee;
      if (!organisationId) {
        const { data: nouvelleOrganisation, error: erreurNouvelleOrganisation } = await admin
          .from('snp_organizations')
          .insert({
            code: codeOrganisation,
            name: nomOrganisation,
            organization_type: 'comptoir',
            is_active: true,
            created_by: acteur.id,
          })
          .select('id')
          .single();
        if (erreurNouvelleOrganisation || !nouvelleOrganisation?.id) {
          const conflit = erreurNouvelleOrganisation?.code === '23505';
          throw new ErreurPublique(
            conflit ? 409 : 400,
            conflit
              ? 'Un comptoir utilise déjà ce code.'
              : 'Le périmètre du comptoir n’a pas pu être créé.',
          );
        }
        organisationId = nouvelleOrganisation.id;
        organisationCreee = organisationId;
      }

      const { error: erreurRattachement } = await admin
        .from('snp_user_organization_memberships')
        .insert({
          user_id: utilisateurCree,
          organization_id: organisationId,
          membership_role: 'manager',
          is_primary: true,
          reason: 'Rattachement lors de la création sécurisée du compte Comptoir',
          granted_by: acteur.id,
        });
      if (erreurRattachement) {
        throw new Error(`rattachement au comptoir: ${erreurRattachement.message}`);
      }
    }

    if (capacites.length > 0) {
      const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
      if (!cleAnon) throw new ErreurPublique(503, 'Le service d’habilitation est indisponible.');
      const clientActeur = createClient(urlSupabase, cleAnon, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: autorisation } },
      });
      for (const capacite of capacites) {
        const { error } = await clientActeur.rpc('snp_definir_capacite_utilisateur', {
          p_user_id: utilisateurCree,
          p_capability_code: capacite.code,
          p_allowed: capacite.allowed,
          p_reason: `${capacite.allowed ? 'Attribution' : 'Retrait'} lors de la création sécurisée du compte`,
          p_valid_until: null,
        });
        if (error) throw new Error(`responsabilités: ${error.message}`);
      }
    }

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
        role: typeCompte === 'comptoir' ? 'comptoir' : role,
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
      user: {
        id: utilisateurCree,
        email,
        full_name: nomComplet,
        role,
        account_type: typeCompte,
      },
      email_sent: true,
      requires_password_change: true,
      requires_mfa_enrollment: true,
      message: 'Compte créé. Le courriel de bienvenue a été envoyé.',
    }, 201);
    utilisateurCree = null;
    organisationCreee = null;
    return reponse;
  } catch (erreur) {
    if (utilisateurCree) {
      await annulerCreation(admin, utilisateurCree).catch((raison) =>
        console.error('[create-user] Retour arrière incomplet.', raison)
      );
    }
    if (organisationCreee) {
      try {
        await admin.from('snp_organizations').delete().eq('id', organisationCreee);
      } catch (raison) {
        console.error('[create-user] Nettoyage du comptoir incomplet.', raison);
      }
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
