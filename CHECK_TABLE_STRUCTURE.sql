-- 1. Vérifier quelle table existe
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('batch_status_transitions', 'allowed_status_transitions')
  AND table_schema = 'public';

-- 2. Vérifier TOUTES les colonnes de batch_status_transitions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'batch_status_transitions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Vérifier TOUTES les colonnes de allowed_status_transitions (si existe)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'allowed_status_transitions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Voir les données actuelles dans batch_status_transitions
SELECT *
FROM batch_status_transitions
WHERE from_status = 'processing'
LIMIT 5;
