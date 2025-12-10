-- Drop batch_id foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_transactions_batch_id_fkey'
    AND table_name = 'inventory_transactions'
  ) THEN
    ALTER TABLE inventory_transactions DROP CONSTRAINT inventory_transactions_batch_id_fkey;
  END IF;
END $$;

-- Drop batch_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE inventory_transactions DROP COLUMN batch_id;
  END IF;
END $$;

-- Ensure freight_shipment_id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
    ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Recreate trigger function without batch_id reference
CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before_oz numeric;
  v_balance_after_oz numeric;
  v_transaction_type text;
BEGIN
  SELECT COALESCE(SUM(quantity_oz), 0)
  INTO v_balance_before_oz
  FROM inventory_transactions
  WHERE inventory_id = NEW.id;

  IF NEW.transaction_type = 'entry' THEN
    v_transaction_type := 'entry';
    v_balance_after_oz := v_balance_before_oz + COALESCE(NEW.final_fine_oz, 0);
  ELSE
    v_transaction_type := 'exit';
    v_balance_after_oz := v_balance_before_oz - COALESCE(NEW.final_fine_oz, 0);
  END IF;

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
    notes,
    created_by
  ) VALUES (
    COALESCE(NEW.entry_date, CURRENT_DATE),
    v_transaction_type,
    NEW.id,
    NEW.freight_shipment_id,
    NEW.sale_id,
    COALESCE(NEW.final_fine_oz, 0),
    COALESCE(NEW.final_fine_grams, 0),
    v_balance_before_oz,
    v_balance_after_oz,
    NEW.notes,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory;
CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();
