import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import { accountOrganizationType, canCreateAccountRole, isInteractiveAccountRole } from '../_shared/account-role-policy.ts';
import { urlModificationMotDePasse, urlRecuperationCompte } from '../_shared/application-url.ts';
import {
  clesJsonValides,
  lireJsonLimite,
  verifierSessionAdministration,
} from '../_shared/admin-account-edge.ts';

const ROLES_CREATEURS = new Set(['owner', 'admin']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAILLE_MAXIMALE_CORPS = 65_536;
const CLES_REQUETE_CREATION = [
  'email',
  'full_name',
  'phone',
  'job_title',
  'department',
  'role',
  'is_active',
  'mining_company_id',
  'account_type',
  'organization_id',
  'organization_code',
  'organization_name',
  'permissions',
  'capabilities',
  'responsibilities',
  'collector_id',
  'access_portal_id',
  'access_role_id',
  'actor_category_code',
  'resource_type',
  'resource_id',
  'access_restrictions',
] as const;
const CLES_PERMISSION_MODULE = [
  'module_id',
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
  'can_approve',
  'field_permissions',
] as const;
const CLES_PERMISSION_CHAMP = ['can_view', 'can_edit'] as const;
const CLE_IDEMPOTENCE = /^[A-Za-z0-9._:-]{8,128}$/;

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
  job_title?: unknown;
  department?: unknown;
  role?: unknown;
  is_active?: unknown;
  mining_company_id?: unknown;
  account_type?: unknown;
  organization_id?: unknown;
  organization_code?: unknown;
  organization_name?: unknown;
  permissions?: unknown;
  capabilities?: unknown;
  responsibilities?: unknown;
  collector_id?: unknown;
  access_portal_id?: unknown;
  access_role_id?: unknown;
  actor_category_code?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  access_restrictions?: unknown;
}

interface ResultatCreationPostgresql {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  account_type?: string | null;
  organization_id?: string | null;
  organization_created?: boolean;
  replayed: boolean;
  email_sent: boolean;
}

const CAPACITES_OPERATIONNELLES = new Set([
  'sonasp.prepare',
  'sonasp.approve',
  'sonasp.finance.execute',
  'sonasp.finance.reconcile',
  'comptoir.manage',
  'comptoir.invoices.issue',
  'comptoir.payments.execute',
  'comptoir.payments.reconcile',
  'comptoir.tax.execute',
  'collectors.manage',
  'collector.operate',
  'dgmg.supervise',
  'dgmg.production.validate',
  'dgi.fiscal.control',
  'dgi.fiscal.reconcile',
  'mine.production.manage',
  'refining.supervise',
  'reconciliation.manage',
]);

const RESPONSABILITES_PAR_ROLE: Readonly<Record<string, readonly string[]>> = {
  admin: [],
  management: ['sonasp.prepare','sonasp.approve','sonasp.finance.execute','sonasp.finance.reconcile','refining.supervise','reconciliation.manage','collectors.manage'],
  dgmg: ['dgmg.supervise','dgmg.production.validate','collectors.manage'],
  dgi: ['dgi.fiscal.control','dgi.fiscal.reconcile'],
  mine: ['mine.production.manage','refining.supervise'],
  comptoir: ['comptoir.manage','refining.supervise','comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile','comptoir.tax.execute'],
  collector: ['collector.operate'],
  customer: [],
};
const RESPONSABILITES_OBLIGATOIRES: Readonly<Record<string, readonly string[]>> = {
  dgmg: ['dgmg.supervise'], dgi: ['dgi.fiscal.control'], mine: ['mine.production.manage'],
  comptoir: ['comptoir.manage'], collector: ['collector.operate'],
};

function normaliserCapacites(brut: unknown, role: string): Array<{ code: string; allowed: boolean }> {
  if (brut === undefined || brut === null) brut = {};
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
  const plafond = new Set(RESPONSABILITES_PAR_ROLE[role] ?? []);
  if (entries.some(([code, allowed]) => allowed && !plafond.has(code))) {
    throw new ErreurPublique(403, 'Une responsabilité métier dépasse le plafond du rôle.');
  }
  const selection = new Map(entries.map(([code, allowed]) => [code, Boolean(allowed)]));
  if ((RESPONSABILITES_OBLIGATOIRES[role] ?? []).some((code) => !selection.get(code))) {
    throw new ErreurPublique(400, 'Une responsabilité obligatoire est absente.');
  }
  if ((selection.get('sonasp.prepare') && selection.get('sonasp.approve'))
    || (selection.get('sonasp.finance.execute') && selection.get('sonasp.finance.reconcile'))
    || (selection.get('comptoir.payments.execute') && selection.get('comptoir.payments.reconcile'))) {
    throw new ErreurPublique(403, 'Séparation des fonctions : responsabilités incompatibles.');
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

const estObjetJson = (valeur: unknown): valeur is Record<string, unknown> =>
  Boolean(valeur && typeof valeur === 'object' && !Array.isArray(valeur));

function permissionsValides(brut: unknown): boolean {
  if (brut === undefined || brut === null) return true;
  if (!estObjetJson(brut)) return false;
  const permissions = Object.values(brut);
  if (permissions.length > 250) return false;

  return permissions.every((valeur) => {
    if (!clesJsonValides(valeur, CLES_PERMISSION_MODULE, ['module_id'])) return false;
    if (typeof valeur.module_id !== 'string') return false;
    for (const cle of ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve'] as const) {
      if (valeur[cle] !== undefined && typeof valeur[cle] !== 'boolean') return false;
    }

    const champs = valeur.field_permissions;
    if (champs === undefined || champs === null) return true;
    if (!estObjetJson(champs)) return false;
    const permissionsChamps = Object.entries(champs);
    if (permissionsChamps.length > 100) return false;
    return permissionsChamps.every(([champ, droits]) =>
      champ.length > 0
      && champ.length <= 100
      && !/[\u0000-\u001F\u007F]/u.test(champ)
      && clesJsonValides(droits, CLES_PERMISSION_CHAMP)
      && (droits.can_view === undefined || typeof droits.can_view === 'boolean')
      && (droits.can_edit === undefined || typeof droits.can_edit === 'boolean')
    );
  });
}

function typesRequeteCreationValides(corps: Record<string, unknown>): boolean {
  const chainesObligatoires = ['email', 'full_name', 'role'] as const;
  if (chainesObligatoires.some((cle) => typeof corps[cle] !== 'string')) return false;
  const chainesOptionnelles = [
    'phone',
    'job_title',
    'department',
    'mining_company_id',
    'account_type',
    'organization_id',
    'organization_code',
    'organization_name',
    'collector_id',
    'access_portal_id',
    'access_role_id',
    'actor_category_code',
    'resource_type',
    'resource_id',
  ] as const;
  if (chainesOptionnelles.some((cle) =>
    corps[cle] !== undefined && corps[cle] !== null && typeof corps[cle] !== 'string'
  )) return false;
  if (corps.is_active !== undefined && typeof corps.is_active !== 'boolean') return false;
  if (corps.access_restrictions !== undefined && !Array.isArray(corps.access_restrictions)) return false;
  if (!permissionsValides(corps.permissions)) return false;
  return [corps.capabilities, corps.responsibilities].every((valeur) =>
    valeur === undefined || valeur === null || estObjetJson(valeur)
  );
}

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
    )
    .sort((gauche, droite) => gauche.module_id.localeCompare(droite.module_id));
}

async function resoudreCleIdempotence(req: Request, acteurId: string, email: string): Promise<string> {
  const fournie = req.headers.get('Idempotency-Key')?.trim();
  if (fournie) {
    if (!CLE_IDEMPOTENCE.test(fournie)) {
      throw new ErreurPublique(400, 'La clé d’idempotence de création est invalide.');
    }
    return fournie;
  }
  // Compatibilité des clients existants : une même adresse, pour un même
  // acteur, produit la même clé jusqu'à réussite ou compensation complète.
  const empreinte = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`sonasp:create-user:${acteurId}:${email}`),
  );
  return Array.from(new Uint8Array(empreinte), (octet) => octet.toString(16).padStart(2, '0')).join('');
}

function erreurAuthUtilisateurAbsent(erreur: { status?: number; code?: string; message?: string } | null): boolean {
  return Boolean(erreur && (
    erreur.status === 404
    || erreur.code === 'user_not_found'
    || /not found|does not exist/i.test(erreur.message ?? '')
  ));
}

async function supprimerIdentiteAuthEtVerifier(admin: SupabaseClient, utilisateurId: string): Promise<void> {
  let derniereErreur = 'La suppression de l’identité Auth n’a pas pu être vérifiée.';
  for (let tentative = 0; tentative < 2; tentative += 1) {
    const { error: erreurSuppression } = await admin.auth.admin.deleteUser(utilisateurId);
    const { data: verification, error: erreurVerification } = await admin.auth.admin.getUserById(utilisateurId);
    if (!verification?.user && erreurAuthUtilisateurAbsent(erreurVerification)) return;
    if (erreurSuppression && !erreurAuthUtilisateurAbsent(erreurSuppression)) {
      derniereErreur = `identité Auth: ${erreurSuppression.message}`;
    } else if (erreurVerification && !erreurAuthUtilisateurAbsent(erreurVerification)) {
      derniereErreur = `vérification Auth: ${erreurVerification.message}`;
    }
  }
  throw new Error(derniereErreur);
}

async function annulerCreation(
  admin: SupabaseClient,
  clientActeur: SupabaseClient,
  utilisateurId: string,
  cleIdempotence: string,
  postgresqlCree: boolean,
): Promise<void> {
  const { data, error } = await clientActeur.rpc('snp_annuler_creation_compte_postgresql', {
    p_idempotency_key: cleIdempotence,
    p_user_id: utilisateurId,
  });
  const creationPostgresqlAbsente = error?.code === 'P0002';
  if ((postgresqlCree && (error || !data || data.removed !== true))
    || (!postgresqlCree && error && !creationPostgresqlAbsente)
    || (!postgresqlCree && !error && data?.removed !== true)) {
    throw new Error(`annulation PostgreSQL: ${error?.message ?? 'confirmation absente'}`);
  }
  await supprimerIdentiteAuthEtVerifier(admin, utilisateurId);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'POST') return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);

  const urlSupabase = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!urlSupabase || !cleService || !cleAnon) {
    console.error('[create-user] Configuration Supabase incomplète.');
    return reponseJson(req, { success: false, error: 'Le service de création de compte est indisponible.' }, 503);
  }

  const admin = createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let utilisateurCree: string | null = null;
  let cleIdempotence: string | null = null;
  let postgresqlCree = false;
  let clientActeurRetour: SupabaseClient | null = null;

  try {
    const autorisation = req.headers.get('Authorization') ?? '';
    const jeton = autorisation.replace(/^Bearer\s+/i, '');
    if (!jeton) throw new ErreurPublique(401, 'Votre session a expiré. Reconnectez-vous.');

    const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(jeton);
    if (erreurAuth || !donneesAuth.user) {
      throw new ErreurPublique(401, 'Votre session n’est plus valide. Reconnectez-vous.');
    }
    const acteur = donneesAuth.user;
    const clientActeur = createClient(urlSupabase, cleAnon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: autorisation } },
    });
    clientActeurRetour = clientActeur;
    const sessionAdministration = await verifierSessionAdministration(clientActeur, 'create');
    if (!sessionAdministration.ok) {
      throw new ErreurPublique(sessionAdministration.status, 'Votre session administrative n’est plus autorisée.');
    }

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

    const corps = await lireJsonLimite(req, TAILLE_MAXIMALE_CORPS);
    if (
      !clesJsonValides(corps, CLES_REQUETE_CREATION, ['email', 'full_name', 'role'])
      || !typesRequeteCreationValides(corps)
    ) {
      throw new ErreurPublique(400, 'Les informations du compte sont illisibles.');
    }
    const requete = corps as RequeteCreation;

    const email = texte(requete.email, 254).toLowerCase();
    const nomComplet = texte(requete.full_name, 160);
    const telephone = texte(requete.phone, 40) || null;
    const fonction = texte(requete.job_title, 120) || null;
    const direction = texte(requete.department, 120) || null;
    const role = texte(requete.role, 40).toLowerCase();
    const societeMiniere = texte(requete.mining_company_id, 64) || null;
    const typeCompte = texte(requete.account_type, 40).toLowerCase() || null;
    const organisationDemandee = texte(requete.organization_id, 64) || null;
    const codeOrganisation = texte(requete.organization_code, 20).toUpperCase() || null;
    const nomOrganisation = texte(requete.organization_name, 160) || null;
    const actif = requete.is_active !== false;
    const collecteurId = texte(requete.collector_id, 64) || null;
    const accessPortalId = texte(requete.access_portal_id, 64) || null;
    const accessRoleId = texte(requete.access_role_id, 64) || null;
    const actorCategoryCode = texte(requete.actor_category_code, 40).toLowerCase() || null;
    const resourceType = texte(requete.resource_type, 40).toLowerCase() || null;
    const resourceId = texte(requete.resource_id, 64) || null;
    const accessRestrictions = requete.access_restrictions ?? [];

    const accessFields = [accessPortalId, accessRoleId, actorCategoryCode];
    if (accessFields.some(Boolean) && !accessFields.every(Boolean)) {
      throw new ErreurPublique(400, 'La catégorie, le portail et le rôle d’accès doivent être renseignés ensemble.');
    }
    if ((accessPortalId && !UUID.test(accessPortalId)) || (accessRoleId && !UUID.test(accessRoleId))
      || (resourceId && !UUID.test(resourceId))) {
      throw new ErreurPublique(400, 'L’affectation d’accès contient un identifiant invalide.');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErreurPublique(400, 'Renseignez une adresse e-mail valide.');
    }
    if (!nomComplet) throw new ErreurPublique(400, 'Le nom complet est obligatoire.');
    if (!isInteractiveAccountRole(role)) {
      throw new ErreurPublique(400, 'Le rôle sélectionné n’est pas reconnu ou attribuable.');
    }
    if (!canCreateAccountRole(roleActeur, role)) {
      throw new ErreurPublique(403, 'Votre rôle ne permet pas de créer ce type de compte.');
    }
    if (role === 'mine' && (!societeMiniere || !UUID.test(societeMiniere))) {
      throw new ErreurPublique(400, 'Rattachez le compte à une société minière.');
    }
    if (role !== 'mine' && societeMiniere) {
      throw new ErreurPublique(400, 'Ce rôle ne peut pas recevoir un périmètre de société minière.');
    }
    if (typeCompte && typeCompte !== role) {
      throw new ErreurPublique(400, 'Le type de compte sélectionné n’est pas reconnu.');
    }
    if (role === 'comptoir') {
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
    } else if (codeOrganisation || nomOrganisation) {
      throw new ErreurPublique(400, 'Seul un Comptoir peut créer une organisation depuis cet écran.');
    }
    if (['dgmg','dgi','collector'].includes(role) && !accessPortalId
      && (!organisationDemandee || !UUID.test(organisationDemandee))) {
      throw new ErreurPublique(400, 'Une organisation compatible est obligatoire pour ce rôle.');
    }
    if (role === 'collector' && (!collecteurId || !UUID.test(collecteurId))) {
      throw new ErreurPublique(400, 'Un profil collecteur valide est obligatoire.');
    }
    if (role === 'collector' && collecteurId) {
      const { data: collecteur, error: erreurCollecteur } = await admin
        .from('snp_artisans_miniers')
        .select('id, actif, type_artisan')
        .eq('id', collecteurId)
        .eq('type_artisan', 'collecteur')
        .eq('actif', true)
        .maybeSingle();
      if (erreurCollecteur || !collecteur) {
        throw new ErreurPublique(400, 'Le profil collecteur est inactif, incompatible ou introuvable.');
      }
      const { data: existingCollectorAccount } = await admin
        .from('snp_collector_accounts')
        .select('id')
        .eq('collector_id', collecteurId)
        .eq('is_active', true)
        .maybeSingle();
      if (existingCollectorAccount) {
        throw new ErreurPublique(409, 'Ce collecteur possède déjà un compte actif.');
      }
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

    const permissions = normaliserPermissions(requete.permissions, role);
    const capacites = normaliserCapacites(requete.responsibilities ?? requete.capabilities, role);
    if (role === 'comptoir' && !capacites.some(
      (capacite) => capacite.code === 'comptoir.manage' && capacite.allowed
    )) {
      throw new ErreurPublique(400, 'L’habilitation Comptoir d’achat est obligatoire pour ce profil.');
    }
    if (role !== 'comptoir' && capacites.some(
      (capacite) => capacite.code === 'comptoir.manage' && capacite.allowed
    )) {
      throw new ErreurPublique(400, 'L’habilitation Comptoir exige un périmètre Comptoir actif.');
    }

    if (organisationDemandee) {
      const typeOrganisationAttendu = accountOrganizationType(role);
      const { data: organisation, error: erreurOrganisation } = await admin
        .from('snp_organizations')
        .select('id')
        .eq('id', organisationDemandee)
        .eq('organization_type', typeOrganisationAttendu)
        .eq('is_active', true)
        .maybeSingle();
      if (erreurOrganisation) throw new Error(`comptoir: ${erreurOrganisation.message}`);
      if (!organisation) throw new ErreurPublique(400, 'L’organisation sélectionnée est incompatible, inactive ou introuvable.');
    }
    if (permissions.length > 0) {
      const ids = [...new Set(permissions.map((permission) => permission.module_id))];
      const { data: modules, error: erreurModules } = await admin.from('modules').select('id').in('id', ids);
      if (erreurModules || (modules?.length ?? 0) !== ids.length) {
        throw new ErreurPublique(400, 'Une ou plusieurs habilitations ne correspondent plus au référentiel courant.');
      }
    }

    const responsabilites = Object.fromEntries(capacites.map(({ code, allowed }) => [code, allowed]));
    cleIdempotence = await resoudreCleIdempotence(req, acteur.id, email);
    const parametresPostgresql = {
      p_idempotency_key: cleIdempotence,
      p_email: email,
      p_full_name: nomComplet,
      p_phone: telephone,
      p_role: role,
      p_is_active: actif,
      p_mining_company_id: societeMiniere,
      p_account_type: typeCompte,
      p_organization_id: organisationDemandee,
      p_organization_code: codeOrganisation,
      p_organization_name: nomOrganisation,
      p_collector_id: collecteurId,
      p_responsibilities: responsabilites,
      p_permissions: role === 'owner' ? [] : permissions,
    };

    const { data: creationPrecedente, error: erreurLectureIdempotence } = await clientActeur.rpc(
      'snp_lire_creation_compte_idempotente',
      parametresPostgresql,
    );
    if (erreurLectureIdempotence) {
      if (erreurLectureIdempotence.code === '23505') {
        throw new ErreurPublique(409, 'Cette demande de création a déjà été utilisée avec d’autres informations.');
      }
      throw new Error(`lecture idempotente: ${erreurLectureIdempotence.message}`);
    }

    let resultatCreation = creationPrecedente as ResultatCreationPostgresql | null;
    if (!resultatCreation) {
      const { data: profilExistant } = await admin
        .from('user_profiles').select('id').eq('email', email).maybeSingle();
      if (profilExistant) throw new ErreurPublique(409, 'Un compte utilise déjà cette adresse e-mail.');

      const { data: creationAuth, error: erreurCreationAuth } = await admin.auth.admin.createUser({
        email,
        password: motDePasseProvisoire(),
        email_confirm: true,
        user_metadata: { full_name: nomComplet, phone: telephone ?? '' },
        app_metadata: {
          role,
          mining_company_id: role === 'mine' ? societeMiniere : null,
          account_creation_key: cleIdempotence,
          account_created_by: acteur.id,
        },
      });
      if (erreurCreationAuth || !creationAuth.user) {
        const conflit = /already|registered|exist/i.test(erreurCreationAuth?.message ?? '');
        throw new ErreurPublique(
          conflit ? 409 : 400,
          conflit ? 'Un compte utilise déjà cette adresse e-mail.' : 'Le compte d’authentification n’a pas pu être créé.',
        );
      }
      utilisateurCree = creationAuth.user.id;

      const { data: resultatPostgresql, error: erreurPostgresql } = await clientActeur.rpc(
        'snp_creer_compte_postgresql_transactionnel',
        { ...parametresPostgresql, p_user_id: utilisateurCree },
      );
      if (erreurPostgresql || !resultatPostgresql) {
        if (erreurPostgresql?.code === '23505') {
          throw new ErreurPublique(409, 'Un compte ou un périmètre utilise déjà ces informations.');
        }
        if (erreurPostgresql?.code === '42501') {
          throw new ErreurPublique(403, 'La création de ce rôle ou de ces habilitations a été refusée.');
        }
        throw new Error(`transaction de création PostgreSQL: ${erreurPostgresql?.message ?? 'résultat absent'}`);
      }
      resultatCreation = resultatPostgresql as ResultatCreationPostgresql;
      postgresqlCree = true;
    }

    if (!resultatCreation || !UUID.test(resultatCreation.user_id)) {
      throw new Error('La création transactionnelle n’a pas retourné un compte valide.');
    }
    const utilisateurIdFinal = resultatCreation.user_id;

    if (fonction || direction) {
      const { error: erreurProfilFonctionnel } = await admin.from('user_profiles').update({
        job_title: fonction,
        department: direction,
      }).eq('id', utilisateurIdFinal);
      if (erreurProfilFonctionnel) throw new Error(`profil fonctionnel: ${erreurProfilFonctionnel.message}`);
    }

    if (accessPortalId && accessRoleId && actorCategoryCode) {
      const { error: erreurAffectation } = await clientActeur.rpc('snp_access_user_assignment_save', {
        p_user_id: utilisateurIdFinal,
        p_portal_id: accessPortalId,
        p_role_id: accessRoleId,
        p_actor_category_code: actorCategoryCode,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_restrictions: accessRestrictions,
        p_reason: 'Création du compte et affectation initiale depuis l’administration.',
      });
      if (erreurAffectation) {
        if (erreurAffectation.code === '42501') {
          throw new ErreurPublique(403, 'L’affectation demandée dépasse vos autorisations.');
        }
        if (erreurAffectation.code === '23503' || erreurAffectation.code === '22023') {
          throw new ErreurPublique(400, 'La catégorie, le portail, le rôle ou la ressource sélectionnée est incompatible.');
        }
        throw new Error(`affectation d’accès: ${erreurAffectation.message}`);
      }
    }

    if (!resultatCreation.email_sent) {
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
      const { error: erreurConfirmationCourriel } = await clientActeur.rpc(
        'snp_confirmer_courriel_creation_compte',
        { p_idempotency_key: cleIdempotence, p_user_id: utilisateurIdFinal },
      );
      // Le courriel a déjà quitté le système : une indisponibilité du marqueur
      // ne doit pas supprimer un compte valide ni invalider le lien envoyé.
      if (erreurConfirmationCourriel) {
        console.error('[create-user] Marqueur de courriel non confirmé.', erreurConfirmationCourriel.message);
      }
    }

    const reponse = reponseJson(req, {
      success: true,
      user: {
        id: utilisateurIdFinal,
        email,
        full_name: nomComplet,
        role,
        account_type: typeCompte,
      },
      email_sent: true,
      requires_password_change: true,
      requires_mfa_enrollment: true,
      replayed: resultatCreation.replayed,
      message: resultatCreation.replayed
        ? 'Cette création avait déjà été finalisée. Aucun compte n’a été dupliqué.'
        : 'Compte créé. Le courriel de bienvenue a été envoyé.',
    }, resultatCreation.replayed ? 200 : 201);
    utilisateurCree = null;
    postgresqlCree = false;
    return reponse;
  } catch (erreur) {
    let retourArriereIncomplet = false;
    if (utilisateurCree && cleIdempotence && clientActeurRetour) {
      try {
        await annulerCreation(
          admin,
          clientActeurRetour,
          utilisateurCree,
          cleIdempotence,
          postgresqlCree,
        );
      } catch (raison) {
        retourArriereIncomplet = true;
        console.error('[create-user] Retour arrière incomplet.', raison);
      }
    }

    if (retourArriereIncomplet) {
      return reponseJson(req, {
        success: false,
        error: 'La création a échoué et son annulation n’a pas pu être confirmée. Faites vérifier le compte par un administrateur avant de réessayer.',
      }, 500);
    }

    if (erreur instanceof ErreurPublique) {
      return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
    }
    console.error('[create-user] Échec de création.', erreur);
    return reponseJson(req, {
      success: false,
      error: 'La création n’a pas pu être finalisée. Faites vérifier le compte par un administrateur avant de réessayer.',
    }, 500);
  }
});
