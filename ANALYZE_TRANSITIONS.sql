-- 1. Compter les doublons dans allowed_status_transitions
SELECT 
  from_status,
  to_status,
  COUNT(*) as duplicate_count
FROM allowed_status_transitions
GROUP BY from_status, to_status
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, from_status, to_status;

-- 2. Voir toutes les transitions avec leurs rôles
SELECT 
  id,
  from_status,
  to_status,
  requires_role,
  description,
  is_active,
  created_at
FROM allowed_status_transitions
ORDER BY from_status, to_status, created_at;

-- 3. Compter le total
SELECT 
  COUNT(*) as total_transitions,
  COUNT(DISTINCT (from_status, to_status)) as unique_transitions,
  COUNT(*) - COUNT(DISTINCT (from_status, to_status)) as duplicates_to_remove
FROM allowed_status_transitions;
