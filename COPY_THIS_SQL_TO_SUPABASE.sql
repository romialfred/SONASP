-- =====================================================
-- CORRECTION DÉFINITIVE - Basée sur la vraie structure
-- =====================================================

-- ÉTAPE 1: Vérifier la structure réelle des tables
-- =====================================================

-- Structure de refinery_plants
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'refinery_plants'
ORDER BY ordinal_position;

-- Structure de freight_companies  
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'freight_companies'
ORDER BY ordinal_position;

-- Structure de export_licenses
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'export_licenses'
ORDER BY ordinal_position;

-- ÉTAPE 2: Voir toutes les données disponibles
-- =====================================================

-- Raffineries (toutes les colonnes)
SELECT * FROM refinery_plants LIMIT 3;

-- Compagnies de fret (toutes les colonnes)
SELECT * FROM freight_companies LIMIT 3;

-- Licenses d'export (toutes les colonnes disponibles)
SELECT * FROM export_licenses LIMIT 3;

-- ÉTAPE 3: État actuel de votre expédition
-- =====================================================

SELECT 
  id,
  expedition_lot_number,
  refinery_id,
  freight_company_id,
  export_license_id,
  shipped_to_company,
  shipped_to_address,
  created_at
FROM shipping_preparations
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';

-- ÉTAPE 4: Voir les JOINTURES actuelles
-- =====================================================

SELECT 
  sp.id,
  sp.expedition_lot_number,
  r.name as nom_raffinerie,
  r.country as pays_raffinerie,
  f.name as nom_compagnie_fret,
  el.license_number as numero_licence
FROM shipping_preparations sp
LEFT JOIN refinery_plants r ON r.id = sp.refinery_id
LEFT JOIN freight_companies f ON f.id = sp.freight_company_id
LEFT JOIN export_licenses el ON el.id = sp.export_license_id
WHERE sp.id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';

-- =====================================================
-- ATTENDEZ ICI ET REGARDEZ LES RÉSULTATS
-- =====================================================
-- 
-- Vous allez voir:
-- 1. Les colonnes exactes de chaque table
-- 2. Les données disponibles avec leurs vrais noms
-- 3. Si votre expédition a refinery_id et freight_company_id = NULL
-- 
-- Une fois que vous avez vu les résultats, passez à l'ÉTAPE 5
--
-- =====================================================

-- ÉTAPE 5: CORRECTION (à exécuter APRÈS avoir vu les résultats)
-- =====================================================
-- 
-- Décommentez les lignes ci-dessous et remplacez les UUIDs
-- avec ceux que vous avez vus dans les résultats de l'ÉTAPE 2
--

/*
UPDATE shipping_preparations
SET 
  refinery_id = 'COLLEZ_UUID_RAFFINERIE_ICI',
  freight_company_id = 'COLLEZ_UUID_COMPAGNIE_FRET_ICI',
  export_license_id = 'COLLEZ_UUID_LICENSE_ICI'  -- optionnel
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
*/

-- ÉTAPE 6: VÉRIFICATION FINALE
-- =====================================================
-- Après avoir exécuté l'UPDATE, vérifiez:

/*
SELECT 
  sp.expedition_lot_number,
  r.name as raffinerie,
  r.country as pays,
  f.name as compagnie_fret,
  el.license_number
FROM shipping_preparations sp
LEFT JOIN refinery_plants r ON r.id = sp.refinery_id
LEFT JOIN freight_companies f ON f.id = sp.freight_company_id
LEFT JOIN export_licenses el ON el.id = sp.export_license_id
WHERE sp.id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
*/

-- Si vous voyez les noms, c'est TERMINÉ !
-- Rafraîchissez la page de l'application (F5)
