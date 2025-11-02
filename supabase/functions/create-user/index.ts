import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ModulePermission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  field_permissions?: Array<{
    field_name: string;
    can_view: boolean;
    can_edit: boolean;
  }>;
}

interface CreateUserRequest {
  email: string;
  password?: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active?: boolean;
  permissions?: Record<string, ModulePermission>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !currentUser) {
      console.error('[create-user] Auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[create-user] Current user:', currentUser.id);

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profileError) {
      console.error('[create-user] Error fetching user profile:', profileError);
      throw new Error('Unable to verify user permissions');
    }

    console.log('[create-user] User profile:', profile);

    if (!profile || profile.role !== 'management') {
      console.warn('[create-user] Unauthorized user attempt:', { userId: currentUser.id, role: profile?.role });
      throw new Error('Only management users can create accounts');
    }

    const requestData: CreateUserRequest = await req.json();
    const { email, password, full_name, phone, role, is_active, permissions } = requestData;

    console.log('[create-user] Request received:', {
      email,
      full_name,
      role,
      hasPhone: !!phone,
      hasPassword: !!password,
      isActive: is_active,
      hasPermissions: !!permissions,
    });

    if (!email || !full_name || !role) {
      console.error('[create-user] Missing required fields:', { email: !!email, full_name: !!full_name, role: !!role });
      throw new Error('Missing required fields: email, full_name, and role are required');
    }

    const generateRandomPassword = () => {
      const length = 12;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pwd = '';
      for (let i = 0; i < length; i++) {
        pwd += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return pwd;
    };

    const userPassword = password || generateRandomPassword();

    console.log('[create-user] Creating auth user...');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: userPassword,
      email_confirm: true, // Auto-confirm email for now
      user_metadata: {
        full_name: full_name,
        phone: phone || '',
      },
      app_metadata: {
        role: role,
      },
    });

    if (authError) {
      console.error('[create-user] Auth creation error:', authError);
      throw authError;
    }

    if (!authData.user) {
      console.error('[create-user] No user returned from auth.admin.createUser');
      throw new Error('User creation failed');
    }

    console.log('[create-user] Auth user created:', authData.user.id);

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        phone: phone || null,
        role: role,
        is_active: is_active !== undefined ? is_active : true, // Default to active
        two_factor_enabled: false,
      });

    if (profileError) {
      console.error('[create-user] Profile creation error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log('[create-user] User profile created');

    // Save user permissions if provided
    if (permissions && Object.keys(permissions).length > 0) {
      console.log('[create-user] Saving permissions...');

      const { data: modules, error: modulesError } = await supabaseAdmin
        .from('modules')
        .select('id, name')
        .in('name', Object.keys(permissions));

      if (modulesError) {
        console.error('[create-user] Error fetching modules:', modulesError);
      } else if (modules && modules.length > 0) {
        const permissionsToInsert = modules.map((module) => {
          const perm = permissions[module.name];
          return {
            user_id: authData.user.id,
            module_id: module.id,
            can_read: perm.can_view || false,
            can_write: perm.can_edit || false,
            can_delete: perm.can_delete || false,
            field_permissions: perm.field_permissions
              ? JSON.stringify(
                  Object.fromEntries(
                    perm.field_permissions.map((fp) => [
                      fp.field_name,
                      { can_view: fp.can_view, can_edit: fp.can_edit }
                    ])
                  )
                )
              : '{}',
            granted_by: currentUser.id,
          };
        });

        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permError) {
          console.error('[create-user] Error saving permissions:', permError);
        } else {
          console.log('[create-user] Permissions saved successfully');
        }
      }
    }

    // Try to generate activation token (may not exist if migration not applied)
    let activationToken = null;
    let hasActivationSystem = false;

    try {
      console.log('[create-user] Attempting to generate activation token...');

      const { data: tokenData, error: tokenError } = await supabaseAdmin.rpc(
        'generate_activation_token',
        {
          p_user_id: authData.user.id,
          p_token_type: 'activation',
          p_temporary_password: userPassword,
          p_created_by: currentUser.id,
        }
      );

      if (tokenError) {
        console.warn('[create-user] Activation token generation error:', tokenError.message, tokenError.code);
        // If function doesn't exist, user is already active
        if (tokenError.message?.includes('function') || tokenError.code === '42883' || tokenError.code === 'PGRST202') {
          console.log('[create-user] Activation system not available - user already activated');
        } else {
          // Other errors should not fail user creation
          console.error('[create-user] Unexpected token generation error:', tokenError);
        }
      } else {
        activationToken = tokenData;
        hasActivationSystem = true;
        console.log('[create-user] Activation token generated successfully');
      }
    } catch (error: any) {
      console.warn('[create-user] Activation system error (caught):', error.message);
      // Continue without activation system
    }

    // Send activation email only if activation system is available
    if (hasActivationSystem && activationToken) {
      try {
        console.log('[create-user] Sending activation email...');

        const emailResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-activation-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              user_id: authData.user.id,
              email: email,
              full_name: full_name,
              token: activationToken,
              temporary_password: userPassword,
              token_type: 'activation',
            }),
          }
        );

        const emailResult = await emailResponse.json();

        if (!emailResult.success) {
          console.error('[create-user] Failed to send activation email:', emailResult.error);
        } else {
          console.log('[create-user] Activation email sent successfully');
        }
      } catch (emailError: any) {
        console.error('[create-user] Error sending activation email:', emailError.message);
      }
    }

    console.log('[create-user] User creation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: email,
          full_name: full_name,
          role: role,
        },
        activation_token: activationToken,
        temporary_password: userPassword,
        message: hasActivationSystem
          ? 'User created successfully. Activation email sent.'
          : 'User created successfully and activated immediately.',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('[create-user] Error creating user:', error);
    console.error('[create-user] Error stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
        details: error.stack || '',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
