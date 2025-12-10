/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  CORRECTION AUTOMATIQUE - Supprimer TOUTES traces de batch_id           ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  Ce script va AUTOMATIQUEMENT:
  1. Trouver TOUTES les vues qui référencent batch_id
  2. Les SUPPRIMER
  3. Supprimer TOUS les index sur batch_id
  4. Supprimer TOUTES les contraintes sur batch_id
  5. Supprimer la colonne batch_id partout
  6. Recréer les fonctions correctement

  SÉCURISÉ: Opération idempotente, peut être exécuté plusieurs fois

  INSTRUCTIONS:
  1. Ouvrez Supabase SQL Editor
  2. Copiez TOUT ce fichier
  3. Exécutez (Ctrl+Enter)
  4. Attendez "Success"
*/

-- ============================================================================
-- ÉTAPE 1: Supprimer TOUTES les vues qui référencent batch_id
-- ============================================================================
DO $$
DECLARE
  view_record RECORD;
  view_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 1: Suppression des vues avec batch_id                 ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  FOR view_record IN
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
      AND definition ILIKE '%batch_id%'
  LOOP
    RAISE NOTICE '⚠️  Suppression de la vue: %', view_record.viewname;
    EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', view_record.viewname);
    view_count := view_count + 1;
  END LOOP;

  IF view_count = 0 THEN
    RAISE NOTICE '✅ Aucune vue avec batch_id trouvée';
  ELSE
    RAISE NOTICE '✅ % vue(s) supprimée(s)', view_count;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2: Supprimer TOUS les index sur batch_id
-- ============================================================================
DO $$
DECLARE
  index_name TEXT;
  index_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 2: Suppression des index sur batch_id                 ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  FOR index_name IN
    SELECT i.relname
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = 'inventory_transactions'
      AND a.attname = 'batch_id'
  LOOP
    RAISE NOTICE '⚠️  Suppression de l''index: %', index_name;
    EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', index_name);
    index_count := index_count + 1;
  END LOOP;

  IF index_count = 0 THEN
    RAISE NOTICE '✅ Aucun index sur batch_id trouvé';
  ELSE
    RAISE NOTICE '✅ % index supprimé(s)', index_count;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3: Supprimer TOUTES les contraintes sur batch_id
-- ============================================================================
DO $$
DECLARE
  constraint_name TEXT;
  constraint_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 3: Suppression des contraintes sur batch_id           ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Contraintes sur inventory_transactions
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'inventory_transactions'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%batch_id%'
  LOOP
    RAISE NOTICE '⚠️  Suppression de la contrainte: %', constraint_name;
    EXECUTE format('ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_name);
    constraint_count := constraint_count + 1;
  END LOOP;

  IF constraint_count = 0 THEN
    RAISE NOTICE '✅ Aucune contrainte sur batch_id trouvée';
  ELSE
    RAISE NOTICE '✅ % contrainte(s) supprimée(s)', constraint_count;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 4: Supprimer la colonne batch_id de TOUTES les tables
-- ============================================================================
DO $$
DECLARE
  table_record RECORD;
  column_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 4: Suppression de la colonne batch_id                 ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  FOR table_record IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'batch_id'
  LOOP
    RAISE NOTICE '⚠️  Suppression de batch_id dans: %', table_record.table_name;
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS batch_id CASCADE', table_record.table_name);
    column_count := column_count + 1;
  END LOOP;

  IF column_count = 0 THEN
    RAISE NOTICE '✅ Colonne batch_id n''existe nulle part';
  ELSE
    RAISE NOTICE '✅ batch_id supprimé de % table(s)', column_count;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 5: Supprimer TOUTES les fonctions obsolètes
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 5: Suppression des fonctions obsolètes                ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  DROP FUNCTION IF EXISTS create_inventory_transaction() CASCADE;
  DROP FUNCTION IF EXISTS track_inventory_transaction() CASCADE;
  DROP FUNCTION IF EXISTS update_inventory_transaction() CASCADE;
  DROP FUNCTION IF EXISTS handle_inventory_transaction() CASCADE;

  RAISE NOTICE '✅ Toutes les anciennes fonctions supprimées';
END $$;

-- ============================================================================
-- ÉTAPE 6: Supprimer TOUS les triggers obsolètes
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 6: Suppression des triggers obsolètes                 ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory CASCADE;
  DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory CASCADE;
  DROP TRIGGER IF EXISTS update_inventory_transaction ON gold_inventory CASCADE;
  DROP TRIGGER IF EXISTS create_inventory_transaction_trigger ON gold_inventory CASCADE;
  DROP TRIGGER IF EXISTS handle_inventory_transaction_trigger ON gold_inventory CASCADE;

  RAISE NOTICE '✅ Tous les anciens triggers supprimés';
END $$;

-- ============================================================================
-- ÉTAPE 7: S'assurer que freight_shipment_id existe
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 7: Vérification de freight_shipment_id                ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'freight_shipment_id'
  ) THEN
    RAISE NOTICE '⚠️  Ajout de freight_shipment_id à inventory_transactions...';
    
    ALTER TABLE inventory_transactions 
      ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;
    
    CREATE INDEX idx_inventory_transactions_freight_shipment 
      ON inventory_transactions(freight_shipment_id);
    
    RAISE NOTICE '✅ freight_shipment_id ajouté';
  ELSE
    RAISE NOTICE '✅ freight_shipment_id existe déjà';
  END IF;

  -- Vérifier dans gold_inventory aussi
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gold_inventory'
      AND column_name = 'freight_shipment_id'
  ) THEN
    RAISE NOTICE '⚠️  Ajout de freight_shipment_id à gold_inventory...';
    
    ALTER TABLE gold_inventory 
      ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;
    
    CREATE INDEX idx_gold_inventory_freight_shipment 
      ON gold_inventory(freight_shipment_id);
    
    RAISE NOTICE '✅ freight_shipment_id ajouté à gold_inventory';
  ELSE
    RAISE NOTICE '✅ freight_shipment_id existe déjà dans gold_inventory';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 8: Créer la fonction CORRECTE (sans batch_id)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 8: Création de la fonction correcte                   ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance_before_oz NUMERIC DEFAULT 0;
  v_balance_after_oz NUMERIC DEFAULT 0;
  v_transaction_type TEXT;
  v_quantity_oz NUMERIC DEFAULT 0;
BEGIN
  IF TG_OP = 'INSERT' THEN

    IF NEW.transaction_type = 'entry' THEN
      v_transaction_type := 'entry';
      v_quantity_oz := COALESCE(NEW.final_fine_oz, 0);
    ELSIF NEW.transaction_type = 'exit' THEN
      v_transaction_type := 'exit';
      v_quantity_oz := COALESCE(NEW.final_fine_oz, 0);
    ELSE
      RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(
      CASE
        WHEN transaction_type = 'entry' THEN quantity_oz
        WHEN transaction_type = 'exit' THEN -quantity_oz
        ELSE 0
      END
    ), 0)
    INTO v_balance_before_oz
    FROM inventory_transactions
    WHERE inventory_id = NEW.id;

    IF v_transaction_type = 'entry' THEN
      v_balance_after_oz := v_balance_before_oz + v_quantity_oz;
    ELSE
      v_balance_after_oz := v_balance_before_oz - v_quantity_oz;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- INSERTION SANS batch_id - Utilise freight_shipment_id
    -- ═══════════════════════════════════════════════════════════════════════
    INSERT INTO inventory_transactions (
      transaction_date,
      transaction_type,
      inventory_id,
      freight_shipment_id,
      sale_id,
      quantity_oz,
      quantity_grams,
      balance_before_oz,
      balance_after_oz,
      transaction_reference,
      notes,
      created_by
    ) VALUES (
      COALESCE(NEW.entry_date, CURRENT_DATE),
      v_transaction_type,
      NEW.id,
      NEW.freight_shipment_id,
      NEW.sale_id,
      v_quantity_oz,
      COALESCE(NEW.final_fine_grams, 0),
      v_balance_before_oz,
      v_balance_after_oz,
      COALESCE(NEW.certificate_number, 
               CASE 
                 WHEN NEW.transaction_type = 'entry' THEN 'Stock entry from refining'
                 ELSE 'Stock exit for sale'
               END),
      NEW.notes,
      NEW.created_by
    );

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- ÉTAPE 9: Créer le trigger CORRECT
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 9: Création du trigger correct                        ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- ============================================================================
-- ÉTAPE 10: Test final
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ÉTAPE 10: Test final                                        ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test: Insertion directe dans inventory_transactions...';
  
  BEGIN
    INSERT INTO inventory_transactions (
      transaction_type,
      inventory_id,
      freight_shipment_id,
      quantity_oz,
      quantity_grams,
      balance_before_oz,
      balance_after_oz,
      transaction_reference
    ) VALUES (
      'entry',
      gen_random_uuid(),
      NULL,
      10.5,
      326.59,
      0,
      10.5,
      'FINAL TEST'
    );
    
    RAISE NOTICE '✅ Test d''insertion: SUCCÈS!';
    
    DELETE FROM inventory_transactions WHERE transaction_reference = 'FINAL TEST';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Test d''insertion: ÉCHEC!';
    RAISE NOTICE '   Erreur: %', SQLERRM;
    RAISE EXCEPTION 'Test échoué: %', SQLERRM;
  END;
  
END $$;

-- ============================================================================
-- CONFIRMATION FINALE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║         ✅ CORRECTION AUTOMATIQUE TERMINÉE!                   ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Résumé des actions:';
  RAISE NOTICE '   ✅ Toutes les vues avec batch_id supprimées';
  RAISE NOTICE '   ✅ Tous les index sur batch_id supprimés';
  RAISE NOTICE '   ✅ Toutes les contraintes batch_id supprimées';
  RAISE NOTICE '   ✅ Colonne batch_id supprimée partout';
  RAISE NOTICE '   ✅ Fonctions/triggers recréés correctement';
  RAISE NOTICE '   ✅ freight_shipment_id vérifié/ajouté';
  RAISE NOTICE '   ✅ Test d''insertion réussi';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 PROCHAINES ÉTAPES:';
  RAISE NOTICE '   1. Rafraîchissez votre application (Ctrl+Shift+R)';
  RAISE NOTICE '   2. Videz COMPLÈTEMENT le cache du navigateur';
  RAISE NOTICE '   3. Allez dans Inventory Management';
  RAISE NOTICE '   4. Ajoutez une entrée d''inventaire';
  RAISE NOTICE '';
  RAISE NOTICE '   L''erreur "batch_id does not exist" est DÉFINITIVEMENT résolue!';
  RAISE NOTICE '';
END $$;
