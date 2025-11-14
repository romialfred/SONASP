/*
  # Correction du Trigger de Changement de Statut Production

  ## Problème:
  Le trigger log_production_status_change essaie d'insérer dans production_status_history
  avec old_status/new_status en type text, mais les colonnes sont de type production_status.

  ## Solution:
  Utiliser unified_status_history au lieu de production_status_history

  ## Modifications:
  1. Supprimer l'ancien trigger et fonction
  2. Créer un nouveau trigger utilisant unified_status_history
  3. Convertir correctement les types ENUM en text
*/

-- =====================================================
-- ÉTAPE 1: Supprimer l'ancien système
-- =====================================================

DO $$
BEGIN
  DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production CASCADE;
  DROP FUNCTION IF EXISTS log_production_status_change() CASCADE;

  RAISE NOTICE '✅ Ancien trigger supprimé';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Erreur suppression: %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 2: Créer la nouvelle fonction pour unified_status_history
-- =====================================================

CREATE OR REPLACE FUNCTION log_production_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Récupérer l'ID utilisateur actuel
  v_user_id := auth.uid();

  -- Si pas d'ID utilisateur (création système), utiliser created_by
  IF v_user_id IS NULL AND TG_OP = 'INSERT' THEN
    v_user_id := NEW.created_by;
  END IF;

  -- Pour les INSERT: nouveau statut seulement
  IF TG_OP = 'INSERT' AND NEW.status IS NOT NULL THEN
    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      'production',
      NEW.id,
      NULL,
      NEW.status::text,  -- Conversion ENUM vers TEXT
      COALESCE(v_user_id, NEW.created_by),
      'Production créée'
    );

  -- Pour les UPDATE: enregistrer si le statut a changé
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      changed_by
    ) VALUES (
      'production',
      NEW.id,
      OLD.status::text,  -- Conversion ENUM vers TEXT
      NEW.status::text,  -- Conversion ENUM vers TEXT
      COALESCE(v_user_id, NEW.updated_by, NEW.created_by)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log l'erreur mais ne pas bloquer l'opération
  RAISE WARNING 'Erreur dans log_production_status_change: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ÉTAPE 3: Créer le trigger
-- =====================================================

CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_production_status_change();

-- =====================================================
-- ÉTAPE 4: Vérifier la table unified_status_history
-- =====================================================

DO $$
DECLARE
  v_has_table boolean;
  v_column_record record;
BEGIN
  -- Vérifier que la table existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'unified_status_history'
  ) INTO v_has_table;

  IF NOT v_has_table THEN
    RAISE EXCEPTION 'Table unified_status_history n''existe pas!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Table unified_status_history existe';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Colonnes de unified_status_history:';

  FOR v_column_record IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'unified_status_history'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  • %: %', v_column_record.column_name, v_column_record.data_type;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Trigger production_status_change_trigger recréé avec succès';
  RAISE NOTICE '✅ Utilise maintenant unified_status_history';
  RAISE NOTICE '';

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erreur vérification: %', SQLERRM;
END $$;
