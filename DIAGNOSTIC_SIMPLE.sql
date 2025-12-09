-- =====================================================
-- DIAGNOSTIC ULTRA SIMPLE
-- =====================================================

-- 1. Quelle est la structure de refinery_plants ?
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'refinery_plants'
ORDER BY ordinal_position;

-- 2. Quelles raffineries existent ?
SELECT * FROM refinery_plants LIMIT 3;

-- 3. Quelles compagnies de fret existent ?
SELECT * FROM freight_companies LIMIT 3;

-- 4. Quelle est la situation de mon expédition ?
SELECT 
  expedition_lot_number,
  refinery_id,
  freight_company_id,
  export_license_id,
  shipped_to_company,
  shipped_to_address
FROM shipping_preparations
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
