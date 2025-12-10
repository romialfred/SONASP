/*
  # Add Freight Shipment Reference to Gold Inventory

  INSTRUCTIONS: Copy and paste this SQL in Supabase SQL Editor and execute it.

  1. Changes
    - Add `freight_shipment_id` column to `gold_inventory` table
    - Add foreign key constraint to `freight_shipments` table
    - Add `silver_percentage` column for silver content tracking
    - Add `impurity_percentage` column for automatic impurity calculation
    - Create index for performance

  2. Security
    - No RLS changes needed (inherits from existing policies)
*/

-- Add freight_shipment_id column
ALTER TABLE gold_inventory
ADD COLUMN IF NOT EXISTS freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;

-- Add silver percentage column
ALTER TABLE gold_inventory
ADD COLUMN IF NOT EXISTS silver_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Add impurity percentage column (calculated field)
ALTER TABLE gold_inventory
ADD COLUMN IF NOT EXISTS impurity_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_gold_inventory_freight_shipment_id
ON gold_inventory(freight_shipment_id);

-- Add comment for documentation
COMMENT ON COLUMN gold_inventory.freight_shipment_id IS 'Reference to the freight shipment that was added to inventory';
COMMENT ON COLUMN gold_inventory.silver_percentage IS 'Silver content percentage in the refined gold';
COMMENT ON COLUMN gold_inventory.impurity_percentage IS 'Impurity percentage calculated as 100 - (fineness + silver)';
