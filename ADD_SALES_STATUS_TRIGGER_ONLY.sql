-- ================================================================
-- AJOUTER UNIQUEMENT LE TRIGGER POUR L'HISTORIQUE DES STATUTS
-- ================================================================
-- La colonne status existe deja - on ajoute juste le trigger
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AJOUT DU TRIGGER HISTORIQUE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- ETAPE 1: Mettre à jour la contrainte CHECK sur unified_status_history
DO $$
BEGIN
  RAISE NOTICE 'Etape 1/3: Mise a jour contrainte unified_status_history...';

  -- Supprimer l'ancienne contrainte si elle existe
  ALTER TABLE unified_status_history
  DROP CONSTRAINT IF EXISTS unified_status_history_entity_type_check;

  -- Ajouter la nouvelle contrainte incluant 'sales'
  ALTER TABLE unified_status_history
  ADD CONSTRAINT unified_status_history_entity_type_check
  CHECK (entity_type IN ('production', 'shipping', 'sales'));

  RAISE NOTICE '  ✓ Contrainte mise a jour (accepte maintenant sales)';
  RAISE NOTICE '';
END $$;

-- ETAPE 2: Créer la fonction de trigger
DO $$
BEGIN
  RAISE NOTICE 'Etape 2/3: Creation de la fonction trigger...';

  CREATE OR REPLACE FUNCTION log_sales_status_change()
  RETURNS TRIGGER AS $func$
  BEGIN
    -- Insérer dans l'historique uniquement si le statut change
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
      INSERT INTO unified_status_history (
        entity_type,
        entity_id,
        old_status,
        new_status,
        change_context,
        changed_by,
        metadata
      ) VALUES (
        'sales',
        NEW.id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END,
        NEW.status::text,
        'system',
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        jsonb_build_object(
          'operation', TG_OP,
          'sale_number', NEW.sale_number,
          'customer_id', NEW.customer_id,
          'quantity_grams', NEW.quantity_grams
        )
      );
    END IF;

    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER;

  RAISE NOTICE '  ✓ Fonction log_sales_status_change() creee';
  RAISE NOTICE '';
END $$;

-- ETAPE 3: Créer le trigger
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'Etape 3/3: Creation du trigger...';

  -- Vérifier si le trigger existe déjà
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sales_status_history_trigger'
    AND tgrelid = 'sales'::regclass
  ) INTO v_trigger_exists;

  -- Supprimer si existe
  IF v_trigger_exists THEN
    DROP TRIGGER sales_status_history_trigger ON sales;
    RAISE NOTICE '  ✓ Ancien trigger supprime';
  END IF;

  -- Créer le nouveau trigger
  CREATE TRIGGER sales_status_history_trigger
    AFTER INSERT OR UPDATE OF status ON sales
    FOR EACH ROW
    EXECUTE FUNCTION log_sales_status_change();

  RAISE NOTICE '  ✓ Trigger sales_status_history_trigger cree';
  RAISE NOTICE '';
END $$;

-- VERIFICATION FINALE
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_constraint_ok BOOLEAN;
  v_function_exists BOOLEAN;
  v_total_sales INT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Vérifier trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sales_status_history_trigger'
    AND tgrelid = 'sales'::regclass
    AND NOT tgisinternal
  ) INTO v_trigger_exists;

  -- Vérifier fonction
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'log_sales_status_change'
  ) INTO v_function_exists;

  -- Vérifier contrainte CHECK
  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'unified_status_history'
    AND cc.check_clause LIKE '%sales%'
  ) INTO v_constraint_ok;

  -- Compter les ventes
  SELECT COUNT(*) INTO v_total_sales FROM sales;

  -- Afficher les résultats
  RAISE NOTICE '1. Fonction trigger:';
  RAISE NOTICE '   Existe: %', CASE WHEN v_function_exists THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE '   Nom: log_sales_status_change()';
  RAISE NOTICE '';

  RAISE NOTICE '2. Trigger:';
  RAISE NOTICE '   Existe: %', CASE WHEN v_trigger_exists THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE '   Nom: sales_status_history_trigger';
  RAISE NOTICE '   Table: sales';
  RAISE NOTICE '';

  RAISE NOTICE '3. Configuration unified_status_history:';
  RAISE NOTICE '   Contrainte accepte sales: %', CASE WHEN v_constraint_ok THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE '';

  RAISE NOTICE '4. Donnees:';
  RAISE NOTICE '   Total ventes: %', v_total_sales;
  RAISE NOTICE '';

  RAISE NOTICE '========================================';
  IF v_trigger_exists AND v_function_exists AND v_constraint_ok THEN
    RAISE NOTICE 'RESULTAT: ✓ CONFIGURATION COMPLETE!';
    RAISE NOTICE '';
    RAISE NOTICE 'Le trigger est actif.';
    RAISE NOTICE 'Les changements de statut seront logues dans unified_status_history.';
    RAISE NOTICE '';
    RAISE NOTICE 'Test: Modifiez le statut d''une vente pour verifier.';
  ELSE
    RAISE WARNING 'RESULTAT: ✗ PROBLEME DETECTE';
    RAISE WARNING '';
    IF NOT v_function_exists THEN
      RAISE WARNING '  - La fonction n''a pas ete creee';
    END IF;
    IF NOT v_trigger_exists THEN
      RAISE WARNING '  - Le trigger n''a pas ete cree';
    END IF;
    IF NOT v_constraint_ok THEN
      RAISE WARNING '  - La contrainte CHECK ne permet pas sales';
    END IF;
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
