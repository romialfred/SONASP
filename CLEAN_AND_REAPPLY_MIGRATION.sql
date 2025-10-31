-- ============================================================================
-- CLEAN AND REAPPLY ASSAY CERTIFICATES MIGRATION
-- ============================================================================
-- This script safely handles existing objects and reapplies the migration
-- Run this in Supabase SQL Editor if you got trigger errors
-- ============================================================================

-- Step 1: Drop existing triggers (safe to run even if they don't exist)
DROP TRIGGER IF EXISTS trigger_update_assay_certificates_updated_at ON assay_certificates;
DROP TRIGGER IF EXISTS trigger_update_assay_base_metals_updated_at ON assay_base_metals;
DROP TRIGGER IF EXISTS trigger_update_assay_deleterious_elements_updated_at ON assay_deleterious_elements;

-- Step 2: Drop existing functions
DROP FUNCTION IF EXISTS get_certificate_full_details(uuid);
DROP FUNCTION IF EXISTS get_batch_certificates(uuid);

-- Step 3: Create tables (only if they don't exist)
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

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_assay_certificates_batch_id ON assay_certificates(batch_id);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_parsing_status ON assay_certificates(parsing_status);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_approval_status ON assay_certificates(approval_status);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_created_at ON assay_certificates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assay_base_metals_certificate_id ON assay_base_metals(certificate_id);
CREATE INDEX IF NOT EXISTS idx_assay_deleterious_elements_certificate_id ON assay_deleterious_elements(certificate_id);

-- Step 5: Enable RLS
ALTER TABLE assay_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assay_base_metals ENABLE ROW LEVEL SECURITY;
ALTER TABLE assay_deleterious_elements ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop and recreate policies
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

CREATE POLICY "Users can view assay certificates" ON assay_certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert assay certificates" ON assay_certificates FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Users can update own assay certificates" ON assay_certificates FOR UPDATE TO authenticated USING (uploaded_by = auth.uid());
CREATE POLICY "Managers can approve certificates" ON assay_certificates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'management', 'factory_manager')));
CREATE POLICY "Users can view base metals" ON assay_base_metals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert base metals" ON assay_base_metals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update base metals" ON assay_base_metals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can view deleterious elements" ON assay_deleterious_elements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert deleterious elements" ON assay_deleterious_elements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update deleterious elements" ON assay_deleterious_elements FOR UPDATE TO authenticated USING (true);

-- Step 7: Recreate triggers
CREATE TRIGGER trigger_update_assay_certificates_updated_at BEFORE UPDATE ON assay_certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_assay_base_metals_updated_at BEFORE UPDATE ON assay_base_metals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_assay_deleterious_elements_updated_at BEFORE UPDATE ON assay_deleterious_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Create functions
CREATE OR REPLACE FUNCTION get_batch_certificates(p_batch_id uuid)
RETURNS TABLE (certificate_id uuid, certificate_number text, certificate_date date, file_name text, parsing_status text, approval_status text, created_at timestamptz) AS $$
BEGIN
  RETURN QUERY SELECT ac.id, ac.certificate_number, ac.certificate_date, ac.file_name, ac.parsing_status, ac.approval_status, ac.created_at FROM assay_certificates ac WHERE ac.batch_id = p_batch_id ORDER BY ac.created_at DESC;
END; $$ LANGUAGE plpgsql;

-- Verification
SELECT 'SUCCESS!' as status, COUNT(*) as tables_created FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('assay_certificates', 'assay_base_metals', 'assay_deleterious_elements');
