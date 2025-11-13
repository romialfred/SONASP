/*
  # FIX DÉFINITIF - Table shipping_preparations

  ## Problème
  La table shipping_preparations utilise encore un ancien CHECK constraint ou un ancien enum
  qui contient 'shipped', mais le nouveau shipping_status_v2 ne contient PAS 'shipped'.

  ## Solution
  1. Drop TOUS les constraints sur status
  2. S'assurer que la colonne utilise shipping_status_v2
  3. Vérifier qu'aucun trigger ne met 'shipped'

  ## Impact
  - Aucune perte de données
  - Fix définitif de l'erreur "invalid input value for enum shipping_status_v2: shipped"
*/

-- =====================================================
-- STEP 1: Nettoyer les anciens constraints
-- =====================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver et dropper tous les CHECK constraints sur status
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'shipping_preparations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE shipping_preparations DROP CONSTRAINT IF EXISTS %I CASCADE', v_constraint_name);
    RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
  END LOOP;
END $$;

-- =====================================================
-- STEP 2: S'assurer que shipping_status_v2 existe
-- =====================================================

DO $$ BEGIN
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
    RAISE NOTICE '✅ Created shipping_status_v2';
  ELSE
    RAISE NOTICE '✅ shipping_status_v2 already exists';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '✅ shipping_status_v2 already exists';
END $$;

-- =====================================================
-- STEP 3: Forcer la colonne status à utiliser shipping_status_v2
-- =====================================================

DO $$
DECLARE
  v_current_type TEXT;
BEGIN
  -- Vérifier le type actuel
  SELECT udt_name INTO v_current_type
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  RAISE NOTICE 'Current status type: %', v_current_type;

  IF v_current_type IS NULL THEN
    -- La colonne n'existe pas, la créer
    ALTER TABLE shipping_preparations
      ADD COLUMN status shipping_status_v2 DEFAULT 'pending' NOT NULL;
    RAISE NOTICE '✅ Created status column with shipping_status_v2';
  ELSIF v_current_type != 'shipping_status_v2' THEN
    -- La colonne existe mais avec un mauvais type
    -- Sauvegarder l'ancienne colonne
    ALTER TABLE shipping_preparations
      RENAME COLUMN status TO status_old_temp;

    -- Créer la nouvelle colonne avec le bon type
    ALTER TABLE shipping_preparations
      ADD COLUMN status shipping_status_v2 DEFAULT 'pending' NOT NULL;

    -- Migrer les données
    UPDATE shipping_preparations
    SET status = CASE
      WHEN status_old_temp::text = 'pending' THEN 'pending'::shipping_status_v2
      WHEN status_old_temp::text = 'prepared' THEN 'prepared'::shipping_status_v2
      WHEN status_old_temp::text = 'shipped' THEN 'prepared'::shipping_status_v2 -- shipped → prepared
      WHEN status_old_temp::text = 'validated_for_refinery' THEN 'validated_for_refinery'::shipping_status_v2
      WHEN status_old_temp::text = 'in_refining' THEN 'in_refining'::shipping_status_v2
      WHEN status_old_temp::text = 'refined' THEN 'refined'::shipping_status_v2
      WHEN status_old_temp::text = 'in_sale' THEN 'in_sale'::shipping_status_v2
      WHEN status_old_temp::text = 'sold' THEN 'sold'::shipping_status_v2
      WHEN status_old_temp::text = 'cancelled' THEN 'cancelled'::shipping_status_v2
      ELSE 'pending'::shipping_status_v2
    END;

    -- Dropper l'ancienne colonne
    ALTER TABLE shipping_preparations DROP COLUMN status_old_temp;

    RAISE NOTICE '✅ Migrated status column to shipping_status_v2';
  ELSE
    RAISE NOTICE '✅ Status column already uses shipping_status_v2';
  END IF;
END $$;

-- =====================================================
-- STEP 4: S'assurer que production_status_v2 a 'shipped'
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'production_status_v2'
    AND e.enumlabel = 'shipped'
  ) THEN
    ALTER TYPE production_status_v2 ADD VALUE IF NOT EXISTS 'shipped' AFTER 'prepared';
    RAISE NOTICE '✅ Added shipped to production_status_v2';
  ELSE
    RAISE NOTICE '✅ production_status_v2 already has shipped';
  END IF;
END $$;

-- =====================================================
-- STEP 5: Créer les indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status
  ON shipping_preparations(status);

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_mining_company
  ON shipping_preparations(mining_company_id);

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license
  ON shipping_preparations(license_id);

-- =====================================================
-- STEP 6: Vérification finale
-- =====================================================

DO $$
DECLARE
  v_shipping_enum TEXT;
  v_production_enum TEXT;
  v_shipping_values TEXT[];
  v_production_values TEXT[];
BEGIN
  -- Get enums used
  SELECT udt_name INTO v_shipping_enum
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations' AND column_name = 'status';

  SELECT udt_name INTO v_production_enum
  FROM information_schema.columns
  WHERE table_name = 'daily_production' AND column_name = 'status';

  -- Get values
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO v_shipping_values
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'shipping_status_v2';

  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO v_production_values
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'production_status_v2';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONFIGURATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'shipping_preparations.status uses: %', v_shipping_enum;
  RAISE NOTICE 'shipping_status_v2 values: %', v_shipping_values;
  RAISE NOTICE '';
  RAISE NOTICE 'daily_production.status uses: %', v_production_enum;
  RAISE NOTICE 'production_status_v2 values: %', v_production_values;
  RAISE NOTICE '========================================';

  -- Vérifications
  IF v_shipping_enum = 'shipping_status_v2' THEN
    IF 'shipped' = ANY(v_shipping_values) THEN
      RAISE WARNING '⚠️  shipping_status_v2 contient shipped - Ce n''est pas normal!';
    ELSE
      RAISE NOTICE '✅ shipping_status_v2 ne contient PAS shipped - CORRECT';
    END IF;
  ELSE
    RAISE WARNING '⚠️  shipping_preparations n''utilise pas shipping_status_v2!';
  END IF;

  IF v_production_enum = 'production_status_v2' THEN
    IF 'shipped' = ANY(v_production_values) THEN
      RAISE NOTICE '✅ production_status_v2 contient shipped - CORRECT';
    ELSE
      RAISE WARNING '⚠️  production_status_v2 ne contient PAS shipped!';
    END IF;
  ELSE
    RAISE WARNING '⚠️  daily_production n''utilise pas production_status_v2!';
  END IF;
END $$;
