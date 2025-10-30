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
  is_system_transition,
  created_at,
  updated_at
FROM allowed_status_transitions
ORDER BY from_status, to_status, created_at;

-- 3. Compter le total
SELECT
  COUNT(*) as total_transitions,
  COUNT(DISTINCT (from_status, to_status)) as unique_transitions,
  COUNT(*) - COUNT(DISTINCT (from_status, to_status)) as duplicates_to_remove
FROM allowed_status_transitions;

-- 4. Voir les transitions système vs normales
SELECT
  is_system_transition,
  COUNT(*) as count
FROM allowed_status_transitions
GROUP BY is_system_transition
ORDER BY is_system_transition;

-- 5. Voir les transitions par rôle requis
SELECT
  COALESCE(requires_role, 'NULL/Any') as role,
  COUNT(*) as transition_count
FROM allowed_status_transitions
GROUP BY requires_role
ORDER BY transition_count DESC;

-- 6. Identifier les transitions en conflit (mêmes from/to mais rôles différents)
SELECT
  ast1.from_status,
  ast1.to_status,
  ast1.requires_role as role_1,
  ast2.requires_role as role_2,
  ast1.description as description_1,
  ast2.description as description_2
FROM allowed_status_transitions ast1
JOIN allowed_status_transitions ast2
  ON ast1.from_status = ast2.from_status
  AND ast1.to_status = ast2.to_status
  AND ast1.id < ast2.id
ORDER BY ast1.from_status, ast1.to_status;

-- 7. Voir les statuses utilisés comme source (from_status)
SELECT
  from_status,
  COUNT(*) as outgoing_transitions
FROM allowed_status_transitions
GROUP BY from_status
ORDER BY outgoing_transitions DESC, from_status;

-- 8. Voir les statuses utilisés comme destination (to_status)
SELECT
  to_status,
  COUNT(*) as incoming_transitions
FROM allowed_status_transitions
GROUP BY to_status
ORDER BY incoming_transitions DESC, to_status;
