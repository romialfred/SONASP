-- Vérifier les transitions depuis approved_for_transport
SELECT 
  from_status,
  to_status,
  requires_role,
  description
FROM allowed_status_transitions
WHERE from_status IN ('approved_for_transport', 'waiting_airport_receipt')
ORDER BY from_status, to_status;
