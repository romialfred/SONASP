-- =====================================================
-- DIAGNOSTIC: Historique de Production
-- =====================================================
-- Ce script diagnostique pourquoi l'historique ne s'affiche pas

\echo ''
\echo '🔍 DIAGNOSTIC: Historique de Production'
\echo '========================================'
\echo ''

-- 1. Vérifier la table unified_status_history
\echo '1️⃣  Vérification de la table unified_status_history:'
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_status_history')
    THEN '✅ Table existe'
    ELSE '❌ Table n''existe PAS!'
  END as status;

-- 2. Vérifier le trigger
\echo ''
\echo '2️⃣  Vérification du trigger:'
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN '✅ Activé'
    WHEN 'D' THEN '❌ Désactivé'
    ELSE '⚠️  État inconnu'
  END as status
FROM pg_trigger
WHERE tgname = 'production_status_change_trigger'
  AND tgrelid = 'daily_production'::regclass;

-- 3. Vérifier la fonction
\echo ''
\echo '3️⃣  Vérification de la fonction:'
SELECT
  proname as function_name,
  CASE
    WHEN proname IS NOT NULL THEN '✅ Fonction existe'
    ELSE '❌ Fonction n''existe PAS!'
  END as status
FROM pg_proc
WHERE proname = 'log_production_status_change';

-- 4. Compter les entrées dans unified_status_history pour production
\echo ''
\echo '4️⃣  Entrées d''historique de production:'
SELECT
  COUNT(*) as total_entries,
  COUNT(CASE WHEN entity_type = 'production' THEN 1 END) as production_entries,
  COUNT(CASE WHEN entity_type = 'shipping' THEN 1 END) as shipping_entries
FROM unified_status_history;

-- 5. Dernières productions créées
\echo ''
\echo '5️⃣  Dernières productions (5 plus récentes):'
SELECT
  id,
  bar_reference,
  status::text as current_status,
  created_at,
  created_by
FROM daily_production
ORDER BY created_at DESC
LIMIT 5;

-- 6. Historique pour les dernières productions
\echo ''
\echo '6️⃣  Historique des 5 dernières productions:'
SELECT
  ush.entity_id,
  dp.bar_reference,
  ush.old_status,
  ush.new_status,
  ush.change_context::text,
  ush.changed_at,
  ush.action_description
FROM unified_status_history ush
LEFT JOIN daily_production dp ON dp.id = ush.entity_id
WHERE ush.entity_type = 'production'
  AND ush.entity_id IN (
    SELECT id FROM daily_production ORDER BY created_at DESC LIMIT 5
  )
ORDER BY ush.changed_at DESC;

-- 7. Vérifier les colonnes de unified_status_history
\echo ''
\echo '7️⃣  Structure de unified_status_history:'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'unified_status_history'
ORDER BY ordinal_position;

-- 8. Vérifier les RLS policies
\echo ''
\echo '8️⃣  Policies RLS sur unified_status_history:'
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'unified_status_history';

-- 9. Tester manuellement l'insertion
\echo ''
\echo '9️⃣  Test d''insertion manuelle:'
DO $$
DECLARE
  v_test_prod_id uuid;
  v_result record;
BEGIN
  -- Prendre la première production
  SELECT id INTO v_test_prod_id
  FROM daily_production
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_test_prod_id IS NULL THEN
    RAISE NOTICE '❌ Aucune production trouvée pour le test';
    RETURN;
  END IF;

  RAISE NOTICE '🧪 Test avec production: %', v_test_prod_id;

  -- Vérifier si elle a déjà un historique
  SELECT COUNT(*) as count INTO v_result
  FROM unified_status_history
  WHERE entity_type = 'production'
    AND entity_id = v_test_prod_id;

  RAISE NOTICE '📊 Nombre d''entrées d''historique: %', v_result.count;

  IF v_result.count = 0 THEN
    RAISE NOTICE '❌ PROBLÈME: Cette production n''a AUCUN historique!';
    RAISE NOTICE '   Le trigger ne s''est PAS exécuté à la création';
  ELSE
    RAISE NOTICE '✅ Cette production a un historique';
  END IF;

END $$;

\echo ''
\echo '✅ Diagnostic terminé'
\echo ''
