/*
  # FIX CRITIQUE - Contrainte freight_company_id incorrecte

  ## Problème
  La migration du 9 décembre 2025 a créé une contrainte vers "freight_companies"
  MAIS la vraie table s'appelle "transport_companies"

  Erreur: insert or update on table "shipping_preparations" violates
  foreign key constraint "shipping_preparations_freight_company_id_fkey"
  Code: 23503
  Details: Key is not present in table "freight_companies".

  ## Solution
  1. Supprimer la contrainte incorrecte
  2. Créer la bonne contrainte vers transport_companies
  3. Mettre à jour les commentaires
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
    DROP CONSTRAINT shipping_preparations_freight_company_id_fkey;

    RAISE NOTICE '✅ Contrainte incorrecte vers freight_companies supprimée';
  ELSE
    RAISE NOTICE 'ℹ️  Contrainte n''existe pas';
  END IF;
END $$;

-- =====================================================
-- 2. CRÉER LA BONNE CONTRAINTE vers transport_companies
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
  ELSE
    RAISE NOTICE '⚠️  Colonne freight_company_id n''existe pas';
  END IF;
END $$;

-- =====================================================
-- 3. METTRE À JOUR LE COMMENTAIRE
-- =====================================================

COMMENT ON COLUMN shipping_preparations.freight_company_id IS
'UUID de la compagnie de transport (transport_companies.id)';

-- =====================================================
-- 4. VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  v_constraint_exists BOOLEAN;
  v_target_table TEXT;
BEGIN
  -- Vérifier que la contrainte pointe vers transport_companies
  SELECT
    COUNT(*) > 0,
    ccu.table_name
  INTO v_constraint_exists, v_target_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_name = 'shipping_preparations_freight_company_id_fkey'
    AND tc.table_name = 'shipping_preparations'
  GROUP BY ccu.table_name;

  IF v_constraint_exists THEN
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ CORRECTION APPLIQUÉE AVEC SUCCÈS';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Contrainte: shipping_preparations_freight_company_id_fkey';
    RAISE NOTICE 'Pointe vers: % (CORRECT)', v_target_table;
    RAISE NOTICE '====================================';
  ELSE
    RAISE NOTICE '⚠️  La contrainte n''a pas pu être créée';
  END IF;
END $$;

-- =====================================================
-- 5. VÉRIFIER LES DONNÉES EXISTANTES
-- =====================================================

DO $$
DECLARE
  v_invalid_count INT;
  v_valid_count INT;
  v_null_count INT;
BEGIN
  -- Compter les IDs invalides (qui ne sont pas dans transport_companies)
  SELECT COUNT(*) INTO v_invalid_count
  FROM shipping_preparations sp
  WHERE sp.freight_company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = sp.freight_company_id
    );

  -- Compter les IDs valides
  SELECT COUNT(*) INTO v_valid_count
  FROM shipping_preparations sp
  WHERE sp.freight_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = sp.freight_company_id
    );

  -- Compter les NULL
  SELECT COUNT(*) INTO v_null_count
  FROM shipping_preparations
  WHERE freight_company_id IS NULL;

  RAISE NOTICE '====================================';
  RAISE NOTICE 'ÉTAT DES DONNÉES';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'IDs valides: %', v_valid_count;
  RAISE NOTICE 'IDs invalides: %', v_invalid_count;
  RAISE NOTICE 'NULL: %', v_null_count;

  IF v_invalid_count > 0 THEN
    RAISE WARNING '⚠️  % expéditions ont des freight_company_id invalides', v_invalid_count;
    RAISE NOTICE 'Définir ces IDs à NULL pour permettre les nouvelles insertions...';

    UPDATE shipping_preparations
    SET freight_company_id = NULL
    WHERE freight_company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM transport_companies tc
        WHERE tc.id = freight_company_id
      );

    RAISE NOTICE '✅ IDs invalides mis à NULL';
  END IF;

  RAISE NOTICE '====================================';
END $$;
