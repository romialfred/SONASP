/*
  # FIX SIMPLE - shipping_preparations.status

  Version simplifiée sans RAISE NOTICE optionnels
  Si la version 006 donne des erreurs de syntaxe, utiliser celle-ci
*/

-- =========================================
-- ÉTAPE 1: Vérifier et créer l'enum
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
  END IF;
END $$;

-- =========================================
-- ÉTAPE 2: Backup complet
-- =========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'shipping_preparations_backup_simple'
  ) THEN
    CREATE TABLE shipping_preparations_backup_simple AS
    SELECT * FROM shipping_preparations;
  END IF;
END $$;

-- =========================================
-- ÉTAPE 3: Supprimer contraintes et colonne
-- =========================================

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Supprimer toutes les contraintes CHECK
  FOR v_constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'shipping_preparations'::regclass
    AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE shipping_preparations DROP CONSTRAINT IF EXISTS %I CASCADE', v_constraint_name);
  END LOOP;

  -- Supprimer la colonne status
  ALTER TABLE shipping_preparations DROP COLUMN IF EXISTS status CASCADE;
END $$;

-- =========================================
-- ÉTAPE 4: Recréer la colonne
-- =========================================

ALTER TABLE shipping_preparations
  ADD COLUMN status shipping_status_v2 DEFAULT 'pending'::shipping_status_v2 NOT NULL;

-- =========================================
-- ÉTAPE 5: Restaurer les données
-- =========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations_backup_simple') THEN
    UPDATE shipping_preparations sp
    SET status = CASE
      WHEN b.status::text IN ('pending', 'prepared', 'validated_for_refinery', 'in_refining', 'refined', 'in_sale', 'sold', 'cancelled')
      THEN b.status::text::shipping_status_v2
      WHEN b.status::text = 'shipped'
      THEN 'prepared'::shipping_status_v2
      ELSE 'pending'::shipping_status_v2
    END
    FROM shipping_preparations_backup_simple b
    WHERE sp.id = b.id;
  END IF;
END $$;

-- =========================================
-- ÉTAPE 6: Recréer l'index
-- =========================================

DROP INDEX IF EXISTS idx_shipping_preparations_status;
DROP INDEX IF EXISTS idx_shipping_preparations_status_v2;

CREATE INDEX idx_shipping_preparations_status
  ON shipping_preparations(status);

-- =========================================
-- ÉTAPE 7: Test final
-- =========================================

DO $$
DECLARE
  v_test_id uuid;
BEGIN
  -- Test INSERT
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
  ) RETURNING id INTO v_test_id;

  -- Cleanup
  DELETE FROM shipping_preparations WHERE id = v_test_id;

  -- Si on arrive ici, c'est OK
  RAISE NOTICE '✅ Migration réussie - Test INSERT/DELETE OK';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ Migration échouée: %', SQLERRM;
END $$;

-- Commentaire final
COMMENT ON COLUMN shipping_preparations.status IS
  'Statut expédition - enum shipping_status_v2 (NO shipped!)';
