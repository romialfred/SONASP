/*
  # Diagnostic: Vérification de la table mining_companies

  Ce script vérifie:
  - Si la table existe
  - Quelles colonnes existent
  - Si SONASP existe
*/

-- Vérifier les colonnes de la table mining_companies
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'mining_companies'
ORDER BY ordinal_position;

-- Vérifier si SONASP existe
SELECT
  id,
  name,
  abbreviation,
  code,
  is_active
FROM mining_companies
WHERE name LIKE '%SONASP%' OR abbreviation = 'SONASP'
LIMIT 5;

-- Compter les sociétés
SELECT COUNT(*) as total_companies FROM mining_companies;
