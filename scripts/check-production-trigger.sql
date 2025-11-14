-- =====================================================
-- Script de Diagnostic: Trigger Production Status
-- =====================================================

-- 1. Vérifier si le trigger existe
SELECT
  'Trigger Status' as check_type,
  t.tgname as trigger_name,
  CASE
    WHEN t.tgenabled = 'O' THEN '✅ ENABLED'
    WHEN t.tgenabled = 'D' THEN '❌ DISABLED'
    ELSE '⚠️  UNKNOWN'
  END as status,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'daily_production'
  AND t.tgname = 'production_status_change_trigger';

-- 2. Vérifier la fonction du trigger
SELECT
  'Function Details' as check_type,
  proname as function_name,
  CASE
    WHEN prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '⚠️  NOT SECURITY DEFINER'
  END as security,
  prolang::regproc as language
FROM pg_proc
WHERE proname = 'log_production_status_change';

-- 3. Vérifier la table unified_status_history
SELECT
  'Table unified_status_history' as check_type,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN entity_type = 'production' THEN 1 END) as production_entries
FROM unified_status_history;

-- 4. Vérifier les dernières entrées d'historique
SELECT
  'Recent History' as check_type,
  entity_id,
  old_status,
  new_status,
  changed_at,
  changed_by
FROM unified_status_history
WHERE entity_type = 'production'
ORDER BY changed_at DESC
LIMIT 5;

-- 5. Vérifier les colonnes de unified_status_history
SELECT
  'Table Columns' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'unified_status_history'
ORDER BY ordinal_position;

-- 6. Test du trigger (simulation)
DO $$
DECLARE
  test_production_id uuid;
  history_count_before int;
  history_count_after int;
BEGIN
  -- Récupérer une production existante
  SELECT id INTO test_production_id
  FROM daily_production
  LIMIT 1;

  IF test_production_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucune production trouvée pour le test';
    RETURN;
  END IF;

  -- Compter l'historique avant
  SELECT COUNT(*) INTO history_count_before
  FROM unified_status_history
  WHERE entity_type = 'production' AND entity_id = test_production_id;

  RAISE NOTICE '';
  RAISE NOTICE '📊 Test Production ID: %', test_production_id;
  RAISE NOTICE '📊 Historique avant: % entrées', history_count_before;

  -- Compter l'historique après
  SELECT COUNT(*) INTO history_count_after
  FROM unified_status_history
  WHERE entity_type = 'production' AND entity_id = test_production_id;

  RAISE NOTICE '📊 Historique après: % entrées', history_count_after;
  RAISE NOTICE '';

  IF history_count_after > 0 THEN
    RAISE NOTICE '✅ Le trigger a créé des entrées d''historique';
  ELSE
    RAISE NOTICE '⚠️  Aucune entrée d''historique trouvée';
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur pendant le test: %', SQLERRM;
END $$;
