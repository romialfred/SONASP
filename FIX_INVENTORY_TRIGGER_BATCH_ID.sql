/*
  # Fix: Supprimer toutes les références batch_id des triggers d'inventaire

  Le problème: Le trigger create_inventory_transaction() essaie encore d'insérer
  batch_id dans inventory_transactions, mais cette colonne n'existe plus.

  Solution: Recréer le trigger sans référence à batch_id
*/

-- Étape 1: Supprimer les triggers existants
DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory CASCADE;
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory CASCADE;

-- Étape 2: Recréer la fonction SANS batch_id
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

    -- Insérer la transaction SANS batch_id
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
      NEW.certificate_number,
      NEW.notes,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Étape 3: Recréer le trigger
CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- Étape 4: Vérifier et supprimer batch_id si elle existe encore
DO $$
BEGIN
  -- Supprimer batch_id de inventory_transactions
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
      AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey CASCADE;
    ALTER TABLE inventory_transactions DROP COLUMN batch_id CASCADE;
    RAISE NOTICE '✅ batch_id supprimé de inventory_transactions';
  END IF;

  -- Supprimer batch_id de gold_inventory
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gold_inventory'
      AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE gold_inventory DROP COLUMN batch_id CASCADE;
    RAISE NOTICE '✅ batch_id supprimé de gold_inventory';
  END IF;

  -- Vérifier que freight_shipment_id existe
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
      AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
      ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ freight_shipment_id ajouté à inventory_transactions';
  END IF;
END $$;
