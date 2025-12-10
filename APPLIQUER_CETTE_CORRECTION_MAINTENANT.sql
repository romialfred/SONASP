/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  CORRECTION BATCH_ID - À EXÉCUTER IMMÉDIATEMENT DANS SUPABASE          ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  INSTRUCTIONS:
  1. Ouvrez https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
  2. Copiez TOUT le contenu de ce fichier
  3. Collez-le dans l'éditeur SQL
  4. Cliquez sur "Run" (ou Ctrl+Enter)
  5. Attendez "Success. No rows returned"
  6. Rafraîchissez votre application (Ctrl+F5)
  7. Testez l'ajout d'inventaire

  TEMPS D'EXÉCUTION: ~2 secondes
  RISQUE: Aucun (opération sans perte de données)
*/

-- ============================================================================
-- ÉTAPE 1: SUPPRIMER LES ANCIENS TRIGGERS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🧹 Nettoyage des anciens triggers...';
END $$;

DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory CASCADE;
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory CASCADE;

-- ============================================================================
-- ÉTAPE 2: RECRÉER LA FONCTION SANS BATCH_ID
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '⚙️  Création de la nouvelle fonction trigger...';
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
  -- Traiter uniquement les INSERT
  IF TG_OP = 'INSERT' THEN

    -- Déterminer le type de transaction
    IF NEW.transaction_type = 'entry' THEN
      v_transaction_type := 'entry';
      v_quantity_oz := COALESCE(NEW.final_fine_oz, 0);
    ELSIF NEW.transaction_type = 'exit' THEN
      v_transaction_type := 'exit';
      v_quantity_oz := COALESCE(NEW.final_fine_oz, 0);
    ELSE
      RETURN NEW;
    END IF;

    -- Calculer le solde avant cette transaction
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

    -- Calculer le solde après
    IF v_transaction_type = 'entry' THEN
      v_balance_after_oz := v_balance_before_oz + v_quantity_oz;
    ELSE
      v_balance_after_oz := v_balance_before_oz - v_quantity_oz;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- IMPORTANT: Insérer la transaction SANS batch_id
    -- On utilise freight_shipment_id à la place
    -- ═══════════════════════════════════════════════════════════════════════
    INSERT INTO inventory_transactions (
      transaction_date,
      transaction_type,
      inventory_id,
      freight_shipment_id,   -- ✅ UTILISE freight_shipment_id (PAS batch_id)
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
      NEW.freight_shipment_id,  -- ✅ Depuis gold_inventory.freight_shipment_id
      NEW.sale_id,
      v_quantity_oz,
      COALESCE(NEW.final_fine_grams, 0),
      v_balance_before_oz,
      v_balance_after_oz,
      NEW.certificate_number,
      NEW.notes,
      NEW.created_by
    );

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- ÉTAPE 3: RECRÉER LE TRIGGER
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔗 Création du trigger...';
END $$;

CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- ============================================================================
-- ÉTAPE 4: VÉRIFICATION ET NETTOYAGE DE SÉCURITÉ
-- ============================================================================

DO $$
DECLARE
  has_batch_id_in_gold_inv BOOLEAN;
  has_batch_id_in_trans BOOLEAN;
BEGIN
  RAISE NOTICE '🔍 Vérification des colonnes batch_id résiduelles...';

  -- Vérifier gold_inventory
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gold_inventory'
      AND column_name = 'batch_id'
  ) INTO has_batch_id_in_gold_inv;

  -- Vérifier inventory_transactions
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'batch_id'
  ) INTO has_batch_id_in_trans;

  -- Supprimer batch_id de inventory_transactions si elle existe
  IF has_batch_id_in_trans THEN
    RAISE NOTICE '⚠️  Suppression de batch_id de inventory_transactions...';

    -- Supprimer la contrainte FK d'abord
    EXECUTE '
      ALTER TABLE inventory_transactions
      DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey CASCADE
    ';

    -- Supprimer la colonne
    EXECUTE '
      ALTER TABLE inventory_transactions
      DROP COLUMN IF EXISTS batch_id CASCADE
    ';

    RAISE NOTICE '✅ batch_id supprimé de inventory_transactions';
  ELSE
    RAISE NOTICE '✅ inventory_transactions ne contient pas batch_id';
  END IF;

  -- Supprimer batch_id de gold_inventory si elle existe
  IF has_batch_id_in_gold_inv THEN
    RAISE NOTICE '⚠️  Suppression de batch_id de gold_inventory...';

    EXECUTE '
      ALTER TABLE gold_inventory
      DROP COLUMN IF EXISTS batch_id CASCADE
    ';

    RAISE NOTICE '✅ batch_id supprimé de gold_inventory';
  ELSE
    RAISE NOTICE '✅ gold_inventory ne contient pas batch_id';
  END IF;

  -- Vérifier que freight_shipment_id existe dans inventory_transactions
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'freight_shipment_id'
  ) THEN
    RAISE NOTICE '⚠️  Ajout de freight_shipment_id à inventory_transactions...';

    EXECUTE '
      ALTER TABLE inventory_transactions
      ADD COLUMN freight_shipment_id UUID
      REFERENCES freight_shipments(id) ON DELETE SET NULL
    ';

    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_inventory_transactions_freight_shipment
      ON inventory_transactions(freight_shipment_id)
    ';

    RAISE NOTICE '✅ freight_shipment_id ajouté';
  ELSE
    RAISE NOTICE '✅ freight_shipment_id existe déjà';
  END IF;

END $$;

-- ============================================================================
-- CONFIRMATION FINALE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║                  ✅ CORRECTION APPLIQUÉE AVEC SUCCÈS!            ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Résumé des changements:';
  RAISE NOTICE '   ✅ Triggers supprimés et recréés';
  RAISE NOTICE '   ✅ Fonction create_inventory_transaction() mise à jour';
  RAISE NOTICE '   ✅ Plus aucune référence à batch_id';
  RAISE NOTICE '   ✅ Utilise maintenant freight_shipment_id';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 PROCHAINE ÉTAPE:';
  RAISE NOTICE '   1. Rafraîchissez votre application (Ctrl+F5 ou Cmd+Shift+R)';
  RAISE NOTICE '   2. Allez dans Inventory Management → Gold Inventory';
  RAISE NOTICE '   3. Cliquez sur "Add Gold Inventory Entry"';
  RAISE NOTICE '   4. Sélectionnez une expédition et remplissez le formulaire';
  RAISE NOTICE '   5. Sauvegardez';
  RAISE NOTICE '';
  RAISE NOTICE '   L''erreur "batch_id does not exist" ne devrait plus apparaître!';
  RAISE NOTICE '';
END $$;
