-- Check if mining_companies table exists and show its structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'mining_companies'
ORDER BY ordinal_position;
