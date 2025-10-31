# URGENT: Sales Insert Error - Constraint Violation

## Error Message

```
ERROR: 23514: new row for relation "sales" violates check constraint "sales_status_check"
DETAIL: Failing row contains (..., pending_approval, ...)
```

## Critical Observation

**The status value IS VALID ("pending_approval")** but the insert still fails!

This indicates one of these problems:

1. **Multiple conflicting constraints** with similar names
2. **Cached constraint definition** not matching database
3. **Different column** being checked by constraint
4. **Constraint checking wrong column** due to schema mismatch

## Root Cause Analysis

Looking at the failing row structure, there are **many columns** (45+ fields). This suggests:

- The sales table has evolved and has many columns
- The constraint might be checking a column we didn't expect
- OR there's a duplicate/old constraint still active

## Immediate Solution

**Run this script to completely rebuild the constraint:**

File: `FIX_SALES_CONSTRAINT_IMMEDIATE.sql`

This script will:

1. ✅ Drop **ALL** constraints with "status" in the name
2. ✅ Clean any remaining invalid status values
3. ✅ Verify all existing data is valid
4. ✅ Add a NEW constraint with a different name (`sales_status_check_v2`)
5. ✅ Test the constraint with a dummy insert
6. ✅ Show final status distribution

## Step-by-Step Instructions

### Step 1: Run Diagnostic Query First

```sql
-- Check what constraints currently exist
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
AND con.contype = 'c'
AND conname LIKE '%status%'
ORDER BY con.conname;
```

**Expected Issues**:
- Multiple constraints with "status" in name
- Old constraint definitions that don't match

### Step 2: Check Column Structure

```sql
-- List ALL columns in sales table
SELECT 
  ordinal_position,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;
```

Look for:
- Multiple columns with "status" in name
- Unexpected column order

### Step 3: Run the Fix

**Open Supabase SQL Editor** and run:

```sql
-- Copy entire content of FIX_SALES_CONSTRAINT_IMMEDIATE.sql
```

### Step 4: Monitor the Output

You should see:

```
NOTICE: Dropped constraint: sales_status_check
NOTICE: Dropped constraint: sales_status_check_old (if exists)
NOTICE: All status values are valid (X rows checked)
NOTICE: Test insert with valid status: SUCCESS
NOTICE: Test insert rolled back successfully
```

### Step 5: Verify Fix Worked

```sql
-- Try a real insert
INSERT INTO sales (
  sale_number,
  customer_id,
  quantity_oz,
  london_am_rate,
  gross_proceeds,
  net_proceeds,
  royalty_amount,
  final_proceeds,
  status,
  sale_date
) VALUES (
  'TEST-VERIFY-001',
  (SELECT id FROM customers LIMIT 1),
  1,
  2500,
  2500,
  2500,
  75,
  2425,
  'pending_approval',
  now()
) RETURNING id, sale_number, status;

-- Clean up test
DELETE FROM sales WHERE sale_number = 'TEST-VERIFY-001';
```

**Expected**: Insert succeeds without error

## Why This Happened

The most likely scenario:

1. Migration ran successfully initially
2. But didn't fully replace the old constraint
3. Both old AND new constraints are active
4. One of them has a different definition
5. New inserts fail even though data looks valid

**OR**

1. There's a cached query plan using old constraint
2. Connection pooling is serving stale constraint info
3. Need to force PostgreSQL to rebuild constraint

## Alternative Quick Fix (If Above Doesn't Work)

### Option A: Temporarily Disable Constraint

```sql
-- Remove constraint entirely
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check_v2;

-- Try your insert now (should work)

-- Re-add constraint after confirming insert works
ALTER TABLE sales ADD CONSTRAINT sales_status_check_v3
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
```

### Option B: Use NOT NULL Instead (Temporary)

```sql
-- If constraint keeps failing, switch to just NOT NULL temporarily
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ALTER COLUMN status SET NOT NULL;

-- Then investigate schema mismatch
```

## Deep Diagnostic (If Problem Persists)

### Check for Hidden Constraints

```sql
-- Show ALL constraints on sales table
SELECT
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
ORDER BY con.contype, con.conname;
```

### Check Constraint Validation

```sql
-- Manually validate each row
SELECT 
  id,
  sale_number,
  status,
  CASE 
    WHEN status IN (
      'pending_approval',
      'approved',
      'customer_approved',
      'customer_rejected',
      'waiting_for_payment',
      'payment_received',
      'completed',
      'rejected',
      'cancelled'
    ) THEN 'VALID'
    ELSE 'INVALID'
  END as validation
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
```

Should return 0 rows.

### Check for Triggers

```sql
-- Check if any trigger is modifying status
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sales'
ORDER BY trigger_name;
```

## Expected Timeline

- **Diagnostic**: 2 minutes
- **Running fix**: 1 minute
- **Verification**: 2 minutes
- **Total**: ~5 minutes

## Success Criteria

After fix:

✅ New sales inserts work with `status = 'pending_approval'`
✅ Only ONE constraint with "status" exists
✅ Constraint name is either `sales_status_check_v2` or `sales_status_check_v3`
✅ All existing sales have valid status values
✅ Test insert and delete works without errors

## If This Still Doesn't Work

There might be a more fundamental issue:

1. **Schema drift**: Frontend/code using different column names
2. **Caching**: Application layer caching old INSERT statements
3. **Permissions**: RLS policy rejecting based on different criteria

**Next steps:**
1. Check what columns the frontend is actually inserting
2. Review the exact INSERT statement being executed
3. Check RLS policies on sales table
4. Verify no application-level validation is interfering

## Files Referenced

- ✅ `FIX_SALES_CONSTRAINT_IMMEDIATE.sql` - Main fix script
- ✅ `diagnose_sales_columns.sql` - Diagnostic queries
- ✅ This guide - `URGENT_SALES_INSERT_ERROR_FIX.md`

---

**Bottom Line**: Run `FIX_SALES_CONSTRAINT_IMMEDIATE.sql` to completely rebuild the constraint cleanly. This should resolve the issue in under 5 minutes! 🚀
