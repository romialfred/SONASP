-- Script pour trouver tous les triggers et fonctions qui référencent quantity_grams

-- 1. Liste tous les triggers sur la table sales
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'sales'::regclass
  AND t.tgisinternal = false;

-- 2. Affiche le code source de toutes les fonctions liées à sales
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
WHERE p.proname ILIKE '%sale%'
  AND pg_get_functiondef(p.oid) ILIKE '%quantity_grams%';

-- 3. Cherche quantity_grams dans les contraintes
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sales'::regclass
  AND pg_get_constraintdef(oid) ILIKE '%quantity_grams%';
