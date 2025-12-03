-- Diagnostic: Vérifier les signataires pour l'expédition HUM-KGM-002:2025

-- 1. Trouver l'expédition HUM-KGM-002:2025
SELECT
  id,
  expedition_lot_number,
  reference_number,
  status,
  mining_company_id,
  created_at
FROM shipping_preparations
WHERE expedition_lot_number LIKE '%KGM-002%'
   OR expedition_lot_number LIKE '%KGM%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Vérifier les signataires dans shipping_signatories
SELECT
  ss.id,
  ss.shipping_preparation_id,
  ss.full_name,
  ss.position,
  ss.title,
  ss.order_index,
  sp.expedition_lot_number,
  sp.reference_number
FROM shipping_signatories ss
LEFT JOIN shipping_preparations sp ON sp.id = ss.shipping_preparation_id
WHERE sp.expedition_lot_number LIKE '%KGM%'
ORDER BY sp.expedition_lot_number, ss.order_index;

-- 3. Vérifier TOUTES les colonnes de shipping_signatories
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_signatories'
ORDER BY ordinal_position;

-- 4. Compter les signataires par expédition
SELECT
  sp.expedition_lot_number,
  sp.id as shipping_prep_id,
  COUNT(ss.id) as signatory_count
FROM shipping_preparations sp
LEFT JOIN shipping_signatories ss ON ss.shipping_preparation_id = sp.id
WHERE sp.expedition_lot_number LIKE '%KGM%'
GROUP BY sp.id, sp.expedition_lot_number
ORDER BY sp.expedition_lot_number;

-- 5. Afficher tous les signataires (peu importe l'expédition)
SELECT
  ss.*,
  sp.expedition_lot_number
FROM shipping_signatories ss
LEFT JOIN shipping_preparations sp ON sp.id = ss.shipping_preparation_id
ORDER BY ss.created_at DESC
LIMIT 10;
