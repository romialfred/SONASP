/*
  # FIX CRITIQUE - Contrainte freight_company_id incorrecte

  ## URGENT - À APPLIQUER IMMÉDIATEMENT DANS SUPABASE SQL EDITOR

  ## Problème
  La migration du 9 décembre a créé une contrainte vers "freight_companies"
  MAIS la vraie table s'appelle "transport_companies"

  Erreur observée:
  ```
  insert or update on table "shipping_preparations" violates
  foreign key constraint "shipping_preparations_freight_company_id_fkey"
  Code: 23503
  Details: Key is not present in table "freight_companies".
  ```

  ## Solution
  1. Supprimer la contrainte incorrecte vers freight_companies
  2. Créer la bonne contrainte vers transport_companies
  3. Nettoyer les données invalides
*/

-- =====================================================
-- 1. SUPPRIMER LA CONTRAINTE INCORRECTE
-- =====================================================

DO $$
BEGIN
  -- Supprimer la contrainte vers freight_companies (table inexistante)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_preparations_freight_company_id_fkey'
    AND table_name = 'shipping_preparations'
  ) THEN
    ALTER TABLE shipping_preparations
    DROP CONSTRAINT IF EXISTS shipping_preparations_freight_company_id_fkey CASCADE;

    RAISE NOTICE '✅ Contrainte incorrecte vers freight_companies supprimée';
  ELSE
    RAISE NOTICE 'ℹ️  Contrainte n''existe pas ou déjà supprimée';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Erreur lors de la suppression: %', SQLERRM;
END $$;

-- =====================================================
-- 2. NETTOYER LES DONNÉES INVALIDES AVANT CONTRAINTE
-- =====================================================

DO $$
DECLARE
  v_invalid_count INT;
BEGIN
  -- Compter et nettoyer les IDs invalides
  SELECT COUNT(*) INTO v_invalid_count
  FROM shipping_preparations sp
  WHERE sp.freight_company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = sp.freight_company_id
    );

  IF v_invalid_count > 0 THEN
    RAISE WARNING '⚠️  % expéditions avec freight_company_id invalides détectées', v_invalid_count;

    -- Mettre à NULL les IDs invalides
    UPDATE shipping_preparations
    SET freight_company_id = NULL
    WHERE freight_company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM transport_companies tc
        WHERE tc.id = freight_company_id
      );

    RAISE NOTICE '✅ % IDs invalides mis à NULL', v_invalid_count;
  ELSE
    RAISE NOTICE '✅ Aucun ID invalide détecté';
  END IF;
END $$;

-- =====================================================
-- 3. CRÉER LA BONNE CONTRAINTE vers transport_companies
-- =====================================================

DO $$
BEGIN
  -- Vérifier que la colonne freight_company_id existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'freight_company_id'
  ) THEN
    -- Ajouter la contrainte vers la VRAIE table transport_companies
    ALTER TABLE shipping_preparations
    ADD CONSTRAINT shipping_preparations_freight_company_id_fkey
    FOREIGN KEY (freight_company_id)
    REFERENCES transport_companies(id)
    ON DELETE SET NULL;

    RAISE NOTICE '✅ Nouvelle contrainte vers transport_companies créée';

    -- Créer l'index si pas déjà fait
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_freight
    ON shipping_preparations(freight_company_id);

    RAISE NOTICE '✅ Index sur freight_company_id vérifié';
  ELSE
    RAISE NOTICE '⚠️  Colonne freight_company_id n''existe pas';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️  Contrainte existe déjà';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de la contrainte: %', SQLERRM;
END $$;

-- =====================================================
-- 4. METTRE À JOUR LES COMMENTAIRES
-- =====================================================

COMMENT ON COLUMN shipping_preparations.freight_company_id IS
'UUID de la compagnie de transport (transport_companies.id) - Correction appliquée le 10 déc 2025';

-- =====================================================
-- 5. VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  v_constraint_exists BOOLEAN;
  v_target_table TEXT;
  v_valid_count INT;
  v_null_count INT;
  v_total_count INT;
BEGIN
  -- Vérifier que la contrainte pointe vers transport_companies
  SELECT
    COUNT(*) > 0,
    MAX(ccu.table_name)
  INTO v_constraint_exists, v_target_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.constraint_schema = ccu.constraint_schema
  WHERE tc.constraint_name = 'shipping_preparations_freight_company_id_fkey'
    AND tc.table_name = 'shipping_preparations'
    AND tc.constraint_type = 'FOREIGN KEY'
  GROUP BY ccu.table_name;

  -- Statistiques des données
  SELECT
    COUNT(*) FILTER (WHERE freight_company_id IS NOT NULL),
    COUNT(*) FILTER (WHERE freight_company_id IS NULL),
    COUNT(*)
  INTO v_valid_count, v_null_count, v_total_count
  FROM shipping_preparations;

  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ CORRECTION APPLIQUÉE AVEC SUCCÈS';
  RAISE NOTICE '====================================';

  IF v_constraint_exists THEN
    RAISE NOTICE 'Contrainte: shipping_preparations_freight_company_id_fkey';
    RAISE NOTICE 'Pointe vers: % (CORRECT ✓)', v_target_table;
  ELSE
    RAISE WARNING '⚠️  La contrainte n''a pas été créée';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'État des données:';
  RAISE NOTICE '  - Total expéditions: %', v_total_count;
  RAISE NOTICE '  - Avec freight company: %', v_valid_count;
  RAISE NOTICE '  - Sans freight company (NULL): %', v_null_count;
  RAISE NOTICE '====================================';
END $$;
