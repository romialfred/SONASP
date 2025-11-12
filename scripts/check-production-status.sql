-- Script pour vérifier et corriger les statuts de production

-- 1. Vérifier si la colonne status existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_production' AND column_name = 'status';

-- 2. Compter les productions sans statut (NULL)
SELECT COUNT(*) as productions_sans_statut
FROM daily_production
WHERE status IS NULL;

-- 3. Compter les productions par statut
SELECT
  COALESCE(status::text, 'NULL') as statut,
  COUNT(*) as nombre
FROM daily_production
GROUP BY status
ORDER BY status;

-- 4. Si des productions ont status NULL, les initialiser à 'prepared'
-- UPDATE daily_production
-- SET status = 'prepared'
-- WHERE status IS NULL;

-- 5. Vérifier que toutes les productions ont maintenant un statut
-- SELECT COUNT(*) as total_productions FROM daily_production;
-- SELECT COUNT(*) as productions_avec_statut FROM daily_production WHERE status IS NOT NULL;
