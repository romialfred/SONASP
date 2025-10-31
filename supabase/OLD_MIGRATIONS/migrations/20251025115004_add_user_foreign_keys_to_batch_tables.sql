/*
  # Add User Foreign Keys to Batch Tables

  1. Changes
    - Add foreign key constraints from batch-related tables to user_profiles
    - batch_approvals: requested_by, approved_by, escalated_to → user_profiles(id)
    - batch_quality_checks: inspector_id → user_profiles(id)
    - batch_status_history: changed_by → user_profiles(id)
    - batch_reservations: reserved_by → user_profiles(id)

  2. Security
    - No RLS changes needed - foreign keys for data integrity only
*/

-- Add foreign key for batch_approvals.requested_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'batch_approvals_requested_by_fkey'
  ) THEN
    ALTER TABLE batch_approvals 
    ADD CONSTRAINT batch_approvals_requested_by_fkey 
    FOREIGN KEY (requested_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for batch_approvals.approved_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'batch_approvals_approved_by_fkey'
  ) THEN
    ALTER TABLE batch_approvals 
    ADD CONSTRAINT batch_approvals_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for batch_approvals.escalated_to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'batch_approvals_escalated_to_fkey'
  ) THEN
    ALTER TABLE batch_approvals 
    ADD CONSTRAINT batch_approvals_escalated_to_fkey 
    FOREIGN KEY (escalated_to) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for batch_quality_checks.inspector_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'batch_quality_checks_inspector_id_fkey'
  ) THEN
    ALTER TABLE batch_quality_checks 
    ADD CONSTRAINT batch_quality_checks_inspector_id_fkey 
    FOREIGN KEY (inspector_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for batch_status_history.changed_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'batch_status_history_changed_by_fkey'
  ) THEN
    ALTER TABLE batch_status_history 
    ADD CONSTRAINT batch_status_history_changed_by_fkey 
    FOREIGN KEY (changed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for batch_reservations.reserved_by (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batch_reservations' 
    AND column_name = 'reserved_by'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'batch_reservations_reserved_by_fkey'
    ) THEN
      ALTER TABLE batch_reservations 
      ADD CONSTRAINT batch_reservations_reserved_by_fkey 
      FOREIGN KEY (reserved_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
