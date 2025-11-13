-- ========================================
-- SCRIPT DE VÉRIFICATION - Enums Shipping
-- ========================================
-- Exécuter dans Supabase SQL Editor pour diagnostiquer le problème

-- 1. Voir tous les enums de status
SELECT
  t.typname as "Nom Enum",
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as "Valeurs"
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%status%'
GROUP BY t.typname
ORDER BY t.typname;

-- 2. Voir quelle colonne utilise quel enum
SELECT
  table_name as "Table",
  column_name as "Colonne",
  udt_name as "Type Enum",
  column_default as "Défaut"
FROM information_schema.columns
WHERE table_name IN ('daily_production', 'shipping_preparations')
AND column_name = 'status'
ORDER BY table_name;

-- 3. Vérifier si production_status_v2 contient 'shipped'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'production_status_v2'
      AND e.enumlabel = 'shipped'
    )
    THEN '✅ production_status_v2 contient shipped'
    ELSE '❌ production_status_v2 NE contient PAS shipped - PROBLÈME!'
  END as "Statut";

-- 4. Vérifier la configuration complète
DO $$
DECLARE
  v_result text;
  v_prod_enum text;
  v_ship_enum text;
BEGIN
  -- Get enums used
  SELECT udt_name INTO v_prod_enum
  FROM information_schema.columns
  WHERE table_name = 'daily_production' AND column_name = 'status';

  SELECT udt_name INTO v_ship_enum
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations' AND column_name = 'status';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTIC COMPLET';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'daily_production.status utilise: %', COALESCE(v_prod_enum, 'NON DÉFINI');
  RAISE NOTICE 'shipping_preparations.status utilise: %', COALESCE(v_ship_enum, 'NON DÉFINI');
  RAISE NOTICE '========================================';

  -- Recommendations
  IF v_prod_enum = 'production_status_v2' THEN
    RAISE NOTICE '✅ daily_production utilise le bon enum';
  ELSE
    RAISE NOTICE '❌ daily_production utilise % au lieu de production_status_v2', v_prod_enum;
  END IF;

  IF v_ship_enum = 'shipping_status_v2' THEN
    RAISE NOTICE '✅ shipping_preparations utilise le bon enum';
  ELSE
    RAISE NOTICE '❌ shipping_preparations utilise % au lieu de shipping_status_v2', COALESCE(v_ship_enum, 'NON DÉFINI');
  END IF;
END $$;
