-- ================================================================
-- ANALYSE COMPLETE DU MODULE SALES
-- ================================================================

\echo '========================================'
\echo 'AUDIT COMPLET MODULE SALES'
\echo '========================================'
\echo ''

-- 1. STRUCTURE TABLE SALES
\echo '1. STRUCTURE TABLE SALES'
\echo '----------------------------------------'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 2. ENUM SALE_STATUS
\echo ''
\echo '2. VALEURS ENUM SALE_STATUS'
\echo '----------------------------------------'
SELECT
  unnest(enum_range(NULL::sale_status))::text as status_value
ORDER BY status_value;

-- 3. TRIGGERS
\echo ''
\echo '3. TRIGGERS SUR TABLE SALES'
\echo '----------------------------------------'
SELECT
  trigger_name,
  event_manipulation as event,
  action_timing as timing,
  action_orientation as orientation
FROM information_schema.triggers
WHERE event_object_table = 'sales'
  AND trigger_schema = 'public'
ORDER BY trigger_name;

-- 4. FOREIGN KEYS
\echo ''
\echo '4. FOREIGN KEYS'
\echo '----------------------------------------'
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'sales'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- 5. INDEXES
\echo ''
\echo '5. INDEXES'
\echo '----------------------------------------'
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sales'
ORDER BY indexname;

-- 6. RLS POLICIES
\echo ''
\echo '6. RLS POLICIES'
\echo '----------------------------------------'
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command
FROM pg_policies
WHERE tablename = 'sales'
ORDER BY policyname;

-- 7. FONCTIONS LIÉES À SALES
\echo ''
\echo '7. FONCTIONS LIÉES À SALES'
\echo '----------------------------------------'
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  CASE p.prokind
    WHEN 'f' THEN 'function'
    WHEN 'p' THEN 'procedure'
    WHEN 'a' THEN 'aggregate'
    WHEN 'w' THEN 'window'
  END as kind
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%sale%'
    OR p.prosrc LIKE '%sales%'
  )
ORDER BY p.proname;

-- 8. STATISTIQUES VENTES
\echo ''
\echo '8. STATISTIQUES'
\echo '----------------------------------------'
SELECT
  COUNT(*) as total_sales,
  COUNT(DISTINCT status) as distinct_statuses,
  COUNT(DISTINCT customer_id) as distinct_customers,
  COUNT(DISTINCT seller_id) as distinct_sellers,
  ROUND(SUM(quantity_oz)::numeric, 2) as total_oz_sold,
  ROUND(SUM(total_amount)::numeric, 2) as total_amount_usd
FROM sales;

-- 9. DISTRIBUTION PAR STATUT
\echo ''
\echo '9. DISTRIBUTION PAR STATUT'
\echo '----------------------------------------'
SELECT
  status,
  COUNT(*) as count,
  ROUND(SUM(quantity_oz)::numeric, 2) as total_oz,
  ROUND(SUM(total_amount)::numeric, 2) as total_amount
FROM sales
GROUP BY status
ORDER BY count DESC;

-- 10. HISTORIQUE UNIFIED_STATUS_HISTORY
\echo ''
\echo '10. HISTORIQUE DES STATUTS'
\echo '----------------------------------------'
SELECT
  COUNT(*) as total_changes,
  COUNT(DISTINCT entity_id) as distinct_sales,
  MIN(changed_at) as first_change,
  MAX(changed_at) as last_change
FROM unified_status_history
WHERE entity_type = 'sales';

-- 11. ÉCHANTILLON DE VENTES
\echo ''
\echo '11. ÉCHANTILLON DE VENTES (5 dernières)'
\echo '----------------------------------------'
SELECT
  id,
  sale_number,
  status,
  quantity_oz,
  total_amount,
  created_at
FROM sales
ORDER BY created_at DESC
LIMIT 5;

-- 12. CONTRAINTES CHECK
\echo ''
\echo '12. CONTRAINTES CHECK'
\echo '----------------------------------------'
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
  AND con.contype = 'c';

\echo ''
\echo '========================================'
\echo 'AUDIT TERMINÉ'
\echo '========================================'
