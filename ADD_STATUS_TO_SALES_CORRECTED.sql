-- ================================================================
-- CORRECTION URGENTE: Ajouter colonne status à sales
-- VERSION CORRIGEE: Compatible avec unified_status_history
-- ================================================================

-- ETAPE PRELIMINAIRE: Mettre à jour la table unified_status_history
-- pour accepter 'sales' dans entity_type
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PREPARATION: Mise a jour contrainte CHECK';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'unified_status_history'
    AND constraint_name LIKE '%entity_type%'
  ) THEN
    ALTER TABLE unified_status_history
    DROP CONSTRAINT IF EXISTS unified_status_history_entity_type_check;

    RAISE NOTICE '  ✓ Ancienne contrainte supprimee';
  ELSE
    RAISE NOTICE '  ✓ Aucune contrainte a supprimer';
  END IF;

  -- Ajouter la nouvelle contrainte incluant 'sales'
  ALTER TABLE unified_status_history
  ADD CONSTRAINT unified_status_history_entity_type_check
  CHECK (entity_type IN ('production', 'shipping', 'sales'));

  RAISE NOTICE '  ✓ Nouvelle contrainte ajoutee (inclut sales)';
  RAISE NOTICE '';
END $$;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEBUT DE LA CORRECTION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- 1. Ajouter la colonne status à sales
DO $$
BEGIN
  RAISE NOTICE 'Etape 1/6: Ajout de la colonne status...';

  ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS status sale_status
  DEFAULT 'pending_management_approval'::sale_status
  NOT NULL;

  RAISE NOTICE '  ✓ Colonne status ajoutee avec succes';
  RAISE NOTICE '';
END $$;

-- 2. Créer l'index pour performance
DO $$
BEGIN
  RAISE NOTICE 'Etape 2/6: Creation de l''index...';

  CREATE INDEX IF NOT EXISTS idx_sales_status
  ON sales(status);

  RAISE NOTICE '  ✓ Index cree avec succes';
  RAISE NOTICE '';
END $$;

-- 3. Mettre à jour les ventes existantes
DO $$
DECLARE
  v_updated_count INT;
BEGIN
  RAISE NOTICE 'Etape 3/6: Mise a jour des ventes existantes...';

  UPDATE sales
  SET status = 'pending_management_approval'::sale_status
  WHERE status IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RAISE NOTICE '  ✓ % vente(s) mise(s) a jour', v_updated_count;
  RAISE NOTICE '';
END $$;

-- 4. Créer la fonction de trigger pour l'historique
DO $$
BEGIN
  RAISE NOTICE 'Etape 4/6: Creation de la fonction trigger...';

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
          'customer_id', NEW.customer_id
        )
      );
    END IF;

    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER;

  RAISE NOTICE '  ✓ Fonction trigger creee avec succes';
  RAISE NOTICE '';
END $$;

-- 5. Supprimer l'ancien trigger s'il existe
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'Etape 5/6: Nettoyage des anciens triggers...';

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sales_status_history_trigger'
    AND tgrelid = 'sales'::regclass
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    DROP TRIGGER sales_status_history_trigger ON sales;
    RAISE NOTICE '  ✓ Ancien trigger supprime';
  ELSE
    RAISE NOTICE '  ✓ Pas d''ancien trigger a supprimer';
  END IF;

  RAISE NOTICE '';
END $$;

-- 6. Créer le nouveau trigger
DO $$
BEGIN
  RAISE NOTICE 'Etape 6/6: Creation du nouveau trigger...';

  CREATE TRIGGER sales_status_history_trigger
    AFTER INSERT OR UPDATE OF status ON sales
    FOR EACH ROW
    EXECUTE FUNCTION log_sales_status_change();

  RAISE NOTICE '  ✓ Trigger cree avec succes';
  RAISE NOTICE '';
END $$;

-- 7. Vérification finale
DO $$
DECLARE
  v_col_exists BOOLEAN;
  v_trig_exists BOOLEAN;
  v_default_val TEXT;
  v_col_type TEXT;
  v_total_sales INT;
  v_constraint_ok BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Vérifier colonne
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales'
    AND column_name = 'status'
  ) INTO v_col_exists;

  -- Récupérer le type de colonne
  SELECT udt_name INTO v_col_type
  FROM information_schema.columns
  WHERE table_name = 'sales'
  AND column_name = 'status';

  -- Vérifier trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sales_status_history_trigger'
    AND tgrelid = 'sales'::regclass
    AND NOT tgisinternal
  ) INTO v_trig_exists;

  -- Vérifier valeur par défaut
  SELECT column_default INTO v_default_val
  FROM information_schema.columns
  WHERE table_name = 'sales'
  AND column_name = 'status';

  -- Vérifier contrainte CHECK sur unified_status_history
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
  RAISE NOTICE '1. Configuration de la colonne:';
  RAISE NOTICE '   Colonne existe: %', CASE WHEN v_col_exists THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE '   Type de colonne: %', COALESCE(v_col_type, 'N/A');
  RAISE NOTICE '   Valeur par defaut: %', COALESCE(v_default_val, 'N/A');
  RAISE NOTICE '';

  RAISE NOTICE '2. Configuration du trigger:';
  RAISE NOTICE '   Trigger existe: %', CASE WHEN v_trig_exists THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE '   Nom: sales_status_history_trigger';
  RAISE NOTICE '   Fonction: log_sales_status_change()';
  RAISE NOTICE '';

  RAISE NOTICE '3. Configuration unified_status_history:';
  RAISE NOTICE '   Contrainte accepte sales: %', CASE WHEN v_constraint_ok THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE '';

  RAISE NOTICE '4. Donnees:';
  RAISE NOTICE '   Total ventes: %', v_total_sales;
  RAISE NOTICE '';

  RAISE NOTICE '========================================';
  IF v_col_exists AND v_trig_exists AND v_constraint_ok THEN
    RAISE NOTICE 'RESULTAT: ✓ CORRECTION REUSSIE!';
    RAISE NOTICE '';
    RAISE NOTICE 'La table sales est maintenant prete.';
    RAISE NOTICE 'Historique sera logue dans unified_status_history.';
  ELSE
    RAISE WARNING 'RESULTAT: ✗ PROBLEME DETECTE';
    RAISE WARNING '';
    IF NOT v_col_exists THEN
      RAISE WARNING '  - La colonne status n''a pas ete creee';
    END IF;
    IF NOT v_trig_exists THEN
      RAISE WARNING '  - Le trigger n''a pas ete cree';
    END IF;
    IF NOT v_constraint_ok THEN
      RAISE WARNING '  - La contrainte CHECK ne permet pas sales';
    END IF;
    RAISE WARNING '';
    RAISE WARNING 'Verifiez les erreurs ci-dessus et reessayez.';
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
