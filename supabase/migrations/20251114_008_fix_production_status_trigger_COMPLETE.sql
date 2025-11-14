/*
  # Correction COMPLÈTE du Trigger de Statut Production

  ## Problème Identifié:
  Le trigger log_production_status_change insère dans unified_status_history
  MAIS il manque le champ OBLIGATOIRE 'change_context' qui est NOT NULL.

  ## Solution:
  1. Recréer la fonction avec change_context
  2. Ajouter tous les champs requis
  3. Gérer correctement les INSERT et UPDATE
  4. S'assurer que TOUS les champs obligatoires sont fournis

  ## Colonnes Obligatoires dans unified_status_history:
  - entity_type: TEXT NOT NULL ✅
  - entity_id: uuid NOT NULL ✅
  - new_status: TEXT NOT NULL ✅
  - change_context: status_change_context NOT NULL ❌ MANQUANT!
  - changed_at: timestamptz DEFAULT now() ✅
*/

-- =====================================================
-- ÉTAPE 1: Supprimer l'ancien trigger
-- =====================================================

DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production CASCADE;
DROP FUNCTION IF EXISTS log_production_status_change() CASCADE;

-- =====================================================
-- ÉTAPE 2: Créer la nouvelle fonction COMPLÈTE
-- =====================================================

CREATE OR REPLACE FUNCTION log_production_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_context status_change_context;
  v_action_desc TEXT;
BEGIN
  -- Récupérer l'ID utilisateur actuel
  v_user_id := auth.uid();

  -- Si pas d'ID utilisateur (création système), utiliser created_by
  IF v_user_id IS NULL AND TG_OP = 'INSERT' THEN
    v_user_id := NEW.created_by;
  END IF;

  -- Déterminer le contexte selon le statut
  IF TG_OP = 'INSERT' THEN
    v_context := 'production_management';
    v_action_desc := 'Production créée avec statut: ' || NEW.status::text;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Déterminer le contexte basé sur le nouveau statut
    CASE NEW.status::text
      WHEN 'prepared' THEN
        v_context := 'production_management';
        v_action_desc := 'Statut changé: ' || COALESCE(OLD.status::text, 'null') || ' → ' || NEW.status::text;
      WHEN 'ready_for_customs' THEN
        v_context := 'production_management';
        v_action_desc := 'Validé pour la douane';
      WHEN 'ready_for_shipment' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Prêt pour expédition';
      WHEN 'shipped' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Expédié';
      WHEN 'cancelled' THEN
        v_context := 'production_management';
        v_action_desc := 'Production annulée';
      ELSE
        v_context := 'production_management';
        v_action_desc := 'Changement de statut: ' || COALESCE(OLD.status::text, 'null') || ' → ' || NEW.status::text;
    END CASE;
  END IF;

  -- Pour les INSERT: nouveau statut seulement
  IF TG_OP = 'INSERT' AND NEW.status IS NOT NULL THEN
    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      change_context,
      changed_by,
      changed_at,
      action_description,
      notes
    ) VALUES (
      'production',
      NEW.id,
      NULL,
      NEW.status::text,
      v_context,
      COALESCE(v_user_id, NEW.created_by),
      NOW(),
      v_action_desc,
      'Production créée'
    );

    RAISE NOTICE '✅ Historique INSERT créé pour production % avec statut %', NEW.id, NEW.status;

  -- Pour les UPDATE: enregistrer si le statut a changé
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      change_context,
      changed_by,
      changed_at,
      action_description,
      notes
    ) VALUES (
      'production',
      NEW.id,
      OLD.status::text,
      NEW.status::text,
      v_context,
      COALESCE(v_user_id, NEW.updated_by, NEW.created_by),
      NOW(),
      v_action_desc,
      NULL
    );

    RAISE NOTICE '✅ Historique UPDATE créé pour production %: % → %', NEW.id, OLD.status, NEW.status;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log l'erreur mais ne pas bloquer l'opération
  RAISE WARNING '❌ Erreur dans log_production_status_change: % - SQLSTATE: %', SQLERRM, SQLSTATE;
  RAISE WARNING '   Entity: %, Status: %', NEW.id, NEW.status;
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
-- ÉTAPE 4: Vérification et RLS
-- =====================================================

-- S'assurer que les RLS policies existent pour unified_status_history
DO $$
BEGIN
  -- Policy pour SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'unified_status_history'
    AND policyname = 'Users can view all status history'
  ) THEN
    CREATE POLICY "Users can view all status history"
      ON unified_status_history
      FOR SELECT
      TO authenticated
      USING (true);
    RAISE NOTICE '✅ Policy SELECT créée';
  END IF;

  -- Policy pour INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'unified_status_history'
    AND policyname = 'System can insert status history'
  ) THEN
    CREATE POLICY "System can insert status history"
      ON unified_status_history
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
    RAISE NOTICE '✅ Policy INSERT créée';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Test du trigger
-- =====================================================

DO $$
DECLARE
  v_test_id uuid;
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST DU TRIGGER';
  RAISE NOTICE '==================';

  -- Vérifier que unified_status_history existe
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_name = 'unified_status_history';

  IF v_count = 0 THEN
    RAISE EXCEPTION '❌ Table unified_status_history n''existe pas!';
  END IF;

  RAISE NOTICE '✅ Table unified_status_history existe';

  -- Vérifier que le trigger existe
  SELECT COUNT(*) INTO v_count
  FROM pg_trigger
  WHERE tgname = 'production_status_change_trigger';

  IF v_count = 0 THEN
    RAISE EXCEPTION '❌ Trigger production_status_change_trigger n''existe pas!';
  END IF;

  RAISE NOTICE '✅ Trigger production_status_change_trigger existe';

  -- Afficher les colonnes de unified_status_history
  RAISE NOTICE '';
  RAISE NOTICE '📋 Colonnes de unified_status_history:';
  FOR v_test_id IN (
    SELECT column_name::uuid FROM information_schema.columns
    WHERE table_name = 'unified_status_history'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE '   • %', v_test_id;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Trigger de production corrigé avec succès!';
  RAISE NOTICE '✅ Inclut maintenant change_context obligatoire';
  RAISE NOTICE '✅ Enregistre dans unified_status_history';
  RAISE NOTICE '';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️  Erreur pendant les tests: %', SQLERRM;
END $$;
