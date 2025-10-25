/*
  # Add Saved Searches and Analytics Tables

  ## Overview
  Adds support for saved search filters and advanced analytics capabilities

  ## New Tables

  ### 1. `saved_batch_searches`
  Stores user-defined search filters for quick access
  - `id` (uuid, primary key)
  - `user_id` (uuid) - User who created the search
  - `name` (text) - Search name
  - `description` (text) - Search description
  - `filters` (jsonb) - Search filter configuration
  - `is_shared` (boolean) - Whether search is shared with team
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `batch_analytics_snapshots`
  Stores periodic snapshots for trend analysis
  - `id` (uuid, primary key)
  - `snapshot_date` (date)
  - `total_batches` (integer)
  - `total_weight_grams` (numeric)
  - `batches_by_status` (jsonb)
  - `batches_by_metal_type` (jsonb)
  - `average_cycle_time` (interval)
  - `variance_statistics` (jsonb)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own saved searches
  - Analytics snapshots are read-only for authenticated users
*/

-- Create saved_batch_searches table
CREATE TABLE IF NOT EXISTS saved_batch_searches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL,
  is_shared boolean DEFAULT false,
  use_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create batch_analytics_snapshots table
CREATE TABLE IF NOT EXISTS batch_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date date NOT NULL UNIQUE,
  total_batches integer DEFAULT 0,
  total_weight_grams numeric(12, 2) DEFAULT 0,
  batches_by_status jsonb,
  batches_by_metal_type jsonb,
  batches_by_site jsonb,
  average_cycle_time_hours numeric(8, 2),
  variance_statistics jsonb,
  quality_statistics jsonb,
  approval_statistics jsonb,
  created_at timestamptz DEFAULT now()
);

-- Function to generate daily analytics snapshot
CREATE OR REPLACE FUNCTION generate_batch_analytics_snapshot(p_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
  v_total_batches integer;
  v_total_weight numeric;
  v_status_breakdown jsonb;
  v_metal_breakdown jsonb;
  v_site_breakdown jsonb;
  v_avg_cycle_time numeric;
  v_variance_stats jsonb;
  v_quality_stats jsonb;
  v_approval_stats jsonb;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(weight_grams), 0)
  INTO v_total_batches, v_total_weight
  FROM batches
  WHERE DATE(created_at) <= p_date;

  SELECT jsonb_object_agg(status, count)
  INTO v_status_breakdown
  FROM (
    SELECT status, COUNT(*) as count
    FROM batches
    WHERE DATE(created_at) <= p_date
    GROUP BY status
  ) t;

  SELECT jsonb_object_agg(metal_type, count)
  INTO v_metal_breakdown
  FROM (
    SELECT metal_type, COUNT(*) as count
    FROM batches
    WHERE DATE(created_at) <= p_date
    GROUP BY metal_type
  ) t;

  SELECT jsonb_object_agg(site_name, count)
  INTO v_site_breakdown
  FROM (
    SELECT s.name as site_name, COUNT(*) as count
    FROM batches b
    JOIN sites s ON b.origin_site_id = s.id
    WHERE DATE(b.created_at) <= p_date
    GROUP BY s.name
  ) t;

  SELECT EXTRACT(EPOCH FROM AVG(updated_at - created_at)) / 3600
  INTO v_avg_cycle_time
  FROM batches
  WHERE DATE(created_at) <= p_date
    AND status IN ('ready_for_sale', 'approved');

  SELECT jsonb_build_object(
    'total_variances', COUNT(*),
    'significant_variances', COUNT(*) FILTER (WHERE is_significant_variance),
    'average_variance_percentage', AVG(ABS(variance_percentage))
  )
  INTO v_variance_stats
  FROM receiving_records
  WHERE DATE(received_at) <= p_date;

  SELECT jsonb_build_object(
    'total_checks', COUNT(*),
    'passed_checks', COUNT(*) FILTER (WHERE passed),
    'pass_rate', (COUNT(*) FILTER (WHERE passed)::numeric / NULLIF(COUNT(*), 0)) * 100
  )
  INTO v_quality_stats
  FROM batch_quality_checks
  WHERE DATE(inspection_date) <= p_date;

  SELECT jsonb_build_object(
    'total_requests', COUNT(*),
    'approved', COUNT(*) FILTER (WHERE status = 'approved'),
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'approval_rate', (COUNT(*) FILTER (WHERE status = 'approved')::numeric / NULLIF(COUNT(*), 0)) * 100
  )
  INTO v_approval_stats
  FROM batch_approvals
  WHERE DATE(requested_at) <= p_date;

  INSERT INTO batch_analytics_snapshots (
    snapshot_date,
    total_batches,
    total_weight_grams,
    batches_by_status,
    batches_by_metal_type,
    batches_by_site,
    average_cycle_time_hours,
    variance_statistics,
    quality_statistics,
    approval_statistics
  ) VALUES (
    p_date,
    v_total_batches,
    v_total_weight,
    v_status_breakdown,
    v_metal_breakdown,
    v_site_breakdown,
    v_avg_cycle_time,
    v_variance_stats,
    v_quality_stats,
    v_approval_stats
  )
  ON CONFLICT (snapshot_date)
  DO UPDATE SET
    total_batches = EXCLUDED.total_batches,
    total_weight_grams = EXCLUDED.total_weight_grams,
    batches_by_status = EXCLUDED.batches_by_status,
    batches_by_metal_type = EXCLUDED.batches_by_metal_type,
    batches_by_site = EXCLUDED.batches_by_site,
    average_cycle_time_hours = EXCLUDED.average_cycle_time_hours,
    variance_statistics = EXCLUDED.variance_statistics,
    quality_statistics = EXCLUDED.quality_statistics,
    approval_statistics = EXCLUDED.approval_statistics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_batch_searches_user_id ON saved_batch_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_batch_searches_shared ON saved_batch_searches(is_shared);
CREATE INDEX IF NOT EXISTS idx_batch_analytics_snapshots_date ON batch_analytics_snapshots(snapshot_date);

-- Create trigger for saved_batch_searches updated_at
CREATE TRIGGER update_saved_batch_searches_updated_at
  BEFORE UPDATE ON saved_batch_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE saved_batch_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_batch_searches
CREATE POLICY "Users can view their own searches" ON saved_batch_searches
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users can create their own searches" ON saved_batch_searches
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own searches" ON saved_batch_searches
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own searches" ON saved_batch_searches
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for batch_analytics_snapshots
CREATE POLICY "Users can view analytics snapshots" ON batch_analytics_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage analytics snapshots" ON batch_analytics_snapshots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
