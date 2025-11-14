/*
  # Analyse Simple des FK - Retourne des Résultats SELECT

  Ce script retourne directement les résultats pour voir dans Supabase
*/

-- =====================================================
-- QUERY 1: TOUTES LES FOREIGN KEYS
-- =====================================================

SELECT
  tc.table_name as table_enfant,
  kcu.column_name as colonne_enfant,
  ccu.table_name AS table_parent,
  ccu.column_name AS colonne_parent,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY ccu.table_name, tc.table_name;
