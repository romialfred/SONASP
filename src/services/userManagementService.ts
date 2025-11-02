import { supabase } from '@/lib/supabase';

export interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  password?: string;
  is_active?: boolean;
  permissions?: Record<string, any>;
}

export interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  activation_token?: string;
  temporary_password?: string;
  message?: string;
  error?: string;
}

/**
 * Create a new user via Edge Function
 */
export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    console.log('[userManagementService] Creating user:', { email: data.email, role: data.role });

    const response = await fetch(
      `${supabaseUrl}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[userManagementService] Error response:', result);
      throw new Error(result.error || 'Failed to create user');
    }

    console.log('[userManagementService] User created successfully:', result);
    return result;
  } catch (error: any) {
    console.error('[userManagementService] Error creating user:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Reset user password via Edge Function
 */
export async function resetUserPassword(userId: string): Promise<CreateUserResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    console.log('[userManagementService] Resetting password for user:', userId);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/reset-user-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[userManagementService] Error response:', result);
      throw new Error(result.error || 'Failed to reset password');
    }

    console.log('[userManagementService] Password reset successfully:', result);
    return result;
  } catch (error: any) {
    console.error('[userManagementService] Error resetting password:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Check if user activation system is available
 */
export async function checkActivationSystemAvailable(): Promise<boolean> {
  try {
    // Check if the activation token function exists
    const { data, error } = await supabase.rpc('validate_activation_token', {
      p_token: 'test_token',
    });

    // If no error (function exists), return true
    // Even if the token is invalid, the function exists
    return !error || !error.message.includes('function');
  } catch (error) {
    console.warn('[userManagementService] Activation system not available:', error);
    return false;
  }
}

/**
 * Fallback: Create user without activation system (direct creation)
 */
export async function createUserDirect(data: CreateUserRequest): Promise<CreateUserResponse> {
  try {
    console.log('[userManagementService] Creating user directly (fallback mode)');

    // Generate password if not provided
    const password = data.password || generateRandomPassword();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: password,
      options: {
        data: {
          full_name: data.full_name,
          phone: data.phone || '',
        },
      },
    });

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error('User creation failed');
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.role,
        is_active: data.is_active !== undefined ? data.is_active : true,
        two_factor_enabled: false,
      });

    if (profileError) throw profileError;

    return {
      success: true,
      user: {
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
      },
      temporary_password: password,
      message: 'User created successfully (direct mode)',
    };
  } catch (error: any) {
    console.error('[userManagementService] Error in direct creation:', error);
    return {
      success: false,
      error: error.message || 'Failed to create user',
    };
  }
}

/**
 * Generate random password
 */
function generateRandomPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}
