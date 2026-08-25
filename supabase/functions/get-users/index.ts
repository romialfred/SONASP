import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { reponseJson } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import {
  creerHandlerAdministration,
  verifierSessionAdministration,
} from '../_shared/admin-account-edge.ts';
import {
  canManageAccountTarget,
} from '../_shared/account-role-policy.ts';

Deno.serve(creerHandlerAdministration({
  methods: ['GET', 'POST'],
  unexpectedError: 'La liste des comptes n’a pas pu être chargée.',
  execute: async (req: Request, { token, authorization: authHeader }) => {
    try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return reponseJson(req, { success: false, error: 'Le service des comptes est indisponible.' }, 503);
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return reponseJson(req, { success: false, error: 'Votre session n’est plus valide. Reconnectez-vous.' }, 401);
    }

    const supabaseActeur = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const garde = await verifierSessionAdministration(supabaseActeur);
    if (!garde.ok) {
      const message = garde.status === 503
        ? 'La vérification de vos habilitations est indisponible.'
        : 'Votre session administrative n’est plus autorisée.';
      return reponseJson(req, { success: false, error: message }, garde.status);
    }

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
      && ['owner', 'admin'].includes(roleEffectif)
      && profile?.mining_company_id === null
      && Boolean(profile?.mfa_enrolled_at)
      && niveauAssurance(token) === 'aal2';
    if (profileError || !habilite) {
      return reponseJson(req, { success: false, error: 'Vous ne disposez pas du droit de consulter les comptes.' }, 403);
    }

    // Fetch all users using service role (bypasses RLS)
    const { data: users, error: usersError } = await supabaseAdmin
      .from('user_profiles')
      .select('id,email,full_name,phone,role,mining_company_id,is_active,mfa_enrolled_at,last_login_at,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('[get-users] Source profils indisponible.');
      throw usersError;
    }

    // Le profil Comptoir réutilise volontairement le rôle partenaire `customer`.
    // Le rattachement d'organisation est l'autorité qui permet à l'interface
    // d'afficher le libellé métier sans ajouter un rôle de base divergent.
    // La clé de service voit tous les profils. On ne restitue que les cibles que
    // l'acteur peut réellement administrer selon la hiérarchie canonique.
    const comptesAdministrables = (users || []).filter((compte) =>
      compte.id === user.id || canManageAccountTarget({
        actorId: user.id,
        actorRole: roleEffectif,
        targetId: compte.id,
        targetRole: String(compte.role),
      })
    );
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
        console.warn('[get-users] Rattachements d’organisation indisponibles.');
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
            console.warn('[get-users] Comptoirs indisponibles.');
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
        is_active: user.is_active === true,
        two_factor_enabled: Boolean(user.mfa_enrolled_at),
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    });

    return reponseJson(req, { success: true, users: validUsers, count: validUsers.length });
    } catch {
      console.error('[get-users] Échec de lecture sans détail utilisateur.');
      return reponseJson(req, { success: false, error: 'La liste des comptes n’a pas pu être chargée.' }, 500);
    }
  },
}));
