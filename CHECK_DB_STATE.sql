-- ============================================================================
-- DIAGNOSTIC: Vérification de l'état actuel de la base de données
-- ============================================================================

-- 1. Vérifier si batch_id existe
SELECT
  'batch_id existe?' as verification,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'batch_id'
  ) as resultat;

-- 2. Vérifier si freight_shipment_id existe
SELECT
  'freight_shipment_id existe?' as verification,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'freight_shipment_id'
  ) as resultat;

-- 3. Lister TOUTES les colonnes de inventory_transactions
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory_transactions'
ORDER BY ordinal_position;

-- 4. Compter les contraintes sur batch_id
SELECT
  'Contraintes sur batch_id' as verification,
  COUNT(*) as nombre
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'inventory_transactions'
  AND ccu.column_name = 'batch_id';
