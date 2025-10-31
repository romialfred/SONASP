/*
  # Reports System Schema

  1. New Tables
    - `scheduled_reports`
      - Stores scheduled report configurations
      - Fields: id, report_type, frequency, schedule_time, recipients, format, is_active
    - `report_history`
      - Tracks generated reports
      - Fields: id, report_type, generated_by, generated_at, file_size, format, download_url

  2. Security
    - Enable RLS on both tables
    - Only management users can manage scheduled reports
    - All authenticated users can view report history

  3. Indexes
    - Add indexes for query performance
*/

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active, next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_report_history_generated_at ON report_history(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_type ON report_history(report_type);
CREATE INDEX IF NOT EXISTS idx_report_history_user ON report_history(generated_by);

-- Enable Row Level Security
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled_reports
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

-- Policies for report_history
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

-- Function to update next_run_at based on schedule
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

-- Trigger to automatically calculate next_run_at
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

CREATE TRIGGER scheduled_reports_next_run_trigger
  BEFORE INSERT OR UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_next_run_at();

-- Insert sample scheduled reports
INSERT INTO scheduled_reports (report_type, frequency, schedule_time, schedule_weekday, recipients, format)
VALUES
  ('executive', 'weekly', '09:00:00', 1, ARRAY['management@mansaresources.com']::text[], 'pdf'),
  ('sales', 'monthly', '10:00:00', 1, ARRAY['sales@mansaresources.com', 'management@mansaresources.com']::text[], 'pdf')
ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE scheduled_reports IS 'Stores scheduled report configurations for automated report generation';
COMMENT ON TABLE report_history IS 'Tracks history of all generated reports for audit and download purposes';
