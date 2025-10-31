/*
  # Create Transport Companies and Refineries Tables

  ## Overview
  This migration creates tables for managing transport companies and refineries,
  enabling proper tracking of the multi-stage gold shipping process from mine to refinery.

  ## New Tables

  ### 1. `transport_companies`
  Manages freight companies responsible for transporting gold between locations
  - `id` (uuid, primary key)
  - `name` (text, unique) - Company name
  - `email` (text) - Contact email for notifications
  - `phone` (text) - Contact phone number
  - `company_type` (text) - Type: mine_to_airport, airport_to_refinery, both
  - `address` (text, nullable) - Company address
  - `contact_person` (text, nullable) - Primary contact name
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `refineries`
  Manages refinery facilities for processing gold
  - `id` (uuid, primary key)
  - `name` (text, unique) - Refinery name
  - `location` (text) - Physical location
  - `country` (text) - Country code
  - `email` (text) - Contact email for notifications
  - `phone` (text) - Contact phone number
  - `contact_person` (text, nullable) - Primary contact name
  - `capacity_grams_per_month` (numeric, nullable) - Processing capacity
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Table Modifications

  ### Enhanced `batches` table
  - Add `mine_to_airport_transport_id` (uuid) - Transport company for first leg
  - Add `airport_to_refinery_transport_id` (uuid) - Transport company for second leg
  - Add `destination_refinery_id` (uuid) - Target refinery
  - Remove dependency on text-based carrier/destination fields

  ## Security
  - Row Level Security enabled on all new tables
  - Policies for authenticated users to view active companies/refineries
  - Only management role can create/update companies and refineries

  ## Seed Data
  - Initial transport companies for common routes
  - Initial refineries in operational countries
*/

-- Create transport_companies table
CREATE TABLE IF NOT EXISTS transport_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  company_type text NOT NULL CHECK (company_type IN ('mine_to_airport', 'airport_to_refinery', 'both')),
  address text,
  contact_person text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create refineries table
CREATE TABLE IF NOT EXISTS refineries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  location text NOT NULL,
  country text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  contact_person text,
  capacity_grams_per_month numeric(12, 2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transport_companies_active ON transport_companies(is_active);
CREATE INDEX IF NOT EXISTS idx_transport_companies_type ON transport_companies(company_type);
CREATE INDEX IF NOT EXISTS idx_refineries_active ON refineries(is_active);
CREATE INDEX IF NOT EXISTS idx_refineries_country ON refineries(country);

-- Create trigger for transport_companies updated_at
CREATE OR REPLACE FUNCTION update_transport_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transport_companies_updated_at
  BEFORE UPDATE ON transport_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_companies_updated_at();

-- Create trigger for refineries updated_at
CREATE OR REPLACE FUNCTION update_refineries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_refineries_updated_at
  BEFORE UPDATE ON refineries
  FOR EACH ROW
  EXECUTE FUNCTION update_refineries_updated_at();

-- Add new columns to batches table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'mine_to_airport_transport_id') THEN
    ALTER TABLE batches ADD COLUMN mine_to_airport_transport_id uuid REFERENCES transport_companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'airport_to_refinery_transport_id') THEN
    ALTER TABLE batches ADD COLUMN airport_to_refinery_transport_id uuid REFERENCES transport_companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'destination_refinery_id') THEN
    ALTER TABLE batches ADD COLUMN destination_refinery_id uuid REFERENCES refineries(id);
  END IF;
END $$;

-- Create indexes for batches foreign keys
CREATE INDEX IF NOT EXISTS idx_batches_mine_to_airport_transport ON batches(mine_to_airport_transport_id);
CREATE INDEX IF NOT EXISTS idx_batches_airport_to_refinery_transport ON batches(airport_to_refinery_transport_id);
CREATE INDEX IF NOT EXISTS idx_batches_destination_refinery ON batches(destination_refinery_id);

-- Enable RLS on transport_companies
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for transport_companies
CREATE POLICY "Users can view active transport companies" ON transport_companies
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Management can view all transport companies" ON transport_companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can create transport companies" ON transport_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update transport companies" ON transport_companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Enable RLS on refineries
ALTER TABLE refineries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for refineries
CREATE POLICY "Users can view active refineries" ON refineries
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Management can view all refineries" ON refineries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can create refineries" ON refineries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update refineries" ON refineries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Insert seed data for transport companies
INSERT INTO transport_companies (name, email, phone, company_type, address, contact_person, is_active) VALUES
  ('Securitas Transport West Africa', 'dispatch@securitas-wa.com', '+224-623-456-789', 'both', 'Conakry, Guinea', 'Mamadou Diallo', true),
  ('Brinks International Guinea', 'operations@brinks-gn.com', '+224-625-123-456', 'mine_to_airport', 'Conakry Airport Area, Guinea', 'Fatou Camara', true),
  ('DHL Secure Logistics', 'secure@dhl-guinea.com', '+224-627-890-123', 'airport_to_refinery', 'Industrial Zone, Conakry', 'Ibrahim Konaté', true),
  ('TransGold Express', 'info@transgold.ci', '+225-07-123-456', 'both', 'Abidjan, Côte d''Ivoire', 'Kouassi Yao', true),
  ('Mali Gold Transport', 'contact@mgt-mali.com', '+223-20-123-456', 'mine_to_airport', 'Bamako, Mali', 'Amadou Touré', true)
ON CONFLICT (name) DO NOTHING;

-- Insert seed data for refineries
INSERT INTO refineries (name, location, country, email, phone, contact_person, capacity_grams_per_month, is_active) VALUES
  ('West African Gold Refinery', 'Conakry Industrial Zone', 'GN', 'operations@wagr.com', '+224-622-345-678', 'Dr. Sékou Touré', 50000.00, true),
  ('Guinea Premium Refinery', 'Kaloum District, Conakry', 'GN', 'reception@gpr-guinea.com', '+224-628-901-234', 'Marie Diaby', 30000.00, true),
  ('Abidjan International Refinery', 'Port Bouët, Abidjan', 'CI', 'contact@air-ci.com', '+225-21-456-789', 'Jean-Paul Kouadio', 75000.00, true),
  ('Mali Gold Processing Center', 'Bamako Industrial Park', 'ML', 'info@mgpc-mali.com', '+223-20-345-678', 'Moussa Traoré', 40000.00, true)
ON CONFLICT (name) DO NOTHING;
