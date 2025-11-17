-- Verifier si les tables existent deja
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('annual_budgets', 'monthly_budgets', 'quarterly_forecasts')
ORDER BY table_name;

-- Verifier structure annual_budgets si elle existe
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'annual_budgets'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verifier les contraintes sur annual_budgets
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'annual_budgets'::regclass
ORDER BY contype;

-- Verifier les donnees existantes
SELECT 
  id,
  year,
  site_id,
  mining_company_id,
  created_by,
  created_at
FROM annual_budgets
ORDER BY created_at DESC
LIMIT 10;
