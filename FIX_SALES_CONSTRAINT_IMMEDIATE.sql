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

-- Step 6: Test the constraint with a dummy insert (will be rolled back)
DO $$
BEGIN
  -- This should work
  INSERT INTO sales (
    id, sale_number, customer_id, quantity_oz, london_am_rate,
    gross_proceeds, net_proceeds, royalty_amount, final_proceeds,
    status, sale_date
  ) VALUES (
    gen_random_uuid(),
    'TEST-001',
    (SELECT id FROM customers LIMIT 1),
    100,
    2500,
    250000,
    250000,
    7500,
    242500,
    'pending_approval',
    now()
  );
  
  RAISE NOTICE 'Test insert with valid status: SUCCESS';
  
  -- Rollback the test insert
  RAISE EXCEPTION 'Rolling back test insert' USING ERRCODE = 'P0001';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM != 'Rolling back test insert' THEN
      RAISE EXCEPTION 'Test insert failed: %', SQLERRM;
    END IF;
    RAISE NOTICE 'Test insert rolled back successfully';
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
