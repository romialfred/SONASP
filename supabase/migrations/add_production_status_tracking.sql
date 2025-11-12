/*
  # Add Production Status and Change Tracking

  1. Changes to daily_production table
    - Add `status` column with enum type
    - Add indexes for performance
    - Update RLS policies

  2. New Table: production_status_history
    - Track all status changes
    - Who made the change
    - When it was made
    - Optional notes/reason for change

  3. Trigger
    - Automatically log status changes

  Status Flow:
  Prepared → Shipped → Refined → Sold
*/

-- Create enum for production status
DO $$ BEGIN
  CREATE TYPE production_status AS ENUM ('prepared', 'shipped', 'refined', 'sold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column to daily_production if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status'
  ) THEN
    ALTER TABLE daily_production ADD COLUMN status production_status DEFAULT 'prepared' NOT NULL;
    RAISE NOTICE 'Added status column to daily_production';
  END IF;
END $$;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_daily_production_status
  ON daily_production(status);

CREATE INDEX IF NOT EXISTS idx_daily_production_mining_company_status
  ON daily_production(mining_company_id, status);

-- Create production_status_history table
CREATE TABLE IF NOT EXISTS production_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES daily_production(id) ON DELETE CASCADE,
  old_status production_status,
  new_status production_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now() NOT NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for history queries
CREATE INDEX IF NOT EXISTS idx_production_status_history_production_id
  ON production_status_history(production_id);

CREATE INDEX IF NOT EXISTS idx_production_status_history_changed_at
  ON production_status_history(changed_at DESC);

-- Enable RLS on production_status_history
ALTER TABLE production_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view status history" ON production_status_history;
DROP POLICY IF EXISTS "Users can insert status history" ON production_status_history;

-- Policies for production_status_history
CREATE POLICY "Users can view status history"
  ON production_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert status history"
  ON production_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_production_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status IS NOT NULL) THEN
    INSERT INTO production_status_history (
      production_id,
      old_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      NULL,
      NEW.status,
      NEW.created_by,
      'Production créée'
    );
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO production_status_history (
      production_id,
      old_status,
      new_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production;
CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_production_status_change();

-- Function to get status history for a production
CREATE OR REPLACE FUNCTION get_production_status_history(prod_id uuid)
RETURNS TABLE (
  id uuid,
  old_status text,
  new_status text,
  changed_by uuid,
  changed_at timestamptz,
  notes text,
  user_email text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    psh.id,
    psh.old_status::text,
    psh.new_status::text,
    psh.changed_by,
    psh.changed_at,
    psh.notes,
    au.email as user_email
  FROM production_status_history psh
  LEFT JOIN auth.users au ON psh.changed_by = au.id
  WHERE psh.production_id = prod_id
  ORDER BY psh.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing productions to have 'prepared' status
UPDATE daily_production
SET status = 'prepared'
WHERE status IS NULL;

-- Add comment to status column
COMMENT ON COLUMN daily_production.status IS 'Status workflow: prepared → shipped → refined → sold';
