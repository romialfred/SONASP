export type UserRole = 'factory' | 'airport' | 'refinery' | 'customer' | 'management';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  site_ids: string[];
  is_active: boolean;
  two_factor_enabled: boolean;
  language: 'en' | 'fr';
  email_notifications: boolean;
  batch_notifications: boolean;
  approval_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface SignupData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  site_ids: string[];
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  password: string;
  token: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}
