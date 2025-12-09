-- =====================================================
-- CORRECTION CONTRAINTE RAFFINERIE
-- =====================================================
--
-- Problème: shipping_preparations.refinery_id pointe vers
--           refinery_plants au lieu de refineries
--
-- Solution: Supprimer l'ancienne contrainte et en créer
--           une nouvelle vers la bonne table
-- =====================================================

-- 1. Supprimer l'ancienne contrainte vers refinery_plants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_preparations_refinery_id_fkey'
    AND table_name = 'shipping_preparations'
  ) THEN
    ALTER TABLE shipping_preparations
    DROP CONSTRAINT shipping_preparations_refinery_id_fkey;

    RAISE NOTICE '✅ Ancienne contrainte (refinery_plants) supprimée';
  ELSE
    RAISE NOTICE 'ℹ️  Ancienne contrainte déjà supprimée';
  END IF;
END $$;

-- 2. Créer la nouvelle contrainte vers refineries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_preparations_refinery_id_fkey_refineries'
    AND table_name = 'shipping_preparations'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD CONSTRAINT shipping_preparations_refinery_id_fkey_refineries
    FOREIGN KEY (refinery_id) REFERENCES refineries(id) ON DELETE SET NULL;

    RAISE NOTICE '✅ Nouvelle contrainte (refineries) créée';
  ELSE
    RAISE NOTICE 'ℹ️  Nouvelle contrainte existe déjà';
  END IF;
END $$;

-- 3. Vérification (optionnel)
SELECT
  'Contrainte corrigée ✅' as status,
  tc.constraint_name,
  ccu.table_name AS references_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'shipping_preparations'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_name LIKE '%refinery%';
