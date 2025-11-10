/*
  # Shipping Preparation System

  1. New Tables
    - `shipping_preparations`
      - `id` (uuid, primary key)
      - `daily_production_id` (uuid, FK to daily_production)
      - `expedition_lot_number` (text) - Format: HUM-SMK-380/2025
      - `seal_number` (text) - Numéro de scellé
      - `packing_list_url` (text) - URL du PDF de facture
      - `shipped_to_company` (text) - Société destinataire
      - `shipped_to_address` (text) - Adresse complète
      - `shipped_to_country` (text) - Pays
      - `status` (text) - pending, prepared, shipped
      - `prepared_at` (timestamptz)
      - `shipped_at` (timestamptz)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, FK to auth.users)

    - `shipping_signatories`
      - `id` (uuid, primary key)
      - `shipping_preparation_id` (uuid, FK to shipping_preparations)
      - `position` (text) - Ex: Gold Room Operator, SMK Finance, etc.
      - `name` (text) - Nom du signataire
      - `signature_data` (text) - Données de signature (base64 ou URL)
      - `signed_at` (timestamptz)
      - `order_index` (integer) - Ordre d'affichage
      - `created_at` (timestamptz)

    - `shipping_ingots`
      - `id` (uuid, primary key)
      - `shipping_preparation_id` (uuid, FK to shipping_preparations)
      - `ingot_box_number` (text) - Ex: HUMSMK-1204
      - `net_weight_grams` (numeric)
      - `gross_weight_grams` (numeric)
      - `seal_number_1` (text)
      - `seal_number_2` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Indexes
    - Add indexes for foreign keys and lookup fields
*/

-- Create shipping_preparations table
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

-- Create shipping_signatories table
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

-- Create shipping_ingots table
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

-- Enable RLS
ALTER TABLE shipping_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_ingots ENABLE ROW LEVEL SECURITY;

-- Policies for shipping_preparations
CREATE POLICY "Users can view shipping preparations"
  ON shipping_preparations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create shipping preparations"
  ON shipping_preparations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shipping preparations"
  ON shipping_preparations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete shipping preparations"
  ON shipping_preparations FOR DELETE
  TO authenticated
  USING (true);

-- Policies for shipping_signatories
CREATE POLICY "Users can view signatories"
  ON shipping_signatories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create signatories"
  ON shipping_signatories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update signatories"
  ON shipping_signatories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete signatories"
  ON shipping_signatories FOR DELETE
  TO authenticated
  USING (true);

-- Policies for shipping_ingots
CREATE POLICY "Users can view ingots"
  ON shipping_ingots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create ingots"
  ON shipping_ingots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update ingots"
  ON shipping_ingots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete ingots"
  ON shipping_ingots FOR DELETE
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_prep_production ON shipping_preparations(daily_production_id);
CREATE INDEX IF NOT EXISTS idx_shipping_prep_status ON shipping_preparations(status);
CREATE INDEX IF NOT EXISTS idx_shipping_prep_created_by ON shipping_preparations(created_by);
CREATE INDEX IF NOT EXISTS idx_shipping_signatories_prep ON shipping_signatories(shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_shipping_ingots_prep ON shipping_ingots(shipping_preparation_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_shipping_preparations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipping_preparations_updated_at
  BEFORE UPDATE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_preparations_updated_at();
