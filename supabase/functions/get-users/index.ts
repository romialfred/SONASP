import { createClient } from 'npm:@supabase/supabase-js@2';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import {
  ACCOUNT_MANAGEMENT_CAPABILITY,
  canManageAccountTarget,
} from '../_shared/account-role-policy.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return reponseJson(req, { success: false, error: 'Le service des comptes est indisponible.' }, 503);
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return reponseJson(req, { success: false, error: 'Votre session a expiré. Reconnectez-vous.' }, 401);
    }

    // Vérifie la session avant toute lecture avec la clé de service.
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return reponseJson(req, { success: false, error: 'Votre session n’est plus valide. Reconnectez-vous.' }, 401);
    }

    const supabaseActeur = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Le profil doit être actif, interne et protégé par AAL2.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', user.id)
      .single();

    // Le rôle faisant autorité est celui du profil en base. Une app_metadata
    // historique ou modifiée ne peut jamais promouvoir un compte en Owner.
    const roleEffectif = String(profile?.role ?? '').toLowerCase();
    const habilite = profile?.is_active
      && profile?.mining_company_id === null
      && Boolean(profile?.mfa_enrolled_at)
      && niveauAssurance(token) === 'aal2';
    if (profileError || !habilite) {
      return reponseJson(req, { success: false, error: 'Vous ne disposez pas du droit de consulter les comptes.' }, 403);
    }

    const { data: possedeCapacite, error: erreurCapacite } = await supabaseActeur
      .rpc('snp_actor_has_capability', { p_capability_code: ACCOUNT_MANAGEMENT_CAPABILITY });
    if (erreurCapacite) {
      console.error('[get-users] Capacité indisponible.', erreurCapacite.message);
      return reponseJson(req, { success: false, error: 'La vérification de vos habilitations est indisponible.' }, 503);
    }
    if (possedeCapacite !== true) {
      return reponseJson(req, { success: false, error: 'Vous ne disposez pas du droit de consulter les comptes.' }, 403);
    }

    // Fetch all users using service role (bypasses RLS)
    const { data: users, error: usersError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching users from database:', usersError);
      throw usersError;
    }

    // Le profil Comptoir réutilise volontairement le rôle partenaire `customer`.
    // Le rattachement d'organisation est l'autorité qui permet à l'interface
    // d'afficher le libellé métier sans ajouter un rôle de base divergent.
    // La clé de service voit tous les profils. On ne restitue que les cibles que
    // l'acteur peut réellement administrer selon la hiérarchie canonique.
    const comptesAdministrables = (users || []).filter((compte) => canManageAccountTarget({
      actorId: user.id,
      actorRole: roleEffectif,
      targetId: compte.id,
      targetRole: String(compte.role),
    }));
    const identifiants = comptesAdministrables.map((compte) => compte.id);
    const rattachementParUtilisateur = new Map<string, { id: string; code: string; name: string }>();
    if (identifiants.length > 0) {
      const { data: rattachements, error: erreurRattachements } = await supabaseAdmin
        .from('snp_user_organization_memberships')
        .select('user_id, organization_id')
        .in('user_id', identifiants)
        .eq('is_primary', true)
        .is('valid_until', null);

      if (erreurRattachements) {
        console.warn('[get-users] Rattachements d’organisation indisponibles.', erreurRattachements.message);
      } else {
        const organisationsIds = [...new Set((rattachements || []).map((ligne) => ligne.organization_id))];
        if (organisationsIds.length > 0) {
          const { data: organisations, error: erreurOrganisations } = await supabaseAdmin
            .from('snp_organizations')
            .select('id, code, name')
            .in('id', organisationsIds)
            .eq('organization_type', 'comptoir')
            .eq('is_active', true);
          if (erreurOrganisations) {
            console.warn('[get-users] Comptoirs indisponibles.', erreurOrganisations.message);
          } else {
            const organisationsParId = new Map(
              (organisations || []).map((organisation) => [organisation.id, organisation] as const),
            );
            (rattachements || []).forEach((rattachement) => {
              const organisation = organisationsParId.get(rattachement.organization_id);
              if (organisation) rattachementParUtilisateur.set(rattachement.user_id, organisation);
            });
          }
        }
      }
    }

    console.log('Successfully fetched manageable users:', comptesAdministrables.length);

    // Ensure we return valid user data
    const validUsers = comptesAdministrables.map(user => {
      const comptoir = rattachementParUtilisateur.get(user.id) ?? null;
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        account_type: comptoir ? 'comptoir' : null,
        organization: comptoir,
        mining_company_id: user.mining_company_id ?? null,
        is_active: user.is_active !== false,
        two_factor_enabled: Boolean(user.mfa_enrolled_at),
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    });

    return reponseJson(req, { success: true, users: validUsers, count: validUsers.length });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return reponseJson(req, { success: false, error: 'La liste des comptes n’a pas pu être chargée.' }, 500);
  }
});
