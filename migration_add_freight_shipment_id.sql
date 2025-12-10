/*
  # Add freight_shipment_id to gold_inventory

  1. Changes
    - Add freight_shipment_id column to gold_inventory table
    - Add foreign key constraint to freight_shipments table
    - Add index for better query performance

  2. Security
    - No RLS changes needed (inherits from table)
*/

-- Add freight_shipment_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_inventory'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE gold_inventory
    ADD COLUMN freight_shipment_id uuid REFERENCES freight_shipments(id);

    -- Add index for better query performance
    CREATE INDEX IF NOT EXISTS idx_gold_inventory_freight_shipment
    ON gold_inventory(freight_shipment_id);

    RAISE NOTICE 'Column freight_shipment_id added to gold_inventory table';
  ELSE
    RAISE NOTICE 'Column freight_shipment_id already exists in gold_inventory table';
  END IF;
END $$;
