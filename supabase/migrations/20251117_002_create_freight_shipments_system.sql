/*
  # Freight Shipments System - Complete Implementation

  1. New Tables
    - `freight_shipments`
      - Main shipment table with multiple productions support
      - Tracks shipment status, commercial info, and totals
      - Auto-generated reference: HUM-SMK-XXX/YYYY format

    - `freight_shipment_productions`
      - Many-to-many relationship between shipments and productions
      - Snapshots production data at time of adding
      - Prevents duplicate production assignments

    - `freight_shipment_signatories`
      - Dynamic signatories management for PDF documents
      - Position, name, and signature data
      - Display order control

  2. Features
    - Multiple production selection per shipment
    - Automatic totals calculation via triggers
    - 4-status workflow system
    - Complete audit trail
    - PDF document storage references

  3. Security
    - Row Level Security enabled on all tables
    - Comprehensive policies for authenticated users
    - Foreign key constraints for data integrity
*/

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Freight shipment status enum
DO $$ BEGIN
  CREATE TYPE freight_shipment_status AS ENUM (
    'pending',
    'approved',
    'shipped_to_refinery',
    'received_at_refinery'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLES
-- =====================================================

-- Main freight shipments table
CREATE TABLE IF NOT EXISTS freight_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference and identification
  reference_number TEXT UNIQUE NOT NULL,
  status freight_shipment_status DEFAULT 'pending' NOT NULL,

  -- Shipment details
  shipment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  destination_refinery_id UUID REFERENCES refineries(id),
  number_of_boxes INTEGER NOT NULL DEFAULT 1,
  box_type TEXT DEFAULT 'Plastic Box',

  -- Commercial information
  gold_price_usd_per_oz DECIMAL(10, 2) NOT NULL,
  exchange_rate DECIMAL(10, 4) NOT NULL,
  local_currency TEXT NOT NULL DEFAULT 'XOF',

  -- Calculated totals (auto-updated by trigger)
  total_bullion_grams DECIMAL(12, 3) DEFAULT 0,
  total_pure_gold_grams DECIMAL(12, 3) DEFAULT 0,
  total_pure_gold_oz DECIMAL(12, 6) DEFAULT 0,
  total_pure_silver_grams DECIMAL(12, 3) DEFAULT 0,
  total_value_usd DECIMAL(15, 2) DEFAULT 0,
  total_value_local DECIMAL(15, 2) DEFAULT 0,
  production_count INTEGER DEFAULT 0,

  -- PDF document paths
  bullion_summary_pdf_path TEXT,
  customs_invoice_pdf_path TEXT,

  -- Notes
  notes TEXT,

  -- Workflow tracking
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  shipped_at TIMESTAMPTZ,
  shipped_by UUID REFERENCES auth.users(id),
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES auth.users(id),

  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_gold_price CHECK (gold_price_usd_per_oz > 0),
  CONSTRAINT valid_exchange_rate CHECK (exchange_rate > 0),
  CONSTRAINT valid_boxes CHECK (number_of_boxes > 0)
);

-- Many-to-many link between shipments and productions
CREATE TABLE IF NOT EXISTS freight_shipment_productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  freight_shipment_id UUID NOT NULL REFERENCES freight_shipments(id) ON DELETE CASCADE,
  production_id UUID NOT NULL REFERENCES daily_production(id) ON DELETE RESTRICT,

  -- Snapshot of production data at time of adding
  production_date TIMESTAMPTZ,
  bar_reference TEXT,
  bullion_grams DECIMAL(10, 3),
  estimated_fineness_pct DECIMAL(5, 2),
  estimated_silver_pct DECIMAL(5, 2),
  pure_gold_grams DECIMAL(10, 3),
  pure_gold_oz DECIMAL(10, 6),
  silver_content_grams DECIMAL(10, 3),

  -- Audit
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id),

  -- Ensure one production can only be in one shipment
  CONSTRAINT unique_production_per_shipment UNIQUE (production_id)
);

-- Signatories for document signing
CREATE TABLE IF NOT EXISTS freight_shipment_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  freight_shipment_id UUID NOT NULL REFERENCES freight_shipments(id) ON DELETE CASCADE,

  -- Signatory information
  position TEXT NOT NULL,
  full_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_position CHECK (position <> ''),
  CONSTRAINT valid_name CHECK (full_name <> '')
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Freight shipments indexes
CREATE INDEX IF NOT EXISTS idx_freight_shipments_status
  ON freight_shipments(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_freight_shipments_reference
  ON freight_shipments(reference_number);

CREATE INDEX IF NOT EXISTS idx_freight_shipments_date
  ON freight_shipments(shipment_date DESC);

CREATE INDEX IF NOT EXISTS idx_freight_shipments_refinery
  ON freight_shipments(destination_refinery_id);

CREATE INDEX IF NOT EXISTS idx_freight_shipments_created
  ON freight_shipments(created_at DESC);

-- Productions link indexes
CREATE INDEX IF NOT EXISTS idx_freight_productions_shipment
  ON freight_shipment_productions(freight_shipment_id);

CREATE INDEX IF NOT EXISTS idx_freight_productions_production
  ON freight_shipment_productions(production_id);

-- Signatories indexes
CREATE INDEX IF NOT EXISTS idx_freight_signatories_shipment
  ON freight_shipment_signatories(freight_shipment_id);

CREATE INDEX IF NOT EXISTS idx_freight_signatories_order
  ON freight_shipment_signatories(freight_shipment_id, display_order);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate unique reference number: HUM-SMK-XXX/YYYY
CREATE OR REPLACE FUNCTION generate_freight_shipment_reference()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  sequence_num INTEGER;
  new_ref TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Get the next sequence number for current year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM 'HUM-SMK-(\d+)/') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM freight_shipments
  WHERE reference_number ~ ('HUM-SMK-\d+/' || current_year);

  -- If no sequence found, start at 1
  IF sequence_num IS NULL THEN
    sequence_num := 1;
  END IF;

  -- Format: HUM-SMK-XXX/YYYY
  new_ref := 'HUM-SMK-' || LPAD(sequence_num::TEXT, 3, '0') || '/' || current_year;

  RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

-- Calculate shipment totals from linked productions
CREATE OR REPLACE FUNCTION calculate_freight_shipment_totals()
RETURNS TRIGGER AS $$
DECLARE
  shipment_id UUID;
  total_bullion DECIMAL(12, 3);
  total_pure_gold_g DECIMAL(12, 3);
  total_pure_gold_oz_val DECIMAL(12, 6);
  total_pure_silver_g DECIMAL(12, 3);
  prod_count INTEGER;
  gold_price DECIMAL(10, 2);
  exchange_rate_val DECIMAL(10, 4);
  calculated_value_usd DECIMAL(15, 2);
  calculated_value_local DECIMAL(15, 2);
BEGIN
  -- Determine shipment ID based on operation
  IF TG_OP = 'DELETE' THEN
    shipment_id := OLD.freight_shipment_id;
  ELSE
    shipment_id := NEW.freight_shipment_id;
  END IF;

  -- Calculate totals from all productions in this shipment
  SELECT
    COALESCE(SUM(bullion_grams), 0),
    COALESCE(SUM(pure_gold_grams), 0),
    COALESCE(SUM(pure_gold_oz), 0),
    COALESCE(SUM(silver_content_grams), 0),
    COUNT(*)
  INTO
    total_bullion,
    total_pure_gold_g,
    total_pure_gold_oz_val,
    total_pure_silver_g,
    prod_count
  FROM freight_shipment_productions
  WHERE freight_shipment_id = shipment_id;

  -- Get gold price and exchange rate from shipment
  SELECT
    gold_price_usd_per_oz,
    exchange_rate
  INTO
    gold_price,
    exchange_rate_val
  FROM freight_shipments
  WHERE id = shipment_id;

  -- Calculate values
  calculated_value_usd := total_pure_gold_oz_val * gold_price;
  calculated_value_local := calculated_value_usd * exchange_rate_val;

  -- Update shipment totals
  UPDATE freight_shipments
  SET
    total_bullion_grams = total_bullion,
    total_pure_gold_grams = total_pure_gold_g,
    total_pure_gold_oz = total_pure_gold_oz_val,
    total_pure_silver_grams = total_pure_silver_g,
    total_value_usd = calculated_value_usd,
    total_value_local = calculated_value_local,
    production_count = prod_count,
    updated_at = now()
  WHERE id = shipment_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_freight_shipment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to calculate totals when productions are added/removed
DROP TRIGGER IF EXISTS trigger_calculate_freight_totals ON freight_shipment_productions;
CREATE TRIGGER trigger_calculate_freight_totals
  AFTER INSERT OR DELETE ON freight_shipment_productions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_freight_shipment_totals();

-- Trigger to update timestamp on shipment changes
DROP TRIGGER IF EXISTS trigger_freight_shipment_updated ON freight_shipments;
CREATE TRIGGER trigger_freight_shipment_updated
  BEFORE UPDATE ON freight_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_freight_shipment_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE freight_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_shipment_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_shipment_signatories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view freight shipments" ON freight_shipments;
DROP POLICY IF EXISTS "Users can create freight shipments" ON freight_shipments;
DROP POLICY IF EXISTS "Users can update freight shipments" ON freight_shipments;
DROP POLICY IF EXISTS "Users can delete freight shipments" ON freight_shipments;

DROP POLICY IF EXISTS "Users can view shipment productions" ON freight_shipment_productions;
DROP POLICY IF EXISTS "Users can add productions to shipments" ON freight_shipment_productions;
DROP POLICY IF EXISTS "Users can remove productions from shipments" ON freight_shipment_productions;

DROP POLICY IF EXISTS "Users can view signatories" ON freight_shipment_signatories;
DROP POLICY IF EXISTS "Users can add signatories" ON freight_shipment_signatories;
DROP POLICY IF EXISTS "Users can update signatories" ON freight_shipment_signatories;
DROP POLICY IF EXISTS "Users can delete signatories" ON freight_shipment_signatories;

-- Policies for freight_shipments
CREATE POLICY "Users can view freight shipments"
  ON freight_shipments
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Users can create freight shipments"
  ON freight_shipments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update freight shipments"
  ON freight_shipments
  FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

CREATE POLICY "Users can delete freight shipments"
  ON freight_shipments
  FOR DELETE
  TO authenticated
  USING (status = 'pending');

-- Policies for freight_shipment_productions
CREATE POLICY "Users can view shipment productions"
  ON freight_shipment_productions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add productions to shipments"
  ON freight_shipment_productions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can remove productions from shipments"
  ON freight_shipment_productions
  FOR DELETE
  TO authenticated
  USING (true);

-- Policies for freight_shipment_signatories
CREATE POLICY "Users can view signatories"
  ON freight_shipment_signatories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add signatories"
  ON freight_shipment_signatories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update signatories"
  ON freight_shipment_signatories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete signatories"
  ON freight_shipment_signatories
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE freight_shipments IS 'Main freight shipments table supporting multiple productions per shipment';
COMMENT ON TABLE freight_shipment_productions IS 'Many-to-many relationship linking shipments to productions with data snapshot';
COMMENT ON TABLE freight_shipment_signatories IS 'Document signatories for Bullion Summary and Customs Invoice PDFs';

COMMENT ON COLUMN freight_shipments.reference_number IS 'Auto-generated reference in format HUM-SMK-XXX/YYYY';
COMMENT ON COLUMN freight_shipments.status IS 'Workflow status: pending, approved, shipped_to_refinery, received_at_refinery';
COMMENT ON COLUMN freight_shipment_productions.production_id IS 'Unique constraint ensures one production can only be in one shipment';
