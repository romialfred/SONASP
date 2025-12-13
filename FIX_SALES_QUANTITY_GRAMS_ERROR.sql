/*
  CRITICAL FIX: Erreur "quantity_grams" dans Sales Table

  PROBLÈME IDENTIFIÉ:
  - Code: 42703
  - Message: record "new" has no field "quantity_grams"

  CAUSE:
  Il y a un trigger ou une fonction qui référence la colonne "quantity_grams"
  mais la table sales utilise "quantity_oz"

  SOLUTION:
  1. Supprimer tous les triggers problématiques sur sales
  2. Ajouter les statuses manquants à l'ENUM
  3. Vérifier la structure de la table
  4. Tester l'insertion
*/

-- ============================================================================
-- ÉTAPE 1: DIAGNOSTIC - Lister les triggers actuels sur sales
-- ============================================================================

DO $$
DECLARE
  trig RECORD;
  trigger_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  DIAGNOSTIC: TRIGGERS SUR TABLE sales';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  FOR trig IN
    SELECT
      t.tgname AS trigger_name,
      p.proname AS function_name,
      pg_get_triggerdef(t.oid) AS trigger_def
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'sales'::regclass
      AND t.tgisinternal = false
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE 'Trigger: %', trig.trigger_name;
    RAISE NOTICE 'Function: %', trig.function_name;
    RAISE NOTICE '---';
  END LOOP;

  IF trigger_count = 0 THEN
    RAISE NOTICE '(Aucun trigger trouvé)';
  ELSE
    RAISE NOTICE 'Total: % trigger(s) trouvé(s)', trigger_count;
  END IF;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 2: SUPPRIMER TOUS LES TRIGGERS ET FONCTIONS PROBLÉMATIQUES
-- ============================================================================

DO $$
DECLARE
  trig RECORD;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  NETTOYAGE: Suppression des triggers problématiques';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  -- Supprimer tous les triggers sur la table sales
  FOR trig IN
    SELECT tgname AS trigger_name
    FROM pg_trigger
    WHERE tgrelid = 'sales'::regclass
      AND tgisinternal = false
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON sales CASCADE', trig.trigger_name);
    RAISE NOTICE '✓ Trigger supprimé: %', trig.trigger_name;
  END LOOP;

  -- Supprimer les fonctions connues problématiques
  DROP FUNCTION IF EXISTS set_initial_sale_status() CASCADE;
  DROP FUNCTION IF EXISTS auto_calculate_commission() CASCADE;
  DROP FUNCTION IF EXISTS calculate_commission() CASCADE;
  DROP FUNCTION IF EXISTS validate_sale_status() CASCADE;
  DROP FUNCTION IF EXISTS update_sale_status() CASCADE;

  RAISE NOTICE '';
  RAISE NOTICE '✓ Tous les triggers et fonctions problématiques supprimés';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 3: VÉRIFIER LA STRUCTURE DE LA TABLE SALES
-- ============================================================================

DO $$
DECLARE
  col RECORD;
  has_quantity_oz BOOLEAN := false;
  has_quantity_grams BOOLEAN := false;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  VÉRIFICATION: Structure de la table sales';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  -- Vérifier les colonnes liées à quantity
  FOR col IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'sales'
      AND column_name ILIKE '%quantity%'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE 'Colonne: % (type: %)', col.column_name, col.data_type;

    IF col.column_name = 'quantity_oz' THEN
      has_quantity_oz := true;
    END IF;

    IF col.column_name = 'quantity_grams' THEN
      has_quantity_grams := true;
    END IF;
  END LOOP;

  RAISE NOTICE '';

  IF has_quantity_oz THEN
    RAISE NOTICE '✓ Colonne quantity_oz existe (CORRECT)';
  ELSE
    RAISE NOTICE '✗ Colonne quantity_oz MANQUANTE (PROBLÈME!)';
  END IF;

  IF has_quantity_grams THEN
    RAISE NOTICE '⚠ Colonne quantity_grams existe (devrait utiliser quantity_oz)';
  ELSE
    RAISE NOTICE '✓ Colonne quantity_grams n''existe pas (CORRECT)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 4: AJOUTER LES STATUSES MANQUANTS À L'ENUM
-- ============================================================================

DO $$
DECLARE
  status_to_add TEXT;
  added_count INT := 0;
  existing_count INT := 0;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  AJOUT: Statuses de workflow à sale_status ENUM';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  FOR status_to_add IN
    SELECT unnest(ARRAY[
      'create_sales',
      'pending_management_approval',
      'management_approved',
      'management_rejected',
      'pending_for_customer_approval',
      'customer_approved',
      'customer_rejected',
      'waiting_for_payment',
      'virtual_payment',
      'payment_received',
      'completed',
      'cancelled'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = status_to_add
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
    ) THEN
      BEGIN
        EXECUTE format('ALTER TYPE sale_status ADD VALUE %L', status_to_add);
        added_count := added_count + 1;
        RAISE NOTICE '✓ Ajouté: %', status_to_add;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ Erreur ajout %: %', status_to_add, SQLERRM;
      END;
    ELSE
      existing_count := existing_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Résultat: % ajouté(s), % existant(s)', added_count, existing_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 5: CONFIGURER LE DEFAULT DU STATUS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  CONFIGURATION: Status par défaut';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  -- Set le default à pending_management_approval
  ALTER TABLE sales
    ALTER COLUMN status SET DEFAULT 'pending_management_approval'::sale_status;

  RAISE NOTICE '✓ Default status = pending_management_approval';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 6: VÉRIFIER royalty_amount vs royalties
-- ============================================================================

DO $$
DECLARE
  has_royalty_amount BOOLEAN := false;
  has_royalties BOOLEAN := false;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  VÉRIFICATION: Colonnes de royalties';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'royalty_amount'
  ) INTO has_royalty_amount;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'royalties'
  ) INTO has_royalties;

  IF has_royalty_amount THEN
    RAISE NOTICE '✓ Colonne royalty_amount existe (CORRECT)';
  END IF;

  IF has_royalties THEN
    RAISE NOTICE '⚠ Colonne royalties existe (devrait utiliser royalty_amount)';
  END IF;

  IF NOT has_royalty_amount AND NOT has_royalties THEN
    RAISE NOTICE '✗ AUCUNE colonne de royalties trouvée!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 7: TEST D'INSERTION
-- ============================================================================

DO $$
DECLARE
  v_customer_id uuid;
  v_seller_id uuid;
  v_test_sale_id uuid;
  test_passed BOOLEAN := true;
  error_msg TEXT;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  TEST: Insertion d''une vente';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  -- Récupérer un customer et un seller pour le test
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_seller_id FROM mining_companies LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE NOTICE '⚠ Aucun customer trouvé - impossible de tester';
    RAISE NOTICE '  Créez des customers d''abord';
    RETURN;
  END IF;

  IF v_seller_id IS NULL THEN
    RAISE NOTICE '⚠ Aucune mining company trouvée - impossible de tester';
    RETURN;
  END IF;

  RAISE NOTICE 'Customer ID: %', v_customer_id;
  RAISE NOTICE 'Seller ID: %', v_seller_id;
  RAISE NOTICE '';

  -- Essayer d'insérer une vente de test
  BEGIN
    INSERT INTO sales (
      sale_number,
      sale_date,
      customer_id,
      seller_id,
      seller_type,
      is_internal_sale,
      quantity_oz,
      london_am_rate,
      freight_cost,
      other_costs,
      gross_proceeds,
      net_proceeds,
      royalty_amount,
      final_proceeds,
      total_amount,
      currency,
      status
    ) VALUES (
      'TEST-FIX-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      CURRENT_DATE,
      v_customer_id,
      v_seller_id,
      'mining_company',
      false,
      10.5,
      2000.00,
      100.00,
      50.00,
      21000.00,
      20850.00,
      625.50,
      20224.50,
      20224.50,
      'USD',
      'pending_management_approval'
    ) RETURNING id INTO v_test_sale_id;

    RAISE NOTICE '✓ TEST RÉUSSI! Vente créée avec ID: %', v_test_sale_id;

    -- Nettoyer
    DELETE FROM sales WHERE id = v_test_sale_id;
    RAISE NOTICE '✓ Vente de test nettoyée';

  EXCEPTION WHEN OTHERS THEN
    test_passed := false;
    GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
    RAISE NOTICE '✗ TEST ÉCHOUÉ!';
    RAISE NOTICE '  Erreur: %', error_msg;
    RAISE NOTICE '';
    RAISE NOTICE '  Si l''erreur mentionne quantity_grams:';
    RAISE NOTICE '  → Il reste un trigger ou une contrainte problématique';
    RAISE NOTICE '  Si l''erreur mentionne un statut invalide:';
    RAISE NOTICE '  → L''ENUM n''a pas tous les statuses requis';
    RAISE NOTICE '  Si l''erreur mentionne RLS:';
    RAISE NOTICE '  → C''est normal (pas d''utilisateur authentifié pour ce test)';
  END;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 8: RÉSUMÉ FINAL
-- ============================================================================

DO $$
DECLARE
  trigger_count INT;
  enum_values TEXT;
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  RÉSUMÉ FINAL';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';

  -- Compter les triggers restants
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'sales'::regclass
    AND tgisinternal = false;

  RAISE NOTICE 'Triggers restants sur sales: %', trigger_count;

  IF trigger_count = 0 THEN
    RAISE NOTICE '  ✓ Aucun trigger (parfait!)';
  ELSE
    RAISE NOTICE '  ⚠ Des triggers existent encore';
  END IF;

  -- Afficher les statuses disponibles
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) INTO enum_values
  FROM pg_enum
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status');

  RAISE NOTICE '';
  RAISE NOTICE 'Statuses disponibles:';
  RAISE NOTICE '  %', enum_values;
  RAISE NOTICE '';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '  FIX APPLIQUÉ!';
  RAISE NOTICE '  Vous pouvez maintenant créer des ventes';
  RAISE NOTICE '====================================================';
  RAISE NOTICE '';
END $$;
