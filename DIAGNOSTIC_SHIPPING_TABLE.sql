-- ========================================
-- DIAGNOSTIC COMPLET - Table shipping_preparations
-- ========================================
-- À exécuter dans Supabase SQL Editor

-- 1. Structure de la table
SELECT
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
ORDER BY ordinal_position;

-- 2. Valeurs ENUM disponibles pour shipping_status_v2
SELECT
  enumlabel,
  enumsortorder
FROM pg_enum
WHERE enumtypid = 'shipping_status_v2'::regtype
ORDER BY enumsortorder;

-- 3. Contenu COMPLET de la table
SELECT
  id,
  expedition_lot_number,
  status::text as status_text,
  created_at,
  updated_at
FROM shipping_preparations
ORDER BY created_at DESC
LIMIT 50;

-- 4. Distribution des statuts
SELECT
  status::text as status_value,
  COUNT(*) as count
FROM shipping_preparations
GROUP BY status::text
ORDER BY count DESC;

-- 5. Vérifier s'il y a des contraintes CHECK
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'shipping_preparations'::regclass;
