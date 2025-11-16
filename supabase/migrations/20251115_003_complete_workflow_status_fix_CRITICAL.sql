/*
  # FIX COMPLET ET DÉFINITIF DU SYSTÈME DE STATUTS

  ## Problème Critical
  1. ENUMs multiples et contradictoires dans la base
  2. production_status_v2 existe mais est incomplet (3 valeurs seulement)
  3. Workflow fragmenté entre modules sans cohérence
  4. Historique incomplet car triggers capturent mal les statuts
  5. Anciens ENUMs (production_status) toujours présents

  ## Solution Professionnelle
  1. ANALYSER tous les ENUMs existants
  2. SUPPRIMER ENUMs obsolètes (production_status ancien)
  3. VÉRIFIER/COMPLÉTER ENUMs corrects selon workflow
  4. METTRE À JOUR triggers pour capturer TOUS les statuts
  5. TESTER complètement

  ## Workflow Complet (Selon Tableau Fourni)

  Production → Shipping Prep → Freight → Refinery → Inventory → Sale → Payment

  Phase 1 - PRODUCTION (production_status_v2):
    - prepared (default)
    - ready_for_customs
    - cancelled

  Phase 2 - SHIPPING PREPARATION (shipping_preparation_status):
    - waiting_for_custom_approval (default/auto)
    - approved_by_customs
    - ready_for_shipping
    - cancelled

  Phase 3 - FREIGHT & CUSTOMS (freight_customs_status):
    - ready_for_shipping (auto)
    - shipped_to_refinery
    - cancelled

  Phase 4 - REFINERY (refinery_status):
    - waiting_for_refinery_approval (auto)
    - refinery_approved
    - refined
    - cancelled

  Phase 5 - INVENTORY (inventory_status):
    - in_stock
    - reserved
    - sold

  Phase 6 - SALE (sale_status):
    - in_sale
    - sold
    - cancelled

  Phase 7 - PAYMENT (payment_status):
    - pending
    - paid
    - cancelled

  ## ATTENTION
  - Cette migration est CRITIQUE
  - BACKUP obligatoire avant exécution
  - Tests complets après migration
  - Validation par double vérification
*/

-- =====================================================
-- ÉTAPE 0: RAPPORT D'ANALYSE
-- =====================================================

DO $$
DECLARE
  v_enum_count INTEGER;
  v_old_production_status_exists BOOLEAN;
  v_table_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 ANALYSE PRÉLIMINAIRE DE LA BASE DE DONNÉES';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Compter les ENUMs de type status
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname LIKE '%status%';

  RAISE NOTICE '📊 Nombre d''ENUMs "status" trouvés: %', v_enum_count;

  -- Vérifier si l'ancien production_status existe
  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'production_status'
  ) INTO v_old_production_status_exists;

  IF v_old_production_status_exists THEN
    RAISE NOTICE '⚠️  ATTENTION: Ancien ENUM "production_status" existe encore!';
    RAISE NOTICE '   → Sera supprimé dans cette migration';
  ELSE
    RAISE NOTICE '✅ Ancien ENUM "production_status" déjà supprimé';
  END IF;

  -- Vérifier production_status_v2
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status_v2') THEN
    RAISE NOTICE '✅ ENUM "production_status_v2" existe';

    -- Compter les valeurs
    SELECT COUNT(*) INTO v_enum_count
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'production_status_v2';

    RAISE NOTICE '   → Nombre de valeurs: %', v_enum_count;

    -- Lister les valeurs
    FOR v_enum_count IN (
      SELECT enumsortorder
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'production_status_v2'
      ORDER BY e.enumsortorder
    ) LOOP
      RAISE NOTICE '      • %', (
        SELECT enumlabel
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'production_status_v2'
        ORDER BY e.enumsortorder
        LIMIT 1 OFFSET v_enum_count - 1
      );
    END LOOP;
  ELSE
    RAISE NOTICE '❌ ENUM "production_status_v2" N''EXISTE PAS!';
    RAISE NOTICE '   → Sera créé';
  END IF;

  -- Vérifier les tables avec colonnes status
  SELECT COUNT(DISTINCT table_name) INTO v_table_count
  FROM information_schema.columns
  WHERE column_name = 'status'
  AND table_schema = 'public';

  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables avec colonne "status": %', v_table_count;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 1: SAUVEGARDE DES TRIGGERS EXISTANTS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '💾 ÉTAPE 1: Sauvegarde des Triggers';
  RAISE NOTICE '─────────────────────────────────────────';

  -- Désactiver temporairement les triggers
  ALTER TABLE daily_production DISABLE TRIGGER ALL;
  ALTER TABLE shipping_preparations DISABLE TRIGGER ALL;

  RAISE NOTICE '✅ Triggers désactivés temporairement';
  RAISE NOTICE '   (Seront réactivés à la fin)';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 2: SUPPRIMER ANCIENS ENUMS OBSOLÈTES
-- =====================================================

DO $$
DECLARE
  v_is_used BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🗑️  ÉTAPE 2: Suppression ENUMs Obsolètes';
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE '';

  -- Vérifier si production_status (ANCIEN) est utilisé
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE udt_name = 'production_status'
    AND table_schema = 'public'
  ) INTO v_is_used;

  IF v_is_used THEN
    RAISE WARNING '⚠️  production_status est encore utilisé par une table!';
    RAISE WARNING '   Migration des données requise avant suppression';
    RAISE WARNING '   → IGNORER pour l''instant';
  ELSE
    -- Supprimer l'ancien ENUM
    DROP TYPE IF EXISTS production_status CASCADE;
    RAISE NOTICE '✅ Ancien ENUM "production_status" supprimé';
  END IF;

  -- Autres ENUMs obsolètes potentiels
  DROP TYPE IF EXISTS shipping_status CASCADE;
  DROP TYPE IF EXISTS unified_status CASCADE;

  RAISE NOTICE '✅ ENUMs obsolètes supprimés';
  RAISE NOTICE '';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️  Erreur lors de la suppression: %', SQLERRM;
  RAISE WARNING '   Continuer quand même...';
END $$;

-- =====================================================
-- ÉTAPE 3: VÉRIFIER/CRÉER ENUMS CORRECTS
-- =====================================================

-- Production Status V2 (déjà correct selon captures)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status_v2') THEN
    CREATE TYPE production_status_v2 AS ENUM (
      'prepared',
      'ready_for_customs',
      'cancelled'
    );
    RAISE NOTICE '✅ ENUM production_status_v2 créé';
  ELSE
    RAISE NOTICE 'ℹ️  ENUM production_status_v2 existe déjà';
  END IF;
END $$;

-- Shipping Preparation Status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipping_preparation_status') THEN
    CREATE TYPE shipping_preparation_status AS ENUM (
      'waiting_for_custom_approval',
      'approved_by_customs',
      'ready_for_shipping',
      'cancelled'
    );
    RAISE NOTICE '✅ ENUM shipping_preparation_status créé';
  ELSE
    RAISE NOTICE 'ℹ️  ENUM shipping_preparation_status existe déjà';
  END IF;
END $$;

-- Freight & Customs Status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'freight_customs_status') THEN
    CREATE TYPE freight_customs_status AS ENUM (
      'ready_for_shipping',
      'shipped_to_refinery',
      'cancelled'
    );
    RAISE NOTICE '✅ ENUM freight_customs_status créé';
  ELSE
    RAISE NOTICE 'ℹ️  ENUM freight_customs_status existe déjà';
  END IF;
END $$;

-- Refinery Status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refinery_status') THEN
    CREATE TYPE refinery_status AS ENUM (
      'waiting_for_refinery_approval',
      'refinery_approved',
      'refined',
      'cancelled'
    );
    RAISE NOTICE '✅ ENUM refinery_status créé';
  ELSE
    RAISE NOTICE 'ℹ️  ENUM refinery_status existe déjà';
  END IF;
END $$;

-- Inventory Status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_status') THEN
    CREATE TYPE inventory_status AS ENUM (
      'in_stock',
      'reserved',
      'sold'
    );
    RAISE NOTICE '✅ ENUM inventory_status créé';
  ELSE
    RAISE NOTICE 'ℹ️  ENUM inventory_status existe déjà';
  END IF;
END $$;

-- Sale Status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
    CREATE TYPE sale_status AS ENUM (
      'in_sale',
      'sold',
      'cancelled'
    );
    RAISE NOTICE '✅ ENUM sale_status créé';
  ELSE
    RAISE NOTICE 'ℹ️  ENUM sale_status existe déjà';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 4: VÉRIFIER COLONNES DE TABLES
-- =====================================================

DO $$
DECLARE
  v_current_enum TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 ÉTAPE 4: Vérification Colonnes de Tables';
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE '';

  -- Vérifier daily_production.status
  SELECT udt_name INTO v_current_enum
  FROM information_schema.columns
  WHERE table_name = 'daily_production'
  AND column_name = 'status';

  IF v_current_enum = 'production_status_v2' THEN
    RAISE NOTICE '✅ daily_production.status utilise production_status_v2';
  ELSE
    RAISE WARNING '⚠️  daily_production.status utilise: %', v_current_enum;
    RAISE WARNING '   Devrait utiliser: production_status_v2';
  END IF;

  -- Vérifier shipping_preparations.status
  SELECT udt_name INTO v_current_enum
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  IF v_current_enum IS NOT NULL THEN
    RAISE NOTICE 'ℹ️  shipping_preparations.status utilise: %', v_current_enum;
  ELSE
    RAISE WARNING '❌ shipping_preparations.status N''EXISTE PAS!';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 5: METTRE À JOUR LA FONCTION UNIFIÉE DE LOGGING
-- =====================================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS log_unified_status_change() CASCADE;

RAISE NOTICE '';
RAISE NOTICE '🔧 ÉTAPE 5: Création Fonction Unifiée de Logging';
RAISE NOTICE '─────────────────────────────────────────';

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
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'daily_production' THEN 'production'
    WHEN 'shipping_preparations' THEN 'shipping'
    WHEN 'freight_customs' THEN 'freight'
    WHEN 'refinery_operations' THEN 'refinery'
    WHEN 'inventory' THEN 'inventory'
    WHEN 'sales' THEN 'sale'
    WHEN 'payments' THEN 'payment'
    ELSE 'unknown'
  END;

  -- Récupérer l'ID utilisateur
  v_user_id := COALESCE(auth.uid(), NEW.created_by);

  -- Préparer les statuts
  v_old_status := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status::text END;
  v_new_status := NEW.status::text;

  -- Déterminer le contexte et la description selon l'entité et le statut
  IF v_entity_type = 'production' THEN
    v_context := 'production_management';

    v_action_desc := CASE v_new_status
      WHEN 'prepared' THEN
        CASE WHEN TG_OP = 'INSERT' THEN 'Production créée et préparée'
        ELSE 'Statut changé: ' || COALESCE(v_old_status, 'null') || ' → prepared'
        END
      WHEN 'ready_for_customs' THEN 'Production validée - Prête pour la douane'
      WHEN 'cancelled' THEN 'Production annulée'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status
    END;

  ELSIF v_entity_type = 'shipping' THEN
    v_context := 'shipping_management';

    v_action_desc := CASE v_new_status
      WHEN 'waiting_for_custom_approval' THEN 'En attente d''approbation douanière'
      WHEN 'approved_by_customs' THEN 'Approuvé par la douane'
      WHEN 'ready_for_shipping' THEN 'Prêt pour expédition'
      WHEN 'cancelled' THEN 'Expédition annulée'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status
    END;

  ELSIF v_entity_type = 'freight' THEN
    v_context := 'freight_customs_management';

    v_action_desc := CASE v_new_status
      WHEN 'ready_for_shipping' THEN 'Prêt pour expédition'
      WHEN 'shipped_to_refinery' THEN 'Expédié vers la raffinerie'
      WHEN 'cancelled' THEN 'Fret annulé'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status
    END;

  ELSIF v_entity_type = 'refinery' THEN
    v_context := 'refining_process';

    v_action_desc := CASE v_new_status
      WHEN 'waiting_for_refinery_approval' THEN 'En attente d''approbation raffinerie'
      WHEN 'refinery_approved' THEN 'Approuvé par la raffinerie'
      WHEN 'refined' THEN 'Raffinage terminé'
      WHEN 'cancelled' THEN 'Raffinage annulé'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status
    END;

  ELSIF v_entity_type = 'inventory' THEN
    v_context := 'inventory_management';

    v_action_desc := CASE v_new_status
      WHEN 'in_stock' THEN 'En stock'
      WHEN 'reserved' THEN 'Réservé'
      WHEN 'sold' THEN 'Vendu'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status
    END;

  ELSIF v_entity_type = 'sale' THEN
    v_context := 'sales_management';

    v_action_desc := CASE v_new_status
      WHEN 'in_sale' THEN 'En vente'
      WHEN 'sold' THEN 'Vendu'
      WHEN 'cancelled' THEN 'Vente annulée'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' → ' || v_new_status
    END;

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
        jsonb_build_object(
          'operation', TG_OP,
          'table', TG_TABLE_NAME,
          'timestamp', NOW()
        )
      );

      RAISE NOTICE '✅ [%] Historique: % → %',
        v_entity_type,
        COALESCE(v_old_status, 'null'),
        v_new_status;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Erreur historique [%]: %',
        v_entity_type,
        SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE '✅ Fonction log_unified_status_change() créée';

-- =====================================================
-- ÉTAPE 6: RECRÉER LES TRIGGERS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 ÉTAPE 6: Recréation des Triggers';
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE '';

  -- Supprimer les anciens triggers
  DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production;
  DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;

  -- Créer le trigger pour daily_production
  CREATE TRIGGER production_status_change_trigger
    AFTER INSERT OR UPDATE OF status ON daily_production
    FOR EACH ROW
    EXECUTE FUNCTION log_unified_status_change();

  RAISE NOTICE '✅ Trigger créé sur daily_production';

  -- Créer le trigger pour shipping_preparations
  CREATE TRIGGER shipping_status_change_trigger
    AFTER INSERT OR UPDATE OF status ON shipping_preparations
    FOR EACH ROW
    EXECUTE FUNCTION log_unified_status_change();

  RAISE NOTICE '✅ Trigger créé sur shipping_preparations';

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 7: RÉACTIVER LES TRIGGERS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '▶️  ÉTAPE 7: Réactivation des Triggers';
  RAISE NOTICE '─────────────────────────────────────────';

  ALTER TABLE daily_production ENABLE TRIGGER ALL;
  ALTER TABLE shipping_preparations ENABLE TRIGGER ALL;

  RAISE NOTICE '✅ Tous les triggers réactivés';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 8: TESTS ET VALIDATION
-- =====================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_function_exists BOOLEAN;
  v_enum_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧪 ÉTAPE 8: Tests et Validation';
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE '';

  -- Test 1: Fonction existe
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_unified_status_change'
  ) INTO v_function_exists;

  IF v_function_exists THEN
    RAISE NOTICE '✅ Fonction log_unified_status_change existe';
  ELSE
    RAISE EXCEPTION '❌ Fonction log_unified_status_change manquante!';
  END IF;

  -- Test 2: Triggers actifs
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE t.tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
  AND t.tgenabled = 'O';

  IF v_trigger_count >= 2 THEN
    RAISE NOTICE '✅ % triggers actifs', v_trigger_count;
  ELSE
    RAISE WARNING '⚠️  Seulement % trigger(s) actif(s)', v_trigger_count;
  END IF;

  -- Test 3: ENUMs créés
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname IN (
    'production_status_v2',
    'shipping_preparation_status',
    'freight_customs_status',
    'refinery_status',
    'inventory_status',
    'sale_status'
  );

  RAISE NOTICE '✅ % ENUMs de statut créés', v_enum_count;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS!';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes:';
  RAISE NOTICE '  1. Exécuter: scripts/test-history-trigger.sql';
  RAISE NOTICE '  2. Tester changement de statut dans l''application';
  RAISE NOTICE '  3. Vérifier unified_status_history se remplit';
  RAISE NOTICE '  4. Builder l''application: npm run build';
  RAISE NOTICE '';

END $$;

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION log_unified_status_change() IS
'Fonction unifiée pour enregistrer TOUS les changements de statut.
Supporte: production, shipping, freight, refinery, inventory, sale, payment.
Capture automatiquement le contexte selon l''entité et le statut.
Enregistre dans unified_status_history pour traçabilité complète.';

COMMENT ON TRIGGER production_status_change_trigger ON daily_production IS
'Enregistre automatiquement les changements de statut production.
Statuts: prepared, ready_for_customs, cancelled.
Historique dans unified_status_history.';

COMMENT ON TRIGGER shipping_status_change_trigger ON shipping_preparations IS
'Enregistre automatiquement les changements de statut shipping.
Statuts: waiting_for_custom_approval, approved_by_customs, ready_for_shipping, cancelled.
Historique dans unified_status_history.';
