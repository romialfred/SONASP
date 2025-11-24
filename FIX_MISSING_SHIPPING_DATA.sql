/*
  # CORRECTION DES DONNÉES MANQUANTES DANS SHIPPING PREPARATIONS
  
  ## Problème
  Certaines expéditions créées avant les validations ont:
  - mining_company_id = NULL
  - total_boxes = NULL ou 0
  - seal_number = NULL
  
  ## Solution
  Ce script déduit ces informations depuis les production items liés
*/

-- =====================================================
-- 1. DÉDUIRE mining_company_id depuis les productions
-- =====================================================

-- D'abord, vérifier combien d'expéditions ont ce problème
SELECT 
  COUNT(*) as expeditions_sans_company,
  COUNT(DISTINCT sp.id) as expeditions_affectees
FROM shipping_preparations sp
WHERE sp.mining_company_id IS NULL
  AND EXISTS (
    SELECT 1 FROM shipping_production_items spi 
    WHERE spi.shipping_preparation_id = sp.id
  );

-- Mettre à jour mining_company_id basé sur la première production item
UPDATE shipping_preparations sp
SET mining_company_id = (
  SELECT dp.mining_company_id
  FROM shipping_production_items spi
  JOIN daily_production dp ON dp.id = spi.daily_production_id
  WHERE spi.shipping_preparation_id = sp.id
  AND dp.mining_company_id IS NOT NULL
  ORDER BY spi.order_index
  LIMIT 1
)
WHERE sp.mining_company_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM shipping_production_items spi
    JOIN daily_production dp ON dp.id = spi.daily_production_id
    WHERE spi.shipping_preparation_id = sp.id
    AND dp.mining_company_id IS NOT NULL
  );

-- =====================================================
-- 2. METTRE À JOUR total_boxes
-- =====================================================

UPDATE shipping_preparations sp
SET total_boxes = (
  SELECT COUNT(*)
  FROM shipping_production_items spi
  WHERE spi.shipping_preparation_id = sp.id
)
WHERE total_boxes IS NULL OR total_boxes = 0;

-- =====================================================
-- 3. DÉDUIRE seal_number depuis le premier item
-- =====================================================

UPDATE shipping_preparations sp
SET seal_number = (
  SELECT COALESCE(spi.seal_number_1, '')
  FROM shipping_production_items spi
  WHERE spi.shipping_preparation_id = sp.id
  AND spi.seal_number_1 IS NOT NULL
  AND spi.seal_number_1 != ''
  ORDER BY spi.order_index
  LIMIT 1
)
WHERE (seal_number IS NULL OR seal_number = '')
  AND EXISTS (
    SELECT 1 
    FROM shipping_production_items spi
    WHERE spi.shipping_preparation_id = sp.id
    AND spi.seal_number_1 IS NOT NULL
    AND spi.seal_number_1 != ''
  );

-- =====================================================
-- 4. VÉRIFICATION FINALE
-- =====================================================

-- Afficher le résultat
SELECT 
  sp.id,
  sp.expedition_lot_number,
  sp.mining_company_id,
  mc.name as mining_company_name,
  sp.seal_number,
  sp.total_boxes,
  (SELECT COUNT(*) FROM shipping_production_items WHERE shipping_preparation_id = sp.id) as actual_items
FROM shipping_preparations sp
LEFT JOIN mining_companies mc ON mc.id = sp.mining_company_id
ORDER BY sp.created_at DESC
LIMIT 10;

-- Compter les problèmes restants
SELECT 
  COUNT(CASE WHEN mining_company_id IS NULL THEN 1 END) as sans_company,
  COUNT(CASE WHEN seal_number IS NULL OR seal_number = '' THEN 1 END) as sans_seal,
  COUNT(CASE WHEN total_boxes IS NULL OR total_boxes = 0 THEN 1 END) as sans_boxes,
  COUNT(*) as total_expeditions
FROM shipping_preparations;
