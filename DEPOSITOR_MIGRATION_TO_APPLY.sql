/*
  # Create Depositors System

  ## New Tables

  ### `depositors`
  Main table for depositor contacts (signatories and approvers)
  - `id` (uuid, primary key)
  - `mining_company_id` (uuid, foreign key to mining_companies)
  - `category` (enum: general_management, finance, bullion_dispatch, sale_of_gold, pmr_assay, security, legal)
  - `full_name` (text)
  - `job_title` (text)
  - `telephone` (text, nullable)
  - `cellphone` (text, nullable)
  - `email` (text, not null)
  - `is_primary` (boolean) - indicates if this is the primary contact for the category
  - `is_backup` (boolean) - indicates if this is a backup contact
  - `group_email` (text, nullable) - for group email addresses
  - `is_active` (boolean, default true)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on `depositors` table
  - Add policies for authenticated users to manage depositors

  ## Notes
  Based on Rand Refinery Depositor Contact Distribution List form:
  - General Management (primary and backup)
  - Finance (Payment & Invoicing, primary and backup)
  - Bullion Dispatch and Logistics (multiple contacts)
  - Sale of Gold (Treasury Team Interaction)
  - PMR / Assay Discrepancy (Evaluation Team Interaction)
  - Security Management (primary and backup)
  - Company Secretary (Legal Matters/Governance/Compliance, primary and backup)
*/

-- Create enum for depositor categories
DO $$ BEGIN
  CREATE TYPE depositor_category AS ENUM (
    'general_management',
    'general_management_backup',
    'finance',
    'finance_backup',
    'bullion_dispatch',
    'sale_of_gold',
    'pmr_assay',
    'security',
    'security_backup',
    'legal',
    'legal_backup'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create depositors table
CREATE TABLE IF NOT EXISTS depositors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id) ON DELETE CASCADE,
  category depositor_category NOT NULL,
  full_name text NOT NULL,
  job_title text NOT NULL,
  telephone text,
  cellphone text,
  email text NOT NULL,
  is_primary boolean DEFAULT false,
  is_backup boolean DEFAULT false,
  group_email text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure email format is valid
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  -- Ensure at least one phone number is provided
  CONSTRAINT has_contact CHECK (telephone IS NOT NULL OR cellphone IS NOT NULL)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_depositors_mining_company ON depositors(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_depositors_category ON depositors(category);
CREATE INDEX IF NOT EXISTS idx_depositors_email ON depositors(email);
CREATE INDEX IF NOT EXISTS idx_depositors_active ON depositors(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_depositors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_depositors_updated_at ON depositors;
CREATE TRIGGER update_depositors_updated_at
  BEFORE UPDATE ON depositors
  FOR EACH ROW
  EXECUTE FUNCTION update_depositors_updated_at();

-- Enable Row Level Security
ALTER TABLE depositors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view depositors" ON depositors;
DROP POLICY IF EXISTS "Users can insert depositors" ON depositors;
DROP POLICY IF EXISTS "Users can update depositors" ON depositors;
DROP POLICY IF EXISTS "Users can delete depositors" ON depositors;

-- Create RLS Policies
CREATE POLICY "Users can view depositors"
  ON depositors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert depositors"
  ON depositors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update depositors"
  ON depositors
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete depositors"
  ON depositors
  FOR DELETE
  TO authenticated
  USING (true);

-- Create view for depositor contact summary
CREATE OR REPLACE VIEW depositor_contact_summary AS
SELECT
  d.id,
  d.mining_company_id,
  mc.name as mining_company_name,
  d.category,
  d.full_name,
  d.job_title,
  d.email,
  d.cellphone,
  d.is_primary,
  d.is_backup,
  d.is_active,
  d.created_at,
  COUNT(*) OVER (PARTITION BY d.mining_company_id, d.category) as contacts_in_category
FROM depositors d
LEFT JOIN mining_companies mc ON mc.id = d.mining_company_id
WHERE d.is_active = true
ORDER BY d.mining_company_id, d.category, d.is_primary DESC, d.is_backup, d.created_at;

-- Grant access to the view
GRANT SELECT ON depositor_contact_summary TO authenticated;
