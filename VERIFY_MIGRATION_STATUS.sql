-- ========================================
-- VÉRIFICATION : Migration déjà appliquée ?
-- ========================================

-- 1. Vérifier si la transition est automatique
SELECT
  step_number,
  status_from,
  status_to,
  is_automatic,
  required_role,
  notes
FROM sales_status_transitions
WHERE status_from = 'management_approved'
  AND status_to = 'pending_for_customer_approval';

-- RÉSULTAT ATTENDU :
-- Si is_automatic = true → ✅ Migration déjà appliquée
-- Si is_automatic = false → ❌ Migration à appliquer

-- ========================================
-- Si is_automatic = false, exécuter ceci :
-- ========================================

-- UPDATE sales_status_transitions
-- SET
--   is_automatic = true,
--   notes = 'Automatic transition after management approval to send to customer'
-- WHERE
--   status_from = 'management_approved'
--   AND status_to = 'pending_for_customer_approval';

-- ========================================
-- 2. Vérifier toutes les transitions de ventes
-- ========================================

SELECT
  step_number,
  status_from,
  status_to,
  is_automatic,
  required_role
FROM sales_status_transitions
ORDER BY step_number;

-- ========================================
-- 3. Vérifier s'il y a des ventes en attente
-- ========================================

SELECT
  sale_number,
  status,
  customer_id,
  final_proceeds,
  created_at
FROM sales
WHERE status IN ('waiting_for_payment', 'management_approved', 'pending_management_approval')
ORDER BY created_at DESC
LIMIT 10;
