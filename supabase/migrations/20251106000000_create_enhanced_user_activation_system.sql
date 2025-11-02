/*
  # Enhanced User Activation and Management System

  1. New Tables
    - `user_activation_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `token` (text, unique)
      - `token_type` (text: 'activation' | 'password_reset')
      - `temporary_password` (text)
      - `expires_at` (timestamptz)
      - `used_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

    - `user_acceptance_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `accepted_gdpr` (boolean, default false)
      - `accepted_privacy` (boolean, default false)
      - `accepted_cookies` (boolean, default false)
      - `accepted_at` (timestamptz)
      - `ip_address` (text)
      - `user_agent` (text)

    - `user_2fa_setup`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `secret` (text)
      - `backup_codes` (jsonb)
      - `verified_at` (timestamptz)
      - `authenticator_app` (text, must be 'microsoft_authenticator')
      - `created_at` (timestamptz)

    - `password_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `password_hash` (text)
      - `changed_at` (timestamptz)
      - `changed_by` (uuid, references auth.users, nullable for self-service)

  2. Schema Updates
    - Add columns to `user_profiles`:
      - `account_activated` (boolean)
      - `activation_completed_at` (timestamptz)
      - `last_password_change` (timestamptz)
      - `password_expiry_days` (integer, default 90)
      - `failed_login_attempts` (integer, default 0)
      - `account_locked_until` (timestamptz, nullable)

  3. Security
    - Enable RLS on all new tables
    - Policies for secure access
    - Audit triggers

  4. Functions
    - Password strength validation
    - Token generation and validation
    - 2FA setup and verification
*/

-- Create user_activation_tokens table
CREATE TABLE IF NOT EXISTS user_activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  token_type text NOT NULL CHECK (token_type IN ('activation', 'password_reset')),
  temporary_password text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_activation_tokens_user_id ON user_activation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_token ON user_activation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_expires ON user_activation_tokens(expires_at);

-- Create user_acceptance_logs table
CREATE TABLE IF NOT EXISTS user_acceptance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  accepted_gdpr boolean DEFAULT false,
  accepted_privacy boolean DEFAULT false,
  accepted_cookies boolean DEFAULT false,
  accepted_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_acceptance_logs_user_id ON user_acceptance_logs(user_id);

-- Create user_2fa_setup table
CREATE TABLE IF NOT EXISTS user_2fa_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  secret text NOT NULL,
  backup_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  authenticator_app text NOT NULL DEFAULT 'microsoft_authenticator' CHECK (authenticator_app = 'microsoft_authenticator'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_2fa_setup_user_id ON user_2fa_setup(user_id);

-- Create password_history table
CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_hash text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_changed_at ON password_history(changed_at);

-- Add columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_activated'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_activated boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'activation_completed_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN activation_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_password_change'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_password_change timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'password_expiry_days'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN password_expiry_days integer DEFAULT 90;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN failed_login_attempts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_locked_until'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_locked_until timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE user_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_acceptance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_activation_tokens

CREATE POLICY "Users can view own activation tokens"
  ON user_activation_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all activation tokens"
  ON user_activation_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Service role can manage activation tokens"
  ON user_activation_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_acceptance_logs

CREATE POLICY "Users can view own acceptance logs"
  ON user_acceptance_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own acceptance logs"
  ON user_acceptance_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own acceptance logs"
  ON user_acceptance_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_2fa_setup

CREATE POLICY "Users can view own 2FA setup"
  ON user_2fa_setup FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA setup"
  ON user_2fa_setup FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA setup"
  ON user_2fa_setup FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own 2FA setup"
  ON user_2fa_setup FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for password_history

CREATE POLICY "Users can view own password history"
  ON password_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all password history"
  ON password_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Function to validate password strength
CREATE OR REPLACE FUNCTION validate_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Minimum 12 characters
  IF length(password) < 12 THEN
    RETURN false;
  END IF;

  -- Must contain at least one uppercase letter
  IF password !~ '[A-Z]' THEN
    RETURN false;
  END IF;

  -- Must contain at least one lowercase letter
  IF password !~ '[a-z]' THEN
    RETURN false;
  END IF;

  -- Must contain at least one digit
  IF password !~ '[0-9]' THEN
    RETURN false;
  END IF;

  -- Must contain at least one special character
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Function to generate activation token
CREATE OR REPLACE FUNCTION generate_activation_token(
  p_user_id uuid,
  p_token_type text,
  p_temporary_password text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_expires_at timestamptz;
BEGIN
  -- Generate unique token
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');

  -- Token expires in 24 hours
  v_expires_at := now() + interval '24 hours';

  -- Invalidate any existing unused tokens for this user and type
  UPDATE user_activation_tokens
  SET used_at = now()
  WHERE user_id = p_user_id
    AND token_type = p_token_type
    AND used_at IS NULL
    AND expires_at > now();

  -- Insert new token
  INSERT INTO user_activation_tokens (
    user_id,
    token,
    token_type,
    temporary_password,
    expires_at,
    created_by
  ) VALUES (
    p_user_id,
    v_token,
    p_token_type,
    p_temporary_password,
    v_expires_at,
    p_created_by
  );

  RETURN v_token;
END;
$$;

-- Function to validate activation token
CREATE OR REPLACE FUNCTION validate_activation_token(p_token text)
RETURNS TABLE (
  is_valid boolean,
  user_id uuid,
  token_type text,
  temporary_password text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (t.used_at IS NULL AND t.expires_at > now())::boolean as is_valid,
    t.user_id,
    t.token_type,
    t.temporary_password
  FROM user_activation_tokens t
  WHERE t.token = p_token;
END;
$$;

-- Function to mark token as used
CREATE OR REPLACE FUNCTION mark_token_used(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_activation_tokens
  SET used_at = now()
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();

  RETURN FOUND;
END;
$$;

-- Function to check if user has accepted all policies
CREATE OR REPLACE FUNCTION check_user_policies_accepted(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accepted boolean;
BEGIN
  SELECT (accepted_gdpr AND accepted_privacy AND accepted_cookies)
  INTO v_accepted
  FROM user_acceptance_logs
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_accepted, false);
END;
$$;

-- Trigger to update last_password_change
CREATE OR REPLACE FUNCTION update_last_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET last_password_change = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_last_password_change ON password_history;
CREATE TRIGGER trigger_update_last_password_change
  AFTER INSERT ON password_history
  FOR EACH ROW
  EXECUTE FUNCTION update_last_password_change();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_activation_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_acceptance_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_2fa_setup TO authenticated;
GRANT SELECT ON password_history TO authenticated;
GRANT EXECUTE ON FUNCTION validate_password_strength TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_policies_accepted TO authenticated;
