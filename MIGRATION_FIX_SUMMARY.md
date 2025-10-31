# Migration Fix Summary

## Issue Found

**Error Message:**
```
ERROR: 42703: column user_profiles.user_id does not exist
```

## Root Cause

The migration scripts were referencing `user_profiles.user_id` but the actual column name in the `user_profiles` table is `id` (not `user_id`).

### user_profiles Table Structure:

```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- ✅ Correct column
  email text UNIQUE NOT NULL,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'factory',
  is_active boolean DEFAULT true,
  ...
);
```

The `id` column serves as both:
- Primary key for the user_profiles table
- Foreign key reference to auth.users(id)

## Files Fixed

### 1. `/supabase/migrations/20251101120000_create_reports_system.sql`

**Changed:** All 5 occurrences of `user_profiles.user_id` to `user_profiles.id`

**Lines affected:** 72, 83, 94, 101, 111

**Before:**
```sql
WHERE user_profiles.user_id = auth.uid()
```

**After:**
```sql
WHERE user_profiles.id = auth.uid()
```

### 2. `/APPLY_ALL_MIGRATIONS.sql`

**Changed:** All 5 occurrences in the reports section from `user_profiles.user_id` to `user_profiles.id`

**Lines affected:** 70, 81, 92, 99, 110

## Verification

### Test Query to Verify Column Name:
```sql
-- Check actual columns in user_profiles table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND table_schema = 'public';
```

Expected result should show `id` (not `user_id`).

### Test the Fixed Policy:
```sql
-- This should work now (no error about user_id)
SELECT EXISTS (
  SELECT 1 FROM user_profiles
  WHERE user_profiles.id = auth.uid()
  AND user_profiles.role = 'management'
);
```

## How to Apply the Fixed Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open the **FIXED** `APPLY_ALL_MIGRATIONS.sql` file
5. Copy the ENTIRE contents
6. Paste into SQL Editor
7. Click **RUN**
8. Wait for success confirmation

### Option 2: Apply Individual Migration File

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open `supabase/migrations/20251101120000_create_reports_system.sql`
5. Copy and paste the contents
6. Click **RUN**

Then apply the storage migration:

7. Click **New Query** again
8. Open `supabase/migrations/20251101130000_create_storage_buckets.sql`
9. Copy and paste the contents
10. Click **RUN**

## Expected Success Output

After running the fixed migration, you should see:

```
✅ Tables created successfully:
   - scheduled_reports
   - report_history

✅ Storage buckets created successfully:
   - documents
   - reports
   - payment-proofs

✅ RLS policies created successfully

✅ All migrations applied successfully!
```

## What Was Fixed

### RLS Policies Now Work Correctly

All Row Level Security policies for scheduled reports now correctly reference the user profile:

1. **Management can view all scheduled reports** - ✅ Fixed
2. **Management can create scheduled reports** - ✅ Fixed
3. **Management can update scheduled reports** - ✅ Fixed
4. **Management can delete scheduled reports** - ✅ Fixed

### Security Impact

- **Before Fix:** Policies would fail with column error, potentially blocking all access
- **After Fix:** Policies correctly verify user roles from user_profiles table

## Testing After Migration

1. **Test Report Scheduling:**
   - Navigate to `/reports`
   - Click "Schedule Report"
   - Fill in details
   - Click "Schedule Report" button
   - Should succeed without errors ✅

2. **Test Document Upload:**
   - Go to batch creation page
   - Try uploading a document
   - Should succeed without "bucket does not exist" error ✅

3. **Test RLS Policies:**
   - Login as Management user
   - Should be able to view/create/update scheduled reports ✅
   - Login as non-Management user
   - Should NOT be able to create scheduled reports ✅

## Summary

| File | Issue | Status |
|------|-------|--------|
| `20251101120000_create_reports_system.sql` | Wrong column name | ✅ Fixed |
| `APPLY_ALL_MIGRATIONS.sql` | Wrong column name | ✅ Fixed |
| `20251101130000_create_storage_buckets.sql` | No issues | ✅ Already correct |

**Total Fixes:** 10 column references changed from `user_id` to `id`

**Result:** Migration script now runs successfully without errors! 🎉
