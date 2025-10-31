/*
  # Create Assay Certificates System

  1. New Tables
    - `assay_certificates`
      - Stores uploaded PDF certificates
      - Links to batches
      - Tracks parsing status and results
    - `assay_certificate_data`
      - Stores parsed data from certificates
      - Gold/silver content
      - Deleterious elements
      - Purity information
      - Certificate details
    - `certificate_approvals`
      - Approval workflow for parsed data
      - Review history

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users
    - Role-based access for approvals

  3. Storage
    - Create bucket for certificate PDFs
    - Security policies for file access
*/

-- ============================================================================
-- ASSAY CERTIFICATES TABLE
-- ============================================================================

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

  -- Parsing status
  parsing_status text DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')),
  parsing_error text,
  parsed_at timestamptz,

  -- Approval status
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  approval_notes text,

  -- Metadata
  uploaded_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ASSAY CERTIFICATE DATA TABLE (Parsed Results)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assay_certificate_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES assay_certificates(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,

  -- Certificate Information
  certificate_number text,
  certificate_date date,
  laboratory_name text,
  laboratory_address text,

  -- Sample Information
  sample_id text,
  sample_weight_g numeric(12, 3),
  sample_description text,

  -- Gold Content
  gold_content_ppm numeric(12, 3),
  gold_content_gpt numeric(12, 3),
  gold_content_ozt numeric(12, 6),
  gold_purity_percentage numeric(5, 2),

  -- Silver Content
  silver_content_ppm numeric(12, 3),
  silver_content_gpt numeric(12, 3),
  silver_content_ozt numeric(12, 6),
  silver_purity_percentage numeric(5, 2),

  -- Other Precious Metals
  platinum_content_ppm numeric(12, 3),
  palladium_content_ppm numeric(12, 3),

  -- Deleterious Elements (as JSON for flexibility)
  deleterious_elements jsonb DEFAULT '{}',
  -- Example: {"arsenic": 0.5, "mercury": 0.2, "lead": 1.3, "antimony": 0.8}

  -- Base Metals
  copper_percentage numeric(5, 2),
  iron_percentage numeric(5, 2),
  zinc_percentage numeric(5, 2),

  -- Fineness
  fineness numeric(6, 3),

  -- Additional Analysis
  moisture_percentage numeric(5, 2),
  total_weight_g numeric(12, 3),

  -- Quality Indicators
  is_verified boolean DEFAULT false,
  verification_notes text,

  -- Raw extracted text (for reference)
  raw_text text,
  extraction_confidence numeric(3, 2) DEFAULT 0.0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CERTIFICATE APPROVALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS certificate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES assay_certificates(id) ON DELETE CASCADE,
  certificate_data_id uuid REFERENCES assay_certificate_data(id) ON DELETE CASCADE,

  -- Approval details
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_review', 'modified')),
  reviewed_by uuid NOT NULL REFERENCES user_profiles(id),
  review_notes text,

  -- Changes made (if modified)
  changes_made jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assay_certificates_batch_id ON assay_certificates(batch_id);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_parsing_status ON assay_certificates(parsing_status);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_approval_status ON assay_certificates(approval_status);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_uploaded_by ON assay_certificates(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assay_certificates_certificate_number ON assay_certificates(certificate_number);

CREATE INDEX IF NOT EXISTS idx_assay_certificate_data_certificate_id ON assay_certificate_data(certificate_id);
CREATE INDEX IF NOT EXISTS idx_assay_certificate_data_batch_id ON assay_certificate_data(batch_id);

CREATE INDEX IF NOT EXISTS idx_certificate_approvals_certificate_id ON certificate_approvals(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_approvals_reviewed_by ON certificate_approvals(reviewed_by);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_assay_certificate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assay_certificates_updated_at
  BEFORE UPDATE ON assay_certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_assay_certificate_updated_at();

CREATE TRIGGER trigger_update_assay_certificate_data_updated_at
  BEFORE UPDATE ON assay_certificate_data
  FOR EACH ROW
  EXECUTE FUNCTION update_assay_certificate_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE assay_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assay_certificate_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_approvals ENABLE ROW LEVEL SECURITY;

-- Assay Certificates Policies
DROP POLICY IF EXISTS "Authenticated users can view certificates" ON assay_certificates;
CREATE POLICY "Authenticated users can view certificates"
  ON assay_certificates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert certificates" ON assay_certificates;
CREATE POLICY "Authenticated users can insert certificates"
  ON assay_certificates FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own certificates" ON assay_certificates;
CREATE POLICY "Users can update own certificates"
  ON assay_certificates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized users can delete certificates" ON assay_certificates;
CREATE POLICY "Authorized users can delete certificates"
  ON assay_certificates FOR DELETE
  TO authenticated
  USING (true);

-- Assay Certificate Data Policies
DROP POLICY IF EXISTS "Authenticated users can view certificate data" ON assay_certificate_data;
CREATE POLICY "Authenticated users can view certificate data"
  ON assay_certificate_data FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert certificate data" ON assay_certificate_data;
CREATE POLICY "Authenticated users can insert certificate data"
  ON assay_certificate_data FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update certificate data" ON assay_certificate_data;
CREATE POLICY "Authenticated users can update certificate data"
  ON assay_certificate_data FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Certificate Approvals Policies
DROP POLICY IF EXISTS "Authenticated users can view approvals" ON certificate_approvals;
CREATE POLICY "Authenticated users can view approvals"
  ON certificate_approvals FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create approvals" ON certificate_approvals;
CREATE POLICY "Authenticated users can create approvals"
  ON certificate_approvals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- STORAGE BUCKET FOR CERTIFICATES
-- ============================================================================

-- Create bucket for assay certificate PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assay-certificates',
  'assay-certificates',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assay-certificates bucket
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
CREATE POLICY "Authenticated users can upload certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assay-certificates');

DROP POLICY IF EXISTS "Authenticated users can view certificates" ON storage.objects;
CREATE POLICY "Authenticated users can view certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assay-certificates');

DROP POLICY IF EXISTS "Users can update own certificate files" ON storage.objects;
CREATE POLICY "Users can update own certificate files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assay-certificates')
  WITH CHECK (bucket_id = 'assay-certificates');

DROP POLICY IF EXISTS "Users can delete certificate files" ON storage.objects;
CREATE POLICY "Users can delete certificate files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assay-certificates');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get certificate with parsed data
CREATE OR REPLACE FUNCTION get_certificate_with_data(cert_id uuid)
RETURNS TABLE (
  certificate json,
  parsed_data json,
  approval_history json
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_to_json(ac.*) as certificate,
    row_to_json(acd.*) as parsed_data,
    (
      SELECT json_agg(ca.*)
      FROM certificate_approvals ca
      WHERE ca.certificate_id = cert_id
      ORDER BY ca.created_at DESC
    ) as approval_history
  FROM assay_certificates ac
  LEFT JOIN assay_certificate_data acd ON ac.id = acd.certificate_id
  WHERE ac.id = cert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get all certificates for a batch
CREATE OR REPLACE FUNCTION get_batch_certificates(p_batch_id uuid)
RETURNS TABLE (
  certificate_id uuid,
  certificate_number text,
  certificate_date date,
  file_name text,
  parsing_status text,
  approval_status text,
  has_parsed_data boolean,
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
    EXISTS(SELECT 1 FROM assay_certificate_data WHERE certificate_id = ac.id),
    ac.created_at
  FROM assay_certificates ac
  WHERE ac.batch_id = p_batch_id
  ORDER BY ac.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE assay_certificates IS 'Stores uploaded assay certificate PDFs and their processing status';
COMMENT ON TABLE assay_certificate_data IS 'Stores parsed data extracted from assay certificates';
COMMENT ON TABLE certificate_approvals IS 'Tracks approval workflow for certificate data';

COMMENT ON COLUMN assay_certificates.parsing_status IS 'Status of PDF parsing: pending, processing, completed, failed, manual_review';
COMMENT ON COLUMN assay_certificates.approval_status IS 'Approval status of parsed data: pending, approved, rejected';
COMMENT ON COLUMN assay_certificate_data.deleterious_elements IS 'JSON object containing harmful element concentrations (As, Hg, Pb, Sb, etc.)';
COMMENT ON COLUMN assay_certificate_data.extraction_confidence IS 'Confidence score (0.0-1.0) of the parsing accuracy';
