/*
  Fix: Ajouter la colonne can_approve à user_permissions si elle manque

  Erreur: "Could not find the 'can_approve' column of 'user_permissions' in the schema cache"

  Ce script:
  1. Vérifie si la colonne existe
  2. L'ajoute si elle manque
  3. Met à jour les triggers et fonctions si nécessaire
*/

-- 1. Vérifier et ajouter la colonne can_approve si elle n'existe pas
DO $$
BEGIN
  -- Vérifier si la colonne existe déjà
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_permissions'
    AND column_name = 'can_approve'
  ) THEN
    -- Ajouter la colonne
    ALTER TABLE user_permissions
    ADD COLUMN can_approve BOOLEAN DEFAULT false NOT NULL;

    RAISE NOTICE 'Column can_approve added to user_permissions';
  ELSE
    RAISE NOTICE 'Column can_approve already exists in user_permissions';
  END IF;
END $$;

-- 2. Vérifier la structure complète de la table
DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Vérifier toutes les colonnes requises
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'can_view') THEN
    missing_columns := array_append(missing_columns, 'can_view');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'can_create') THEN
    missing_columns := array_append(missing_columns, 'can_create');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'can_edit') THEN
    missing_columns := array_append(missing_columns, 'can_edit');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'can_delete') THEN
    missing_columns := array_append(missing_columns, 'can_delete');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'can_approve') THEN
    missing_columns := array_append(missing_columns, 'can_approve');
  END IF;

  -- Ajouter les colonnes manquantes
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE NOTICE 'Adding missing columns: %', array_to_string(missing_columns, ', ');

    IF 'can_view' = ANY(missing_columns) THEN
      ALTER TABLE user_permissions ADD COLUMN can_view BOOLEAN DEFAULT false NOT NULL;
    END IF;

    IF 'can_create' = ANY(missing_columns) THEN
      ALTER TABLE user_permissions ADD COLUMN can_create BOOLEAN DEFAULT false NOT NULL;
    END IF;

    IF 'can_edit' = ANY(missing_columns) THEN
      ALTER TABLE user_permissions ADD COLUMN can_edit BOOLEAN DEFAULT false NOT NULL;
    END IF;

    IF 'can_delete' = ANY(missing_columns) THEN
      ALTER TABLE user_permissions ADD COLUMN can_delete BOOLEAN DEFAULT false NOT NULL;
    END IF;

    IF 'can_approve' = ANY(missing_columns) THEN
      ALTER TABLE user_permissions ADD COLUMN can_approve BOOLEAN DEFAULT false NOT NULL;
    END IF;
  END IF;
END $$;

-- 3. Créer la table user_permissions si elle n'existe pas (cas extrême)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false NOT NULL,
  can_create BOOLEAN DEFAULT false NOT NULL,
  can_edit BOOLEAN DEFAULT false NOT NULL,
  can_delete BOOLEAN DEFAULT false NOT NULL,
  can_approve BOOLEAN DEFAULT false NOT NULL,
  granted_by UUID REFERENCES user_profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- 4. S'assurer que les index existent
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id ON user_permissions(module_id);

-- 5. Activer RLS si ce n'est pas déjà fait
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 6. Recréer les politiques RLS
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can manage all permissions" ON user_permissions;

CREATE POLICY "Users can view own permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Management can manage all permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- 7. Fonction trigger pour updated_at
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at_trigger ON user_permissions;

CREATE TRIGGER update_user_permissions_updated_at_trigger
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- 8. Vérification finale
SELECT
  'user_permissions' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_permissions'
ORDER BY ordinal_position;

-- Afficher le résumé
DO $$
DECLARE
  total_permissions INTEGER;
  users_with_permissions INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_permissions FROM user_permissions;
  SELECT COUNT(DISTINCT user_id) INTO users_with_permissions FROM user_permissions;

  RAISE NOTICE '✅ Fix completed successfully!';
  RAISE NOTICE 'Total permissions: %', total_permissions;
  RAISE NOTICE 'Users with permissions: %', users_with_permissions;
END $$;
