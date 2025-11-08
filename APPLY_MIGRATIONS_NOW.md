# Apply License Migrations - Quick Guide

## ✅ Files Ready to Apply

Both migration files have been corrected and are ready to execute in your Supabase SQL Editor.

---

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **"New query"**

---

## Step 2: Apply Migration #1 (Core License System)

1. Open this file in your code editor:
   ```
   supabase/migrations/20251108000000_create_export_license_system.sql
   ```

2. **Copy the ENTIRE file contents** (727 lines)

3. **Paste into Supabase SQL Editor**

4. Click **"Run"** (or press Ctrl+Enter / Cmd+Enter)

5. Wait for success message

**What this creates:**
- `license_requests` table
- `license_request_documents` table
- `licenses` table
- `license_quota_transactions` table
- `license_events` table
- `license_kpi_thresholds` table
- All enums (license_status, license_request_status, etc.)
- All triggers and functions
- RLS policies for security
- Adds `license_id` column to batches table

---

## Step 3: Apply Migration #2 (Sample Data)

1. Open this file in your code editor:
   ```
   supabase/migrations/20251108100000_seed_license_sample_data.sql
   ```

2. **Copy the ENTIRE file contents** (227 lines)

3. **Paste into Supabase SQL Editor** (new query or clear previous)

4. Click **"Run"**

5. Wait for success message

**What this creates:**
- 10 sample licenses (LIC-2024-0001 to LIC-2024-0010)
- License events for audit trail
- Quota transactions showing consumption
- 5 sample license requests
- Links existing batches to licenses

---

## Step 4: Verify Success

Run this verification query:

```sql
-- Check license count
SELECT COUNT(*) as total_licenses FROM licenses;
-- Should return 10

-- View sample licenses
SELECT
  license_number,
  status,
  issue_date,
  expiry_date,
  ROUND(authorized_qty_oz::numeric, 2) as authorized_oz,
  ROUND(consumed_qty_oz::numeric, 2) as consumed_oz,
  ROUND(remaining_qty_oz::numeric, 2) as remaining_oz,
  days_to_expiry
FROM licenses
WHERE license_number LIKE 'LIC-2024-%'
ORDER BY created_at;

-- Check batches linked to licenses
SELECT
  l.license_number,
  COUNT(b.id) as batch_count
FROM licenses l
LEFT JOIN batches b ON b.license_id = l.id
WHERE l.license_number LIKE 'LIC-2024-%'
GROUP BY l.license_number
ORDER BY l.license_number;
```

---

## Step 5: Access License Management

1. Go to your application
2. Click **"License Management"** in the sidebar
3. You should see:
   - 10 licenses listed
   - KPI tiles at the top
   - Traffic light indicators
4. Click any license to see:
   - **Associated Batches** tab (NEW!)
   - Quota Transactions tab
   - Audit Trail tab

---

## Troubleshooting

### If migration fails with "relation already exists":
- The table was already created
- Skip to next migration or check what's missing

### If you see "permission denied":
- Make sure you're logged in as database owner
- Check you're in the correct project

### If sample data doesn't appear:
1. Check if migration #1 completed successfully
2. Verify you have mining companies in the database:
   ```sql
   SELECT COUNT(*) FROM mining_companies;
   ```
3. If no mining companies exist, the sample data won't insert

### If "License Not Found" error in UI:
1. Check your user role:
   ```sql
   SELECT id, email, role FROM user_profiles WHERE id = auth.uid();
   ```
2. Make sure you have 'management' or 'factory' role

---

## What's New

### ✅ Enhanced License Details Page
- **New "Associated Batches" tab** shows all batches using each license
- Complete batch information: number, date, status, weight, mining company
- Quick navigation to batch details
- Batch count shown in tab label

### ✅ Sample Data
- 10 licenses spanning 8 months (April-November 2024)
- 5 EXPIRED, 3 ACTIVE, 2 REGISTERED
- Realistic consumption patterns (0% to 96% used)
- Traffic light indicators (RED, YELLOW, GREEN, GRAY)
- Complete audit trail and events

### ✅ Database Structure
- Proper schema with all relationships
- Row Level Security enabled
- Automatic status updates via triggers
- Quota tracking with audit trail

---

## Build Status

✅ **Project builds successfully**
- No TypeScript errors
- All imports resolved
- Production ready

---

## Need Help?

If you encounter any issues:

1. Check browser console for JavaScript errors
2. Check Supabase logs for database errors
3. Verify migrations were applied in correct order
4. Make sure your user has the correct role

---

## Files Location

```
supabase/migrations/
├── 20251108000000_create_export_license_system.sql   ← Apply FIRST
└── 20251108100000_seed_license_sample_data.sql       ← Apply SECOND

Documentation/
├── MIGRATIONS_EXECUTION_ORDER.md   ← Complete list of all 20 migrations
├── APPLY_LICENSE_MIGRATIONS.md      ← Detailed migration guide
└── LICENSE_SYSTEM_READY.md          ← Implementation summary
```

---

## Success Indicators

After applying both migrations, you should see:

✅ 10 licenses in License Management page
✅ KPI tiles showing license counts
✅ Traffic light colors on each license
✅ License details page with 3 tabs
✅ Associated batches showing in first tab
✅ Quota transactions with history
✅ Audit trail with events

---

**Ready to apply? Start with Step 1 above!**
