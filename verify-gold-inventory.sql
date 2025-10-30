-- Vérifier si la table gold_inventory existe et sa structure

SELECT 'Table gold_inventory exists?' as check_type;

SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'gold_inventory'
) as table_exists;

-- Si existe, voir les colonnes
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'gold_inventory'
ORDER BY ordinal_position;

-- Si existe, voir les données
SELECT COUNT(*) as row_count
FROM gold_inventory
WHERE 1=1;

-- Si la table n'existe pas, chercher des tables similaires
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%inventor%'
ORDER BY table_name;
