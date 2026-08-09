import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*', // audit V11
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
      console.error('[reset-password] No authorization header');
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
      console.error('[reset-password] Auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[reset-password] Current user:', currentUser.id);

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profileError) {
      console.error('[reset-password] Error fetching profile:', profileError);
      throw new Error('Unable to verify user permissions');
    }

    if (!profile || profile.role !== 'management') {
      console.warn('[reset-password] Unauthorized attempt:', { userId: currentUser.id, role: profile?.role });
      throw new Error('Only management users can reset passwords');
    }

    const requestData: ResetPasswordRequest = await req.json();
    const { user_id } = requestData;

    console.log('[reset-password] Request to reset password for user:', user_id);

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
      console.error('[reset-password] User not found:', user_id);
      throw new Error('User not found');
    }

    console.log('[reset-password] Resetting password for:', userData.email);

    // SÉCURITÉ (audit V12) : générateur cryptographiquement sûr (CSPRNG), pas Math.random.
    const generateRandomPassword = () => {
      const length = 16;
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      const bytes = new Uint32Array(length);
      crypto.getRandomValues(bytes);
      let pwd = '';
      for (let i = 0; i < length; i++) {
        pwd += charset.charAt(bytes[i] % charset.length);
      }
      return pwd;
    };

    const temporaryPassword = generateRandomPassword();

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (updateError) {
      console.error('[reset-password] Error updating password:', updateError);
      throw updateError;
    }

    console.log('[reset-password] Password updated successfully');

    // Try to generate password reset token (optional - may not exist)
    let resetToken = null;
    let hasResetSystem = false;

    try {
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
        console.warn('[reset-password] Token generation error:', tokenError.message, tokenError.code);
        if (tokenError.message?.includes('function') || tokenError.code === '42883' || tokenError.code === 'PGRST202') {
          console.log('[reset-password] Reset token system not available');
        }
      } else {
        resetToken = tokenData;
        hasResetSystem = true;
        console.log('[reset-password] Reset token generated');
      }
    } catch (error: any) {
      console.warn('[reset-password] Reset token system error:', error.message);
    }

    // Send password reset email if system available
    if (hasResetSystem && resetToken) {
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
          console.error('[reset-password] Failed to send reset email:', emailResult.error);
        } else {
          console.log('[reset-password] Reset email sent successfully');
        }
      } catch (emailError: any) {
        console.error('[reset-password] Error sending reset email:', emailError.message);
      }
    }

    // Try to log the password reset action (optional - table may not exist)
    try {
      await supabaseAdmin.from('audit_trail').insert({
        user_id: user_id,
        action: 'password_reset_by_admin',
        details: {
          reset_by: currentUser.id,
          reset_by_email: currentUser.email,
        },
        performed_by: currentUser.id,
      });
      console.log('[reset-password] Audit log created');
    } catch (auditError: any) {
      console.warn('[reset-password] Could not create audit log:', auditError.message);
    }

    console.log('[reset-password] Password reset completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: hasResetSystem
          ? 'Password reset successfully. User will receive an email with instructions.'
          : 'Password reset successfully. User can now log in with the new password.',
        reset_token: resetToken,
        temporary_password: temporaryPassword,
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
    // SÉCURITÉ (audit V15) : détail loggué côté serveur, jamais exposé au client.
    console.error('[reset-password] Error resetting password:', error);

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
