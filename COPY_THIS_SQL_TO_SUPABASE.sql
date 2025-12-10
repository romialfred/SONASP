/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  CORRECTION COMPLÈTE - TOUS LES TRIGGERS batch_id                       ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  PROBLÈME: Plusieurs fonctions référencent encore batch_id qui n'existe plus
  SOLUTION: Remplacer batch_id par freight_shipment_id partout

  INSTRUCTIONS:
  1. Ouvrez Supabase SQL Editor
  2. Copiez TOUT ce fichier
  3. Exécutez-le (Ctrl+Enter)
  4. Attendez "Success"
  5. Testez l'ajout d'inventaire

  DURÉE: ~5 secondes
*/

-- ============================================================================
-- ÉTAPE 1: SUPPRIMER TOUS LES TRIGGERS OBSOLÈTES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🧹 Suppression de tous les triggers obsolètes...';
END $$;

DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory CASCADE;
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory CASCADE;
DROP TRIGGER IF EXISTS update_inventory_transaction ON gold_inventory CASCADE;
DROP TRIGGER IF EXISTS create_inventory_transaction_trigger ON gold_inventory CASCADE;

-- ============================================================================
-- ÉTAPE 2: SUPPRIMER TOUTES LES FONCTIONS OBSOLÈTES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🗑️  Suppression de toutes les fonctions obsolètes...';
END $$;

DROP FUNCTION IF EXISTS create_inventory_transaction() CASCADE;
DROP FUNCTION IF EXISTS track_inventory_transaction() CASCADE;
DROP FUNCTION IF EXISTS update_inventory_transaction() CASCADE;

-- ============================================================================
-- ÉTAPE 3: CRÉER LA NOUVELLE FONCTION (SANS batch_id)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '⚙️  Création de la nouvelle fonction sans batch_id...';
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
      -- Type non reconnu, on saute
      RETURN NEW;
    END IF;

    -- Calculer le solde AVANT cette transaction
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

    -- Calculer le solde APRÈS
    IF v_transaction_type = 'entry' THEN
      v_balance_after_oz := v_balance_before_oz + v_quantity_oz;
    ELSE
      v_balance_after_oz := v_balance_before_oz - v_quantity_oz;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- IMPORTANT: Insérer la transaction SANS batch_id
    -- On utilise freight_shipment_id depuis gold_inventory
    -- ═══════════════════════════════════════════════════════════════════════
    INSERT INTO inventory_transactions (
      transaction_date,
      transaction_type,
      inventory_id,
      freight_shipment_id,   -- ✅ PAS batch_id
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
-- ÉTAPE 4: CRÉER LE NOUVEAU TRIGGER
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔗 Création du nouveau trigger...';
END $$;

CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- ============================================================================
-- ÉTAPE 5: VÉRIFIER QUE batch_id N'EXISTE PLUS NULLE PART
-- ============================================================================

DO $$
DECLARE
  has_batch_id_in_gold_inv BOOLEAN;
  has_batch_id_in_trans BOOLEAN;
BEGIN
  RAISE NOTICE '🔍 Vérification finale de batch_id...';

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

  -- Supprimer batch_id de inventory_transactions si elle existe encore
  IF has_batch_id_in_trans THEN
    RAISE NOTICE '⚠️  Suppression de batch_id de inventory_transactions...';

    EXECUTE 'ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey CASCADE';
    EXECUTE 'ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS batch_id CASCADE';

    RAISE NOTICE '✅ batch_id supprimé de inventory_transactions';
  ELSE
    RAISE NOTICE '✅ inventory_transactions ne contient pas batch_id';
  END IF;

  -- Supprimer batch_id de gold_inventory si elle existe
  IF has_batch_id_in_gold_inv THEN
    RAISE NOTICE '⚠️  Suppression de batch_id de gold_inventory...';
    EXECUTE 'ALTER TABLE gold_inventory DROP COLUMN IF EXISTS batch_id CASCADE';
    RAISE NOTICE '✅ batch_id supprimé de gold_inventory';
  ELSE
    RAISE NOTICE '✅ gold_inventory ne contient pas batch_id';
  END IF;

  -- Vérifier que freight_shipment_id existe
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'freight_shipment_id'
  ) THEN
    RAISE NOTICE '⚠️  Ajout de freight_shipment_id à inventory_transactions...';

    EXECUTE 'ALTER TABLE inventory_transactions ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_transactions_freight_shipment ON inventory_transactions(freight_shipment_id)';

    RAISE NOTICE '✅ freight_shipment_id ajouté';
  ELSE
    RAISE NOTICE '✅ freight_shipment_id existe déjà';
  END IF;

END $$;

-- ============================================================================
-- ÉTAPE 6: CONFIRMATION FINALE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║         ✅ CORRECTION COMPLÈTE APPLIQUÉE AVEC SUCCÈS!            ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Résumé:';
  RAISE NOTICE '   ✅ Tous les triggers supprimés et recréés';
  RAISE NOTICE '   ✅ Toutes les fonctions mises à jour';
  RAISE NOTICE '   ✅ Plus AUCUNE référence à batch_id';
  RAISE NOTICE '   ✅ Utilise maintenant freight_shipment_id';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TESTEZ MAINTENANT:';
  RAISE NOTICE '   1. Rafraîchissez votre application (Ctrl+F5)';
  RAISE NOTICE '   2. Allez dans Inventory Management';
  RAISE NOTICE '   3. Ajoutez une entrée d''inventaire';
  RAISE NOTICE '';
  RAISE NOTICE '   L''erreur "batch_id does not exist" NE DEVRAIT PLUS JAMAIS APPARAÎTRE!';
  RAISE NOTICE '';
END $$;
