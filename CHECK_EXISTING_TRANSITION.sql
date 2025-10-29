-- Vérifier si la transition existe déjà
SELECT 
  from_status,
  to_status,
  requires_approval,
  approval_roles,
  is_active,
  created_at
FROM batch_status_transitions
WHERE from_status = 'processing' AND to_status = 'processed';

-- Voir TOUTES les transitions depuis 'processing'
SELECT 
  from_status,
  to_status,
  requires_approval,
  approval_roles,
  is_active
FROM batch_status_transitions
WHERE from_status = 'processing';

-- Compter toutes les transitions
SELECT COUNT(*) as total_transitions
FROM batch_status_transitions;
