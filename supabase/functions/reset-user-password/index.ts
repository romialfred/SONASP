import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ResetPasswordRequest {
  user_id: string;
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
      throw new Error('Only management users can reset passwords');
    }

    const requestData: ResetPasswordRequest = await req.json();
    const { user_id } = requestData;

    if (!user_id) {
      throw new Error('Missing required field: user_id');
    }

    // Get user details
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .single();

    if (userDataError || !userData) {
      throw new Error('User not found');
    }

    // Generate random temporary password
    const generateRandomPassword = () => {
      const length = 12;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pwd = '';
      for (let i = 0; i < length; i++) {
        pwd += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return pwd;
    };

    const temporaryPassword = generateRandomPassword();

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: temporaryPassword,
      email_confirm: false, // User must confirm via reset flow
    });

    if (updateError) {
      throw updateError;
    }

    // Generate password reset token
    const { data: tokenData, error: tokenError } = await supabaseAdmin.rpc(
      'generate_activation_token',
      {
        p_user_id: user_id,
        p_token_type: 'password_reset',
        p_temporary_password: temporaryPassword,
        p_created_by: currentUser.id,
      }
    );

    if (tokenError) {
      console.error('Error generating reset token:', tokenError);
      throw new Error('Failed to generate reset token');
    }

    const resetToken = tokenData;

    // Send password reset email
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
            user_id: user_id,
            email: userData.email,
            full_name: userData.full_name,
            token: resetToken,
            temporary_password: temporaryPassword,
            token_type: 'password_reset',
          }),
        }
      );

      const emailResult = await emailResponse.json();

      if (!emailResult.success) {
        console.error('Failed to send reset email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending reset email:', emailError);
    }

    // Log the password reset action
    await supabaseAdmin.from('audit_trail').insert({
      user_id: user_id,
      action: 'password_reset_by_admin',
      details: {
        reset_by: currentUser.id,
        reset_by_email: currentUser.email,
      },
      performed_by: currentUser.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully. User will receive an email with instructions.',
        reset_token: resetToken,
        temporary_password: temporaryPassword,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error resetting password:', error);
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
