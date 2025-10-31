# Fix "Policy Already Exists" Error

## The Error You Saw

```
ERROR: 42710: policy "Management can view all scheduled reports"
for table "scheduled_reports" already exists
```

## Why This Happened

You ran the individual migration file `20251101120000_create_reports_system.sql` **before** it was fixed. That created the policies with the **wrong** column name (`user_id` instead of `id`), and now they exist in your database.

## ✅ The Solution

The good news: The **combined** migration file `APPLY_ALL_MIGRATIONS.sql` is already designed to handle this!

### Quick Fix (30 seconds):

1. **Just run APPLY_ALL_MIGRATIONS.sql**
   - It already includes `DROP POLICY IF EXISTS` statements
   - These will remove the old (broken) policies
   - Then create new (fixed) policies with correct column names

2. **Steps:**
   - Open Supabase Dashboard → SQL Editor
   - Copy ALL contents from `APPLY_ALL_MIGRATIONS.sql`
   - Paste and click RUN
   - It will:
     - ✅ Drop existing policies (the broken ones)
     - ✅ Create tables (if not exists - safe)
     - ✅ Create new policies (with correct user_profiles.id)
     - ✅ Create storage buckets

## Alternative: Clean First, Then Apply

If you prefer to clean up manually first:

### Option A: Run Cleanup Script First

1. Run `CLEAN_AND_REAPPLY_MIGRATION.sql` first
   - This drops all policies

2. Then run `APPLY_ALL_MIGRATIONS.sql`
   - This creates everything fresh

### Option B: Drop Policies Manually

```sql
-- Copy and run these in SQL Editor:
DROP POLICY IF EXISTS "Management can view all scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can create scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can update scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can delete scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Authenticated users can view report history" ON report_history;
DROP POLICY IF EXISTS "Authenticated users can create report history entries" ON report_history;
DROP POLICY IF EXISTS "Users can update their own report history entries" ON report_history;
```

Then run `APPLY_ALL_MIGRATIONS.sql`

## Recommended Approach

**Just run APPLY_ALL_MIGRATIONS.sql** - it's designed to be idempotent (safe to run multiple times).

The file contains:
```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Management can view all scheduled reports" ON scheduled_reports;
-- ... (all other policies)

-- Then create new ones
CREATE POLICY "Management can view all scheduled reports"
  ON scheduled_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()  -- ✅ FIXED!
      AND user_profiles.role = 'management'
    )
  );
```

## What Will Happen

1. **Existing policies dropped** ✅
   - Old broken policies removed

2. **Tables remain unchanged** ✅
   - `CREATE TABLE IF NOT EXISTS` means safe

3. **New policies created** ✅
   - With correct `user_profiles.id` reference

4. **Storage buckets created** ✅
   - If they don't exist yet

## Verification After Running

Test that policies work:

```sql
-- This should work now (no error about user_id):
SELECT EXISTS (
  SELECT 1 FROM user_profiles
  WHERE user_profiles.id = auth.uid()
  AND user_profiles.role = 'management'
);
```

## Summary

- ❌ Don't run individual migration files again
- ✅ Just run `APPLY_ALL_MIGRATIONS.sql`
- ✅ It handles cleanup automatically
- ✅ Safe to run multiple times
- ✅ Will fix all column name issues

**Time needed:** 30 seconds
**Result:** All policies fixed with correct column names!
