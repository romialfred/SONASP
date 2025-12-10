-- Script de vérification des licences d'exportation
-- pour la page Shipping Preparation Details

-- ============================================
-- 1. Vérifier toutes les licences d'exportation
-- ============================================
SELECT
  id,
  license_number,
  issue_date,
  expiry_date,
  CASE
    WHEN expiry_date IS NULL THEN 'Pas de date d''expiration'
    WHEN expiry_date > NOW() THEN 'Valide ✓'
    ELSE 'Expirée ✗'
  END AS status,
  created_at
FROM export_licenses
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 2. Vérifier les shipping_preparations avec leurs licences
-- ============================================
SELECT
  sp.id,
  sp.reference_number,
  sp.export_license_id,
  el.license_number,
  el.issue_date,
  el.expiry_date,
  CASE
    WHEN sp.export_license_id IS NULL THEN 'Pas de licence associée'
    WHEN el.license_number IS NULL THEN 'Licence introuvable'
    WHEN el.expiry_date > NOW() THEN 'Licence valide ✓'
    ELSE 'Licence expirée ✗'
  END AS license_status
FROM shipping_preparations sp
LEFT JOIN export_licenses el ON sp.export_license_id = el.id
ORDER BY sp.created_at DESC
LIMIT 10;

-- ============================================
-- 3. Shipping preparations SANS licence
-- ============================================
SELECT
  id,
  reference_number,
  shipment_date,
  status,
  created_at
FROM shipping_preparations
WHERE export_license_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 4. Détail complet pour UNE shipping preparation spécifique
-- ============================================
-- Remplacer 'VOTRE-ID-ICI' par l'ID réel
/*
SELECT
  sp.id AS shipping_id,
  sp.reference_number,
  sp.export_license_id,
  sp.shipment_date,
  sp.status,
  el.id AS license_id,
  el.license_number,
  el.issue_date,
  el.expiry_date,
  mc.name AS mining_company,
  rp.name AS refinery,
  tc.name AS transport_company
FROM shipping_preparations sp
LEFT JOIN export_licenses el ON sp.export_license_id = el.id
LEFT JOIN mining_companies mc ON sp.mining_company_id = mc.id
LEFT JOIN refineries rp ON sp.refinery_id = rp.id
LEFT JOIN transport_companies tc ON sp.freight_company_id = tc.id
WHERE sp.id = 'VOTRE-ID-ICI';
*/

-- ============================================
-- 5. Statistiques des licences
-- ============================================
SELECT
  COUNT(*) AS total_licenses,
  COUNT(CASE WHEN expiry_date > NOW() THEN 1 END) AS valid_licenses,
  COUNT(CASE WHEN expiry_date <= NOW() THEN 1 END) AS expired_licenses,
  COUNT(CASE WHEN expiry_date IS NULL THEN 1 END) AS no_expiry_date
FROM export_licenses;

-- ============================================
-- 6. Licences expirées encore utilisées
-- ============================================
SELECT
  el.license_number,
  el.expiry_date,
  COUNT(sp.id) AS shipments_using_this_license,
  STRING_AGG(sp.reference_number, ', ') AS shipment_references
FROM export_licenses el
INNER JOIN shipping_preparations sp ON sp.export_license_id = el.id
WHERE el.expiry_date < NOW()
GROUP BY el.id, el.license_number, el.expiry_date
ORDER BY el.expiry_date DESC;
