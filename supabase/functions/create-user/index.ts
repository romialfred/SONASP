import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import { accountOrganizationType, canCreateAccountRole, isInteractiveAccountRole } from '../_shared/account-role-policy.ts';
import { urlModificationMotDePasse, urlRecuperationCompte } from '../_shared/application-url.ts';
import { verifierSessionAdministration } from '../_shared/admin-account-edge.ts';

const ROLES_CREATEURS = new Set(['owner', 'admin']);
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
  responsibilities?: unknown;
  collector_id?: unknown;
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
  const erreurs: string[] = [];
  const suppressions = [
    ['comptes collecteur', admin.from('snp_collector_accounts').delete().eq('user_id', utilisateurId)],
    ['rattachements organisationnels', admin.from('snp_user_organization_memberships').delete().eq('user_id', utilisateurId)],
    ['responsabilités', admin.from('snp_user_responsibilities').delete().eq('user_id', utilisateurId)],
    ['capacités explicites', admin.from('snp_user_capabilities').delete().eq('user_id', utilisateurId)],
    ['habilitations', admin.from('user_permissions').delete().eq('user_id', utilisateurId)],
    ['profil', admin.from('user_profiles').delete().eq('id', utilisateurId)],
  ] as const;

  for (const [libelle, requete] of suppressions) {
    const { error } = await requete;
    if (error) erreurs.push(`${libelle}: ${error.message}`);
  }
  const { error: erreurAuth } = await admin.auth.admin.deleteUser(utilisateurId);
  if (erreurAuth) erreurs.push(`identité Auth: ${erreurAuth.message}`);
  if (erreurs.length > 0) {
    throw new Error(`Retour arrière incomplet (${erreurs.join(' ; ')})`);
  }
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
    const clientActeur = createClient(urlSupabase, cleAnon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: autorisation } },
    });
    const sessionAdministration = await verifierSessionAdministration(clientActeur);
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
    const collecteurId = texte(corps.collector_id, 64) || null;

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
    if (['dgmg','dgi','collector'].includes(role) && (!organisationDemandee || !UUID.test(organisationDemandee))) {
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

    const { data: profilExistant } = await admin
      .from('user_profiles').select('id').eq('email', email).maybeSingle();
    if (profilExistant) throw new ErreurPublique(409, 'Un compte utilise déjà cette adresse e-mail.');

    const permissions = normaliserPermissions(corps.permissions, role);
    const capacites = normaliserCapacites(corps.responsibilities ?? corps.capabilities, role);
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
      // Owner n'est jamais activé par la seule clé de service : le RPC vérifie
      // à nouveau le JWT et la hiérarchie avant promotion et journalisation.
      role: role === 'owner' ? 'customer' : role,
      mining_company_id: role === 'mine' ? societeMiniere : null,
      is_active: role === 'owner' ? false : actif,
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

    let organisationId = organisationDemandee;
    if (role === 'comptoir') {
      if (!organisationId) {
        const { data: ministereTutelle, error: erreurMinistereTutelle } = await admin
          .from('snp_ministries')
          .select('id')
          .eq('code', 'MEMC')
          .eq('is_active', true)
          .maybeSingle();
        if (erreurMinistereTutelle || !ministereTutelle?.id) {
          throw new Error(
            `ministère de tutelle du comptoir: ${erreurMinistereTutelle?.message ?? 'MEMC actif introuvable'}`,
          );
        }
        const { data: nouvelleOrganisation, error: erreurNouvelleOrganisation } = await admin
          .from('snp_organizations')
          .insert({
            code: codeOrganisation,
            name: nomOrganisation,
            organization_type: 'comptoir',
            supervising_ministry_id: ministereTutelle.id,
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

    }

    if (role === 'mine') {
      const { data: mineOrganization, error: mineOrganizationError } = await admin
        .from('snp_organizations')
        .select('id')
        .eq('mining_company_id', societeMiniere)
        .eq('organization_type', 'mine')
        .maybeSingle();
      if (mineOrganizationError || !mineOrganization?.id) {
        throw new Error(`organisation minière: ${mineOrganizationError?.message ?? 'introuvable'}`);
      }
      organisationId = mineOrganization.id;
    }

    if (organisationId) {
      const { error: erreurRattachement } = await admin
        .from('snp_user_organization_memberships')
        .insert({
          user_id: utilisateurCree,
          organization_id: organisationId,
          membership_role: ['mine', 'comptoir'].includes(role) ? 'manager' : 'operator',
          is_primary: true,
          reason: 'Rattachement lors de la création sécurisée du compte',
          granted_by: acteur.id,
        });
      if (erreurRattachement) {
        throw new Error(`rattachement à l’organisation: ${erreurRattachement.message}`);
      }
    }

    if (role === 'collector' && collecteurId) {
      const { error: collectorAccountError } = await admin.from('snp_collector_accounts').insert({
        user_id: utilisateurCree,
        collector_id: collecteurId,
        comptoir_organization_id: organisationId,
        is_active: true,
        linked_by: acteur.id,
        reason: 'Rattachement lors de la création sécurisée du compte Collecteur',
      });
      if (collectorAccountError) throw new Error(`profil collecteur: ${collectorAccountError.message}`);
    }

    if (capacites.length > 0) {
      const responsibilityPayload = Object.fromEntries(capacites.map(({ code, allowed }) => [code, allowed]));
      const { error: validationError } = await clientActeur.rpc('snp_validate_responsibilities', {
        p_role: role,
        p_responsibilities: responsibilityPayload,
      });
      if (validationError) throw new ErreurPublique(403, validationError.message);
      const selectedResponsibilities = capacites.filter(({ allowed }) => allowed).map(({ code }) => ({
        user_id: utilisateurCree,
        responsibility_code: code,
        granted_by: acteur.id,
        reason: 'Attribution lors de la création sécurisée du compte',
      }));
      if (selectedResponsibilities.length > 0) {
        const { error: responsibilitiesError } = await admin
          .from('snp_user_responsibilities')
          .insert(selectedResponsibilities);
        if (responsibilitiesError) throw new Error(`responsabilités: ${responsibilitiesError.message}`);
      }
    }

    if (role === 'owner') {
      const { error: ownerError } = await clientActeur.rpc('snp_configurer_acces_compte', {
        p_user_id: utilisateurCree, p_full_name: nomComplet, p_phone: telephone,
        p_role: 'owner', p_is_active: actif, p_mining_company_id: null,
        p_organization_id: organisationId, p_collector_id: null,
        p_responsibilities: {}, p_permissions: [],
      });
      if (ownerError) throw new ErreurPublique(403, 'La création du compte Owner n’a pas été autorisée par le serveur.');
    } else if (permissions.length > 0) {
      // L'Edge Function possède la clé de service, mais ne contourne jamais le
      // plafond du rôle : la même RPC autoritative gouverne création et édition.
      const { error: erreurPermissions } = await clientActeur.rpc('snp_remplacer_habilitations_compte', {
        p_user_id: utilisateurCree,
        p_habilitations: permissions,
      });
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
    let retourArriereIncomplet = false;
    if (utilisateurCree) {
      try {
        await annulerCreation(admin, utilisateurCree);
      } catch (raison) {
        retourArriereIncomplet = true;
        console.error('[create-user] Retour arrière incomplet.', raison);
      }
    }
    if (organisationCreee) {
      try {
        const { error: erreurSuppressionOrganisation } = await admin
          .from('snp_organizations')
          .delete()
          .eq('id', organisationCreee);
        if (erreurSuppressionOrganisation) throw erreurSuppressionOrganisation;
      } catch (raison) {
        retourArriereIncomplet = true;
        console.error('[create-user] Nettoyage du comptoir incomplet.', raison);
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
