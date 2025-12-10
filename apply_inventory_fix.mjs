import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const migrationSQL = `
-- Drop any existing triggers that might reference batch_id
DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory;
DROP FUNCTION IF EXISTS create_inventory_transaction CASCADE;

-- Check if inventory_transactions table exists and modify it
DO $$
BEGIN
  -- Check if batch_id column exists and drop it
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'batch_id'
  ) THEN
    -- Drop the foreign key constraint first if it exists
    ALTER TABLE inventory_transactions
    DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey;

    -- Now drop the column
    ALTER TABLE inventory_transactions
    DROP COLUMN batch_id;

    RAISE NOTICE 'Dropped batch_id column from inventory_transactions';
  END IF;

  -- Ensure freight_shipment_id column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
    ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added freight_shipment_id column to inventory_transactions';
  END IF;
END $$;

-- Recreate the trigger function without batch_id reference
CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.transaction_type = 'entry' THEN
    INSERT INTO inventory_transactions (
      transaction_date,
      transaction_type,
      inventory_id,
      freight_shipment_id,
      quantity_oz,
      quantity_grams,
      balance_before_oz,
      balance_after_oz,
      transaction_reference,
      notes,
      created_by
    ) VALUES (
      NEW.entry_date,
      'entry',
      NEW.id,
      NEW.freight_shipment_id,
      NEW.final_fine_oz,
      NEW.final_fine_grams,
      0,
      NEW.quantity_available_oz,
      NEW.certificate_number,
      NEW.notes,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory;
CREATE TRIGGER track_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();
`;

async function applyMigration() {
  try {
    console.log('🚀 Applying inventory_transactions fix migration...');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('❌ Error applying migration:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('📊 Result:', data);
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();
