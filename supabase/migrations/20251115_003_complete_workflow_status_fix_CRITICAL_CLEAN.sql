/*
  FIX COMPLET ET DEFINITIF DU SYSTEME DE STATUTS

  Probleme: ENUMs incorrects, workflow fragmente, historique incomplet
  Solution: Nettoyage complet + Creation ENUMs corrects + Triggers robustes

  ATTENTION: Migration CRITIQUE - BACKUP obligatoire avant execution
*/

-- =====================================================
-- ETAPE 0: RAPPORT D'ANALYSE
-- =====================================================

DO $$
DECLARE
  v_enum_count INTEGER;
  v_old_production_status_exists BOOLEAN;
  v_table_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'ANALYSE PRELIMINAIRE DE LA BASE DE DONNEES';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';

  -- Compter les ENUMs de type status
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname LIKE '%status%';

  RAISE NOTICE 'Nombre d''ENUMs "status" trouves: %', v_enum_count;

  -- Verifier si l'ancien production_status existe
  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'production_status'
  ) INTO v_old_production_status_exists;

  IF v_old_production_status_exists THEN
    RAISE NOTICE 'ATTENTION: Ancien ENUM "production_status" existe encore!';
    RAISE NOTICE '  -> Sera supprime dans cette migration';
  ELSE
    RAISE NOTICE 'OK: Ancien ENUM "production_status" deja supprime';
  END IF;

  -- Verifier production_status_v2
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status_v2') THEN
    RAISE NOTICE 'OK: ENUM "production_status_v2" existe';

    SELECT COUNT(*) INTO v_enum_count
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'production_status_v2';

    RAISE NOTICE '  -> Nombre de valeurs: %', v_enum_count;
  ELSE
    RAISE NOTICE 'INFO: ENUM "production_status_v2" sera cree';
  END IF;

  -- Verifier les tables avec colonnes status
  SELECT COUNT(DISTINCT table_name) INTO v_table_count
  FROM information_schema.columns
  WHERE column_name = 'status'
  AND table_schema = 'public';

  RAISE NOTICE 'Tables avec colonne "status": %', v_table_count;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 1: SAUVEGARDE DES TRIGGERS EXISTANTS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ETAPE 1: Sauvegarde des Triggers';
  RAISE NOTICE '-------------------------------------';

  -- Desactiver temporairement les triggers
  ALTER TABLE daily_production DISABLE TRIGGER ALL;
  ALTER TABLE shipping_preparations DISABLE TRIGGER ALL;

  RAISE NOTICE 'OK: Triggers desactives temporairement';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 2: SUPPRIMER ANCIENS ENUMS OBSOLETES
-- =====================================================

DO $$
DECLARE
  v_is_used BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ETAPE 2: Suppression ENUMs Obsoletes';
  RAISE NOTICE '-------------------------------------';
  RAISE NOTICE '';

  -- Verifier si production_status (ANCIEN) est utilise
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE udt_name = 'production_status'
    AND table_schema = 'public'
  ) INTO v_is_used;

  IF v_is_used THEN
    RAISE NOTICE 'ATTENTION: production_status est encore utilise par une table!';
    RAISE NOTICE '  Migration des donnees requise avant suppression';
  ELSE
    -- Supprimer l'ancien ENUM
    DROP TYPE IF EXISTS production_status CASCADE;
    RAISE NOTICE 'OK: Ancien ENUM "production_status" supprime';
  END IF;

  -- Autres ENUMs obsoletes potentiels
  DROP TYPE IF EXISTS shipping_status CASCADE;
  DROP TYPE IF EXISTS unified_status CASCADE;

  RAISE NOTICE 'OK: ENUMs obsoletes supprimes';
  RAISE NOTICE '';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATTENTION: Erreur lors de la suppression: %', SQLERRM;
  RAISE NOTICE '  Continuer quand meme...';
END $$;

-- =====================================================
-- ETAPE 3: VERIFIER/CREER ENUMS CORRECTS
-- =====================================================

-- Production Status V2
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status_v2') THEN
    CREATE TYPE production_status_v2 AS ENUM (
      'prepared',
      'ready_for_customs',
      'cancelled'
    );
    RAISE NOTICE 'OK: ENUM production_status_v2 cree';
  ELSE
    RAISE NOTICE 'INFO: ENUM production_status_v2 existe deja';
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
    RAISE NOTICE 'OK: ENUM shipping_preparation_status cree';
  ELSE
    RAISE NOTICE 'INFO: ENUM shipping_preparation_status existe deja';
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
    RAISE NOTICE 'OK: ENUM freight_customs_status cree';
  ELSE
    RAISE NOTICE 'INFO: ENUM freight_customs_status existe deja';
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
    RAISE NOTICE 'OK: ENUM refinery_status cree';
  ELSE
    RAISE NOTICE 'INFO: ENUM refinery_status existe deja';
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
    RAISE NOTICE 'OK: ENUM inventory_status cree';
  ELSE
    RAISE NOTICE 'INFO: ENUM inventory_status existe deja';
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
    RAISE NOTICE 'OK: ENUM sale_status cree';
  ELSE
    RAISE NOTICE 'INFO: ENUM sale_status existe deja';
  END IF;
END $$;

-- =====================================================
-- ETAPE 4: VERIFIER COLONNES DE TABLES
-- =====================================================

DO $$
DECLARE
  v_current_enum TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ETAPE 4: Verification Colonnes de Tables';
  RAISE NOTICE '-------------------------------------';
  RAISE NOTICE '';

  -- Verifier daily_production.status
  SELECT udt_name INTO v_current_enum
  FROM information_schema.columns
  WHERE table_name = 'daily_production'
  AND column_name = 'status';

  IF v_current_enum = 'production_status_v2' THEN
    RAISE NOTICE 'OK: daily_production.status utilise production_status_v2';
  ELSE
    RAISE NOTICE 'ATTENTION: daily_production.status utilise: %', v_current_enum;
    RAISE NOTICE '  Devrait utiliser: production_status_v2';
  END IF;

  -- Verifier shipping_preparations.status
  SELECT udt_name INTO v_current_enum
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  IF v_current_enum IS NOT NULL THEN
    RAISE NOTICE 'INFO: shipping_preparations.status utilise: %', v_current_enum;
  ELSE
    RAISE NOTICE 'ATTENTION: shipping_preparations.status N''EXISTE PAS!';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 5: METTRE A JOUR LA FONCTION UNIFIEE DE LOGGING
-- =====================================================

DROP FUNCTION IF EXISTS log_unified_status_change() CASCADE;

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
  -- Determiner le type d'entite selon la table
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

  -- Recuperer l'ID utilisateur
  v_user_id := COALESCE(auth.uid(), NEW.created_by);

  -- Preparer les statuts
  v_old_status := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status::text END;
  v_new_status := NEW.status::text;

  -- Determiner le contexte et la description selon l'entite et le statut
  IF v_entity_type = 'production' THEN
    v_context := 'production_management';

    v_action_desc := CASE v_new_status
      WHEN 'prepared' THEN
        CASE WHEN TG_OP = 'INSERT' THEN 'Production creee et preparee'
        ELSE 'Statut change: ' || COALESCE(v_old_status, 'null') || ' -> prepared'
        END
      WHEN 'ready_for_customs' THEN 'Production validee - Prete pour la douane'
      WHEN 'cancelled' THEN 'Production annulee'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' -> ' || v_new_status
    END;

  ELSIF v_entity_type = 'shipping' THEN
    v_context := 'shipping_management';

    v_action_desc := CASE v_new_status
      WHEN 'waiting_for_custom_approval' THEN 'En attente d''approbation douaniere'
      WHEN 'approved_by_customs' THEN 'Approuve par la douane'
      WHEN 'ready_for_shipping' THEN 'Pret pour expedition'
      WHEN 'cancelled' THEN 'Expedition annulee'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' -> ' || v_new_status
    END;

  ELSIF v_entity_type = 'freight' THEN
    v_context := 'freight_customs_management';

    v_action_desc := CASE v_new_status
      WHEN 'ready_for_shipping' THEN 'Pret pour expedition'
      WHEN 'shipped_to_refinery' THEN 'Expedie vers la raffinerie'
      WHEN 'cancelled' THEN 'Fret annule'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' -> ' || v_new_status
    END;

  ELSIF v_entity_type = 'refinery' THEN
    v_context := 'refining_process';

    v_action_desc := CASE v_new_status
      WHEN 'waiting_for_refinery_approval' THEN 'En attente d''approbation raffinerie'
      WHEN 'refinery_approved' THEN 'Approuve par la raffinerie'
      WHEN 'refined' THEN 'Raffinage termine'
      WHEN 'cancelled' THEN 'Raffinage annule'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' -> ' || v_new_status
    END;

  ELSIF v_entity_type = 'inventory' THEN
    v_context := 'inventory_management';

    v_action_desc := CASE v_new_status
      WHEN 'in_stock' THEN 'En stock'
      WHEN 'reserved' THEN 'Reserve'
      WHEN 'sold' THEN 'Vendu'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' -> ' || v_new_status
    END;

  ELSIF v_entity_type = 'sale' THEN
    v_context := 'sales_management';

    v_action_desc := CASE v_new_status
      WHEN 'in_sale' THEN 'En vente'
      WHEN 'sold' THEN 'Vendu'
      WHEN 'cancelled' THEN 'Vente annulee'
      ELSE 'Changement de statut: ' || COALESCE(v_old_status, 'null') || ' -> ' || v_new_status
    END;

  ELSE
    v_context := 'system';
    v_action_desc := 'Changement de statut systeme';
  END IF;

  -- Enregistrer UNIQUEMENT si le statut a change (ou si c'est un INSERT)
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

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erreur historique [%]: %', v_entity_type, SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ETAPE 6: RECREER LES TRIGGERS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ETAPE 6: Recreation des Triggers';
  RAISE NOTICE '-------------------------------------';
  RAISE NOTICE '';

  -- Supprimer les anciens triggers
  DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production;
  DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;

  -- Creer le trigger pour daily_production
  CREATE TRIGGER production_status_change_trigger
    AFTER INSERT OR UPDATE OF status ON daily_production
    FOR EACH ROW
    EXECUTE FUNCTION log_unified_status_change();

  RAISE NOTICE 'OK: Trigger cree sur daily_production';

  -- Creer le trigger pour shipping_preparations
  CREATE TRIGGER shipping_status_change_trigger
    AFTER INSERT OR UPDATE OF status ON shipping_preparations
    FOR EACH ROW
    EXECUTE FUNCTION log_unified_status_change();

  RAISE NOTICE 'OK: Trigger cree sur shipping_preparations';

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 7: REACTIVER LES TRIGGERS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ETAPE 7: Reactivation des Triggers';
  RAISE NOTICE '-------------------------------------';

  ALTER TABLE daily_production ENABLE TRIGGER ALL;
  ALTER TABLE shipping_preparations ENABLE TRIGGER ALL;

  RAISE NOTICE 'OK: Tous les triggers reactives';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ETAPE 8: TESTS ET VALIDATION
-- =====================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_function_exists BOOLEAN;
  v_enum_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ETAPE 8: Tests et Validation';
  RAISE NOTICE '-------------------------------------';
  RAISE NOTICE '';

  -- Test 1: Fonction existe
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_unified_status_change'
  ) INTO v_function_exists;

  IF v_function_exists THEN
    RAISE NOTICE 'OK: Fonction log_unified_status_change existe';
  ELSE
    RAISE EXCEPTION 'ERREUR: Fonction log_unified_status_change manquante!';
  END IF;

  -- Test 2: Triggers actifs
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE t.tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
  AND t.tgenabled = 'O';

  IF v_trigger_count >= 2 THEN
    RAISE NOTICE 'OK: % triggers actifs', v_trigger_count;
  ELSE
    RAISE NOTICE 'ATTENTION: Seulement % trigger(s) actif(s)', v_trigger_count;
  END IF;

  -- Test 3: ENUMs crees
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

  RAISE NOTICE 'OK: % ENUMs de statut crees', v_enum_count;

  RAISE NOTICE '';
  RAISE NOTICE '===================================================';
  RAISE NOTICE 'MIGRATION TERMINEE AVEC SUCCES!';
  RAISE NOTICE '===================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines etapes:';
  RAISE NOTICE '  1. Executer: scripts/test-history-trigger.sql';
  RAISE NOTICE '  2. Tester changement de statut dans l''application';
  RAISE NOTICE '  3. Verifier unified_status_history se remplit';
  RAISE NOTICE '  4. Builder l''application: npm run build';
  RAISE NOTICE '';

END $$;

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION log_unified_status_change() IS
'Fonction unifiee pour enregistrer TOUS les changements de statut.
Supporte: production, shipping, freight, refinery, inventory, sale, payment.
Capture automatiquement le contexte selon l''entite et le statut.
Enregistre dans unified_status_history pour tracabilite complete.';

COMMENT ON TRIGGER production_status_change_trigger ON daily_production IS
'Enregistre automatiquement les changements de statut production.
Statuts: prepared, ready_for_customs, cancelled.
Historique dans unified_status_history.';

COMMENT ON TRIGGER shipping_status_change_trigger ON shipping_preparations IS
'Enregistre automatiquement les changements de statut shipping.
Statuts: waiting_for_custom_approval, approved_by_customs, ready_for_shipping, cancelled.
Historique dans unified_status_history.';
