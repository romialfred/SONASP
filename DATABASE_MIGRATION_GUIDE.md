# Database Migration Guide

## Required Migrations for Full Functionality

To ensure all features work correctly, you need to apply two new migrations to your Supabase database.

## Migration 1: Reports System (REQUIRED)

**File:** `supabase/migrations/20251101120000_create_reports_system.sql`

This migration creates the necessary tables and functions for the Reports module:
- `scheduled_reports` table
- `report_history` table
- Row Level Security policies
- Automatic scheduling functions

### How to Apply

#### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20251101120000_create_reports_system.sql`
5. Paste into the SQL Editor
6. Click **Run** button
7. Verify success message appears

#### Option 2: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push

# Or apply specific migration
supabase migration up --include-all
```

### Verification

After applying, run this query to verify tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('scheduled_reports', 'report_history');
```

You should see both tables listed.

## Migration 2: Storage Buckets (REQUIRED)

**File:** `supabase/migrations/20251101130000_create_storage_buckets.sql`

This migration creates the storage buckets needed for:
- Document uploads on batch creation
- Report file storage
- Payment proof uploads

### Buckets Created

1. **documents** - For batch documents, receipts, general files
   - Max file size: 50MB
   - Allowed types: PDF, JPG, PNG, XLSX, CSV

2. **reports** - For generated report files
   - Max file size: 50MB
   - Allowed types: PDF, XLSX

3. **payment-proofs** - For payment proof documents
   - Max file size: 50MB
   - Allowed types: PDF, JPG, PNG

### How to Apply

#### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20251101130000_create_storage_buckets.sql`
5. Paste into the SQL Editor
6. Click **Run** button
7. Verify success message appears

#### Option 2: Manual Bucket Creation (Alternative)

If SQL approach fails, you can create buckets manually:

1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Create each bucket with these settings:

**For "documents" bucket:**
- Name: `documents`
- Public: Off (unchecked)
- File size limit: 52428800 (50MB)
- Allowed MIME types:
  - application/pdf
  - image/jpeg
  - image/png
  - image/jpg
  - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - application/vnd.ms-excel
  - text/csv

**For "reports" bucket:**
- Name: `reports`
- Public: Off (unchecked)
- File size limit: 52428800 (50MB)
- Allowed MIME types:
  - application/pdf
  - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

**For "payment-proofs" bucket:**
- Name: `payment-proofs`
- Public: Off (unchecked)
- File size limit: 52428800 (50MB)
- Allowed MIME types:
  - application/pdf
  - image/jpeg
  - image/png
  - image/jpg

4. After creating buckets, go to **Storage** > **Policies**
5. For each bucket, add these policies:

**Upload Policy:**
- Policy name: "Allow authenticated uploads"
- Target roles: authenticated
- Policy definition: `bucket_id = 'BUCKET_NAME'`
- Allowed operation: INSERT

**Select Policy:**
- Policy name: "Allow authenticated select"
- Target roles: authenticated
- Policy definition: `bucket_id = 'BUCKET_NAME'`
- Allowed operation: SELECT

### Verification

After applying, verify buckets exist:

1. Go to **Storage** in Supabase Dashboard
2. You should see three buckets: `documents`, `reports`, `payment-proofs`
3. Check that RLS is enabled for each bucket

Or run this query:

```sql
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('documents', 'reports', 'payment-proofs');
```

## Quick Fix Steps

### For "Failed to schedule report" Error

1. Apply **Migration 1** (Reports System) as described above
2. Refresh your application
3. Try scheduling a report again

### For "Storage bucket 'documents' does not exist" Error

1. Apply **Migration 2** (Storage Buckets) as described above
2. Refresh your application
3. Try uploading a document on batch creation

## Troubleshooting

### Migration Already Applied?

If you get errors about objects already existing:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check if buckets exist
SELECT * FROM storage.buckets;
```

### Permission Errors?

Make sure you're running migrations with database admin privileges. In Supabase Dashboard SQL Editor, you automatically have the necessary permissions.

### RLS Errors?

If you get Row Level Security errors after migration:

```sql
-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

## Post-Migration Verification Checklist

After applying both migrations, verify these features work:

- [ ] Navigate to `/reports` page
- [ ] Click "Schedule Report" button
- [ ] Fill in schedule details and click "Schedule Report"
- [ ] Verify no error appears
- [ ] Check "Scheduled Reports" section shows your new schedule
- [ ] Navigate to batch creation page
- [ ] Try uploading a document
- [ ] Verify upload succeeds without "bucket does not exist" error

## Support

If you encounter issues:

1. Check Supabase Dashboard logs (Database > Logs)
2. Verify your `.env` file has correct Supabase credentials
3. Ensure your Supabase project is on a paid plan (if required for storage)
4. Check that RLS policies don't conflict with existing policies

## Summary

**Must Apply:**
1. `20251101120000_create_reports_system.sql` - For report scheduling
2. `20251101130000_create_storage_buckets.sql` - For document uploads

**Expected Result:**
- Report scheduling works without errors
- Document uploads succeed on batch creation
- All storage features functional

**Time Required:** 5-10 minutes for both migrations
