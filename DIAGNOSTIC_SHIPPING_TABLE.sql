-- =========================================
-- DIAGNOSTIC COMPLET - shipping_preparations
-- =========================================
-- Exécuter dans Supabase SQL Editor

-- 1. Voir la définition exacte de la table
SELECT
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
ORDER BY ordinal_position;

-- 2. Voir TOUTES les contraintes (CHECK, FK, etc.)
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'shipping_preparations'::regclass;

-- 3. Voir les valeurs de shipping_status_v2
SELECT
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'shipping_status_v2';

-- 4. Voir production_status_v2
SELECT
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'production_status_v2';

-- 5. Voir TOUS les triggers sur shipping_preparations
SELECT
  tgname as trigger_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'shipping_preparations'::regclass
AND tgisinternal = false;

-- 6. Voir TOUS les triggers sur shipping_production_items
SELECT
  tgname as trigger_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'shipping_production_items'::regclass
AND tgisinternal = false;

-- 7. Tester un INSERT manuel
-- COMMENTER LES LIGNES CI-DESSOUS ET DÉCOMMENTER POUR TESTER
/*
DO $$
BEGIN
  INSERT INTO shipping_preparations (
    expedition_lot_number,
    status,
    mining_company_id,
    total_net_weight_grams,
    total_gross_weight_grams,
    total_weight_oz
  ) VALUES (
    'TEST-' || gen_random_uuid()::text,
    'prepared',
    NULL,
    100,
    110,
    3.215
  );

  RAISE NOTICE 'INSERT réussi avec status=prepared';

  -- Rollback le test
  RAISE EXCEPTION 'Test terminé - rollback';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur: %', SQLERRM;
END $$;
*/
