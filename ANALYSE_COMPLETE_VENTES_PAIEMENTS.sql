-- ========================================
-- ANALYSE COMPLÈTE VENTES & PAIEMENTS
-- ========================================

-- 1. VÉRIFIER LES ENUMS DE STATUT
-- ================================
SELECT '=== 1. ENUMS DE STATUT ===' as section;

SELECT
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('sale_status', 'payment_status', 'approval_status')
ORDER BY t.typname, e.enumsortorder;

-- 2. STRUCTURE DE LA TABLE gold_sales
-- ====================================
SELECT '=== 2. STRUCTURE gold_sales ===' as section;

SELECT
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gold_sales'
ORDER BY ordinal_position;

-- 3. STRUCTURE DE LA TABLE payments
-- ==================================
SELECT '=== 3. STRUCTURE payments ===' as section;

SELECT
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments'
ORDER BY ordinal_position;

-- 4. TOUS LES TRIGGERS SUR gold_sales
-- ====================================
SELECT '=== 4. TRIGGERS gold_sales ===' as section;

SELECT
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE
    WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
    WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE
    WHEN t.tgtype & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    ELSE 'OTHER'
  END as event,
  obj_description(t.oid, 'pg_trigger') as description
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'gold_sales'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 5. TOUS LES TRIGGERS SUR payments
-- ==================================
SELECT '=== 5. TRIGGERS payments ===' as section;

SELECT
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE
    WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
    WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE
    WHEN t.tgtype & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    ELSE 'OTHER'
  END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'payments'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 6. CODE DES FONCTIONS DE TRIGGER (gold_sales)
-- ==============================================
SELECT '=== 6. FONCTIONS TRIGGER gold_sales ===' as section;

SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    SELECT DISTINCT p2.proname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p2 ON t.tgfoid = p2.oid
    WHERE c.relname = 'gold_sales'
      AND NOT t.tgisinternal
  )
ORDER BY p.proname;

-- 7. CODE DES FONCTIONS DE TRIGGER (payments)
-- ============================================
SELECT '=== 7. FONCTIONS TRIGGER payments ===' as section;

SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    SELECT DISTINCT p2.proname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p2 ON t.tgfoid = p2.oid
    WHERE c.relname = 'payments'
      AND NOT t.tgisinternal
  )
ORDER BY p.proname;

-- 8. CONTRAINTES DE VÉRIFICATION
-- ===============================
SELECT '=== 8. CONTRAINTES ===' as section;

SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
  AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('gold_sales', 'payments')
  AND tc.constraint_type IN ('CHECK', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_name;

-- 9. VÉRIFIER LES POLITIQUES RLS
-- ===============================
SELECT '=== 9. POLITIQUES RLS ===' as section;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('gold_sales', 'payments')
ORDER BY tablename, policyname;

-- 10. VÉRIFIER LES INDEX
-- ======================
SELECT '=== 10. INDEX ===' as section;

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('gold_sales', 'payments')
ORDER BY tablename, indexname;
