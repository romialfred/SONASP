-- 1. Vérifier si la table existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('allowed_status_transitions', 'batch_status_transitions')
ORDER BY table_name;

-- 2. Vérifier la structure de la table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('allowed_status_transitions', 'batch_status_transitions')
ORDER BY table_name, ordinal_position;

-- 3. Vérifier les contraintes UNIQUE
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('allowed_status_transitions', 'batch_status_transitions')
ORDER BY tc.table_name, tc.constraint_name;
