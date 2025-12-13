-- ================================================================
-- VÉRIFIER LA STRUCTURE COMPLÈTE DE LA TABLE SALES
-- ================================================================

-- 1. Toutes les colonnes de la table sales
SELECT
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 2. Vérifier si la colonne status existe
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN 'OUI - La colonne status existe'
    ELSE 'NON - La colonne status n''existe pas'
  END as status_existe
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name = 'status';

-- 3. Tous les triggers sur la table sales
SELECT
  t.tgname as trigger_name,
  p.proname as function_name,
  t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'sales'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 4. Toutes les contraintes de clé étrangère
SELECT
  tc.constraint_name,
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
  AND tc.table_name = 'sales'
ORDER BY tc.constraint_name;
