/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  DIAGNOSTIC COMPLET - inventory_transactions                            ║
  ║  Analyse TOUT ce qui peut référencer batch_id                           ║
  ╚══════════════════════════════════════════════════════════════════════════╝
  
  INSTRUCTIONS:
  1. Ouvrez Supabase SQL Editor
  2. Copiez et exécutez ce script
  3. Examinez TOUS les résultats
  4. Envoyez-moi les résultats pour analyse
*/

-- ============================================================================
-- SECTION 1: Structure de la table inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 1: STRUCTURE DE inventory_transactions              ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

-- Lister TOUTES les colonnes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory_transactions'
ORDER BY ordinal_position;

-- ============================================================================
-- SECTION 2: Toutes les VUES qui référencent inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 2: VUES LIÉES À inventory_transactions              ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%inventory_transactions%'
ORDER BY viewname;

-- ============================================================================
-- SECTION 3: Vues qui référencent spécifiquement batch_id
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
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%batch_id%'
ORDER BY viewname;

-- ============================================================================
-- SECTION 4: Tous les INDEX sur inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 4: INDEX SUR inventory_transactions                 ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  i.relname AS index_name,
  a.attname AS column_name,
  am.amname AS index_type
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_am am ON i.relam = am.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname = 'inventory_transactions'
  AND t.relkind = 'r'
ORDER BY i.relname, a.attnum;

-- ============================================================================
-- SECTION 5: Contraintes sur inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 5: CONTRAINTES                                      ║';
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
-- SECTION 6: Fonctions qui SÉLECTIONNENT depuis inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 6: FONCTIONS SÉLECTIONNANT inventory_transactions   ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%FROM inventory_transactions%'
ORDER BY p.proname;

-- ============================================================================
-- SECTION 7: Fonctions qui INSÈRENT dans inventory_transactions
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 7: FONCTIONS INSÉRANT dans inventory_transactions   ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%INSERT INTO inventory_transactions%'
ORDER BY p.proname;

-- ============================================================================
-- SECTION 8: Triggers sur gold_inventory (qui créent des transactions)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 8: TRIGGERS SUR gold_inventory                      ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_definition,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'gold_inventory'
  AND t.tgname NOT LIKE 'pg_%'
ORDER BY t.tgname;

-- ============================================================================
-- SECTION 9: Vérifier si batch_id existe QUELQUE PART
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 9: RECHERCHE GLOBALE DE batch_id                    ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

-- Dans les tables
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'batch_id'
ORDER BY table_name;

-- ============================================================================
-- SECTION 10: Test d'insertion directe
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  SECTION 10: TEST D''INSERTION DIRECTE                        ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Test: Insérer directement dans inventory_transactions...';
  
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
      'TEST INSERT'
    );
    
    RAISE NOTICE '✅ Insertion directe RÉUSSIE!';
    RAISE NOTICE '   → La table inventory_transactions fonctionne correctement';
    RAISE NOTICE '   → Le problème vient d''ailleurs (vue, fonction, trigger)';
    
    -- Nettoyer le test
    DELETE FROM inventory_transactions WHERE transaction_reference = 'TEST INSERT';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Insertion directe ÉCHOUÉE!';
    RAISE NOTICE '   Erreur: %', SQLERRM;
    RAISE NOTICE '   → Le problème est dans la table elle-même';
  END;
  
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- RÉSUMÉ FINAL
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ DIAGNOSTIC TERMINÉ                                        ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Examinez tous les résultats ci-dessus.';
  RAISE NOTICE '';
  RAISE NOTICE 'Cherchez particulièrement:';
  RAISE NOTICE '  1. Des VUES qui sélectionnent batch_id';
  RAISE NOTICE '  2. Des INDEX sur batch_id';
  RAISE NOTICE '  3. Des FONCTIONS qui utilisent batch_id';
  RAISE NOTICE '  4. Des TRIGGERS qui insèrent batch_id';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Si vous trouvez batch_id quelque part, c''est le coupable!';
  RAISE NOTICE '';
END $$;
