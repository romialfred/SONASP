/*
  # Add Seal Numbers to Shipping Production Items

  1. Changes
    - Add seal_number_1 (required) to shipping_production_items
    - Add seal_number_2 (optional) to shipping_production_items

  2. Notes
    - Each production can have 2 seal numbers
    - seal_number_1 is mandatory
    - seal_number_2 is optional
*/

-- Add seal_number_1 column (required)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_production_items'
    AND column_name = 'seal_number_1'
  ) THEN
    ALTER TABLE shipping_production_items
    ADD COLUMN seal_number_1 text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add seal_number_2 column (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_production_items'
    AND column_name = 'seal_number_2'
  ) THEN
    ALTER TABLE shipping_production_items
    ADD COLUMN seal_number_2 text;
  END IF;
END $$;

-- Remove default from seal_number_1 after adding the column
DO $$
BEGIN
  ALTER TABLE shipping_production_items
  ALTER COLUMN seal_number_1 DROP DEFAULT;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore if default doesn't exist
END $$;

-- Add comment for documentation
COMMENT ON COLUMN shipping_production_items.seal_number_1 IS 'Primary seal number (required) - each production must have at least one seal';
COMMENT ON COLUMN shipping_production_items.seal_number_2 IS 'Secondary seal number (optional) - additional seal if needed';
