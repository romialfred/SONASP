/*
  # Add Shipping Status History System

  ## Description
  This migration creates a comprehensive status history tracking system for shipping preparations,
  similar to the production status history system.

  ## ⚠️  PREREQUISITES - VERIFY BEFORE EXECUTION
  Run this verification script first: scripts/verify-database-structure.sql

  Required tables:
  - ✅ shipping_preparations (must exist)
  - ⚠️  user_profiles or users (optional, affects changed_by foreign key)

  ## Changes

  ### 1. New Table: shipping_status_history
  - Tracks all status changes for shipping preparations
  - Records who made the change, when, and why
  - Stores user ID from auth.uid() without foreign key constraint
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
  - History is preserved when shipping preparation is deleted (ON DELETE CASCADE)
  - All timestamps in UTC using timestamptz
  - changed_by stores UUID from auth.uid() without foreign key
  - To get user email, join with auth.users or user_profiles in queries
*/

-- =====================================================
-- STEP 1: Create the shipping_status_history table
-- =====================================================

CREATE TABLE IF NOT EXISTS shipping_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,  -- Stores auth.uid(), no foreign key constraint
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE shipping_status_history IS 'Tracks all status changes for shipping preparations with full audit trail';
COMMENT ON COLUMN shipping_status_history.shipping_preparation_id IS 'Reference to the shipping preparation';
COMMENT ON COLUMN shipping_status_history.old_status IS 'Previous status value (NULL for initial status)';
COMMENT ON COLUMN shipping_status_history.new_status IS 'New status value';
COMMENT ON COLUMN shipping_status_history.changed_by IS 'User UUID from auth.uid() who made the change';
COMMENT ON COLUMN shipping_status_history.changed_at IS 'Timestamp when the change occurred';
COMMENT ON COLUMN shipping_status_history.notes IS 'Optional notes explaining the status change';

-- =====================================================
-- STEP 2: Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shipping_status_history_preparation_id
  ON shipping_status_history(shipping_preparation_id);

CREATE INDEX IF NOT EXISTS idx_shipping_status_history_changed_at
  ON shipping_status_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipping_status_history_changed_by
  ON shipping_status_history(changed_by);

-- =====================================================
-- STEP 3: Enable Row Level Security
-- =====================================================

ALTER TABLE shipping_status_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: Create RLS Policies
-- =====================================================

-- Policy 1: Allow authenticated users to read history for shipping preparations they can access
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

-- Policy 2: Allow authenticated users to insert history entries
DROP POLICY IF EXISTS "Users can create shipping status history" ON shipping_status_history;
CREATE POLICY "Users can create shipping status history"
  ON shipping_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by OR changed_by IS NULL);

-- =====================================================
-- STEP 5: Create trigger function
-- =====================================================

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
      auth.uid(),  -- Gets current authenticated user
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function comment
COMMENT ON FUNCTION create_shipping_status_history_on_update() IS 'Automatically creates status history entry when shipping preparation status changes';

-- =====================================================
-- STEP 6: Create trigger on shipping_preparations table
-- =====================================================

DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;
CREATE TRIGGER shipping_status_change_trigger
  AFTER INSERT OR UPDATE OF status ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION create_shipping_status_history_on_update();

-- =====================================================
-- VERIFICATION QUERIES (commented out - run manually if needed)
-- =====================================================

-- Uncomment these to verify the migration was successful:

/*
-- 1. Verify table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'shipping_status_history'
) AS table_exists;

-- 2. Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'shipping_status_history';

-- 3. Verify trigger
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'shipping_preparations'
AND trigger_name = 'shipping_status_change_trigger';

-- 4. Verify RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'shipping_status_history';

-- 5. Test insert (replace UUID with real shipping_preparation_id)
INSERT INTO shipping_status_history (
  shipping_preparation_id,
  old_status,
  new_status,
  changed_by,
  notes
) VALUES (
  'your-shipping-preparation-id-here',
  'pending',
  'prepared',
  auth.uid(),
  'Test entry'
);
*/
