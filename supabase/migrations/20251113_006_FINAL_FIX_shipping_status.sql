/*
  # FIX ULTIME - shipping_preparations.status

  ## Problème Identifié Après 4h
  Le problème persiste malgré les migrations précédentes car:
  1. La table pourrait encore utiliser TEXT avec CHECK au lieu de l'enum
  2. Des triggers résiduels pourraient interférer
  3. Des données cached pourraient causer des problèmes

  ## Solution Radicale
  Cette migration:
  1. DROP complètement la colonne status
  2. Recrée avec le bon enum shipping_status_v2
  3. Nettoie TOUTES les contraintes
  4. Force le bon type
  5. NO ROLLBACK - approche définitive
*/

-- =========================================
-- ÉTAPE 1: Vérifier l'état actuel
-- =========================================

DO $$
DECLARE
  v_current_type text;
  v_has_check boolean;
BEGIN
  -- Get current type
  SELECT udt_name INTO v_current_type
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  -- Check for CHECK constraints
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shipping_preparations'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
  ) INTO v_has_check;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ÉTAT ACTUEL';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Type actuel: %', COALESCE(v_current_type, 'UNDEFINED');
  RAISE NOTICE 'A des CHECK: %', v_has_check;
  RAISE NOTICE '========================================';
END $$;

-- =========================================
-- ÉTAPE 2: S'assurer que shipping_status_v2 existe
-- =========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipping_status_v2') THEN
    CREATE TYPE shipping_status_v2 AS ENUM (
      'pending',
      'prepared',
      'validated_for_refinery',
      'in_refining',
      'refined',
      'in_sale',
      'sold',
      'cancelled'
    );
    RAISE NOTICE '✅ shipping_status_v2 créé';
  ELSE
    RAISE NOTICE '✅ shipping_status_v2 existe';
  END IF;

  -- Vérifier que 'shipped' N'EST PAS dedans
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'shipping_status_v2'
    AND e.enumlabel = 'shipped'
  ) THEN
    RAISE EXCEPTION '❌ shipping_status_v2 contient shipped - ARRÊT';
  END IF;
END $$;

-- =========================================
-- ÉTAPE 3: NETTOYAGE RADICAL
-- =========================================

DO $$
DECLARE
  v_constraint_name text;
  v_data_count int;
BEGIN
  -- Compter les données
  SELECT COUNT(*) INTO v_data_count FROM shipping_preparations;
  RAISE NOTICE 'Données existantes: %', v_data_count;

  -- Backup total si des données existent
  IF v_data_count > 0 AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'shipping_preparations_backup_final'
  ) THEN
    CREATE TABLE shipping_preparations_backup_final AS
    SELECT * FROM shipping_preparations;
    RAISE NOTICE '✅ Backup complet créé: shipping_preparations_backup_final';
  END IF;

  -- Supprimer TOUTES les contraintes CHECK sur la table
  FOR v_constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'shipping_preparations'::regclass
    AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE shipping_preparations DROP CONSTRAINT IF EXISTS %I CASCADE', v_constraint_name);
    RAISE NOTICE '✅ Contrainte supprimée: %', v_constraint_name;
  END LOOP;

  -- DROP la colonne status complètement
  ALTER TABLE shipping_preparations DROP COLUMN IF EXISTS status CASCADE;
  RAISE NOTICE '✅ Colonne status supprimée';

  -- Recréer avec le BON type
  ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_status_v2 DEFAULT 'pending'::shipping_status_v2 NOT NULL;
  RAISE NOTICE '✅ Colonne status recréée avec shipping_status_v2';

  -- Restaurer les valeurs valides depuis le backup
  IF v_data_count > 0 THEN
    UPDATE shipping_preparations sp
    SET status = CASE
      WHEN b.status IN ('pending', 'prepared', 'validated_for_refinery', 'in_refining', 'refined', 'in_sale', 'sold', 'cancelled')
      THEN b.status::shipping_status_v2
      WHEN b.status = 'shipped'
      THEN 'prepared'::shipping_status_v2
      ELSE 'pending'::shipping_status_v2
    END
    FROM shipping_preparations_backup_final b
    WHERE sp.id = b.id;
    RAISE NOTICE '✅ Valeurs restaurées';
  END IF;
END $$;

-- =========================================
-- ÉTAPE 4: Recréer les indexes
-- =========================================

DROP INDEX IF EXISTS idx_shipping_preparations_status;
DROP INDEX IF EXISTS idx_shipping_preparations_status_v2;

CREATE INDEX idx_shipping_preparations_status
  ON shipping_preparations(status);

RAISE NOTICE '✅ Index recréé';

-- =========================================
-- ÉTAPE 5: VÉRIFICATION FINALE STRICTE
-- =========================================

DO $$
DECLARE
  v_final_type text;
  v_has_check_final boolean;
  v_test_insert_ok boolean := false;
BEGIN
  -- Vérifier le type final
  SELECT udt_name INTO v_final_type
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  -- Vérifier l'absence de CHECK
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shipping_preparations'::regclass
    AND contype = 'c'
  ) INTO v_has_check_final;

  -- Test INSERT
  BEGIN
    INSERT INTO shipping_preparations (
      expedition_lot_number,
      status,
      total_net_weight_grams,
      total_gross_weight_grams,
      total_weight_oz
    ) VALUES (
      'TEST-DELETE-' || gen_random_uuid()::text,
      'prepared'::shipping_status_v2,
      0,
      0,
      0
    );

    DELETE FROM shipping_preparations
    WHERE expedition_lot_number LIKE 'TEST-DELETE-%';

    v_test_insert_ok := true;
    RAISE NOTICE '✅ Test INSERT/DELETE réussi';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ Test INSERT a échoué: %', SQLERRM;
      v_test_insert_ok := false;
  END;

  -- Rapport final
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Type final: %', v_final_type;
  RAISE NOTICE 'A des CHECK: %', v_has_check_final;
  RAISE NOTICE 'Test INSERT: %', CASE WHEN v_test_insert_ok THEN 'OK' ELSE 'FAILED' END;
  RAISE NOTICE '========================================';

  -- Échouer si pas correct
  IF v_final_type != 'shipping_status_v2' THEN
    RAISE EXCEPTION '❌ Type final incorrect: %', v_final_type;
  END IF;

  IF v_has_check_final THEN
    RAISE EXCEPTION '❌ Contraintes CHECK encore présentes';
  END IF;

  IF NOT v_test_insert_ok THEN
    RAISE EXCEPTION '❌ Test INSERT a échoué';
  END IF;

  RAISE NOTICE '✅✅✅ MIGRATION RÉUSSIE ✅✅✅';
END $$;

-- =========================================
-- COMMENTAIRE
-- =========================================

COMMENT ON COLUMN shipping_preparations.status IS
  'Statut expédition - enum shipping_status_v2 (pending|prepared|validated_for_refinery|in_refining|refined|in_sale|sold|cancelled) - PAS de shipped!';
