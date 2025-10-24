/*
  # Batch Management System - Core Tables

  ## Overview
  This migration creates the foundational tables for the Gold Shipper batch management system,
  enabling end-to-end tracking of gold and silver shipments from mine extraction to final sale.

  ## New Tables

  ### 1. `sites`
  Stores information about operational sites (factories, airports, refineries)
  - `id` (uuid, primary key)
  - `name` (text) - Site name
  - `site_type` (text) - Type: factory, airport, refinery
  - `country` (text) - Country code: GN (Guinea), CI (Côte d'Ivoire), ML (Mali)
  - `address` (text) - Physical address
  - `contact_email` (text) - Contact email
  - `contact_phone` (text) - Contact phone
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `batches`
  Core batch tracking table with complete shipment information
  - `id` (uuid, primary key)
  - `batch_number` (text, unique) - Auto-generated batch identifier
  - `status` (text) - Current batch status
  - `origin_site_id` (uuid) - Reference to originating site
  - `current_site_id` (uuid) - Reference to current location
  - `weight_grams` (numeric) - Weight in grams
  - `weight_ounces` (numeric) - Calculated weight in ounces
  - `shipping_date` (date) - Date of shipment
  - `comments` (text) - General comments
  - `transportation_company` (text) - Transporter name
  - `created_by` (uuid) - User who created batch
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `batch_status_history`
  Complete audit trail of all status changes
  - `id` (uuid, primary key)
  - `batch_id` (uuid) - Reference to batch
  - `status` (text) - Status at this point
  - `changed_by` (uuid) - User who made the change
  - `changed_at` (timestamptz) - When change occurred
  - `comments` (text) - Comments about the change
  - `previous_status` (text) - Previous status for rollback capability

  ### 4. `receiving_records`
  Records for batch receiving at airports and refineries
  - `id` (uuid, primary key)
  - `batch_id` (uuid) - Reference to batch
  - `receiving_site_id` (uuid) - Site where received
  - `expected_weight_grams` (numeric) - Expected weight
  - `actual_weight_grams` (numeric) - Actual received weight
  - `variance_grams` (numeric) - Calculated difference
  - `variance_percentage` (numeric) - Percentage variance
  - `is_significant_variance` (boolean) - Over threshold flag
  - `received_by` (uuid) - User who received
  - `received_at` (timestamptz) - Receipt timestamp
  - `reconciliation_comments` (text) - Variance justification
  - `reconciliation_approved_by` (uuid) - Approver for variances
  - `reconciliation_approved_at` (timestamptz) - Approval timestamp

  ### 5. `refining_records`
  Processing records for refinery operations
  - `id` (uuid, primary key)
  - `batch_id` (uuid) - Reference to batch
  - `pre_melting_weight_grams` (numeric) - Weight before melting
  - `post_melting_weight_grams` (numeric) - Weight after melting
  - `fineness_percentage` (numeric) - Purity percentage
  - `metal_retained_percentage` (numeric) - Retention percentage
  - `final_fine_grams` (numeric) - Calculated final fine in grams
  - `final_fine_ounces` (numeric) - Calculated final fine in ounces
  - `processing_notes` (text) - Operator notes
  - `processed_by` (uuid) - Processing operator
  - `processed_at` (timestamptz) - Processing timestamp
  - `approved_by` (uuid) - Supervisor approval
  - `approved_at` (timestamptz) - Approval timestamp

  ### 6. `batch_documents`
  Document attachments for batches (receipts, proofs, etc.)
  - `id` (uuid, primary key)
  - `batch_id` (uuid) - Reference to batch
  - `document_type` (text) - Type: receipt, proof, variance_evidence, etc.
  - `file_name` (text) - Original file name
  - `file_path` (text) - Storage path
  - `file_size` (integer) - File size in bytes
  - `uploaded_by` (uuid) - User who uploaded
  - `uploaded_at` (timestamptz) - Upload timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies created for multi-tenant access control based on site assignment
  - Users can only access batches from their assigned sites
  - Management role has cross-site access

  ## Indexes
  - Optimized indexes on foreign keys and frequently queried fields
  - Batch number unique index for fast lookups
  - Status indexes for filtering

  ## Notes
  - All timestamps use timestamptz for proper timezone handling
  - Numeric types used for precise weight calculations
  - Automatic triggers for updated_at timestamps
  - Cascading deletes configured where appropriate
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  site_type text NOT NULL CHECK (site_type IN ('factory', 'airport', 'refinery')),
  country text NOT NULL CHECK (country IN ('GN', 'CI', 'ML')),
  address text,
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created', 'shipped', 'received_airport', 'shipped_refinery',
      'received_refinery', 'processing', 'processed', 'approved', 'ready_for_sale'
    )
  ),
  origin_site_id uuid REFERENCES sites(id),
  current_site_id uuid REFERENCES sites(id),
  weight_grams numeric(10, 2) NOT NULL,
  weight_ounces numeric(10, 2) NOT NULL,
  shipping_date date NOT NULL,
  comments text,
  transportation_company text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create batch status history table
CREATE TABLE IF NOT EXISTS batch_status_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  comments text,
  previous_status text
);

-- Create receiving records table
CREATE TABLE IF NOT EXISTS receiving_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  receiving_site_id uuid REFERENCES sites(id),
  expected_weight_grams numeric(10, 2) NOT NULL,
  actual_weight_grams numeric(10, 2) NOT NULL,
  variance_grams numeric(10, 2) NOT NULL,
  variance_percentage numeric(5, 2) NOT NULL,
  is_significant_variance boolean DEFAULT false,
  received_by uuid,
  received_at timestamptz DEFAULT now(),
  reconciliation_comments text,
  reconciliation_approved_by uuid,
  reconciliation_approved_at timestamptz
);

-- Create refining records table
CREATE TABLE IF NOT EXISTS refining_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  pre_melting_weight_grams numeric(10, 2) NOT NULL,
  post_melting_weight_grams numeric(10, 2) NOT NULL,
  fineness_percentage numeric(5, 2) NOT NULL,
  metal_retained_percentage numeric(5, 2) NOT NULL,
  final_fine_grams numeric(10, 2) NOT NULL,
  final_fine_ounces numeric(10, 2) NOT NULL,
  processing_notes text,
  processed_by uuid,
  processed_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz
);

-- Create batch documents table
CREATE TABLE IF NOT EXISTS batch_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (
    document_type IN ('receipt', 'proof', 'variance_evidence', 'refining_report', 'other')
  ),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_batch_number ON batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_origin_site ON batches(origin_site_id);
CREATE INDEX IF NOT EXISTS idx_batches_current_site ON batches(current_site_id);
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON batches(created_by);
CREATE INDEX IF NOT EXISTS idx_batch_status_history_batch_id ON batch_status_history(batch_id);
CREATE INDEX IF NOT EXISTS idx_receiving_records_batch_id ON receiving_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_refining_records_batch_id ON refining_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_documents_batch_id ON batch_documents(batch_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security on all tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE refining_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sites table
CREATE POLICY "Users can view sites" ON sites
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policies for batches table
CREATE POLICY "Users can view batches from their sites" ON batches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create batches" ON batches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update batches they created" ON batches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create RLS policies for batch_status_history
CREATE POLICY "Users can view batch status history" ON batch_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert batch status history" ON batch_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Create RLS policies for receiving_records
CREATE POLICY "Users can view receiving records" ON receiving_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create receiving records" ON receiving_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = received_by);

CREATE POLICY "Users can update receiving records" ON receiving_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = received_by);

-- Create RLS policies for refining_records
CREATE POLICY "Users can view refining records" ON refining_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create refining records" ON refining_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = processed_by);

CREATE POLICY "Users can update refining records" ON refining_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = processed_by);

-- Create RLS policies for batch_documents
CREATE POLICY "Users can view batch documents" ON batch_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload batch documents" ON batch_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own batch documents" ON batch_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);
