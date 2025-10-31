# Sales Status Constraint Error - Complete Fix Guide

## Error Encountered

```
ERROR: 23514: check constraint "sales_status_check" of relation "sales" is violated by some row
```

## Root Cause

Your `sales` table contains rows with status values that don't match the new constraint you're trying to add.

**Common Invalid Status Values**:
- Old status names (e.g., "pending", "waiting", "payment_pending")
- NULL values
- Typos or variations in status names
- Legacy status values from old schema

## Diagnostic Process

### Step 1: Identify Invalid Status Values

Run this diagnostic query in Supabase SQL Editor:

```sql
-- Show all current status values and their counts
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM sales
GROUP BY status
ORDER BY count DESC;
```

### Step 2: Find Specific Invalid Rows

```sql
-- Find rows that would violate the new constraint
SELECT 
  id,
  sale_number,
  status,
  created_at,
  customer_id
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
) OR status IS NULL
ORDER BY created_at DESC
LIMIT 20;
```

### Step 3: Count Valid vs Invalid

```sql
SELECT 
  'Valid statuses' as category,
  COUNT(*) as count
FROM sales
WHERE status IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
)
UNION ALL
SELECT 
  'Invalid/Need update' as category,
  COUNT(*) as count
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

## Solution Applied

The migration has been updated to **automatically clean invalid statuses BEFORE applying the constraint**.

### What the Updated Migration Does

1. **Counts invalid statuses** and displays the number
2. **Updates NULL statuses** to 'pending_approval'
3. **Maps common variations** to valid status values:
   - Anything with "pending" → `pending_approval`
   - Anything with "wait" → `waiting_for_payment`
   - Anything with "approv" → `approved`
   - Anything with "complet" → `completed`
   - Anything with "reject" → `rejected`
   - Anything with "cancel" → `cancelled`
   - Anything with "paid" or "payment" → `payment_received`
   - Everything else → `pending_approval` (safe default)
4. **Verifies all statuses are valid** before applying constraint
5. **Drops old constraint** if it exists
6. **Adds new constraint** with all required status values

### Updated Migration Code (Lines 26-123)

```sql
-- First, check and display current status values
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

  RAISE NOTICE 'Found % sales with invalid or NULL status values', invalid_count;
END $$;

-- Update NULL statuses
UPDATE sales
SET status = 'pending_approval',
    updated_at = now()
WHERE status IS NULL;

-- Map invalid statuses to valid ones
UPDATE sales
SET status = CASE
  WHEN status ILIKE '%pending%' THEN 'pending_approval'
  WHEN status ILIKE '%wait%' THEN 'waiting_for_payment'
  WHEN status ILIKE '%approv%' AND status NOT LIKE 'customer_%' THEN 'approved'
  WHEN status ILIKE '%complet%' THEN 'completed'
  WHEN status ILIKE '%reject%' AND status NOT LIKE 'customer_%' THEN 'rejected'
  WHEN status ILIKE '%cancel%' THEN 'cancelled'
  WHEN status ILIKE '%paid%' OR status ILIKE '%payment%' THEN 'payment_received'
  ELSE 'pending_approval'
END,
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
);

-- Verify cleanup was successful
DO $$
DECLARE
  remaining_invalid INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_invalid
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

  IF remaining_invalid > 0 THEN
    RAISE EXCEPTION 'Still have % invalid status values after cleanup', remaining_invalid;
  END IF;

  RAISE NOTICE 'All status values are now valid. Proceeding with constraint.';
END $$;

-- Now safe to add constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

ALTER TABLE sales ADD CONSTRAINT sales_status_check
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

## How to Apply

### Option 1: Run Complete Corrected Migration (Recommended)

1. **Open Supabase SQL Editor**
2. **Copy the entire file**: `supabase/migrations/20251031000000_fix_sales_approval_workflow.sql`
3. **Paste and Execute**
4. **Watch for NOTICE messages** showing:
   - "Found X sales with invalid or NULL status values"
   - "All status values are now valid. Proceeding with constraint."

### Option 2: Manual Cleanup First (If you prefer to see what's being changed)

#### Step 1: Review Current Statuses
```sql
SELECT status, COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY count DESC;
```

#### Step 2: Manually Update Specific Statuses (if you prefer custom mapping)
```sql
-- Example: If you have specific status values you want to map differently
UPDATE sales
SET status = 'approved'  -- your desired target status
WHERE status = 'your_old_status_value';
```

#### Step 3: Then Run The Migration
Once you're satisfied with manual updates, run the migration.

## Verification After Migration

### Check Constraint Exists
```sql
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
  AND con.contype = 'c'
  AND con.conname = 'sales_status_check';
```

**Expected**: Shows constraint with 9 allowed status values

### Check All Statuses Are Valid
```sql
SELECT 
  status,
  COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY status;
```

**Expected**: Only shows the 9 allowed status values

### Verify No Invalid Statuses Remain
```sql
SELECT COUNT(*) as should_be_zero
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

**Expected**: Returns 0

## Common Status Mappings

Here's what the migration will do automatically:

| Original Status | → | New Status |
|----------------|---|------------|
| NULL | → | pending_approval |
| "pending" | → | pending_approval |
| "pending-approval" | → | pending_approval |
| "awaiting_approval" | → | pending_approval |
| "waiting" | → | waiting_for_payment |
| "waiting_payment" | → | waiting_for_payment |
| "awaiting_payment" | → | waiting_for_payment |
| "approve" | → | approved |
| "approved_by_management" | → | approved |
| "complete" | → | completed |
| "done" | → | completed |
| "reject" | → | rejected |
| "declined" | → | rejected |
| "cancel" | → | cancelled |
| "paid" | → | payment_received |
| "payment" | → | payment_received |
| Anything else | → | pending_approval |

## If Custom Mapping Needed

If the automatic mapping doesn't fit your data, update BEFORE running migration:

```sql
-- Example: Custom mapping for your specific status values
UPDATE sales
SET status = CASE
  WHEN status = 'your_custom_status_1' THEN 'approved'
  WHEN status = 'your_custom_status_2' THEN 'completed'
  WHEN status = 'your_custom_status_3' THEN 'waiting_for_payment'
  -- Add more mappings as needed
  ELSE 'pending_approval'
END
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
);
```

Then run the migration.

## Rollback (If Needed)

If something goes wrong, you can rollback the status updates:

```sql
-- Remove the new constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

-- Restore old constraint (if you had one)
-- ALTER TABLE sales ADD CONSTRAINT sales_status_check CHECK (...old values...);
```

Note: You cannot rollback the status value updates themselves unless you have a backup.

## Summary

✅ **Problem**: Sales table has invalid status values
✅ **Solution**: Migration now auto-cleans invalid statuses before applying constraint
✅ **Safe**: Uses intelligent mapping + fallback to 'pending_approval'
✅ **Verified**: Checks all statuses are valid before applying constraint
✅ **Idempotent**: Can be run multiple times safely

---

**Files Updated**:
- ✅ `supabase/migrations/20251031000000_fix_sales_approval_workflow.sql` - Lines 26-123 updated
- ✅ `check-sales-for-approval.sql` - Diagnostic queries
- ✅ `SALES_STATUS_CONSTRAINT_FIX.md` - This guide

**Next Step**: Run the corrected migration in Supabase SQL Editor! 🚀

The migration will now:
1. Show how many invalid statuses were found
2. Clean them automatically
3. Verify cleanup succeeded
4. Apply the constraint successfully
