/*
  # Fix Batch Details RLS and Foreign Key Issues

  1. Purpose
     - Ensure all users can view batch details with related data
     - Fix RLS policies for sites and user_profiles tables
     - Add missing indexes for performance
     - Make foreign key constraints more flexible

  2. Changes
     - Update RLS policies to allow viewing of related data
     - Add policies for sites table
     - Ensure user_profiles can be read by all authenticated users
     - Add helpful indexes
*/

-- Ensure sites table has proper RLS policies for reading
DO $$
BEGIN
  -- Enable RLS if not already enabled
  ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Anyone can view sites" ON sites;
DROP POLICY IF EXISTS "Users can view sites" ON sites;
DROP POLICY IF EXISTS "Authenticated users can view sites" ON sites;

-- Create policy allowing all authenticated users to view sites
CREATE POLICY "Authenticated users can view all sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

-- Ensure user_profiles SELECT policy allows reading other profiles (for batch created_by lookups)
DROP POLICY IF EXISTS "Users can view other profiles" ON user_profiles;
CREATE POLICY "Users can view other profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Ensure batch_status_history can be viewed by anyone viewing the batch
DROP POLICY IF EXISTS "Users can view batch status history" ON batch_status_history;
CREATE POLICY "Users can view batch status history"
  ON batch_status_history FOR SELECT
  TO authenticated
  USING (true);

-- Add policy for transport_companies
DO $$
BEGIN
  ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DROP POLICY IF EXISTS "Users can view transport companies" ON transport_companies;
CREATE POLICY "Users can view transport companies"
  ON transport_companies FOR SELECT
  TO authenticated
  USING (true);

-- Add helpful indexes for batch details queries
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_origin_site ON batches(origin_site_id);
CREATE INDEX IF NOT EXISTS idx_batches_current_site ON batches(current_site_id);
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON batches(created_by);
CREATE INDEX IF NOT EXISTS idx_batch_status_history_batch_id ON batch_status_history(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_status_history_changed_at ON batch_status_history(changed_at);

-- Create a helpful view for batch details that combines all related data
CREATE OR REPLACE VIEW batch_details_view AS
SELECT
  b.id,
  b.batch_number,
  b.status,
  b.weight_grams,
  b.weight_ounces,
  b.shipping_date,
  b.comments,
  b.metal_type,
  b.created_by,
  b.created_at,
  b.updated_at,
  b.origin_site_id,
  b.current_site_id,
  b.destination_site_id,
  origin_site.name as origin_site_name,
  origin_site.country as origin_site_country,
  origin_site.site_type as origin_site_type,
  current_site.name as current_site_name,
  current_site.country as current_site_country,
  current_site.site_type as current_site_type,
  dest_site.name as destination_site_name,
  creator.full_name as created_by_name,
  creator.email as created_by_email
FROM batches b
LEFT JOIN sites origin_site ON b.origin_site_id = origin_site.id
LEFT JOIN sites current_site ON b.current_site_id = current_site.id
LEFT JOIN sites dest_site ON b.destination_site_id = dest_site.id
LEFT JOIN user_profiles creator ON b.created_by = creator.id;

-- Grant access to the view
GRANT SELECT ON batch_details_view TO authenticated;

-- Create RLS policy for the view
ALTER TABLE batch_details_view SET (security_invoker = true);

COMMENT ON VIEW batch_details_view IS 'Comprehensive view of batch data with all related information for easy querying';
