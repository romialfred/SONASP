# Migration Fix - Audit Trail Syntax Error

## Problem

When running migration `20251031000000_fix_sales_approval_workflow.sql`, you encountered:

```
ERROR: 42601: syntax error at or near "NOT"
LINE 200: CREATE POLICY IF NOT EXISTS "Allow authenticated users to insert audit logs"
```

## Root Cause

**PostgreSQL does not support `IF NOT EXISTS` with `CREATE POLICY`**

This syntax is only supported for:
- CREATE TABLE IF NOT EXISTS
- CREATE INDEX IF NOT EXISTS
- CREATE SCHEMA IF NOT EXISTS

But **NOT** for:
- ❌ CREATE POLICY IF NOT EXISTS (doesn't exist)
- ❌ CREATE TRIGGER IF NOT EXISTS (doesn't exist)

## Fix Applied

Changed from:
```sql
CREATE POLICY IF NOT EXISTS "policy_name" ...
```

To:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ...
```

## Diagnostic Steps

### Step 1: Check Current Audit Table Status

Run this in Supabase SQL Editor:

```sql
-- Check which audit tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name LIKE '%audit%'
ORDER BY table_name;
```

**Expected Results**:
- You might see `audit_logs` (old schema)
- You might see `audit_trail` (new schema)
- Or neither if neither exists yet

### Step 2: Check Existing Policies on audit_trail (if exists)

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command,
  roles
FROM pg_policies
WHERE tablename = 'audit_trail'
ORDER BY policyname;
```

**Possible Results**:
- No rows = No policies exist yet (migration can proceed)
- Rows returned = Policies already exist (DROP will handle them)

### Step 3: Check PostgreSQL Version

```sql
SELECT version();
```

**All Supabase instances run PostgreSQL 15+**, which supports:
- ✅ DROP POLICY IF EXISTS (PostgreSQL 9.5+)
- ❌ CREATE POLICY IF NOT EXISTS (never added)

## Corrected Migration

The migration has been updated with the correct syntax:

```sql
-- ============================================
-- 6. Create audit_trail table if missing
-- ============================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  details jsonb,
  user_email text,
  created_at timestamptz DEFAULT now()
);

-- Create index for audit trail lookups
CREATE INDEX IF NOT EXISTS idx_audit_trail_record 
ON audit_trail(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_created 
ON audit_trail(created_at DESC);

-- Enable RLS on audit_trail
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_trail;
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_trail;

-- Policy to allow authenticated users to insert audit logs
CREATE POLICY "Allow authenticated users to insert audit logs"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy to allow authenticated users to view audit logs
CREATE POLICY "Allow authenticated users to view audit logs"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (true);
```

## How to Apply Corrected Migration

### Option 1: Run Complete Migration (Recommended)

1. **Open Supabase SQL Editor**
2. **Copy the entire corrected migration file**: `supabase/migrations/20251031000000_fix_sales_approval_workflow.sql`
3. **Paste and Execute**
4. **Check for success** - All sections should complete without errors

### Option 2: Run Section by Section

If you prefer to run step-by-step:

#### Section 1: Sales Status Constraint
```sql
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

#### Section 2: Add mechanism_type to sales
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'mechanism_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN mechanism_type text DEFAULT 'spot';
  END IF;
END $$;
```

#### Section 3: Add customer_approval_date
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_approval_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_approval_date timestamptz;
  END IF;
END $$;
```

#### Section 4: Virtual Payment Columns
```sql
-- is_virtual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'is_virtual'
  ) THEN
    ALTER TABLE payments ADD COLUMN is_virtual boolean DEFAULT false;
  END IF;
END $$;

-- payment_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type text;
  END IF;
END $$;

-- mechanism_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'mechanism_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN mechanism_type text;
  END IF;
END $$;

-- auto_credited_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'auto_credited_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN auto_credited_at timestamptz;
  END IF;
END $$;

-- virtual_due_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'virtual_due_date'
  ) THEN
    ALTER TABLE payments ADD COLUMN virtual_due_date date;
  END IF;
END $$;
```

#### Section 5: Create Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_payments_is_virtual 
ON payments(is_virtual) WHERE is_virtual = true;

CREATE INDEX IF NOT EXISTS idx_payments_virtual_due_date 
ON payments(virtual_due_date) WHERE virtual_due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

CREATE INDEX IF NOT EXISTS idx_sales_waiting_payment 
ON sales(status) WHERE status = 'waiting_for_payment';
```

#### Section 6: Audit Trail Table (CORRECTED)
```sql
CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  details jsonb,
  user_email text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_record 
ON audit_trail(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_created 
ON audit_trail(created_at DESC);

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_trail;
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_trail;

CREATE POLICY "Allow authenticated users to insert audit logs"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view audit logs"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (true);
```

#### Section 7: Trigger for customer_approval_date
```sql
CREATE OR REPLACE FUNCTION update_customer_approval_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('customer_approved', 'waiting_for_payment') 
     AND OLD.status NOT IN ('customer_approved', 'waiting_for_payment')
     AND NEW.customer_approval_date IS NULL THEN
    NEW.customer_approval_date = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_approval_date ON sales;

CREATE TRIGGER trigger_update_customer_approval_date
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_approval_date();
```

## Verification After Migration

Run these queries to confirm everything worked:

### 1. Check Sales Status Constraint
```sql
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
  AND con.contype = 'c'
  AND con.conname LIKE '%status%';
```

**Expected**: Shows constraint with 9 status values

### 2. Check Virtual Payment Columns
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('is_virtual', 'payment_type', 'mechanism_type', 'auto_credited_at', 'virtual_due_date')
ORDER BY column_name;
```

**Expected**: 5 rows returned

### 3. Check audit_trail Table and Policies
```sql
-- Check table exists
SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'audit_trail';

-- Check policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'audit_trail'
ORDER BY policyname;
```

**Expected**: 
- column_count = 7
- 2 policies (INSERT and SELECT)

### 4. Check Trigger
```sql
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_customer_approval_date';
```

**Expected**: 1 row showing BEFORE UPDATE trigger on sales

### 5. Test Audit Trail Insert
```sql
-- Test insert into audit_trail
INSERT INTO audit_trail (action, table_name, record_id, details, user_email)
VALUES ('test_action', 'sales', 'test-id-123', '{"test": true}'::jsonb, 'test@example.com')
RETURNING *;

-- Clean up test
DELETE FROM audit_trail WHERE record_id = 'test-id-123';
```

**Expected**: Insert succeeds, returns inserted row

## Common Issues and Solutions

### Issue 1: "relation audit_trail already exists"
**Cause**: Table was created in a previous run
**Solution**: Safe to ignore - `CREATE TABLE IF NOT EXISTS` handles this

### Issue 2: "policy already exists"
**Cause**: Policies were created in a previous run
**Solution**: Migration now uses `DROP POLICY IF EXISTS` first - should not occur

### Issue 3: "column already exists"
**Cause**: Columns were added in a previous run
**Solution**: Safe to ignore - `DO $$ IF NOT EXISTS` blocks handle this

### Issue 4: "trigger already exists"
**Cause**: Trigger was created in a previous run
**Solution**: Migration uses `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` - should not occur

## Summary

✅ **Problem**: `CREATE POLICY IF NOT EXISTS` syntax not supported
✅ **Solution**: Use `DROP POLICY IF EXISTS` then `CREATE POLICY`
✅ **Status**: Migration file corrected
✅ **Action**: Re-run the corrected migration

The corrected migration is now **idempotent** and can be run multiple times safely!

---

**Files Updated**:
- ✅ `/supabase/migrations/20251031000000_fix_sales_approval_workflow.sql` - Fixed line 200-209
- ✅ `MIGRATION_FIX_AUDIT_TRAIL.md` - This guide

**Next Step**: Run the corrected migration in Supabase SQL Editor ⚡
