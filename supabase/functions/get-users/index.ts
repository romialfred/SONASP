import { createClient } from 'npm:@supabase/supabase-js@2';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return reponseJson(req, { success: false, error: 'Votre session a expiré. Reconnectez-vous.' }, 401);
    }

    // Verify user has management role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return reponseJson(req, { success: false, error: 'Votre session n’est plus valide. Reconnectez-vous.' }, 401);
    }

    // Check if user has management role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', user.id)
      .single();

    // Le rôle faisant autorité est celui du profil en base. Une app_metadata
    // historique ou modifiée ne peut jamais promouvoir un compte en Owner.
    const roleEffectif = String(profile?.role ?? '').toLowerCase();
    const habilite = profile?.is_active
      && ['owner', 'admin', 'management'].includes(roleEffectif)
      && profile?.mining_company_id === null
      && Boolean(profile?.mfa_enrolled_at)
      && niveauAssurance(token) === 'aal2';
    if (profileError || !habilite) {
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

    console.log('Successfully fetched users:', users?.length || 0);

    // Ensure we return valid user data
    const validUsers = (users || []).map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      mining_company_id: user.mining_company_id ?? null,
      is_active: user.is_active !== false,
      two_factor_enabled: Boolean(user.mfa_enrolled_at),
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return reponseJson(req, { success: true, users: validUsers, count: validUsers.length });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return reponseJson(req, { success: false, error: 'La liste des comptes n’a pas pu être chargée.' }, 500);
  }
});
