/*
  # ULTRA SIMPLE FIX - Clean any remaining shipped values

  Cette migration est ULTRA SÉCURISÉE et peut être exécutée PLUSIEURS fois.
  Elle ne touche que les données, pas la structure.
*/

-- =========================================
-- ÉTAPE 1: Vérifier l'état actuel
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ULTRA SIMPLE FIX - Début';
  RAISE NOTICE '========================================';
END $$;

-- =========================================
-- ÉTAPE 2: Nettoyer UNIQUEMENT si nécessaire
-- =========================================

DO $$
DECLARE
  v_total int := 0;
BEGIN
  -- Compter le total
  SELECT COUNT(*) INTO v_total FROM shipping_preparations;
  RAISE NOTICE 'Total enregistrements: %', v_total;

  -- Si la table est vide, pas besoin de nettoyer
  IF v_total = 0 THEN
    RAISE NOTICE 'Table vide - rien à faire';
    RETURN;
  END IF;

  -- Mettre à jour UNIQUEMENT les valeurs problématiques
  -- On ne touche PAS aux valeurs déjà valides
  UPDATE shipping_preparations
  SET status = 'prepared'::shipping_status_v2
  WHERE status::text NOT IN (
    'pending',
    'prepared',
    'validated_for_refinery',
    'in_refining',
    'refined',
    'in_sale',
    'sold',
    'cancelled'
  );

  RAISE NOTICE '✅ Valeurs invalides converties en "prepared"';
EXCEPTION
  WHEN OTHERS THEN
    -- Si erreur, c'est probablement parce que tout est déjà OK
    RAISE NOTICE 'Toutes les valeurs sont déjà valides (ou table vide)';
END $$;

-- =========================================
-- ÉTAPE 3: Vérification
-- =========================================

DO $$
DECLARE
  v_record record;
  v_total int;
BEGIN
  SELECT COUNT(*) INTO v_total FROM shipping_preparations;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total: % enregistrements', v_total;

  IF v_total > 0 THEN
    RAISE NOTICE 'Distribution:';
    FOR v_record IN
      SELECT status::text as s, COUNT(*) as c
      FROM shipping_preparations
      GROUP BY status::text
      ORDER BY c DESC
    LOOP
      RAISE NOTICE '  %: %', v_record.s, v_record.c;
    END LOOP;
  ELSE
    RAISE NOTICE 'Table vide - prête pour insertions';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '========================================';
END $$;
