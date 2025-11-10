/*
  # Create Shipping Preparation Tables Only

  1. New Tables
    - `shipping_preparations`
    - `shipping_signatories`
    - `shipping_ingots`

  2. Security
    - Enable RLS on all tables
    - Policies will be added in separate migration

  3. Indexes and Triggers
    - Foreign key indexes
    - Updated_at trigger
*/

-- Create shipping_preparations table if not exists
CREATE TABLE IF NOT EXISTS shipping_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_production_id uuid REFERENCES daily_production(id) ON DELETE CASCADE,
  expedition_lot_number text,
  seal_number text,
  packing_list_url text,
  shipped_to_company text,
  shipped_to_address text,
  shipped_to_country text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'prepared', 'shipped')),
  prepared_at timestamptz,
  shipped_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create shipping_signatories table if not exists
CREATE TABLE IF NOT EXISTS shipping_signatories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  position text NOT NULL,
  name text NOT NULL,
  signature_data text,
  signed_at timestamptz,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create shipping_ingots table if not exists
CREATE TABLE IF NOT EXISTS shipping_ingots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  ingot_box_number text NOT NULL,
  net_weight_grams numeric(12, 2) NOT NULL,
  gross_weight_grams numeric(12, 2) NOT NULL,
  seal_number_1 text,
  seal_number_2 text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (safe to run multiple times)
ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots ENABLE ROW LEVEL SECURITY;

-- Create indexes if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipping_prep_production') THEN
    CREATE INDEX idx_shipping_prep_production ON shipping_preparations(daily_production_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipping_prep_status') THEN
    CREATE INDEX idx_shipping_prep_status ON shipping_preparations(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipping_prep_created_by') THEN
    CREATE INDEX idx_shipping_prep_created_by ON shipping_preparations(created_by);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipping_signatories_prep') THEN
    CREATE INDEX idx_shipping_signatories_prep ON shipping_signatories(shipping_preparation_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipping_ingots_prep') THEN
    CREATE INDEX idx_shipping_ingots_prep ON shipping_ingots(shipping_preparation_id);
  END IF;
END $$;

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION update_shipping_preparations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS shipping_preparations_updated_at ON shipping_preparations;

CREATE TRIGGER shipping_preparations_updated_at
  BEFORE UPDATE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_preparations_updated_at();
