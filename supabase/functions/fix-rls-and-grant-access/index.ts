import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('Starting RLS fix and access grant...');

    // Step 1: Drop existing policies
    const dropPolicies = `
      DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
      DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
      DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;
      DROP POLICY IF EXISTS "user_profiles_service_role_all" ON user_profiles;
      DROP POLICY IF EXISTS "user_profiles_service_role" ON user_profiles;
    `;

    const { error: dropError } = await supabase.rpc('exec_sql', { sql: dropPolicies });
    if (dropError) {
      console.error('Error dropping policies:', dropError);
      // Continue anyway, policies might not exist
    }

    // Step 2: Create new simple policies
    const createPolicies = `
      CREATE POLICY "user_profiles_select_own"
        ON user_profiles FOR SELECT TO authenticated
        USING (id = auth.uid());

      CREATE POLICY "user_profiles_update_own"
        ON user_profiles FOR UPDATE TO authenticated
        USING (id = auth.uid())
        WITH CHECK (id = auth.uid());

      CREATE POLICY "user_profiles_service_role"
        ON user_profiles FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createPolicies });
    if (createError) {
      console.error('Error creating policies:', createError);
    }

    // Step 3: Update user role to management
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .update({
        role: 'management',
        is_active: true,
      })
      .eq('email', 'romuald.tiegnan@gmail.com')
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to update user: ${userError.message}`);
    }

    if (!userData) {
      throw new Error('User not found: romuald.tiegnan@gmail.com');
    }

    console.log('Updated user to management role:', userData.id);

    // Step 4: Get all modules
    const { data: modules, error: modulesError } = await supabase
      .from('modules')
      .select('id, name')
      .eq('is_active', true);

    if (modulesError) {
      throw new Error(`Failed to fetch modules: ${modulesError.message}`);
    }

    console.log(`Found ${modules?.length || 0} active modules`);

    // Step 5: Delete existing permissions
    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userData.id);

    if (deleteError) {
      console.error('Error deleting old permissions:', deleteError);
    }

    // Step 6: Grant full permissions to all modules
    const permissions = modules?.map(module => ({
      user_id: userData.id,
      module_id: module.id,
      can_read: true,
      can_write: true,
      can_delete: true,
      can_approve: true,
      field_permissions: {},
    })) || [];

    if (permissions.length > 0) {
      const { error: permError } = await supabase
        .from('user_permissions')
        .insert(permissions);

      if (permError) {
        throw new Error(`Failed to insert permissions: ${permError.message}`);
      }
    }

    console.log(`Granted full access to ${permissions.length} modules`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully granted full access to ${permissions.length} modules`,
        user: {
          id: userData.id,
          email: userData.email,
          role: userData.role,
        },
        modules: modules?.length || 0,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
