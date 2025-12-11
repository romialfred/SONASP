-- Vérifier la structure exacte de la colonne status dans sales

-- 1. Détails de la colonne status
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sales'
  AND column_name = 'status';

-- 2. Contraintes sur la colonne status
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.sales'::regclass
  AND conkey @> ARRAY[(
    SELECT attnum
    FROM pg_attribute
    WHERE attrelid = 'public.sales'::regclass
    AND attname = 'status'
  )];

-- 3. Toutes les valeurs de l'enum sale_status
SELECT
  enumlabel AS status_value,
  enumsortorder AS sort_order
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;

-- 4. Policies RLS sur sales
SELECT
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'sales';

-- 5. Tester insertion directe SQL
INSERT INTO sales (
  sale_number,
  sale_date,
  customer_id,
  seller_id,
  seller_type,
  quantity_oz,
  london_am_rate,
  freight_cost,
  other_costs,
  gross_proceeds,
  net_proceeds,
  royalties,
  final_proceeds,
  total_amount,
  currency,
  status
) VALUES (
  'SQL-TEST-001',
  CURRENT_DATE,
  (SELECT id FROM customers LIMIT 1),
  (SELECT id FROM mining_companies LIMIT 1),
  'mining_company',
  100,
  2700,
  0,
  0,
  270000,
  270000,
  8100,
  261900,
  261900,
  'USD',
  'pending_management_approval'
) RETURNING *;

-- Nettoyer le test
DELETE FROM sales WHERE sale_number = 'SQL-TEST-001';
