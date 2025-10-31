-- =====================================================
-- COMBINED MIGRATION SCRIPT FOR GOLD SHIPPER
-- Apply this entire script in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Reports System
-- =====================================================

-- Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('executive', 'sales', 'batch', 'customer', 'financial', 'operations')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  schedule_time time NOT NULL DEFAULT '09:00:00',
  schedule_day int CHECK (schedule_day BETWEEN 1 AND 31),
  schedule_weekday int CHECK (schedule_weekday BETWEEN 0 AND 6),
  recipients text[] NOT NULL DEFAULT ARRAY[]::text[],
  format text NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  next_run_at timestamptz
);

-- Create report_history table
CREATE TABLE IF NOT EXISTS report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('executive', 'sales', 'batch', 'customer', 'financial', 'operations', 'custom')),
  report_name text NOT NULL,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  file_size text,
  format text NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
  download_url text,
  parameters jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active, next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_report_history_generated_at ON report_history(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_type ON report_history(report_type);
CREATE INDEX IF NOT EXISTS idx_report_history_user ON report_history(generated_by);

-- Enable RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Management can view all scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can create scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can update scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can delete scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Authenticated users can view report history" ON report_history;
DROP POLICY IF EXISTS "Authenticated users can create report history entries" ON report_history;
DROP POLICY IF EXISTS "Users can update their own report history entries" ON report_history;

-- Create policies for scheduled_reports
CREATE POLICY "Management can view all scheduled reports"
  ON scheduled_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can create scheduled reports"
  ON scheduled_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update scheduled reports"
  ON scheduled_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can delete scheduled reports"
  ON scheduled_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Create policies for report_history
CREATE POLICY "Authenticated users can view report history"
  ON report_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create report history entries"
  ON report_history FOR INSERT
  TO authenticated
  WITH CHECK (generated_by = auth.uid());

CREATE POLICY "Users can update their own report history entries"
  ON report_history FOR UPDATE
  TO authenticated
  USING (generated_by = auth.uid())
  WITH CHECK (generated_by = auth.uid());

-- Create function to calculate next run time
CREATE OR REPLACE FUNCTION calculate_next_run_time(
  p_frequency text,
  p_schedule_time time,
  p_schedule_day int,
  p_schedule_weekday int,
  p_last_run_at timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_time timestamptz;
  v_next_run timestamptz;
BEGIN
  v_base_time := COALESCE(p_last_run_at, now());

  CASE p_frequency
    WHEN 'daily' THEN
      v_next_run := (date_trunc('day', v_base_time) + interval '1 day' + p_schedule_time::interval);
    WHEN 'weekly' THEN
      v_next_run := (date_trunc('week', v_base_time) + interval '1 week' + (p_schedule_weekday || ' days')::interval + p_schedule_time::interval);
    WHEN 'monthly' THEN
      v_next_run := (date_trunc('month', v_base_time) + interval '1 month' + ((p_schedule_day - 1) || ' days')::interval + p_schedule_time::interval);
    WHEN 'quarterly' THEN
      v_next_run := (date_trunc('quarter', v_base_time) + interval '3 months' + ((p_schedule_day - 1) || ' days')::interval + p_schedule_time::interval);
    WHEN 'yearly' THEN
      v_next_run := (date_trunc('year', v_base_time) + interval '1 year' + ((p_schedule_day - 1) || ' days')::interval + p_schedule_time::interval);
    ELSE
      v_next_run := v_base_time + interval '1 day';
  END CASE;

  IF v_next_run <= now() THEN
    v_next_run := v_next_run + CASE p_frequency
      WHEN 'daily' THEN interval '1 day'
      WHEN 'weekly' THEN interval '1 week'
      WHEN 'monthly' THEN interval '1 month'
      WHEN 'quarterly' THEN interval '3 months'
      WHEN 'yearly' THEN interval '1 year'
      ELSE interval '1 day'
    END;
  END IF;

  RETURN v_next_run;
END;
$$;

-- Create trigger function
CREATE OR REPLACE FUNCTION update_next_run_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.next_run_at := calculate_next_run_time(
    NEW.frequency,
    NEW.schedule_time,
    NEW.schedule_day,
    NEW.schedule_weekday,
    NEW.last_run_at
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS scheduled_reports_next_run_trigger ON scheduled_reports;
CREATE TRIGGER scheduled_reports_next_run_trigger
  BEFORE INSERT OR UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_next_run_at();

-- =====================================================
-- PART 2: Storage Buckets
-- =====================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']::text[]),
  ('reports', 'reports', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]),
  ('payment-proofs', 'payment-proofs', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can view reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own payment proofs" ON storage.objects;

-- Create policies for documents bucket
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Users can update their own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());

CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND owner = auth.uid());

-- Create policies for reports bucket
CREATE POLICY "Authenticated users can upload reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reports');

CREATE POLICY "Users can view reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reports');

-- Create policies for payment-proofs bucket
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Users can view payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "Users can update their own payment proofs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'payment-proofs' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'payment-proofs' AND owner = auth.uid());

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables were created
SELECT 'Tables created successfully:' as status;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('scheduled_reports', 'report_history');

-- Verify buckets were created
SELECT 'Storage buckets created successfully:' as status;
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('documents', 'reports', 'payment-proofs');

-- Verify policies exist
SELECT 'RLS policies created successfully:' as status;
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('scheduled_reports', 'report_history');

SELECT 'Storage policies created successfully:' as status;
SELECT COUNT(*) as storage_policy_count
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
SELECT '✅ All migrations applied successfully!' as result;
SELECT '✅ Report scheduling is now enabled' as result;
SELECT '✅ Document uploads are now enabled' as result;
SELECT 'You can now close this window and refresh your application' as next_step;
