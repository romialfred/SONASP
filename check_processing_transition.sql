-- Vérifier si la transition processing → processed existe
SELECT 
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  is_active
FROM allowed_status_transitions
WHERE from_status = 'processing';

-- Vérifier toutes les transitions liées à "processed"
SELECT 
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  is_active
FROM allowed_status_transitions
WHERE from_status = 'processed' OR to_status = 'processed'
ORDER BY from_status, to_status;
