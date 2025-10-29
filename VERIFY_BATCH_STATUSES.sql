-- ========================================
-- Script de Vérification des Statuts de Batches
-- À exécuter APRÈS les 4 migrations
-- ========================================

-- 1. Vérifier la distribution des statuts
SELECT 
  '1. Status Distribution' as check_name,
  status,
  COUNT(*) as batch_count
FROM batches
GROUP BY status
ORDER BY batch_count DESC;

-- 2. Vérifier qu'il n'y a pas de statuts orphelins (sans transitions sortantes)
SELECT 
  '2. Orphan Statuses (should be empty)' as check_name,
  b.status,
  COUNT(*) as batch_count
FROM batches b
WHERE b.status NOT IN ('sold', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions ast
    WHERE ast.from_status = b.status
  )
GROUP BY b.status;

-- 3. Vérifier les 15 statuts valides dans la contrainte
SELECT 
  '3. Valid Statuses in Constraint' as check_name,
  unnest(enum_range(NULL::text)) as valid_status
FROM (
  SELECT constraint_name 
  FROM information_schema.table_constraints 
  WHERE table_name = 'batches' 
    AND constraint_name = 'batches_status_check'
) c;

-- 4. Vérifier la transition processed → in_inventory
SELECT 
  '4. Processed → In_Inventory Transition' as check_name,
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  CASE 
    WHEN requires_role = 'refinery_staff' AND is_system_transition = false 
    THEN '✓ CORRECT' 
    ELSE '✗ INCORRECT' 
  END as status
FROM allowed_status_transitions
WHERE from_status = 'processed' AND to_status = 'in_inventory';

-- 5. Compter les transitions disponibles par statut
SELECT 
  '5. Transitions Count by Status' as check_name,
  from_status,
  COUNT(*) as available_transitions
FROM allowed_status_transitions
GROUP BY from_status
ORDER BY from_status;

-- 6. Vérifier les statuts les plus utilisés
SELECT 
  '6. Top 5 Most Used Statuses' as check_name,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM batches), 2) as percentage
FROM batches
GROUP BY status
ORDER BY count DESC
LIMIT 5;

-- 7. Vérifier qu'il n'y a pas de statuts NULL
SELECT 
  '7. Batches with NULL status (should be empty)' as check_name,
  COUNT(*) as null_status_count
FROM batches
WHERE status IS NULL;

-- ========================================
-- Résultat attendu:
-- ========================================
-- 1. Distribution affichée correctement
-- 2. Aucun statut orphelin
-- 3. 15 statuts valides listés
-- 4. processed → in_inventory = refinery_staff ✓
-- 5. Toutes les transitions listées
-- 6. Top 5 des statuts utilisés
-- 7. 0 batches avec statut NULL
-- ========================================
