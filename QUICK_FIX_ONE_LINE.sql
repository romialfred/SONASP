-- =====================================================
-- CORRECTION RAPIDE EN UNE LIGNE
-- =====================================================
-- 
-- INSTRUCTIONS:
-- 1. Remplacez les '...' par les vrais UUIDs
-- 2. Pour obtenir les UUIDs, exécutez d'abord les SELECT ci-dessous
-- 3. Puis exécutez l'UPDATE avec les valeurs correctes
--
-- =====================================================

-- Étape 1: OBTENIR LES UUIDs DISPONIBLES
SELECT '=== RAFFINERIES DISPONIBLES ===' as info;
SELECT id, name, location, country FROM refinery_plants WHERE is_active = true;

SELECT '=== COMPAGNIES DE FRET DISPONIBLES ===' as info;
SELECT id, name FROM freight_companies WHERE is_active = true;

SELECT '=== LICENSES DISPONIBLES ===' as info;
SELECT id, license_number FROM export_licenses WHERE is_active = true ORDER BY created_at DESC LIMIT 5;

-- Étape 2: METTRE À JOUR L'EXPÉDITION
-- Copiez un UUID de chaque liste ci-dessus et remplacez dans la ligne ci-dessous

/*
UPDATE shipping_preparations
SET 
  refinery_id = 'COLLEZ_ICI_UUID_RAFFINERIE',
  freight_company_id = 'COLLEZ_ICI_UUID_COMPAGNIE_FRET',
  export_license_id = 'COLLEZ_ICI_UUID_LICENSE'
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
*/

-- Étape 3: VÉRIFIER LE RÉSULTAT
SELECT 
  sp.id,
  sp.expedition_lot_number,
  r.name as raffinerie,
  r.country as pays_raffinerie,
  f.name as compagnie_fret,
  el.license_number
FROM shipping_preparations sp
LEFT JOIN refinery_plants r ON r.id = sp.refinery_id
LEFT JOIN freight_companies f ON f.id = sp.freight_company_id
LEFT JOIN export_licenses el ON el.id = sp.export_license_id
WHERE sp.id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';

-- Si tout est correct, vous verrez les noms s'afficher au lieu de NULL
