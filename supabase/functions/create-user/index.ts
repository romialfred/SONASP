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
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (!profile || profile.role !== 'management') {
      throw new Error('Only management users can create accounts');
    }

    const requestData: CreateUserRequest = await req.json();
    const { email, password, full_name, phone, role, is_active, permissions } = requestData;

    if (!email || !full_name || !role) {
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

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: userPassword,
      email_confirm: false, // User must activate account first
      user_metadata: {
        full_name: full_name,
        phone: phone || '',
      },
      app_metadata: {
        role: role,
      },
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('User creation failed');
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        phone: phone || null,
        role: role,
        is_active: false, // Will be activated after completing activation workflow
        two_factor_enabled: false,
        account_activated: false,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Save user permissions if provided
    if (permissions && Object.keys(permissions).length > 0) {
      // Get module IDs for the provided module names
      const { data: modules, error: modulesError } = await supabaseAdmin
        .from('modules')
        .select('id, name')
        .in('name', Object.keys(permissions));

      if (modulesError) {
        console.error('Error fetching modules:', modulesError);
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
          console.error('Error saving permissions:', permError);
        }
      }
    }

    // Generate activation token
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
      console.error('Error generating activation token:', tokenError);
      throw new Error('Failed to generate activation token');
    }

    const activationToken = tokenData;

    // Send activation email
    try {
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
        console.error('Failed to send activation email:', emailResult.error);
        // Don't fail user creation if email fails - admin can resend
      }
    } catch (emailError) {
      console.error('Error sending activation email:', emailError);
      // Continue even if email fails
    }

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
        message: 'User created successfully. Activation email sent.',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
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