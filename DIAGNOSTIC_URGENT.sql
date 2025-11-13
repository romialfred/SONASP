-- ========================================
-- DIAGNOSTIC URGENT - État actuel DB
-- ========================================
-- Exécuter dans Supabase SQL Editor

-- 1. Vérifier le type de la colonne status
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'status';

-- 2. Vérifier les valeurs enum disponibles
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'shipping_status_v2'::regtype
ORDER BY enumsortorder;

-- 3. Compter les enregistrements avec statut "shipped" (devrait être 0)
SELECT
  status::text as status_text,
  COUNT(*) as count
FROM shipping_preparations
GROUP BY status::text
ORDER BY count DESC;

-- 4. Vérifier les tables backup
SELECT
  table_name
FROM information_schema.tables
WHERE table_name LIKE 'shipping_preparations_backup%'
ORDER BY table_name;

-- 5. Si des "shipped" existent encore, les lister
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM shipping_preparations
  WHERE status::text = 'shipped';

  RAISE NOTICE 'Nombre de "shipped" trouvés: %', v_count;

  IF v_count > 0 THEN
    RAISE NOTICE '⚠️ DES VALEURS "shipped" EXISTENT ENCORE!';
  ELSE
    RAISE NOTICE '✅ Aucun "shipped" trouvé';
  END IF;
END $$;
