/*
  # Create Stakeholders Management Schema

  1. New Tables
    - `mining_companies` - Mining company information
    - `freight_companies` - Transport/freight company information
    - `refinery_plants` - Refinery plant information
    - `stakeholder_bank_accounts` - Bank accounts for customers and mining companies
    - `stakeholder_contacts` - Contact persons for all stakeholders
    - `stakeholder_activities` - Activity log for all stakeholders

  2. Features
    - Complete address and contact information
    - Multiple bank accounts with different currencies
    - Activity tracking for audit trail
    - Country and currency support
    - Website and optional fields

  3. Security
    - RLS enabled on all tables
    - Authenticated users can view
    - Only management can create/update
*/

-- Create mining companies table
CREATE TABLE IF NOT EXISTS mining_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  country text NOT NULL,
  address text,
  city text,
  postal_code text,
  contact_person_name text,
  contact_person_email text,
  contact_person_phone text,
  website text,
  default_currency text DEFAULT 'USD',
  tax_id text,
  registration_number text,
  is_active boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create freight companies table (extends existing transport_companies)
CREATE TABLE IF NOT EXISTS freight_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  country text NOT NULL,
  address text,
  city text,
  postal_code text,
  contact_person_name text,
  contact_person_email text,
  contact_person_phone text,
  website text,
  license_number text,
  vehicle_types text[], -- Array of vehicle types (truck, plane, ship, etc.)
  service_routes text[], -- Array of routes they service
  insurance_info text,
  is_active boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create refinery plants table (extends existing refineries)
CREATE TABLE IF NOT EXISTS refinery_plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  country text NOT NULL,
  address text,
  city text,
  postal_code text,
  contact_person_name text,
  contact_person_email text,
  contact_person_phone text,
  website text,
  capacity_kg_per_month numeric(12, 2),
  metal_types text[], -- Array of metals processed (gold, silver, platinum, etc.)
  certification text[], -- Array of certifications (ISO, LBMA, etc.)
  processing_fee_percentage numeric(5, 2),
  min_batch_weight_kg numeric(10, 2),
  is_active boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stakeholder bank accounts table
CREATE TABLE IF NOT EXISTS stakeholder_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_type text NOT NULL CHECK (stakeholder_type IN ('customer', 'mining_company', 'freight_company', 'refinery_plant')),
  stakeholder_id uuid NOT NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  bank_country text NOT NULL,
  account_number text NOT NULL,
  account_currency text NOT NULL DEFAULT 'USD',
  swift_code text,
  iban text,
  branch_name text,
  branch_code text,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stakeholder contacts table (additional contacts beyond primary)
CREATE TABLE IF NOT EXISTS stakeholder_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_type text NOT NULL CHECK (stakeholder_type IN ('customer', 'mining_company', 'freight_company', 'refinery_plant')),
  stakeholder_id uuid NOT NULL,
  contact_name text NOT NULL,
  contact_title text,
  contact_email text,
  contact_phone text,
  contact_mobile text,
  department text,
  is_primary boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stakeholder activities table
CREATE TABLE IF NOT EXISTS stakeholder_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_type text NOT NULL CHECK (stakeholder_type IN ('customer', 'mining_company', 'freight_company', 'refinery_plant')),
  stakeholder_id uuid NOT NULL,
  activity_type text NOT NULL, -- batch_created, shipment_sent, payment_received, etc.
  activity_date timestamptz DEFAULT now(),
  description text NOT NULL,
  reference_type text, -- batch, sale, payment, shipment
  reference_id uuid,
  amount numeric(18, 2),
  currency text,
  status text,
  metadata jsonb,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mining_companies_country ON mining_companies(country);
CREATE INDEX IF NOT EXISTS idx_mining_companies_active ON mining_companies(is_active);
CREATE INDEX IF NOT EXISTS idx_freight_companies_country ON freight_companies(country);
CREATE INDEX IF NOT EXISTS idx_freight_companies_active ON freight_companies(is_active);
CREATE INDEX IF NOT EXISTS idx_refinery_plants_country ON refinery_plants(country);
CREATE INDEX IF NOT EXISTS idx_refinery_plants_active ON refinery_plants(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_stakeholder ON stakeholder_bank_accounts(stakeholder_type, stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON stakeholder_bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_contacts_stakeholder ON stakeholder_contacts(stakeholder_type, stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_activities_stakeholder ON stakeholder_activities(stakeholder_type, stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON stakeholder_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON stakeholder_activities(activity_type);

-- Enable RLS
ALTER TABLE mining_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinery_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mining_companies
CREATE POLICY "Authenticated users can view mining companies"
  ON mining_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert mining companies"
  ON mining_companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

CREATE POLICY "Management can update mining companies"
  ON mining_companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- RLS Policies for freight_companies
CREATE POLICY "Authenticated users can view freight companies"
  ON freight_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert freight companies"
  ON freight_companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

CREATE POLICY "Management can update freight companies"
  ON freight_companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- RLS Policies for refinery_plants
CREATE POLICY "Authenticated users can view refinery plants"
  ON refinery_plants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can insert refinery plants"
  ON refinery_plants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

CREATE POLICY "Management can update refinery plants"
  ON refinery_plants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- RLS Policies for stakeholder_bank_accounts
CREATE POLICY "Authenticated users can view bank accounts"
  ON stakeholder_bank_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage bank accounts"
  ON stakeholder_bank_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- RLS Policies for stakeholder_contacts
CREATE POLICY "Authenticated users can view contacts"
  ON stakeholder_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage contacts"
  ON stakeholder_contacts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin')
    )
  );

-- RLS Policies for stakeholder_activities
CREATE POLICY "Authenticated users can view activities"
  ON stakeholder_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create activities"
  ON stakeholder_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_stakeholder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_mining_companies_updated_at
  BEFORE UPDATE ON mining_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_stakeholder_updated_at();

CREATE TRIGGER update_freight_companies_updated_at
  BEFORE UPDATE ON freight_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_stakeholder_updated_at();

CREATE TRIGGER update_refinery_plants_updated_at
  BEFORE UPDATE ON refinery_plants
  FOR EACH ROW
  EXECUTE FUNCTION update_stakeholder_updated_at();

CREATE TRIGGER update_stakeholder_bank_accounts_updated_at
  BEFORE UPDATE ON stakeholder_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_stakeholder_updated_at();
