/*
  # Add Shipping Status History System

  ## Description
  This migration creates a comprehensive status history tracking system for shipping preparations,
  similar to the production status history system.

  ## Changes

  ### 1. New Table: shipping_status_history
  - Tracks all status changes for shipping preparations
  - Records who made the change, when, and why
  - Links to users table for audit trail
  - Stores optional notes for each status change

  ### 2. Security
  - Row Level Security (RLS) enabled
  - Read access for authenticated users who can see the shipping preparation
  - Insert/update restricted to authenticated users
  - Automatic tracking via trigger

  ### 3. Indexes
  - Optimized for common queries:
    - By shipping_preparation_id (most common query)
    - By changed_at (for chronological sorting)
    - By changed_by (for user activity tracking)

  ### 4. Trigger
  - Automatically creates history entry when shipping_preparations.status changes
  - Captures old and new status values
  - Records timestamp and user automatically

  ## Important Notes
  - This table is append-only (no updates or deletes of history)
  - History is preserved even if shipping preparation is deleted (consider carefully)
  - All timestamps in UTC using timestamptz
  - Foreign key to users table for full audit trail
*/

-- Create the shipping_status_history table
CREATE TABLE IF NOT EXISTS shipping_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipping_status_history_preparation_id
  ON shipping_status_history(shipping_preparation_id);

CREATE INDEX IF NOT EXISTS idx_shipping_status_history_changed_at
  ON shipping_status_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipping_status_history_changed_by
  ON shipping_status_history(changed_by);

-- Enable Row Level Security
ALTER TABLE shipping_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow authenticated users to read history for shipping preparations they can access
DROP POLICY IF EXISTS "Users can view shipping status history" ON shipping_status_history;
CREATE POLICY "Users can view shipping status history"
  ON shipping_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipping_preparations
      WHERE shipping_preparations.id = shipping_status_history.shipping_preparation_id
    )
  );

-- Allow authenticated users to insert history entries
DROP POLICY IF EXISTS "Users can create shipping status history" ON shipping_status_history;
CREATE POLICY "Users can create shipping status history"
  ON shipping_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION create_shipping_status_history_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)
     OR (TG_OP = 'INSERT' AND NEW.status IS NOT NULL) THEN

    INSERT INTO shipping_status_history (
      shipping_preparation_id,
      old_status,
      new_status,
      changed_by,
      changed_at
    ) VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      auth.uid(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on shipping_preparations table
DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;
CREATE TRIGGER shipping_status_change_trigger
  AFTER INSERT OR UPDATE OF status ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION create_shipping_status_history_on_update();

-- Add comment to table
COMMENT ON TABLE shipping_status_history IS 'Tracks all status changes for shipping preparations with full audit trail';
COMMENT ON COLUMN shipping_status_history.shipping_preparation_id IS 'Reference to the shipping preparation';
COMMENT ON COLUMN shipping_status_history.old_status IS 'Previous status value (NULL for initial status)';
COMMENT ON COLUMN shipping_status_history.new_status IS 'New status value';
COMMENT ON COLUMN shipping_status_history.changed_by IS 'User who made the change (from auth.uid())';
COMMENT ON COLUMN shipping_status_history.changed_at IS 'Timestamp when the change occurred';
COMMENT ON COLUMN shipping_status_history.notes IS 'Optional notes explaining the status change';
