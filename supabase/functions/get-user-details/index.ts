import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import {
  canManageAccountTarget,
} from '../_shared/account-role-policy.ts';
import { reponseJson } from '../_shared/cors.ts';
import {
  creerHandlerAdministration,
  lireJsonLimite,
  verifierSessionAdministration,
} from '../_shared/admin-account-edge.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENEMENTS_CONNEXION = [
  'login_success',
  'login_profile_unavailable',
  'login_denied_inactive_account',
  'logout',
];

class ErreurPublique extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

type ResultatLecture<T> = { data: T | null; error: { message?: string } | null };

function texte(valeur: unknown, longueur = 120): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, longueur) : '';
}

function nombreDansPeriode(lignes: Array<{ created_at?: string | null }>, depuis: number): number {
  return lignes.filter((ligne) => {
    const instant = new Date(ligne.created_at ?? '').getTime();
    return Number.isFinite(instant) && instant >= depuis;
  }).length;
}

function objetJson(valeur: unknown): Record<string, unknown> | null {
  if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) {
    return valeur as Record<string, unknown>;
  }
  if (typeof valeur !== 'string') return null;
  try {
    const resultat = JSON.parse(valeur) as unknown;
    return resultat && typeof resultat === 'object' && !Array.isArray(resultat)
      ? resultat as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

Deno.serve(creerHandlerAdministration({
  methods: ['GET', 'POST'],
  unexpectedError: 'La fiche du compte n’a pas pu être chargée.',
  execute: async (req: Request, { token: jeton, authorization: autorisation }) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !cleService || !cleAnonyme) {
    return reponseJson(req, { success: false, error: 'Le service des comptes est indisponible.' }, 503);
  }

  const admin = createClient(supabaseUrl, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: donneesAuth, error: erreurAuth } = await admin.auth.getUser(jeton);
    const acteur = donneesAuth.user;
    if (erreurAuth || !acteur) {
      throw new ErreurPublique(401, 'Votre session n’est plus valide. Reconnectez-vous.');
    }

    const supabaseActeur = createClient(supabaseUrl, cleAnonyme, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: autorisation } },
    });
    const garde = await verifierSessionAdministration(supabaseActeur);
    if (!garde.ok) {
      throw new ErreurPublique(
        garde.status,
        garde.status === 503
          ? 'La vérification de vos habilitations est indisponible.'
          : 'Votre session administrative n’est plus autorisée.',
      );
    }
    const { data: profilActeur, error: erreurProfilActeur } = await admin
      .from('user_profiles')
      .select('id, role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', acteur.id)
      .maybeSingle();
    const roleActeur = texte(profilActeur?.role, 40).toLowerCase();
    const acteurValide = !erreurProfilActeur
      && profilActeur?.is_active === true
      && ['owner', 'admin'].includes(roleActeur)
      && profilActeur.mining_company_id === null
      && Boolean(profilActeur.mfa_enrolled_at)
      && niveauAssurance(jeton) === 'aal2';
    if (!acteurValide) {
      throw new ErreurPublique(403, 'Vous ne disposez pas du droit de consulter ce compte.');
    }

    const url = new URL(req.url);
    const corps = req.method === 'POST' ? await lireJsonLimite(req) : {};
    if (!corps) throw new ErreurPublique(400, 'La demande de consultation est invalide.');
    const utilisateurId = texte(corps.user_id ?? url.searchParams.get('user_id'), 64);
    if (!UUID.test(utilisateurId)) throw new ErreurPublique(400, 'Le compte demandé est invalide.');

    const { data: cible, error: erreurCible } = await admin
      .from('user_profiles')
      .select([
        'id', 'email', 'full_name', 'phone', 'role', 'job_title', 'department',
        'is_active', 'account_locked', 'account_locked_until', 'failed_login_attempts',
        'two_factor_enabled', 'mfa_enrolled_at', 'last_login_at',
        'last_activity_at', 'created_at', 'updated_at', 'activation_completed_at',
        'must_change_password', 'password_changed_at', 'timezone',
        'language_preference', 'language', 'mining_company_id',
      ].join(','))
      .eq('id', utilisateurId)
      .maybeSingle();
    if (erreurCible) throw erreurCible;
    if (!cible) throw new ErreurPublique(404, 'Ce compte est introuvable ou a été supprimé.');

    const lecturePropreCompte = acteur.id === cible.id;
    if (!lecturePropreCompte && !canManageAccountTarget({
      actorId: acteur.id,
      actorRole: roleActeur,
      targetId: cible.id,
      targetRole: texte(cible.role, 40),
    })) {
      throw new ErreurPublique(403, 'Vous ne disposez pas du droit de consulter ce compte.');
    }

    const lectures = await Promise.all([
      admin
        .from('security_events')
        .select('id, event_type, created_at')
        .eq('user_id', utilisateurId)
        .in('event_type', EVENEMENTS_CONNEXION)
        .order('created_at', { ascending: false })
        .limit(200),
      admin
        .from('security_events')
        .select('id, event_type, created_at')
        .eq('event_type', 'login_failed')
        .contains('details', { email: cible.email })
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('user_activity_logs')
        .select('id, action_type, module_name, resource_type, resource_id, status, created_at')
        .eq('user_id', utilisateurId)
        .order('created_at', { ascending: false })
        .limit(200),
      admin
        .from('audit_logs')
        .select('id, action, module, status, created_at')
        .eq('user_id', utilisateurId)
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('user_permissions')
        .select('id, module_id, can_view, can_read, can_create, can_write, can_edit, can_delete, can_approve, granted_at, modules:module_id(id, name, display_name, category)')
        .eq('user_id', utilisateurId)
        .order('granted_at', { ascending: false }),
      admin
        .from('user_site_assignments')
        .select('id, site_id, is_primary, assigned_at, sites:site_id(id, name, location, site_type, mining_company_id)')
        .eq('user_id', utilisateurId)
        .order('assigned_at', { ascending: false }),
      admin
        .from('snp_comptes_audit')
        .select('uid, action, ancien_etat, nouvel_etat, motif, cree_le, acteur_id')
        .eq('cible_id', utilisateurId)
        .order('cree_le', { ascending: false })
        .limit(100),
      admin
        .from('audit_logs')
        .select('id, action, details, created_at, user_id')
        .eq('module', 'administration_utilisateurs')
        .in('action', ['activation_compte', 'reactivation_compte', 'desactivation_compte'])
        .order('created_at', { ascending: false })
        .limit(500),
    ]) as Array<ResultatLecture<Record<string, unknown>[]>>;

    const nomsSources = [
      'journal des connexions',
      'tentatives de connexion refusées',
      'journal d’activité',
      'journal d’audit',
      'permissions individuelles',
      'accès aux sites',
      'historique du statut',
      'historique administratif de secours',
    ];
    const sourcesIndisponibles: string[] = [];
    lectures.forEach((resultat, index) => {
      if (resultat.error) {
        sourcesIndisponibles.push(nomsSources[index]);
        console.warn('[get-user-details] Source indisponible.', {
          source: nomsSources[index],
        });
      }
    });

    const connexionsAssociees = lectures[0].error ? [] : (lectures[0].data ?? []);
    const echecsParCourriel = lectures[1].error ? [] : (lectures[1].data ?? []);
    const connexions = [...connexionsAssociees, ...echecsParCourriel]
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      .slice(0, 250);
    const activitesMetier = lectures[2].error ? [] : (lectures[2].data ?? []);
    const audits = lectures[3].error ? [] : (lectures[3].data ?? []);
    const permissions = lectures[4].error ? [] : (lectures[4].data ?? []);
    const sites = lectures[5].error ? [] : (lectures[5].data ?? []);
    const changementsCanoniques = lectures[6].error ? [] : (lectures[6].data ?? []);
    const changementsSecours = (lectures[7].error ? [] : (lectures[7].data ?? []))
      .map((ligne) => ({ ligne, details: objetJson(ligne.details) }))
      .filter(({ details }) => String(details?.cible_id ?? '') === utilisateurId)
      .map(({ ligne, details }) => ({
        uid: String(ligne.id),
        action: String(ligne.action),
        ancien_etat: Boolean(details?.ancien_etat),
        nouvel_etat: Boolean(details?.nouvel_etat),
        motif: String(details?.motif ?? ''),
        cree_le: String(ligne.created_at ?? ''),
        acteur_id: String(ligne.user_id ?? ''),
      }));
    const changementsParDecision = new Map<string, Record<string, unknown>>();
    [...changementsCanoniques, ...changementsSecours].forEach((changement) => {
      const cle = [
        String(changement.nouvel_etat),
        String(changement.motif ?? ''),
        String(changement.cree_le ?? '').slice(0, 16),
      ].join('|');
      if (!changementsParDecision.has(cle)) changementsParDecision.set(cle, changement);
    });
    const changementsCompte = [...changementsParDecision.values()]
      .sort((a, b) => String(b.cree_le ?? '').localeCompare(String(a.cree_le ?? '')));

    let compagnie: Record<string, unknown> | null = null;
    if (cible.mining_company_id) {
      const { data, error } = await admin
        .from('mining_companies')
        .select('id, name, abbreviation, is_active')
        .eq('id', cible.mining_company_id)
        .maybeSingle();
      if (error) sourcesIndisponibles.push('société minière');
      else compagnie = data;
    }

    const maintenant = Date.now();
    const depuis30Jours = maintenant - (30 * 24 * 60 * 60 * 1000);
    const connexionsReussies = connexions.filter((ligne) => ligne.event_type === 'login_success');
    const connexionsRefusees = connexions.filter((ligne) =>
      ligne.event_type === 'login_failed'
      || ligne.event_type === 'login_profile_unavailable'
      || ligne.event_type === 'login_denied_inactive_account'
    );
    const activitesNormalisees = [
      ...activitesMetier.map((ligne) => ({ ...ligne, source: 'activity' })),
      ...audits.map((ligne) => ({
        id: ligne.id,
        action_type: ligne.action,
        module_name: ligne.module,
        resource_type: 'audit',
        resource_id: null,
        description: null,
        status: ligne.status,
        error_message: null,
        ip_address: null,
        user_agent: null,
        created_at: ligne.created_at,
        source: 'audit',
      })),
    ].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).slice(0, 250);

    return reponseJson(req, {
      success: true,
      profile: {
        ...cible,
        two_factor_enabled: Boolean(cible.mfa_enrolled_at || cible.two_factor_enabled),
        mining_company: compagnie,
      },
      statistics: {
        connection_events: connexionsReussies.length,
        connection_events_30d: nombreDansPeriode(connexionsReussies, depuis30Jours),
        rejected_connections: connexionsRefusees.length,
        activity_events: activitesNormalisees.length,
        activity_events_30d: nombreDansPeriode(activitesNormalisees, depuis30Jours),
        permissions_count: permissions.length,
        sites_count: sites.length,
      },
      connections: connexions,
      activities: activitesNormalisees,
      permissions,
      sites,
      account_changes: changementsCompte,
      sources_unavailable: [...new Set(sourcesIndisponibles)],
    });
  } catch (erreur) {
    if (erreur instanceof ErreurPublique) {
      return reponseJson(req, { success: false, error: erreur.message }, erreur.statut);
    }
    console.error('[get-user-details] Échec inattendu sans détail utilisateur.');
    return reponseJson(req, { success: false, error: 'La fiche du compte n’a pas pu être chargée.' }, 500);
  }
  },
}));
