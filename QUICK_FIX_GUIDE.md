# 🔧 Quick Fix Guide - Apply Database Migrations

## Issues Fixed

1. ❌ **"Failed to schedule report"** → ✅ Report scheduling works
2. ❌ **"Storage bucket 'documents' does not exist"** → ✅ Document uploads work

## 5-Minute Fix (Recommended)

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Run the Migration

1. Open the file: `APPLY_ALL_MIGRATIONS.sql` in this project
2. Copy the ENTIRE contents (Ctrl+A, Ctrl+C)
3. Paste into the Supabase SQL Editor
4. Click **RUN** (or press Ctrl+Enter)
5. Wait for "Success" message (should take 5-10 seconds)

### Step 3: Verify Success

You should see these messages at the bottom:
```
✅ All migrations applied successfully!
✅ Report scheduling is now enabled
✅ Document uploads are now enabled
```

### Step 4: Test the Fixes

1. Refresh your Gold Shipper application
2. Go to `/reports` page
3. Click "Schedule Report" → Fill form → Click "Schedule Report"
4. Should succeed without error ✅
5. Go to batch creation page
6. Try uploading a document
7. Should succeed without "bucket does not exist" error ✅

## What the Migration Does

### Creates 2 Database Tables
- `scheduled_reports` - Stores report schedules
- `report_history` - Logs generated reports

### Creates 3 Storage Buckets
- `documents` - For batch documents (50MB max)
- `reports` - For generated PDFs/Excel (50MB max)
- `payment-proofs` - For payment receipts (50MB max)

### Sets Up Security
- Row Level Security (RLS) on all tables
- Proper access policies
- Management-only report scheduling
- Authenticated user document uploads

## Alternative: Individual Migration Files

If you prefer to run migrations separately:

### Migration 1: Reports System
File: `supabase/migrations/20251101120000_create_reports_system.sql`

### Migration 2: Storage Buckets
File: `supabase/migrations/20251101130000_create_storage_buckets.sql`

Run each in Supabase SQL Editor following the same steps above.

## Troubleshooting

### "relation already exists" errors?
This is normal if you run the migration twice. The script is idempotent.

### "permission denied" errors?
Make sure you're logged in to Supabase Dashboard as an admin.

### Still getting bucket errors?
1. Go to **Storage** in Supabase Dashboard
2. Check if `documents`, `reports`, `payment-proofs` buckets exist
3. If not, try running just the storage bucket migration again

### Report scheduling still fails?
1. Check if `scheduled_reports` table exists:
   ```sql
   SELECT * FROM scheduled_reports LIMIT 1;
   ```
2. If error, try running just the reports migration again

## Support Files

- `DATABASE_MIGRATION_GUIDE.md` - Detailed step-by-step guide
- `APPLY_ALL_MIGRATIONS.sql` - Combined migration script (use this!)
- `supabase/migrations/20251101120000_create_reports_system.sql` - Reports only
- `supabase/migrations/20251101130000_create_storage_buckets.sql` - Storage only

## After Migration

Everything should work:
- ✅ Report scheduling with email recipients
- ✅ Document uploads on batch creation
- ✅ Payment proof uploads
- ✅ PDF report generation
- ✅ Excel exports
- ✅ Report history tracking

---

**Time Required:** 5 minutes
**Difficulty:** Easy (just copy-paste-run)
**Impact:** Fixes both major issues
