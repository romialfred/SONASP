-- Vérifier les transitions depuis received_at_airport
SELECT from_status, to_status, requires_role, description
FROM allowed_status_transitions
WHERE from_status = 'received_at_airport'
ORDER BY to_status;

-- Vérifier aussi batch_status_transitions si elle existe
SELECT from_status, to_status, requires_approval, approval_roles
FROM batch_status_transitions
WHERE from_status = 'received_at_airport'
ORDER BY to_status;
