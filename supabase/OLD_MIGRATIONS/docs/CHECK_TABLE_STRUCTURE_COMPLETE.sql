-- Vérifier la structure complète de allowed_status_transitions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'allowed_status_transitions'
ORDER BY ordinal_position;
