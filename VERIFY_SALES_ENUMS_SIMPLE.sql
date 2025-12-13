-- ========================================
-- VÉRIFICATION SIMPLE DES ENUMS VENTES
-- ========================================

-- 1. Toutes les valeurs de sale_status
SELECT
  'sale_status' as enum_name,
  enumlabel as value,
  enumsortorder as order_num
FROM pg_enum
WHERE enumtypid = 'sale_status'::regtype
ORDER BY enumsortorder;

-- 2. Toutes les valeurs de payment_status (si existe)
SELECT
  'payment_status' as enum_name,
  enumlabel as value,
  enumsortorder as order_num
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'payment_status'
)
ORDER BY enumsortorder;

-- 3. Structure colonne status dans gold_sales
SELECT
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'gold_sales'
  AND column_name = 'status';

-- 4. Vérifier si le trigger existe
SELECT
  t.tgname as trigger_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'gold_sales'
  AND NOT t.tgisinternal
  AND (t.tgname LIKE '%status%' OR p.proname LIKE '%status%');
