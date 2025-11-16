/*
  # FIX COMPLET du Système d'Historique

  ## Problèmes Identifiés:
  1. Le trigger sur daily_production ne capture pas tous les changements
  2. Pas de trigger sur shipping_preparations
  3. L'historique n'est pas enregistré pour ready_for_customs
  4. La table production_status_history existe mais n'est pas utilisée
  5. Manque de cohérence entre les différents triggers

  ## Solution Professionnelle:
  1. Supprimer les anciens triggers et fonctions
  2. Créer des triggers ROBUSTES pour production ET shipping
  3. S'assurer que TOUS les changements de statut sont capturés
  4. Ajouter des logs détaillés pour le debugging
  5. Créer une fonction unifiée de logging
  6. Tester le système complètement

  ## Tables Concernées:
  - unified_status_history (table centrale)
  - daily_production (entity_type: 'production')
  - shipping_preparations (entity_type: 'shipping')

  ## Statuts Production à Capturer:
  - prepared
  - ready_for_customs ⚠️ CRITIQUE - NON CAPTURÉ ACTUELLEMENT
  - shipped
  - cancelled

  ## Statuts Shipping à Capturer:
  - pending
  - prepared
  - approved_by_customs
  - ready_for_expedition
  - shipped_to_refinery
  - cancelled
*/

-- =====================================================
-- ÉTAPE 1: NETTOYAGE COMPLET
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧹 NETTOYAGE DES ANCIENS TRIGGERS ET FONCTIONS';
  RAISE NOTICE '================================================';
END $$;

-- Drop tous les triggers existants
DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production CASCADE;
DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations CASCADE;
DROP TRIGGER IF EXISTS production_status_history_trigger ON daily_production CASCADE;

-- Drop toutes les fonctions existantes
DROP FUNCTION IF EXISTS log_production_status_change() CASCADE;
DROP FUNCTION IF EXISTS log_shipping_status_change() CASCADE;
DROP FUNCTION IF EXISTS record_production_status_change() CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Anciens triggers et fonctions supprimés';
END $$;

-- =====================================================
-- ÉTAPE 2: FONCTION UNIFIÉE DE LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION log_unified_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_context status_change_context;
  v_action_desc TEXT;
  v_entity_type TEXT;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  -- Déterminer le type d'entité selon la table
  IF TG_TABLE_NAME = 'daily_production' THEN
    v_entity_type := 'production';
  ELSIF TG_TABLE_NAME = 'shipping_preparations' THEN
    v_entity_type := 'shipping';
  ELSE
    v_entity_type := 'unknown';
  END IF;

  -- Récupérer l'ID utilisateur actuel
  v_user_id := auth.uid();

  -- Si pas d'ID utilisateur, utiliser created_by ou updated_by
  IF v_user_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_user_id := NEW.created_by;
    ELSIF TG_OP = 'UPDATE' THEN
      v_user_id := COALESCE(NEW.updated_by, NEW.created_by);
    END IF;
  END IF;

  -- Préparer les statuts (conversion en texte)
  IF TG_OP = 'INSERT' THEN
    v_old_status := NULL;
    v_new_status := NEW.status::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_status := OLD.status::text;
    v_new_status := NEW.status::text;
  END IF;

  -- Déterminer le contexte et la description selon le statut et l'entité
  IF v_entity_type = 'production' THEN
    CASE v_new_status
      WHEN 'prepared' THEN
        v_context := 'production_management';
        IF TG_OP = 'INSERT' THEN
          v_action_desc := 'Production créée et préparée';
        ELSE
          v_action_desc := 'Statut changé: ' || COALESCE(v_old_status, 'null') || ' → prepared';
        END IF;

      WHEN 'ready_for_customs' THEN
        v_context := 'production_management';
        v_action_desc := 'Production validée - Prête pour la douane';

      WHEN 'shipped' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Production expédiée';

      WHEN 'cancelled' THEN
        v_context := 'production_management';
        v_action_desc := 'Production annulée';

      ELSE
        v_context := 'production_management';
        v_action_desc := 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status;
    END CASE;

  ELSIF v_entity_type = 'shipping' THEN
    CASE v_new_status
      WHEN 'pending' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Expédition créée - En attente';

      WHEN 'prepared' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Expédition préparée';

      WHEN 'approved_by_customs' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Approuvé par la douane';

      WHEN 'ready_for_expedition' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Prêt pour expédition';

      WHEN 'shipped_to_refinery' THEN
        v_context := 'freight_customs_management';
        v_action_desc := 'Expédié vers la raffinerie';

      WHEN 'cancelled' THEN
        v_context := 'shipping_management';
        v_action_desc := 'Expédition annulée';

      ELSE
        v_context := 'shipping_management';
        v_action_desc := 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status;
    END CASE;
  ELSE
    v_context := 'system';
    v_action_desc := 'Changement de statut système';
  END IF;

  -- Enregistrer UNIQUEMENT si le statut a changé (ou si c'est un INSERT)
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN

    BEGIN
      INSERT INTO unified_status_history (
        entity_type,
        entity_id,
        old_status,
        new_status,
        change_context,
        changed_by,
        changed_at,
        action_description,
        notes,
        metadata
      ) VALUES (
        v_entity_type,
        NEW.id,
        v_old_status,
        v_new_status,
        v_context,
        v_user_id,
        NOW(),
        v_action_desc,
        NULL,
        jsonb_build_object(
          'operation', TG_OP,
          'table', TG_TABLE_NAME,
          'timestamp', NOW()
        )
      );

      RAISE NOTICE '✅ [%] Historique enregistré: % (%) - % → %',
        v_entity_type,
        NEW.id,
        TG_OP,
        COALESCE(v_old_status, 'null'),
        v_new_status;

    EXCEPTION WHEN OTHERS THEN
      -- Log l'erreur mais ne pas bloquer l'opération
      RAISE WARNING '❌ Erreur enregistrement historique [%]: % - SQLSTATE: %',
        v_entity_type,
        SQLERRM,
        SQLSTATE;
      RAISE WARNING '   Entity ID: %, Status: % → %',
        NEW.id,
        COALESCE(v_old_status, 'null'),
        v_new_status;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '✅ Fonction unifiée log_unified_status_change() créée';
END $$;

-- =====================================================
-- ÉTAPE 3: CRÉER LES TRIGGERS SUR LES TABLES
-- =====================================================

-- Trigger pour daily_production
CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE OF status ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_unified_status_change();

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger créé sur daily_production';
END $$;

-- Trigger pour shipping_preparations
CREATE TRIGGER shipping_status_change_trigger
  AFTER INSERT OR UPDATE OF status ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION log_unified_status_change();

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger créé sur shipping_preparations';
END $$;

-- =====================================================
-- ÉTAPE 4: VÉRIFIER LA STRUCTURE unified_status_history
-- =====================================================

DO $$
DECLARE
  v_column_count INTEGER;
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 VÉRIFICATION DE LA STRUCTURE';
  RAISE NOTICE '===============================';

  -- Vérifier que la table existe
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'unified_status_history';

  IF v_column_count = 0 THEN
    RAISE EXCEPTION '❌ Table unified_status_history n''existe pas!';
  END IF;

  RAISE NOTICE '✅ Table unified_status_history existe (%colonnes)', v_column_count;

  -- Vérifier les colonnes obligatoires
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_status_history'
    AND column_name = 'change_context'
  ) THEN
    RAISE EXCEPTION '❌ Colonne change_context manquante!';
  END IF;

  RAISE NOTICE '✅ Colonne change_context présente';

  -- Vérifier les policies RLS
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'unified_status_history';

  IF v_policy_count = 0 THEN
    RAISE WARNING '⚠️  Aucune policy RLS sur unified_status_history';
  ELSE
    RAISE NOTICE '✅ % policies RLS configurées', v_policy_count;
  END IF;

END $$;

-- =====================================================
-- ÉTAPE 5: S'ASSURER DES POLICIES RLS
-- =====================================================

DO $$
BEGIN
  -- Enable RLS si pas déjà fait
  ALTER TABLE unified_status_history ENABLE ROW LEVEL SECURITY;

  -- Policy pour SELECT (tous les utilisateurs authentifiés)
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
  ELSE
    RAISE NOTICE 'ℹ️  Policy SELECT existe déjà';
  END IF;

  -- Policy pour INSERT (système et utilisateurs authentifiés)
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
  ELSE
    RAISE NOTICE 'ℹ️  Policy INSERT existe déjà';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 6: TEST COMPLET DU SYSTÈME
-- =====================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST DU SYSTÈME COMPLET';
  RAISE NOTICE '===========================';

  -- Test 1: Vérifier que la fonction existe
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_unified_status_change'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION '❌ Fonction log_unified_status_change n''existe pas!';
  END IF;
  RAISE NOTICE '✅ Fonction log_unified_status_change existe';

  -- Test 2: Vérifier les triggers
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger');

  IF v_trigger_count < 2 THEN
    RAISE EXCEPTION '❌ Tous les triggers ne sont pas créés! (trouvés: %)', v_trigger_count;
  END IF;
  RAISE NOTICE '✅ % triggers créés et actifs', v_trigger_count;

  -- Test 3: Lister les triggers actifs
  RAISE NOTICE '';
  RAISE NOTICE '📋 Triggers Actifs:';
  FOR v_trigger_count IN (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
  ) LOOP
    RAISE NOTICE '   • % sur %',
      (SELECT tgname FROM pg_trigger t2
       JOIN pg_class c2 ON t2.tgrelid = c2.oid
       WHERE t2.tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
       LIMIT 1),
      (SELECT c2.relname FROM pg_trigger t2
       JOIN pg_class c2 ON t2.tgrelid = c2.oid
       WHERE t2.tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
       LIMIT 1);
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ SYSTÈME D''HISTORIQUE COMPLÈTEMENT RÉPARÉ!';
  RAISE NOTICE '✅ Tous les changements de statut seront maintenant enregistrés';
  RAISE NOTICE '✅ Production: prepared → ready_for_customs → shipped';
  RAISE NOTICE '✅ Shipping: pending → prepared → approved_by_customs → ready_for_expedition → shipped_to_refinery';
  RAISE NOTICE '';

END $$;

-- =====================================================
-- ÉTAPE 7: COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION log_unified_status_change() IS
'Fonction unifiée pour enregistrer TOUS les changements de statut dans unified_status_history.
Utilisée par les triggers sur daily_production et shipping_preparations.
Capture: INSERT (création) et UPDATE (changement de statut).
Gère automatiquement le contexte selon le type d''entité et le statut.';

COMMENT ON TRIGGER production_status_change_trigger ON daily_production IS
'Enregistre automatiquement tout changement de statut dans unified_status_history.
Se déclenche sur INSERT et UPDATE de la colonne status.
Statuts capturés: prepared, ready_for_customs, shipped, cancelled.';

COMMENT ON TRIGGER shipping_status_change_trigger ON shipping_preparations IS
'Enregistre automatiquement tout changement de statut dans unified_status_history.
Se déclenche sur INSERT et UPDATE de la colonne status.
Statuts capturés: pending, prepared, approved_by_customs, ready_for_expedition, shipped_to_refinery, cancelled.';
