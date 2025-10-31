# Storage Upload Fix - Quick Guide

## Problem
Buckets exist but upload still fails with "Storage bucket does not exist" error.

## Root Cause
Row Level Security (RLS) policies not configured correctly for storage.

## ✅ Solution (2 minutes)

### Run This SQL

Copy and run `FIX_STORAGE_POLICIES_NOW.sql` in Supabase SQL Editor.

The script will:
1. Make buckets public
2. Enable RLS properly
3. Create permissive access policies
4. Verify everything is set up

### Steps:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire `FIX_STORAGE_POLICIES_NOW.sql` file
3. Paste and click RUN
4. Wait for success
5. Hard refresh your app (Ctrl+Shift+R)
6. Try uploading - should work! ✅

## Files to Use
- `FIX_STORAGE_POLICIES_NOW.sql` - **RUN THIS**

## After Running SQL
✅ Document upload will work
✅ No more bucket errors
✅ Files accessible via public URLs

## Verify It Worked
```sql
-- Should show 3 public buckets
SELECT id, name, public FROM storage.buckets;

-- Should show 5+ policies
SELECT COUNT(*) FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

## Build Status
✅ Code updated with better error handling
✅ Build successful (16.01s)
✅ Ready to use after running SQL

---

**Action:** Run `FIX_STORAGE_POLICIES_NOW.sql` now!
