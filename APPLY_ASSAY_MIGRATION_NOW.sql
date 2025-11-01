-- ============================================================================
-- ASSAY CERTIFICATES MIGRATION - SAFE VERSION
-- ============================================================================
-- Run this in Supabase SQL Editor
-- Handles all cases: fresh install or partial migration
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TABLES FIRST
-- ============================================================================

-- Main assay certificates table
CREATE TABLE IF NOT EXISTS assay_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  certificate_number text,
  certificate_date date,
  issuing_laboratory text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text DEFAULT 'application/pdf',
  
  parsing_status text DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')),
  parsing_error text,
  parsed_at timestamptz,
  
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  
  sample_id text,
  sample_description text,
  sample_weight_grams numeric(15,4),
  
  gold_content_ppm numeric(15,4),
  gold_content_gpt numeric(15,4),
  gold_content_percent numeric(8,6),
  silver_content_ppm numeric(15,4),
  silver_content_gpt numeric(15,4),
  silver_content_percent numeric(8,6),
  platinum_content_ppm numeric(15,4),
  palladium_content_ppm numeric(15,4),
  
  purity_percent numeric(8,6),
  fineness numeric(8,3),
  
  notes text,
  metadata jsonb,
  
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Base metals table
CREATE TABLE IF NOT EXISTS assay_base_metals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid REFERENCES assay_certificates(id) ON DELETE CASCADE,
  
  copper_ppm numeric(15,4),
  iron_ppm numeric(15,4),
  zinc_ppm numeric(15,4),
  nickel_ppm numeric(15,4),
  manganese_ppm numeric(15,4),
  chromium_ppm numeric(15,4),
  cobalt_ppm numeric(15,4),
  tin_ppm numeric(15,4),
  aluminum_ppm numeric(15,4),
  magnesium_ppm numeric(15,4),
  calcium_ppm numeric(15,4),
  
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Deleterious elements table
CREATE TABLE IF NOT EXISTS assay_deleterious_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid REFERENCES assay_certificates(id) ON DELETE CASCADE,
  
  arsenic_ppm numeric(15,4),
  mercury_ppm numeric(15,4),
  lead_ppm numeric(15,4),
  antimony_ppm numeric(15,4),
  bismuth_ppm numeric(15,4),
  cadmium_ppm numeric(15,4),
  selenium_ppm numeric(15,4),
  tellurium_ppm numeric(15,4),
  sulfur_ppm numeric(15,4),
  phosphorus_ppm numeric(15,4),
  
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assay_certificates_batch_id ON assay_certificates(batch_id);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_parsing_status ON assay_certificates(parsing_status);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_approval_status ON assay_certificates(approval_status);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_created_at ON assay_certificates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assay_base_metals_certificate_id ON assay_base_metals(certificate_id);
CREATE INDEX IF NOT EXISTS idx_assay_deleterious_elements_certificate_id ON assay_deleterious_elements(certificate_id);

-- ============================================================================
-- STEP 3: ENABLE RLS
-- ============================================================================

ALTER TABLE assay_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assay_base_metals ENABLE ROW LEVEL SECURITY;
ALTER TABLE assay_deleterious_elements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: DROP AND RECREATE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can insert assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can update own assay certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Managers can approve certificates" ON assay_certificates;
DROP POLICY IF EXISTS "Users can view base metals" ON assay_base_metals;
DROP POLICY IF EXISTS "Users can insert base metals" ON assay_base_metals;
DROP POLICY IF EXISTS "Users can update base metals" ON assay_base_metals;
DROP POLICY IF EXISTS "Users can view deleterious elements" ON assay_deleterious_elements;
DROP POLICY IF EXISTS "Users can insert deleterious elements" ON assay_deleterious_elements;
DROP POLICY IF EXISTS "Users can update deleterious elements" ON assay_deleterious_elements;

-- Assay certificates policies
CREATE POLICY "Users can view assay certificates"
  ON assay_certificates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert assay certificates"
  ON assay_certificates FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update own assay certificates"
  ON assay_certificates FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Managers can approve certificates"
  ON assay_certificates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin', 'management', 'factory_manager')
    )
  );

-- Base metals policies
CREATE POLICY "Users can view base metals"
  ON assay_base_metals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert base metals"
  ON assay_base_metals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update base metals"
  ON assay_base_metals FOR UPDATE
  TO authenticated
  USING (true);

-- Deleterious elements policies
CREATE POLICY "Users can view deleterious elements"
  ON assay_deleterious_elements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert deleterious elements"
  ON assay_deleterious_elements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update deleterious elements"
  ON assay_deleterious_elements FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================================
-- STEP 5: DROP EXISTING TRIGGERS (NOW THAT TABLES EXIST)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_assay_certificates_updated_at ON assay_certificates;
DROP TRIGGER IF EXISTS trigger_update_assay_base_metals_updated_at ON assay_base_metals;
DROP TRIGGER IF EXISTS trigger_update_assay_deleterious_elements_updated_at ON assay_deleterious_elements;

-- ============================================================================
-- STEP 6: CREATE UPDATE TIMESTAMP FUNCTION (IF NOT EXISTS)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: CREATE TRIGGERS
-- ============================================================================

CREATE TRIGGER trigger_update_assay_certificates_updated_at
  BEFORE UPDATE ON assay_certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_assay_base_metals_updated_at
  BEFORE UPDATE ON assay_base_metals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_assay_deleterious_elements_updated_at
  BEFORE UPDATE ON assay_deleterious_elements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 8: DROP AND RECREATE HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS get_batch_certificates(uuid);

CREATE OR REPLACE FUNCTION get_batch_certificates(p_batch_id uuid)
RETURNS TABLE (
  certificate_id uuid,
  certificate_number text,
  certificate_date date,
  file_name text,
  parsing_status text,
  approval_status text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.certificate_number,
    ac.certificate_date,
    ac.file_name,
    ac.parsing_status,
    ac.approval_status,
    ac.created_at
  FROM assay_certificates ac
  WHERE ac.batch_id = p_batch_id
  ORDER BY ac.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 9: VERIFICATION
-- ============================================================================

-- Check tables exist
SELECT
  'Tables created' as status,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('assay_certificates', 'assay_base_metals', 'assay_deleterious_elements');

-- Check RLS enabled
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('assay_certificates', 'assay_base_metals', 'assay_deleterious_elements');

-- Check policies
SELECT
  'Policies created' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('assay_certificates', 'assay_base_metals', 'assay_deleterious_elements');

-- Check triggers
SELECT
  'Triggers created' as status,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_table IN ('assay_certificates', 'assay_base_metals', 'assay_deleterious_elements')
  AND trigger_name LIKE 'trigger_update%';

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- If all verification queries return expected results, migration is complete!
--
-- Expected results:
-- - Tables created: 3
-- - All RLS: ENABLED
-- - Policies created: 10
-- - Triggers created: 3
--
-- Next steps:
-- 1. Create storage bucket 'assay-certificates' (if not exists)
-- 2. Refresh your application (F5)
-- 3. Test upload functionality in batch details page
-- ============================================================================
