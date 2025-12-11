/*
  # Vérification Structure Table Sales

  Exécuter dans Supabase SQL Editor pour voir la structure complète
*/

-- 1. Vérifier si la table sales existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'sales'
) AS table_exists;

-- 2. Lister toutes les colonnes de sales
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Vérifier si l'enum sale_status existe
SELECT
  t.typname AS enum_name,
  e.enumlabel AS enum_value,
  e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%sale%'
  OR t.typname LIKE '%status%'
ORDER BY t.typname, e.enumsortorder;

-- 4. Vérifier les contraintes sur la table sales
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'sales'::regclass;

-- 5. Vérifier les index
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sales'
  AND schemaname = 'public';

-- 6. Vérifier les foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sales';

-- 7. Compter les ventes par status (pour voir les valeurs utilisées)
SELECT
  status,
  COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY count DESC;

-- 8. Voir un exemple de vente
SELECT *
FROM sales
LIMIT 1;
