/*
  # Automated Audit Trail System

  ## Purpose
  Implement comprehensive automatic audit logging for all batch status changes
  and critical operations to ensure complete traceability and accountability.

  ## Changes
  1. Automatic Status Change Logging
     - Auto-log all status changes with user, timestamp, and context
     - Capture previous and new status
     - Include optional comments

  2. Audit Trail Protection
     - Prevent modification of audit records
     - Prevent deletion of audit records
     - Maintain data integrity

  3. Enhanced Audit Views
     - Recent activity tracking
     - User action history
     - Batch complete history

  ## Business Value
  - Complete traceability of all actions
  - Regulatory compliance support
  - Forensic analysis capability
  - Accountability enforcement

  ## Data Safety
  - All historical audit data is preserved
  - No existing records are modified
  - Audit trail is tamper-proof
*/

-- ========================================
-- STEP 1: Add Comment Column to Batches
-- ========================================

-- Add temporary column for status change comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'status_change_comment'
  ) THEN
    ALTER TABLE batches
      ADD COLUMN status_change_comment text;
    RAISE NOTICE 'Added status_change_comment column to batches table';
  END IF;
END $$;

COMMENT ON COLUMN batches.status_change_comment IS
  'Temporary column to hold comment when updating status. Automatically cleared after logging to history.';

-- ========================================
-- STEP 2: Automatic Audit Logging Function
-- ========================================

CREATE OR REPLACE FUNCTION auto_log_batch_status_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
  current_user_name text;
  auto_comment text;
BEGIN
  -- Get current user
  current_user_id := auth.uid();

  -- Get user name for logging
  SELECT full_name INTO current_user_name
  FROM user_profiles
  WHERE id = current_user_id;

  -- If status changed, log it
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- Build automatic comment if none provided
    IF NEW.status_change_comment IS NULL OR NEW.status_change_comment = '' THEN
      auto_comment := format(
        'Status changed from %s to %s by %s',
        OLD.status,
        NEW.status,
        COALESCE(current_user_name, 'System')
      );
    ELSE
      auto_comment := NEW.status_change_comment;
    END IF;

    -- Insert into audit history
    INSERT INTO batch_status_history (
      batch_id,
      status,
      previous_status,
      changed_at,
      changed_by,
      comments
    ) VALUES (
      NEW.id,
      NEW.status,
      OLD.status,
      NOW(),
      current_user_id,
      auto_comment
    );

    -- Clear the temporary comment
    NEW.status_change_comment := NULL;

    RAISE NOTICE 'Audit log created: Batch % status changed from % to %',
      NEW.batch_number, OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS auto_audit_batch_status ON batches;

CREATE TRIGGER auto_audit_batch_status
  BEFORE UPDATE ON batches
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION auto_log_batch_status_change();

COMMENT ON FUNCTION auto_log_batch_status_change() IS
  'Automatically logs all batch status changes to batch_status_history.
   Captures user, timestamp, previous/new status, and optional comments.
   This function runs automatically and cannot be bypassed.';

-- ========================================
-- STEP 3: Audit Trail Protection
-- ========================================

-- Function to prevent audit modification
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail records cannot be modified. All audit data is immutable for compliance and security.'
    USING HINT = 'If you need to correct information, create a new status change with corrected data';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent audit deletion
CREATE OR REPLACE FUNCTION prevent_audit_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail records cannot be deleted. All audit data must be retained permanently for compliance.'
    USING HINT = 'Audit records are permanent and cannot be removed';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply protection triggers
DROP TRIGGER IF EXISTS prevent_audit_update ON batch_status_history;
CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON batch_status_history
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS prevent_audit_delete ON batch_status_history;
CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON batch_status_history
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_deletion();

-- ========================================
-- STEP 4: Enhanced Audit Views
-- ========================================

-- Recent activity across all batches
CREATE OR REPLACE VIEW recent_batch_activity AS
SELECT
  bsh.id,
  bsh.batch_id,
  b.batch_number,
  b.metal_type,
  bsh.status as current_status,
  bsh.previous_status,
  bsh.changed_at,
  bsh.comments,
  up.full_name as changed_by_name,
  up.role as changed_by_role,
  mc.name as mining_company_name,
  EXTRACT(EPOCH FROM (NOW() - bsh.changed_at)) / 3600 as hours_ago
FROM batch_status_history bsh
JOIN batches b ON b.id = bsh.batch_id
LEFT JOIN user_profiles up ON up.id = bsh.changed_by
LEFT JOIN mining_companies mc ON mc.id = b.mining_company_id
ORDER BY bsh.changed_at DESC
LIMIT 100;

COMMENT ON VIEW recent_batch_activity IS
  'Shows the 100 most recent batch status changes across all batches.
   Useful for monitoring real-time activity and recent changes.';

-- User action history
CREATE OR REPLACE VIEW user_action_history AS
SELECT
  up.id as user_id,
  up.full_name,
  up.email,
  up.role,
  COUNT(bsh.id) as total_actions,
  COUNT(DISTINCT bsh.batch_id) as batches_affected,
  MIN(bsh.changed_at) as first_action,
  MAX(bsh.changed_at) as last_action,
  ARRAY_AGG(DISTINCT bsh.status) as statuses_set
FROM user_profiles up
LEFT JOIN batch_status_history bsh ON bsh.changed_by = up.id
GROUP BY up.id, up.full_name, up.email, up.role
HAVING COUNT(bsh.id) > 0
ORDER BY total_actions DESC;

COMMENT ON VIEW user_action_history IS
  'Aggregates all actions by user, showing total actions, affected batches, and status changes.
   Useful for activity monitoring and user productivity analysis.';

-- Complete batch history with all details
CREATE OR REPLACE VIEW batch_complete_history AS
WITH history_with_timing AS (
  SELECT
    bsh.batch_id,
    bsh.status,
    bsh.previous_status,
    bsh.changed_at,
    bsh.changed_by,
    bsh.comments,
    up.full_name as changed_by_name,
    up.role as changed_by_role,
    EXTRACT(EPOCH FROM (
      LEAD(bsh.changed_at) OVER (PARTITION BY bsh.batch_id ORDER BY bsh.changed_at) - bsh.changed_at
    )) / 3600 as hours_in_status
  FROM batch_status_history bsh
  LEFT JOIN user_profiles up ON up.id = bsh.changed_by
)
SELECT
  b.id as batch_id,
  b.batch_number,
  b.metal_type,
  b.weight_grams,
  b.status as current_status,
  b.created_at as batch_created,
  mc.name as mining_company,
  mc.country,
  json_agg(
    json_build_object(
      'status', hwt.status,
      'previous_status', hwt.previous_status,
      'changed_at', hwt.changed_at,
      'changed_by', hwt.changed_by_name,
      'changed_by_role', hwt.changed_by_role,
      'comments', hwt.comments,
      'hours_in_status', hwt.hours_in_status
    )
    ORDER BY hwt.changed_at
  ) as status_history,
  COUNT(hwt.batch_id) as total_status_changes,
  MAX(hwt.changed_at) as last_status_change,
  EXTRACT(EPOCH FROM (NOW() - MAX(hwt.changed_at))) / 86400 as days_since_last_change
FROM batches b
LEFT JOIN history_with_timing hwt ON hwt.batch_id = b.id
LEFT JOIN mining_companies mc ON mc.id = b.mining_company_id
GROUP BY b.id, b.batch_number, b.metal_type, b.weight_grams, b.status, b.created_at, mc.name, mc.country;

COMMENT ON VIEW batch_complete_history IS
  'Complete history for each batch including all status changes, users, timing, and context.
   Provides comprehensive audit trail for forensic analysis and compliance reporting.';

-- ========================================
-- STEP 5: Audit Search Functions
-- ========================================

-- Search audit trail by date range
CREATE OR REPLACE FUNCTION search_audit_by_date(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  batch_number text,
  status text,
  previous_status text,
  changed_at timestamptz,
  changed_by_name text,
  changed_by_role text,
  comments text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.batch_number,
    bsh.status,
    bsh.previous_status,
    bsh.changed_at,
    up.full_name as changed_by_name,
    up.role as changed_by_role,
    bsh.comments
  FROM batch_status_history bsh
  JOIN batches b ON b.id = bsh.batch_id
  LEFT JOIN user_profiles up ON up.id = bsh.changed_by
  WHERE bsh.changed_at BETWEEN start_date AND end_date
  ORDER BY bsh.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION search_audit_by_date IS
  'Search audit trail within a date range.
   Usage: SELECT * FROM search_audit_by_date(''2024-01-01'', ''2024-12-31'');';

-- Get audit trail for specific batch
CREATE OR REPLACE FUNCTION get_batch_audit_trail(batch_id_param uuid)
RETURNS TABLE (
  status text,
  previous_status text,
  changed_at timestamptz,
  changed_by_name text,
  changed_by_role text,
  comments text,
  hours_in_status numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH history_ordered AS (
    SELECT
      bsh.status,
      bsh.previous_status,
      bsh.changed_at,
      up.full_name as changed_by_name,
      up.role as changed_by_role,
      bsh.comments,
      LEAD(bsh.changed_at) OVER (ORDER BY bsh.changed_at) as next_changed_at
    FROM batch_status_history bsh
    LEFT JOIN user_profiles up ON up.id = bsh.changed_by
    WHERE bsh.batch_id = batch_id_param
  )
  SELECT
    ho.status,
    ho.previous_status,
    ho.changed_at,
    ho.changed_by_name,
    ho.changed_by_role,
    ho.comments,
    ROUND(
      EXTRACT(EPOCH FROM (ho.next_changed_at - ho.changed_at)) / 3600,
      2
    ) as hours_in_status
  FROM history_ordered ho
  ORDER BY ho.changed_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_batch_audit_trail IS
  'Get complete audit trail for a specific batch with timing information.
   Usage: SELECT * FROM get_batch_audit_trail(''batch-uuid-here'');';

-- ========================================
-- STEP 6: Audit Metrics and Analytics
-- ========================================

-- Create view for audit metrics
CREATE OR REPLACE VIEW audit_trail_metrics AS
SELECT
  COUNT(*) as total_status_changes,
  COUNT(DISTINCT batch_id) as batches_with_history,
  COUNT(DISTINCT changed_by) as unique_users,
  MIN(changed_at) as oldest_record,
  MAX(changed_at) as newest_record,
  COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '24 hours') as changes_last_24h,
  COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '7 days') as changes_last_7d,
  COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '30 days') as changes_last_30d,
  ROUND(
    COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '24 hours')::numeric /
    NULLIF(COUNT(DISTINCT DATE_TRUNC('day', changed_at) ) FILTER (WHERE changed_at > NOW() - INTERVAL '30 days'), 0),
    2
  ) as avg_daily_changes
FROM batch_status_history;

COMMENT ON VIEW audit_trail_metrics IS
  'Provides high-level metrics about the audit trail system.
   Useful for monitoring system activity and compliance reporting.';

-- ========================================
-- STEP 7: Validation and Summary
-- ========================================

DO $$
DECLARE
  total_history INTEGER;
  total_batches INTEGER;
  recent_changes INTEGER;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO total_history FROM batch_status_history;
  SELECT COUNT(DISTINCT batch_id) INTO total_batches FROM batch_status_history;
  SELECT COUNT(*) INTO recent_changes
  FROM batch_status_history
  WHERE changed_at > NOW() - INTERVAL '24 hours';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Automated Audit Trail System';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Audit Trail Status:';
  RAISE NOTICE '  • Total audit records: %', total_history;
  RAISE NOTICE '  • Batches with history: %', total_batches;
  RAISE NOTICE '  • Changes in last 24h: %', recent_changes;
  RAISE NOTICE '';
  RAISE NOTICE 'Protection Features:';
  RAISE NOTICE '  ✓ Automatic status change logging';
  RAISE NOTICE '  ✓ Audit records cannot be modified';
  RAISE NOTICE '  ✓ Audit records cannot be deleted';
  RAISE NOTICE '  ✓ User and timestamp captured automatically';
  RAISE NOTICE '';
  RAISE NOTICE 'Available Views:';
  RAISE NOTICE '  • recent_batch_activity - Last 100 changes';
  RAISE NOTICE '  • user_action_history - Actions by user';
  RAISE NOTICE '  • batch_complete_history - Full batch timelines';
  RAISE NOTICE '  • audit_trail_metrics - System metrics';
  RAISE NOTICE '';
  RAISE NOTICE 'Available Functions:';
  RAISE NOTICE '  • search_audit_by_date(start, end)';
  RAISE NOTICE '  • get_batch_audit_trail(batch_id)';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
