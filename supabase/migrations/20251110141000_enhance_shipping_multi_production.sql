/*
  # Enhance Shipping Preparation for Multiple Productions

  1. Changes
    - Create junction table for multiple productions per shipment
    - Add document storage tracking
    - Update shipping_preparations schema
    - Add status tracking fields

  2. Security
    - Enable RLS on new tables
    - Create appropriate policies
*/

-- Create shipping_production_items table for multiple productions per shipment
CREATE TABLE IF NOT EXISTS shipping_production_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  daily_production_id uuid NOT NULL REFERENCES daily_production(id) ON DELETE CASCADE,
  ingot_box_number text NOT NULL,
  net_weight_grams numeric(12, 2) NOT NULL,
  gross_weight_grams numeric(12, 2) NOT NULL,
  fineness_pct numeric(5, 2) NOT NULL,
  pure_gold_grams numeric(12, 2) NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shipping_preparation_id, daily_production_id)
);

-- Add packing_list_document_id to shipping_preparations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'packing_list_document_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN packing_list_document_id text;
  END IF;
END $$;

-- Add total weight fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'total_net_weight_grams'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN total_net_weight_grams numeric(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'total_gross_weight_grams'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN total_gross_weight_grams numeric(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'total_boxes'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN total_boxes integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE shipping_production_items ENABLE ROW LEVEL SECURITY;

-- Create policies for shipping_production_items
DROP POLICY IF EXISTS "Users can view production items" ON shipping_production_items;
CREATE POLICY "Users can view production items"
  ON shipping_production_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create production items" ON shipping_production_items;
CREATE POLICY "Users can create production items"
  ON shipping_production_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update production items" ON shipping_production_items;
CREATE POLICY "Users can update production items"
  ON shipping_production_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete production items" ON shipping_production_items;
CREATE POLICY "Users can delete production items"
  ON shipping_production_items FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipping_production_items_shipping
  ON shipping_production_items(shipping_preparation_id);

CREATE INDEX IF NOT EXISTS idx_shipping_production_items_production
  ON shipping_production_items(daily_production_id);

-- Create function to update total weights
CREATE OR REPLACE FUNCTION update_shipping_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shipping_preparations
  SET
    total_net_weight_grams = (
      SELECT COALESCE(SUM(net_weight_grams), 0)
      FROM shipping_production_items
      WHERE shipping_preparation_id = NEW.shipping_preparation_id
    ),
    total_gross_weight_grams = (
      SELECT COALESCE(SUM(gross_weight_grams), 0)
      FROM shipping_production_items
      WHERE shipping_preparation_id = NEW.shipping_preparation_id
    ),
    total_boxes = (
      SELECT COUNT(*)
      FROM shipping_production_items
      WHERE shipping_preparation_id = NEW.shipping_preparation_id
    )
  WHERE id = NEW.shipping_preparation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic total calculation
DROP TRIGGER IF EXISTS shipping_production_items_totals ON shipping_production_items;

CREATE TRIGGER shipping_production_items_totals
  AFTER INSERT OR UPDATE OR DELETE ON shipping_production_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_totals();
