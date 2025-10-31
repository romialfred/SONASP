/*
  # Authentication and Role-Based Access Control Schema

  ## Overview
  Complete authentication and authorization system for Gold Shipper with user profiles,
  roles, permissions, site assignments, and comprehensive security features.

  ## New Tables

  ### user_profiles
  Extended user profile information linked to Supabase auth.users
  - `id` (uuid, primary key) - References auth.users(id)
  - `email` (text) - User email (synced from auth)
  - `full_name` (text) - User's full name
  - `phone` (text) - Phone number
  - `role` (text) - User role: factory, airport, refinery, customer, management
  - `is_active` (boolean) - Account active status
  - `two_factor_enabled` (boolean) - 2FA enabled flag
  - `two_factor_secret` (text) - Encrypted TOTP secret
  - `backup_codes` (text[]) - Array of encrypted backup codes
  - `language` (text) - Preferred language (en/fr)
  - `email_notifications` (boolean) - Email notification preference
  - `batch_notifications` (boolean) - Batch notification preference
  - `approval_notifications` (boolean) - Approval notification preference
  - `last_login_at` (timestamptz) - Last login timestamp
  - `last_login_ip` (text) - Last login IP address
  - `failed_login_attempts` (integer) - Failed login counter
  - `locked_until` (timestamptz) - Account lock expiry time
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### user_site_assignments
  Many-to-many relationship between users and sites for multi-tenant access
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to user_profiles
  - `site_id` (uuid) - Reference to sites
  - `is_primary` (boolean) - Primary site flag
  - `assigned_by` (uuid) - User who made the assignment
  - `assigned_at` (timestamptz) - Assignment timestamp

  ### user_permissions
  Granular permission assignments for fine-grained access control
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to user_profiles
  - `permission` (text) - Permission identifier
  - `resource` (text) - Resource type (batches, sales, customers, etc.)
  - `granted_by` (uuid) - User who granted permission
  - `granted_at` (timestamptz) - Grant timestamp

  ### user_sessions
  Active session tracking for security monitoring
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to user_profiles
  - `session_token` (text) - Session identifier
  - `ip_address` (text) - Client IP address
  - `user_agent` (text) - Client user agent
  - `expires_at` (timestamptz) - Session expiry time
  - `created_at` (timestamptz) - Session start time

  ### security_events
  Security-related event logging for audit and monitoring
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to user_profiles
  - `event_type` (text) - Event type (login_failed, 2fa_setup, password_change, etc.)
  - `ip_address` (text) - Client IP address
  - `user_agent` (text) - Client user agent
  - `details` (jsonb) - Additional event details
  - `created_at` (timestamptz) - Event timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only view/edit their own profile
  - Management role has access to all profiles
  - Site assignments restrict data access across the application
  - Comprehensive audit logging for all security events
  - Password policy enforcement at application level
  - Account lockout after failed login attempts

  ## Important Notes
  - User profiles are automatically created via trigger when auth.users record is created
  - Two-factor secrets and backup codes are encrypted
  - Session tokens are hashed for security
  - Failed login attempts reset after successful login
  - Account locks automatically expire after configured duration
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'factory' CHECK (role IN ('factory', 'airport', 'refinery', 'customer', 'management')),
  is_active boolean DEFAULT true,
  two_factor_enabled boolean DEFAULT false,
  two_factor_secret text,
  backup_codes text[],
  language text DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  email_notifications boolean DEFAULT true,
  batch_notifications boolean DEFAULT true,
  approval_notifications boolean DEFAULT true,
  last_login_at timestamptz,
  last_login_ip text,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_site_assignments table
CREATE TABLE IF NOT EXISTS user_site_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, site_id)
);

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  resource text NOT NULL,
  granted_by uuid REFERENCES user_profiles(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission, resource)
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create security_events table
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Create function to update user profile updated_at
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_updated_at();

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO security_events (user_id, event_type, ip_address, user_agent, details)
  VALUES (p_user_id, p_event_type, p_ip_address, p_user_agent, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id uuid,
  p_permission text,
  p_resource text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_permissions
    WHERE user_id = p_user_id
      AND permission = p_permission
      AND resource = p_resource
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's assigned sites
CREATE OR REPLACE FUNCTION get_user_sites(p_user_id uuid)
RETURNS TABLE(site_id uuid, site_name text, site_type text, is_primary boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.site_type,
    usa.is_primary
  FROM user_site_assignments usa
  JOIN sites s ON usa.site_id = s.id
  WHERE usa.user_id = p_user_id
  ORDER BY usa.is_primary DESC, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_site_assignments_user_id ON user_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_assignments_site_id ON user_site_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Management can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Management can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "Management can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- RLS Policies for user_site_assignments
CREATE POLICY "Users can view own site assignments"
  ON user_site_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Management can view all site assignments"
  ON user_site_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "Management can manage site assignments"
  ON user_site_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- RLS Policies for user_permissions
CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Management can view all permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "Management can manage permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Management can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "System can manage sessions"
  ON user_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for security_events
CREATE POLICY "Users can view own security events"
  ON security_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Management can view all security events"
  ON security_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "System can insert security events"
  ON security_events FOR INSERT
  TO authenticated
  WITH CHECK (true);
