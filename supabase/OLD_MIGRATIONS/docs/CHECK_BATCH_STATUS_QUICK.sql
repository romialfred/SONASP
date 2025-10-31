-- ========================================
-- VÉRIFICATION RAPIDE - Statuts de Batches
-- ========================================

-- 1️⃣ Distribution des statuts actuels
SELECT 
  status,
  COUNT(*) as count
FROM batches
GROUP BY status
ORDER BY count DESC;

-- 2️⃣ Vérification transition processed → in_inventory
SELECT 
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  CASE 
    WHEN requires_role = 'refinery_staff' AND is_system_transition = false 
    THEN '✓ CORRECT' 
    ELSE '✗ NEEDS FIX' 
  END as validation
FROM allowed_status_transitions
WHERE from_status = 'processed' AND to_status = 'in_inventory';

-- 3️⃣ Statuts orphelins (devrait être vide)
SELECT 
  b.status,
  COUNT(*) as batch_count
FROM batches b
WHERE b.status NOT IN ('sold', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions ast
    WHERE ast.from_status = b.status
  )
GROUP BY b.status;

-- 4️⃣ Nombre total de statuts utilisés
SELECT COUNT(DISTINCT status) as total_statuses_used FROM batches;

-- 5️⃣ Nombre total de transitions définies
SELECT COUNT(*) as total_transitions FROM allowed_status_transitions;

-- ========================================
-- RÉSULTATS ATTENDUS:
-- ========================================
-- 1. Distribution visible
-- 2. requires_role = 'refinery_staff' ✓ CORRECT
-- 3. Aucune ligne (pas d'orphelins)
-- 4. Entre 5 et 15 statuts utilisés
-- 5. Au moins 20 transitions définies
-- ========================================
