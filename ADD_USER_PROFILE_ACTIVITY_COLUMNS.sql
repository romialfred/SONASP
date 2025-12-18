/*
  Migration: Ajouter colonnes manquantes pour User Details Page

  Cette migration ajoute les colonnes nécessaires pour afficher
  les informations complètes de l'utilisateur dans la page de détails:
  - job_title
  - department
  - account_locked
  - two_factor_enabled
  - last_activity_at
  - timezone
  - language_preference
  - profile_picture_url
  - failed_login_attempts
*/

-- 1. Ajouter les colonnes manquantes à user_profiles
DO $$
BEGIN
  -- job_title
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN job_title TEXT;
    RAISE NOTICE 'Column job_title added';
  END IF;

  -- department
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN department TEXT;
    RAISE NOTICE 'Column department added';
  END IF;

  -- account_locked
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_locked'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_locked BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Column account_locked added';
  END IF;

  -- two_factor_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'two_factor_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Column two_factor_enabled added';
  END IF;

  -- last_activity_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_activity_at TIMESTAMPTZ;
    RAISE NOTICE 'Column last_activity_at added';
  END IF;

  -- timezone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN timezone TEXT DEFAULT 'UTC';
    RAISE NOTICE 'Column timezone added';
  END IF;

  -- language_preference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'language_preference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN language_preference TEXT DEFAULT 'en';
    RAISE NOTICE 'Column language_preference added';
  END IF;

  -- profile_picture_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN profile_picture_url TEXT;
    RAISE NOTICE 'Column profile_picture_url added';
  END IF;

  -- failed_login_attempts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 NOT NULL;
    RAISE NOTICE 'Column failed_login_attempts added';
  END IF;
END $$;

-- 2. Créer la table user_activity_logs si elle n'existe pas
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', 'export', 'approve', 'reject'
  module_name TEXT NOT NULL, -- 'production', 'sales', 'shipping', etc.
  resource_type TEXT, -- 'batch', 'sale', 'payment', etc.
  resource_id UUID,
  description TEXT NOT NULL,
  changes_summary JSONB,
  status TEXT DEFAULT 'success', -- 'success' ou 'error'
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_action_type CHECK (action_type IN ('create', 'update', 'delete', 'view', 'export', 'approve', 'reject', 'login', 'logout')),
  CONSTRAINT valid_status CHECK (status IN ('success', 'error'))
);

-- 3. Index pour performances
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_module_name ON user_activity_logs(module_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON user_activity_logs(action_type);

-- 4. RLS pour user_activity_logs
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity_logs;
DROP POLICY IF EXISTS "Management can view all activity" ON user_activity_logs;
DROP POLICY IF EXISTS "System can insert activity" ON user_activity_logs;

-- Créer les politiques
CREATE POLICY "Users can view own activity"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all activity"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "System can insert activity"
  ON user_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Trigger pour mettre à jour last_activity_at
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET last_activity_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_activity ON user_activity_logs;

CREATE TRIGGER trigger_update_last_activity
  AFTER INSERT ON user_activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_last_activity();

-- 6. Fonction helper pour logger les activités
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_action_type TEXT,
  p_module_name TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_description TEXT,
  p_changes_summary JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action_type,
    module_name,
    resource_type,
    resource_id,
    description,
    changes_summary,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action_type,
    p_module_name,
    p_resource_type,
    p_resource_id,
    p_description,
    p_changes_summary,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Vérifier la structure finale
SELECT
  'user_profiles' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name IN (
    'job_title', 'department', 'account_locked', 'two_factor_enabled',
    'last_activity_at', 'timezone', 'language_preference',
    'profile_picture_url', 'failed_login_attempts'
  )
ORDER BY ordinal_position;

-- Afficher le résumé
DO $$
DECLARE
  total_users INTEGER;
  total_activities INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM user_profiles;
  SELECT COUNT(*) INTO total_activities FROM user_activity_logs;

  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE 'Total activity logs: %', total_activities;
  RAISE NOTICE 'User Details Page is ready to use!';
END $$;
