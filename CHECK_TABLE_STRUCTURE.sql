-- Vérifier la structure de la table allowed_status_transitions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'allowed_status_transitions'
ORDER BY ordinal_position;
