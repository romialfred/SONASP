-- =====================================================
-- LISTE: Shipping Preparations Invalides
-- =====================================================
-- Version SÉCURISÉE qui LISTE seulement (ne supprime pas)
-- Identifie les shipping_preparations dont les productions
-- sont encore à l'étape "prepared"

DO $$
DECLARE
  v_count INTEGER := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LISTE DES SHIPPING INVALIDES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      sp.id,
      sp.expedition_lot_number,
      sp.status::text as shipping_status,
      sp.total_net_weight_grams,
      sp.created_at,
      COUNT(DISTINCT spi.daily_production_id) as nb_productions,
      STRING_AGG(DISTINCT dp.status::text, ', ') as production_statuses,
      STRING_AGG(DISTINCT dp.bar_reference, ', ' ORDER BY dp.bar_reference) as production_refs
    FROM shipping_preparations sp
    LEFT JOIN shipping_production_items spi ON spi.shipping_preparation_id = sp.id
    LEFT JOIN daily_production dp ON dp.id = spi.daily_production_id
    GROUP BY sp.id, sp.expedition_lot_number, sp.status, sp.total_net_weight_grams, sp.created_at
    HAVING STRING_AGG(DISTINCT dp.status::text, ', ') = 'prepared'
       OR (COUNT(DISTINCT spi.daily_production_id) > 0
           AND STRING_AGG(DISTINCT dp.status::text, ', ') LIKE '%prepared%')
    ORDER BY sp.created_at DESC
  LOOP
    v_count := v_count + 1;

    RAISE NOTICE '❌ SHIPPING INVALIDE #%:', v_count;
    RAISE NOTICE '';
    RAISE NOTICE '  ID:                  %', rec.id;
    RAISE NOTICE '  Lot:                 %', rec.expedition_lot_number;
    RAISE NOTICE '  Status:              %', rec.shipping_status;
    RAISE NOTICE '  Créé le:             %', rec.created_at;
    RAISE NOTICE '  Nombre productions:  %', rec.nb_productions;
    RAISE NOTICE '  Status productions:  %', rec.production_statuses;
    RAISE NOTICE '  Références:          %', rec.production_refs;
    RAISE NOTICE '  Poids total:         % g', rec.total_net_weight_grams;
    RAISE NOTICE '';
    RAISE NOTICE '  Pour supprimer:';
    RAISE NOTICE '  DELETE FROM shipping_preparations WHERE id = ''%'';', rec.id;
    RAISE NOTICE '';
    RAISE NOTICE '  ────────────────────────────────────────';
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ Aucune shipping invalide trouvée';
    RAISE NOTICE '';
    RAISE NOTICE 'Toutes les shipping_preparations sont cohérentes.';
  ELSE
    RAISE NOTICE 'Total shipping invalides: %', v_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  CES SHIPPING NE DEVRAIENT PAS EXISTER';
    RAISE NOTICE '';
    RAISE NOTICE 'Pour nettoyer automatiquement, exécuter:';
    RAISE NOTICE 'scripts/cleanup-invalid-shippings-FIXED.sql';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';

END $$;
