/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  DIAGNOSTIC SIMPLE - inventory_transactions                             ║
  ║  Version sans erreur - Analyse essentielle                              ║
  ╚══════════════════════════════════════════════════════════════════════════╝
*/

-- ============================================================================
-- SECTION 1: Colonnes de inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 1: COLONNES DE inventory_transactions               ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory_transactions'
ORDER BY ordinal_position;

-- ============================================================================
-- SECTION 2: batch_id existe-t-il dans inventory_transactions?
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 2: VÉRIFICATION batch_id                           ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  
  SELECT COUNT(*)
  INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'inventory_transactions'
    AND column_name = 'batch_id';
  
  IF v_count > 0 THEN
    RAISE NOTICE '❌ batch_id existe encore dans inventory_transactions';
  ELSE
    RAISE NOTICE '✅ batch_id n''existe PAS dans inventory_transactions';
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: Vues avec batch_id
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 3: VUES AVEC batch_id                               ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  viewname,
  LEFT(definition, 200) AS definition_preview
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%batch_id%'
ORDER BY viewname;

-- ============================================================================
-- SECTION 4: Contraintes sur inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 4: CONTRAINTES                                      ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'inventory_transactions'::regclass
ORDER BY conname;

-- ============================================================================
-- SECTION 5: Fonctions qui mentionnent batch_id
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 5: FONCTIONS AVEC batch_id                          ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  p.proname AS function_name,
  LEFT(pg_get_functiondef(p.oid), 500) AS function_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%batch_id%'
ORDER BY p.proname;

-- ============================================================================
-- SECTION 6: Fonctions qui insèrent dans inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 6: FONCTIONS INSÉRANT inventory_transactions        ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  p.proname AS function_name,
  LEFT(pg_get_functiondef(p.oid), 500) AS function_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%INSERT INTO inventory_transactions%'
ORDER BY p.proname;

-- ============================================================================
-- SECTION 7: Triggers sur gold_inventory
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 7: TRIGGERS SUR gold_inventory                      ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'gold_inventory'
  AND t.tgname NOT LIKE 'pg_%'
ORDER BY t.tgname;

-- ============================================================================
-- SECTION 8: Recherche batch_id dans TOUTES les tables
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 8: batch_id DANS TOUTES LES TABLES                  ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'batch_id'
ORDER BY table_name;

-- ============================================================================
-- SECTION 9: Test d'insertion directe
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 9: TEST D''INSERTION                                 ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  
  BEGIN
    INSERT INTO inventory_transactions (
      transaction_type,
      inventory_id,
      freight_shipment_id,
      quantity_oz,
      quantity_grams,
      balance_before_oz,
      balance_after_oz,
      transaction_reference
    ) VALUES (
      'entry',
      gen_random_uuid(),
      NULL,
      10.5,
      326.59,
      0,
      10.5,
      'DIAGNOSTIC TEST'
    );
    
    RAISE NOTICE '✅ Insertion directe RÉUSSIE!';
    RAISE NOTICE '   → inventory_transactions fonctionne';
    RAISE NOTICE '   → Problème = vue/fonction/trigger';
    
    DELETE FROM inventory_transactions WHERE transaction_reference = 'DIAGNOSTIC TEST';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Insertion ÉCHOUÉE!';
    RAISE NOTICE '   Erreur: %', SQLERRM;
    RAISE NOTICE '   Code: %', SQLSTATE;
  END;
END $$;

-- ============================================================================
-- SECTION 10: Résumé et Recommandations
-- ============================================================================
DO $$
DECLARE
  v_batch_id_count INTEGER;
  v_views_count INTEGER;
  v_functions_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 10: RÉSUMÉ                                          ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  
  -- Compter batch_id
  SELECT COUNT(*)
  INTO v_batch_id_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'batch_id';
  
  -- Compter vues avec batch_id
  SELECT COUNT(*)
  INTO v_views_count
  FROM pg_views
  WHERE schemaname = 'public'
    AND definition ILIKE '%batch_id%';
  
  -- Compter fonctions avec batch_id
  SELECT COUNT(*)
  INTO v_functions_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND pg_get_functiondef(p.oid) ILIKE '%batch_id%';
  
  RAISE NOTICE 'Résultats:';
  RAISE NOTICE '  • Tables avec batch_id: %', v_batch_id_count;
  RAISE NOTICE '  • Vues avec batch_id: %', v_views_count;
  RAISE NOTICE '  • Fonctions avec batch_id: %', v_functions_count;
  RAISE NOTICE '';
  
  IF v_batch_id_count > 0 OR v_views_count > 0 OR v_functions_count > 0 THEN
    RAISE NOTICE '❌ PROBLÈME DÉTECTÉ!';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 SOLUTION:';
    RAISE NOTICE '   Exécutez FIX_BATCH_ID_MAINTENANT.sql';
  ELSE
    RAISE NOTICE '✅ Aucun batch_id trouvé!';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Le problème vient peut-être:';
    RAISE NOTICE '   1. Du cache navigateur (Ctrl+Shift+R)';
    RAISE NOTICE '   2. D''une ancienne version du code JS';
    RAISE NOTICE '   3. Vérifiez la console navigateur (F12)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
END $$;
