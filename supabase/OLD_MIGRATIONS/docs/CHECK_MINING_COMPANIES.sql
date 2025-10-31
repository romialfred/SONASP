-- Vérifier la structure des tables mining_companies et sites
-- Pour comprendre la relation correcte

-- 1. Vérifier si mining_companies existe
SELECT 
  'mining_companies table exists' as check_name,
  COUNT(*) as count
FROM mining_companies
LIMIT 5;

-- 2. Vérifier si sites existe
SELECT 
  'sites table check' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sites')
    THEN 'exists'
    ELSE 'does not exist'
  END as status;

-- 3. Voir les colonnes de user_site_assignments
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_site_assignments'
ORDER BY ordinal_position;

-- 4. Voir les foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'user_site_assignments'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 5. Lister quelques mining companies
SELECT id, name, code, country, is_active
FROM mining_companies
WHERE is_active = true
ORDER BY name
LIMIT 5;
