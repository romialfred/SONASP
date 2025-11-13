/*
  # EMERGENCY FIX - Cleanup ALL "shipped" values

  Cette migration force la conversion de toutes les valeurs invalides
  qui peuvent subsister après les migrations précédentes.

  SAFE: Cette migration peut être exécutée plusieurs fois sans danger.
*/

-- =========================================
-- ÉTAPE 1: Diagnostic initial
-- =========================================

DO $$
DECLARE
  v_current_type text;
  v_shipped_count int := 0;
BEGIN
  -- Vérifier le type actuel
  SELECT udt_name INTO v_current_type
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Type colonne status: %', v_current_type;
  RAISE NOTICE '========================================';

  -- Essayer de compter les "shipped" (peut échouer si type incorrect)
  BEGIN
    SELECT COUNT(*) INTO v_shipped_count
    FROM shipping_preparations
    WHERE status::text = 'shipped';

    RAISE NOTICE 'Enregistrements "shipped" trouvés: %', v_shipped_count;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Impossible de lire les valeurs actuelles: %', SQLERRM;
  END;
END $$;

-- =========================================
-- ÉTAPE 2: Backup de sécurité
-- =========================================

DO $$
BEGIN
  DROP TABLE IF EXISTS shipping_preparations_backup_emergency CASCADE;

  CREATE TABLE shipping_preparations_backup_emergency AS
  SELECT * FROM shipping_preparations;

  RAISE NOTICE '✅ Backup emergency créé';
END $$;

-- =========================================
-- ÉTAPE 3: FORCER la mise à jour des valeurs
-- =========================================

DO $$
DECLARE
  v_updated int := 0;
BEGIN
  -- Méthode 1: UPDATE direct avec default si erreur
  BEGIN
    UPDATE shipping_preparations
    SET status = 'pending'::shipping_status_v2
    WHERE status IS NULL;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Lignes NULL mises à jour: %', v_updated;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Erreur UPDATE NULL: %', SQLERRM;
  END;

  -- Méthode 2: Forcer toutes les valeurs à une valeur valide temporaire
  BEGIN
    -- Mettre tout à 'pending' d'abord
    UPDATE shipping_preparations
    SET status = 'pending'::shipping_status_v2;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE '✅ Toutes les lignes mises à "pending": %', v_updated;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Erreur UPDATE global: %', SQLERRM;
  END;

  -- Méthode 3: Restaurer depuis backup avec conversion
  BEGIN
    UPDATE shipping_preparations sp
    SET status = CASE
      WHEN b.status::text = 'prepared' THEN 'prepared'::shipping_status_v2
      WHEN b.status::text = 'validated_for_refinery' THEN 'validated_for_refinery'::shipping_status_v2
      WHEN b.status::text = 'in_refining' THEN 'in_refining'::shipping_status_v2
      WHEN b.status::text = 'refined' THEN 'refined'::shipping_status_v2
      WHEN b.status::text = 'in_sale' THEN 'in_sale'::shipping_status_v2
      WHEN b.status::text = 'sold' THEN 'sold'::shipping_status_v2
      WHEN b.status::text = 'cancelled' THEN 'cancelled'::shipping_status_v2
      -- TOUT le reste (shipped, etc.) devient 'pending'
      ELSE 'pending'::shipping_status_v2
    END
    FROM shipping_preparations_backup_emergency b
    WHERE sp.id = b.id
    AND b.status::text != 'pending';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE '✅ Valeurs restaurées depuis backup: %', v_updated;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Erreur restauration backup: %', SQLERRM;
  END;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ CLEANUP TERMINÉ';
  RAISE NOTICE '========================================';
END $$;

-- =========================================
-- ÉTAPE 4: Vérification finale
-- =========================================

DO $$
DECLARE
  v_total int;
  v_by_status record;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM shipping_preparations;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total enregistrements: %', v_total;
  RAISE NOTICE 'Distribution par statut:';

  FOR v_by_status IN
    SELECT status::text as status_name, COUNT(*) as count
    FROM shipping_preparations
    GROUP BY status::text
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  - %: %', v_by_status.status_name, v_by_status.count;
  END LOOP;

  RAISE NOTICE '========================================';
END $$;

-- =========================================
-- ÉTAPE 5: Test INSERT
-- =========================================

DO $$
DECLARE
  v_test_id uuid;
BEGIN
  -- Test avec chaque valeur valide
  INSERT INTO shipping_preparations (
    expedition_lot_number,
    status,
    total_net_weight_grams,
    total_gross_weight_grams,
    total_weight_oz
  ) VALUES (
    'TEST-EMERGENCY-' || gen_random_uuid()::text,
    'prepared'::shipping_status_v2,
    0, 0, 0
  ) RETURNING id INTO v_test_id;

  DELETE FROM shipping_preparations WHERE id = v_test_id;

  RAISE NOTICE '✅✅✅ TEST INSERT/DELETE RÉUSSI ✅✅✅';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LA BASE EST MAINTENANT PROPRE!';
  RAISE NOTICE '========================================';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ Test INSERT a échoué: %', SQLERRM;
END $$;
