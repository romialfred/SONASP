-- ============================================================================
-- SCRIPT D'ANALYSE: Trouver TOUTES les fonctions avec batch_id
-- ============================================================================
-- À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔍 RECHERCHE DE TOUTES LES FONCTIONS AVEC batch_id';
  RAISE NOTICE '================================================================';
END $$;

-- Trouver toutes les fonctions qui mentionnent batch_id
SELECT
  p.proname AS function_name,
  n.nspname AS schema_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%batch_id%'
ORDER BY p.proname;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '🔍 RECHERCHE DE TOUS LES TRIGGERS LIÉS À inventory_transactions';
  RAISE NOTICE '================================================================';
END $$;

-- Trouver tous les triggers sur gold_inventory
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'gold_inventory'
  AND t.tgname NOT LIKE 'pg_%'
ORDER BY t.tgname;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ANALYSE TERMINÉE';
  RAISE NOTICE '';
  RAISE NOTICE 'Examinez les résultats ci-dessus pour identifier';
  RAISE NOTICE 'toutes les fonctions qui doivent être corrigées.';
END $$;
