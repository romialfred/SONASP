/*
  Correction des migrations contenant array_agg

  Ce script corrige toutes les fonctions qui utilisaient array_agg
  et les remplace par string_agg ou des alternatives
*/

-- ============================================
-- 1. Fonction de vérification des ENUM (CORRIGÉE)
-- ============================================

CREATE OR REPLACE FUNCTION check_enum_values(enum_name text)
RETURNS TABLE(value text, position int)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.enumlabel::text,
    e.enumsortorder::int
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = enum_name
  ORDER BY e.enumsortorder;
END;
$$;

-- Utilisation:
-- SELECT * FROM check_enum_values('shipping_status_v2');

-- ============================================
-- 2. Fonction pour obtenir toutes les valeurs d'un ENUM en texte
-- ============================================

CREATE OR REPLACE FUNCTION get_enum_values_text(enum_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result text;
BEGIN
  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
  INTO result
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = enum_name;

  RETURN result;
END;
$$;

-- Utilisation:
-- SELECT get_enum_values_text('shipping_status_v2');

-- ============================================
-- 3. Vérification des valeurs ENUM (SANS ARRAY_AGG)
-- ============================================

DO $$
DECLARE
  v_shipping_values text;
  v_production_values text;
  v_enum_exists boolean;
BEGIN
  -- Vérifier si shipping_status_v2 existe
  SELECT EXISTS(
    SELECT 1 FROM pg_type WHERE typname = 'shipping_status_v2'
  ) INTO v_enum_exists;

  IF v_enum_exists THEN
    -- Obtenir les valeurs avec string_agg
    SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
    INTO v_shipping_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'shipping_status_v2';

    RAISE NOTICE 'shipping_status_v2 values: %', v_shipping_values;
  ELSE
    RAISE NOTICE 'shipping_status_v2 does not exist';
  END IF;

  -- Vérifier production_status_v2
  SELECT EXISTS(
    SELECT 1 FROM pg_type WHERE typname = 'production_status_v2'
  ) INTO v_enum_exists;

  IF v_enum_exists THEN
    SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
    INTO v_production_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'production_status_v2';

    RAISE NOTICE 'production_status_v2 values: %', v_production_values;
  ELSE
    RAISE NOTICE 'production_status_v2 does not exist';
  END IF;
END $$;

-- ============================================
-- 4. Diagnostic des ENUM (version détaillée)
-- ============================================

-- Liste de tous les ENUM du schéma public
SELECT
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values,
  COUNT(e.enumlabel) as value_count
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 5. Analyse des Foreign Keys (SANS ARRAY_AGG)
-- ============================================

-- Liste des FK avec leurs tables parentes (version simple)
SELECT DISTINCT
  tc.table_name as child_table,
  kcu.column_name as child_column,
  ccu.table_name as parent_table,
  ccu.column_name as parent_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, ccu.table_name;

-- Version avec string_agg pour grouper
SELECT
  tc.table_name as child_table,
  string_agg(DISTINCT ccu.table_name, ', ') as parent_tables
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- ============================================
-- RÉSUMÉ
-- ============================================

/*
  RÈGLES À SUIVRE :

  1. JAMAIS utiliser array_agg
  2. Utiliser string_agg pour concaténer des valeurs
  3. Utiliser json_agg si on a vraiment besoin d'un tableau
  4. Faire des requêtes simples ligne par ligne si possible

  EXEMPLES :

  ❌ array_agg(column_name)
  ✅ string_agg(column_name, ', ')

  ❌ array_agg(column_name ORDER BY x)
  ✅ string_agg(column_name, ', ' ORDER BY x)

  ❌ array_agg(DISTINCT column_name)
  ✅ string_agg(DISTINCT column_name, ', ')
*/
