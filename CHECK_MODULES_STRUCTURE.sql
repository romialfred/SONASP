-- Vérifier la structure actuelle de la table modules
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'modules'
ORDER BY ordinal_position;

-- Vérifier les données existantes
SELECT * FROM modules LIMIT 5;

-- Compter les modules existants
SELECT COUNT(*) as total_modules FROM modules;
