-- =====================================================
-- CORRECTION RAPIDE - VERSION CORRIGÉE
-- =====================================================
-- 
-- INSTRUCTIONS:
-- 1. Exécutez d'abord les SELECT pour voir les données disponibles
-- 2. Copiez les UUIDs que vous voulez utiliser
-- 3. Décommentez l'UPDATE et remplacez les valeurs
-- 4. Exécutez l'UPDATE
-- 5. Vérifiez avec le dernier SELECT
--
-- =====================================================

-- Étape 1: VÉRIFIER LA STRUCTURE DES TABLES
SELECT '=== STRUCTURE REFINERY_PLANTS ===' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'refinery_plants'
ORDER BY ordinal_position;

-- Étape 2: OBTENIR LES RAFFINERIES DISPONIBLES (colonnes corrigées)
SELECT '=== RAFFINERIES DISPONIBLES ===' as info;
SELECT id, name, country, address 
FROM refinery_plants 
WHERE is_active = true;

-- Si la colonne address n'existe pas non plus, essayer:
-- SELECT id, name, country FROM refinery_plants WHERE is_active = true;

-- Étape 3: OBTENIR LES COMPAGNIES DE FRET DISPONIBLES
SELECT '=== COMPAGNIES DE FRET DISPONIBLES ===' as info;
SELECT id, name FROM freight_companies WHERE is_active = true;

-- Étape 4: OBTENIR LES LICENSES DISPONIBLES
SELECT '=== LICENSES DISPONIBLES ===' as info;
SELECT id, license_number, quota_kg 
FROM export_licenses 
WHERE is_active = true 
ORDER BY created_at DESC 
LIMIT 5;

-- Étape 5: METTRE À JOUR L'EXPÉDITION
-- Décommentez les lignes ci-dessous et remplacez les UUIDs

/*
UPDATE shipping_preparations
SET 
  refinery_id = 'COLLER_UUID_RAFFINERIE_ICI',
  freight_company_id = 'COLLER_UUID_COMPAGNIE_FRET_ICI',
  export_license_id = 'COLLER_UUID_LICENSE_ICI'
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
*/

-- Étape 6: VÉRIFIER LE RÉSULTAT
SELECT 
  sp.id,
  sp.expedition_lot_number,
  r.name as raffinerie,
  r.country as pays_raffinerie,
  f.name as compagnie_fret,
  el.license_number,
  el.quota_kg as quota_disponible
FROM shipping_preparations sp
LEFT JOIN refinery_plants r ON r.id = sp.refinery_id
LEFT JOIN freight_companies f ON f.id = sp.freight_company_id
LEFT JOIN export_licenses el ON el.id = sp.export_license_id
WHERE sp.id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';

-- Si vous voyez les noms s'afficher, c'est bon !
-- Sinon, ils seront NULL et vous devrez exécuter l'UPDATE ci-dessus
