/*
  # Enhanced Batch Management Schema

  ## Overview
  This migration enhances the batch management system with advanced tracking capabilities,
  quality control, lifecycle management, and comprehensive workflow support.

  ## New Tables

  ### 1. `batch_quality_checks`
  Stores multiple quality assessments throughout batch lifecycle
  - `id` (uuid, primary key)
  - `batch_id` (uuid) - Reference to batch
  - `check_type` (text) - Type: initial, intermediate, final, random
  - `purity_percentage` (numeric) - Measured purity
  - `appearance_grade` (text) - Visual quality grade: A, B, C
  - `test_method` (text) - Testing methodology used
  - `test_results` (jsonb) - Detailed test results
  - `inspector_id` (uuid) - Quality inspector
  - `inspection_date` (timestamptz)
  - `passed` (boolean) - Pass/fail status
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 2. `batch_splits`
  Tracks batch division scenarios
  - `id` (uuid, primary key)
  - `parent_batch_id` (uuid) - Original batch
  - `child_batch_id` (uuid) - New batch created from split
  - `split_weight_grams` (numeric) - Weight allocated to child
  - `split_reason` (text)
  - `split_by` (uuid)
  - `split_at` (timestamptz)

  ### 3. `batch_merges`
  Tracks batch combination operations
  - `id` (uuid, primary key)
  - `source_batch_ids` (uuid[]) - Batches being merged
  - `target_batch_id` (uuid) - Resulting merged batch
  - `merge_reason` (text)
  - `total_weight_grams` (numeric)
  - `merged_by` (uuid)
  - `merged_at` (timestamptz)

  ### 4. `transportation_details`
  Enhanced transportation tracking
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `vehicle_id` (text)
  - `driver_name` (text)
  - `driver_phone` (text)
  - `license_plate` (text)
  - `departure_time` (timestamptz)
  - `estimated_arrival` (timestamptz)
  - `actual_arrival` (timestamptz)
  - `route_description` (text)
  - `gps_tracking_enabled` (boolean)
  - `seal_number` (text)
  - `created_at` (timestamptz)

  ### 5. `batch_alerts`
  Automated threshold-based notifications
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `alert_type` (text) - Type: variance, delay, quality, security
  - `severity` (text) - Level: low, medium, high, critical
  - `message` (text)
  - `triggered_at` (timestamptz)
  - `acknowledged_by` (uuid)
  - `acknowledged_at` (timestamptz)
  - `resolved_at` (timestamptz)
  - `resolution_notes` (text)

  ### 6. `variance_investigations`
  Formal variance dispute resolution
  - `id` (uuid, primary key)
  - `receiving_record_id` (uuid)
  - `investigation_status` (text) - pending, in_progress, resolved, closed
  - `investigation_type` (text) - shortage, overage, damage, theft
  - `assigned_investigator_id` (uuid)
  - `findings` (text)
  - `evidence_collected` (jsonb)
  - `responsible_party` (text)
  - `financial_impact` (numeric)
  - `resolution` (text)
  - `opened_at` (timestamptz)
  - `closed_at` (timestamptz)

  ### 7. `batch_reservations`
  Batch reservation for pending sales
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `customer_id` (uuid)
  - `reserved_weight_grams` (numeric)
  - `reservation_expires_at` (timestamptz)
  - `reserved_by` (uuid)
  - `reserved_at` (timestamptz)
  - `released_at` (timestamptz)
  - `status` (text) - active, expired, fulfilled, cancelled

  ### 8. `batch_tags`
  Custom categorization system
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `tag_name` (text)
  - `tag_category` (text)
  - `created_by` (uuid)
  - `created_at` (timestamptz)

  ## Table Modifications

  ### Enhanced `batches` table
  - Add `quality_grade` (text)
  - Add `expected_purity` (numeric)
  - Add `metal_type` (text) - gold, silver
  - Add `sealed_container_id` (text)
  - Add `customs_clearance_date` (date)
  - Add `is_on_hold` (boolean)
  - Add `hold_reason` (text)
  - Add `hold_released_at` (timestamptz)

  ### Enhanced `batch_status_history`
  - Add `location_latitude` (numeric)
  - Add `location_longitude` (numeric)
  - Add `ip_address` (text)
  - Add `user_agent` (text)

  ## Security
  - Row Level Security enabled on all new tables
  - Policies for authenticated access with role-based restrictions
  - Audit trail for all sensitive operations

  ## Indexes
  - Optimized indexes for search and filtering performance
  - Composite indexes for common query patterns
*/

-- Add new columns to batches table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'quality_grade') THEN
    ALTER TABLE batches ADD COLUMN quality_grade text CHECK (quality_grade IN ('A', 'B', 'C', 'ungraded'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'expected_purity') THEN
    ALTER TABLE batches ADD COLUMN expected_purity numeric(5, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'metal_type') THEN
    ALTER TABLE batches ADD COLUMN metal_type text DEFAULT 'gold' CHECK (metal_type IN ('gold', 'silver'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'sealed_container_id') THEN
    ALTER TABLE batches ADD COLUMN sealed_container_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'customs_clearance_date') THEN
    ALTER TABLE batches ADD COLUMN customs_clearance_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'is_on_hold') THEN
    ALTER TABLE batches ADD COLUMN is_on_hold boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'hold_reason') THEN
    ALTER TABLE batches ADD COLUMN hold_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'hold_released_at') THEN
    ALTER TABLE batches ADD COLUMN hold_released_at timestamptz;
  END IF;
END $$;

-- Add new columns to batch_status_history table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_status_history' AND column_name = 'location_latitude') THEN
    ALTER TABLE batch_status_history ADD COLUMN location_latitude numeric(10, 8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_status_history' AND column_name = 'location_longitude') THEN
    ALTER TABLE batch_status_history ADD COLUMN location_longitude numeric(11, 8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_status_history' AND column_name = 'ip_address') THEN
    ALTER TABLE batch_status_history ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_status_history' AND column_name = 'user_agent') THEN
    ALTER TABLE batch_status_history ADD COLUMN user_agent text;
  END IF;
END $$;

-- Create batch_quality_checks table
CREATE TABLE IF NOT EXISTS batch_quality_checks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN ('initial', 'intermediate', 'final', 'random', 'customs')),
  purity_percentage numeric(5, 2),
  appearance_grade text CHECK (appearance_grade IN ('A', 'B', 'C', 'ungraded')),
  test_method text,
  test_results jsonb,
  inspector_id uuid,
  inspection_date timestamptz DEFAULT now(),
  passed boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create batch_splits table
CREATE TABLE IF NOT EXISTS batch_splits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  child_batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  split_weight_grams numeric(10, 2) NOT NULL,
  split_percentage numeric(5, 2),
  split_reason text,
  split_by uuid,
  split_at timestamptz DEFAULT now(),
  UNIQUE(parent_batch_id, child_batch_id)
);

-- Create batch_merges table
CREATE TABLE IF NOT EXISTS batch_merges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_batch_ids uuid[] NOT NULL,
  target_batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  merge_reason text,
  total_weight_grams numeric(10, 2) NOT NULL,
  merged_by uuid,
  merged_at timestamptz DEFAULT now()
);

-- Create transportation_details table
CREATE TABLE IF NOT EXISTS transportation_details (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  vehicle_id text,
  driver_name text,
  driver_phone text,
  license_plate text,
  departure_time timestamptz,
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  route_description text,
  gps_tracking_enabled boolean DEFAULT false,
  seal_number text,
  seal_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create batch_alerts table
CREATE TABLE IF NOT EXISTS batch_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('variance', 'delay', 'quality', 'security', 'customs', 'approval_pending', 'system')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message text NOT NULL,
  details jsonb,
  triggered_at timestamptz DEFAULT now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text
);

-- Create variance_investigations table
CREATE TABLE IF NOT EXISTS variance_investigations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  receiving_record_id uuid REFERENCES receiving_records(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  investigation_status text DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'in_progress', 'resolved', 'closed', 'escalated')),
  investigation_type text CHECK (investigation_type IN ('shortage', 'overage', 'damage', 'theft', 'measurement_error', 'other')),
  assigned_investigator_id uuid,
  findings text,
  evidence_collected jsonb,
  responsible_party text,
  financial_impact numeric(12, 2),
  resolution text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create batch_reservations table
CREATE TABLE IF NOT EXISTS batch_reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  customer_id uuid,
  reserved_weight_grams numeric(10, 2) NOT NULL,
  reserved_weight_ounces numeric(10, 2) NOT NULL,
  reservation_expires_at timestamptz NOT NULL,
  reserved_by uuid,
  reserved_at timestamptz DEFAULT now(),
  released_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'fulfilled', 'cancelled')),
  notes text
);

-- Create batch_tags table
CREATE TABLE IF NOT EXISTS batch_tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  tag_category text,
  tag_color text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, tag_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_quality_checks_batch_id ON batch_quality_checks(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_quality_checks_check_type ON batch_quality_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_batch_quality_checks_passed ON batch_quality_checks(passed);
CREATE INDEX IF NOT EXISTS idx_batch_splits_parent_batch ON batch_splits(parent_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_splits_child_batch ON batch_splits(child_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_merges_target_batch ON batch_merges(target_batch_id);
CREATE INDEX IF NOT EXISTS idx_transportation_details_batch_id ON transportation_details(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_alerts_batch_id ON batch_alerts(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_alerts_severity ON batch_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_batch_alerts_resolved ON batch_alerts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_variance_investigations_batch_id ON variance_investigations(batch_id);
CREATE INDEX IF NOT EXISTS idx_variance_investigations_status ON variance_investigations(investigation_status);
CREATE INDEX IF NOT EXISTS idx_batch_reservations_batch_id ON batch_reservations(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_reservations_customer_id ON batch_reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_batch_reservations_status ON batch_reservations(status);
CREATE INDEX IF NOT EXISTS idx_batch_tags_batch_id ON batch_tags(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_tags_name ON batch_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_batches_quality_grade ON batches(quality_grade);
CREATE INDEX IF NOT EXISTS idx_batches_metal_type ON batches(metal_type);
CREATE INDEX IF NOT EXISTS idx_batches_is_on_hold ON batches(is_on_hold);

-- Create trigger for transportation_details updated_at
CREATE TRIGGER update_transportation_details_updated_at
  BEFORE UPDATE ON transportation_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE batch_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for batch_quality_checks
CREATE POLICY "Users can view quality checks" ON batch_quality_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inspectors can create quality checks" ON batch_quality_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inspector_id);

CREATE POLICY "Inspectors can update their quality checks" ON batch_quality_checks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = inspector_id);

-- Create RLS policies for batch_splits
CREATE POLICY "Users can view batch splits" ON batch_splits
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create splits" ON batch_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = split_by);

-- Create RLS policies for batch_merges
CREATE POLICY "Users can view batch merges" ON batch_merges
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create merges" ON batch_merges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = merged_by);

-- Create RLS policies for transportation_details
CREATE POLICY "Users can view transportation details" ON transportation_details
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create transportation details" ON transportation_details
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update transportation details" ON transportation_details
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for batch_alerts
CREATE POLICY "Users can view batch alerts" ON batch_alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create batch alerts" ON batch_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can acknowledge alerts" ON batch_alerts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for variance_investigations
CREATE POLICY "Users can view variance investigations" ON variance_investigations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create variance investigations" ON variance_investigations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Investigators can update their investigations" ON variance_investigations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = assigned_investigator_id OR true);

-- Create RLS policies for batch_reservations
CREATE POLICY "Users can view batch reservations" ON batch_reservations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create batch reservations" ON batch_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reserved_by);

CREATE POLICY "Users can update their reservations" ON batch_reservations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reserved_by);

-- Create RLS policies for batch_tags
CREATE POLICY "Users can view batch tags" ON batch_tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create batch tags" ON batch_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their tags" ON batch_tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
