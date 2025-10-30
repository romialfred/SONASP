-- ========================================
-- IMMEDIATE FIX FOR SALES CONSTRAINT
-- ========================================

-- This will completely rebuild the constraint cleanly

-- Step 1: Drop ALL existing constraints with "status" in the name
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN 
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'sales'
    AND con.contype = 'c'
    AND conname LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE sales DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- Step 2: Show what constraints remain
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
AND con.contype = 'c'
ORDER BY con.conname;

-- Step 3: Clean any invalid status values AGAIN (just to be safe)
UPDATE sales
SET status = 'pending_approval',
    updated_at = now()
WHERE status NOT IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
) OR status IS NULL;

-- Step 4: Verify all statuses are valid
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM sales
  WHERE status NOT IN (
    'pending_approval',
    'approved',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ) OR status IS NULL;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % invalid status values', invalid_count;
  END IF;

  RAISE NOTICE 'All status values are valid (% rows checked)', (SELECT COUNT(*) FROM sales);
END $$;

-- Step 5: Add the NEW constraint with a unique name
ALTER TABLE sales ADD CONSTRAINT sales_status_check_v2
CHECK (status IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
));

-- Step 6: Validate the constraint logic (without inserting)
DO $$
DECLARE
  test_status TEXT;
  is_valid BOOLEAN;
BEGIN
  test_status := 'pending_approval';

  -- Test if our status would pass the constraint
  SELECT test_status IN (
    'pending_approval',
    'approved',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ) INTO is_valid;

  IF is_valid THEN
    RAISE NOTICE 'Constraint validation: "%" is VALID ✓', test_status;
  ELSE
    RAISE EXCEPTION 'Constraint validation: "%" is INVALID ✗', test_status;
  END IF;

  -- Test a few more statuses
  RAISE NOTICE 'Testing other valid statuses...';

  FOR test_status IN
    SELECT unnest(ARRAY[
      'approved',
      'customer_approved',
      'waiting_for_payment',
      'completed'
    ])
  LOOP
    SELECT test_status IN (
      'pending_approval',
      'approved',
      'customer_approved',
      'customer_rejected',
      'waiting_for_payment',
      'payment_received',
      'completed',
      'rejected',
      'cancelled'
    ) INTO is_valid;

    RAISE NOTICE '  - "%": %', test_status, CASE WHEN is_valid THEN 'VALID ✓' ELSE 'INVALID ✗' END;
  END LOOP;

  RAISE NOTICE 'All constraint validations passed successfully';
END $$;

-- Step 7: Verify constraint is active
SELECT
  con.conname as constraint_name,
  con.contype as type,
  pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
AND con.contype = 'c'
AND conname LIKE '%status%'
ORDER BY con.conname;

-- Step 8: Show current status distribution
SELECT 
  status,
  COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY count DESC;
