-- =====================================================
-- NETTOYAGE: Shipping Preparations Invalides
-- =====================================================
-- Supprime les shipping_preparations dont les productions
-- sont encore à l'étape "prepared" (incohérence de données)

DO $$
DECLARE
  v_invalid_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NETTOYAGE SHIPPING PREPARATIONS INVALIDES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 1. Identifier les shipping_preparations invalides
  RAISE NOTICE '1. IDENTIFICATION des shipping_preparations invalides:';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      sp.id,
      sp.expedition_lot_number,
      sp.status as shipping_status,
      sp.export_license_id,
      sp.total_weight_grams,
      COUNT(DISTINCT spi.production_id) as nb_productions,
      STRING_AGG(DISTINCT dp.status::text, ', ') as production_statuses,
      STRING_AGG(DISTINCT dp.bar_reference, ', ') as production_refs
    FROM shipping_preparations sp
    LEFT JOIN shipping_production_items spi ON spi.shipping_preparation_id = sp.id
    LEFT JOIN daily_production dp ON dp.id = spi.production_id
    GROUP BY sp.id, sp.expedition_lot_number, sp.status, sp.export_license_id, sp.total_weight_grams
    HAVING STRING_AGG(DISTINCT dp.status::text, ', ') = 'prepared'
       OR (COUNT(DISTINCT spi.production_id) > 0
           AND STRING_AGG(DISTINCT dp.status::text, ', ') LIKE '%prepared%')
  LOOP
    v_invalid_count := v_invalid_count + 1;

    RAISE NOTICE '  ❌ Shipping INVALIDE #%:', v_invalid_count;
    RAISE NOTICE '      ID: %', rec.id;
    RAISE NOTICE '      Lot: %', rec.expedition_lot_number;
    RAISE NOTICE '      Status Shipping: %', rec.shipping_status;
    RAISE NOTICE '      Productions (%): %', rec.nb_productions, rec.production_refs;
    RAISE NOTICE '      Status Productions: %', rec.production_statuses;
    RAISE NOTICE '      Poids Total: % g', rec.total_weight_grams;
    RAISE NOTICE '';

    -- SUPPRESSION: Supprimer cette shipping_preparation
    -- Note: Les shipping_production_items seront supprimés en cascade
    BEGIN
      DELETE FROM shipping_preparations
      WHERE id = rec.id;

      v_deleted_count := v_deleted_count + 1;

      RAISE NOTICE '      ✅ SUPPRIMÉ avec succès';

      -- Si une licence était associée, vérifier qu'elle a été libérée
      IF rec.export_license_id IS NOT NULL THEN
        RAISE NOTICE '      📋 Quota de licence libéré: % g', rec.total_weight_grams;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '      ❌ ERREUR lors de la suppression: %', SQLERRM;
    END;

    RAISE NOTICE '';
    RAISE NOTICE '  ---';
    RAISE NOTICE '';
  END LOOP;

  -- 2. Résumé
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Shipping invalides trouvées: %', v_invalid_count;
  RAISE NOTICE 'Shipping supprimées: %', v_deleted_count;

  IF v_deleted_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ NETTOYAGE TERMINÉ AVEC SUCCÈS';
  ELSIF v_invalid_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Aucune shipping invalide trouvée';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Certaines shipping n''ont pas pu être supprimées';
  END IF;

  -- 3. Vérification finale
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Compter les shipping_preparations restantes
  SELECT COUNT(*) INTO v_invalid_count
  FROM shipping_preparations sp
  LEFT JOIN shipping_production_items spi ON spi.shipping_preparation_id = sp.id
  LEFT JOIN daily_production dp ON dp.id = spi.production_id
  GROUP BY sp.id
  HAVING STRING_AGG(DISTINCT dp.status::text, ', ') = 'prepared';

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Il reste encore % shipping_preparations invalides', v_invalid_count;
  ELSE
    RAISE NOTICE '✅ Toutes les shipping_preparations invalides ont été nettoyées';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIN DU NETTOYAGE';
  RAISE NOTICE '========================================';

END $$;
