# Migration Execution Guide

## Quick Start - Run These Migrations In Order

### **Step 1: Fix Database Schema** ⚠️ REQUIRED FIRST
```
File: 20251027100000_comprehensive_database_schema_fix.sql
```

**What it does:**
- ✅ Adds missing columns to `sales` table (sale_date, currency, total_amount, metal_type)
- ✅ Adds missing columns to `payments` table (payment_proof_url)
- ✅ Creates missing `payment_reminders` table
- ✅ Ensures `payment_documents` and `payment_history` tables exist
- ✅ Recreates views with correct column names
- ✅ Fixes all schema inconsistencies

**Status:** ✅ READY TO RUN (all syntax errors fixed)

---

### **Step 2: Clean Batch/Shipping/Refining Data** 🧹 OPTIONAL
```
File: 20251027110000_clean_batch_data.sql
```

**What it cleans:**
- All batches and batch history
- All receiving records
- All refining records
- All sales and related data
- All payments and related data
- All batch documents
- All quality checks and alerts
- Operational audit logs

**What it preserves:**
- ✅ User accounts and profiles
- ✅ Sites configuration
- ✅ Transport companies
- ✅ Refineries
- ✅ Customers (optional - can uncomment to clean)
- ✅ User permissions and roles
- ✅ System settings

**Status:** ✅ READY TO RUN

---

## Execution Instructions

### Option A: Run Both (Recommended for Fresh Start)

**In Supabase SQL Editor:**

1. **First, run the schema fix:**
   ```sql
   -- Copy and paste entire content of:
   -- 20251027100000_comprehensive_database_schema_fix.sql
   ```

2. **Then, run the data cleanup:**
   ```sql
   -- Copy and paste entire content of:
   -- 20251027110000_clean_batch_data.sql
   ```

### Option B: Only Fix Schema (Keep Your Data)

**In Supabase SQL Editor:**

```sql
-- Copy and paste entire content of:
-- 20251027100000_comprehensive_database_schema_fix.sql
```

---

## Expected Output

### From Schema Fix Migration:

```
STEP 1: Fixing SALES table structure...
  ✓ Added sale_date column
  ✓ Added currency column
  ✓ Added total_amount column
  ✓ Added metal_type column

STEP 2: Fixing PAYMENTS table structure...
  ✓ Added payment_proof_url column

STEP 3: Ensuring PAYMENT_REMINDERS table exists...
  ✓ Created payment_reminders table with indexes and RLS

STEP 4: Ensuring PAYMENT_DOCUMENTS table exists...
  ✓ payment_documents table already exists

STEP 5: Ensuring PAYMENT_HISTORY table exists...
  ✓ payment_history table already exists

STEP 6: Recreating PAYMENTS_WITH_DETAILS view...
  ✓ Recreated payments_with_details view

STEP 7: Recreating PAYMENT_ANALYTICS view...
  ✓ Recreated payment_analytics view

========================================
DATABASE SCHEMA FIX COMPLETED!
========================================
```

### From Batch Cleanup Migration:

```
========================================
CLEANING BATCH-RELATED DATA
========================================

STEP 1: Cleaning sales-related data...
  ✓ Deleted X sales allocations
  ✓ Deleted X sales line items
  ...

STEP 2: Cleaning payment data...
  ✓ Deleted X payment reminders
  ✓ Deleted X payment documents
  ...

STEP 3: Cleaning sales data...
  ✓ Deleted X sales records

STEP 4: Cleaning batch enhancement data...
  ✓ Deleted X batch tags
  ...

STEP 5: Cleaning core batch data...
  ✓ Deleted X batch documents
  ✓ Deleted X refining records
  ✓ Deleted X receiving records
  ✓ Deleted X batches

STEP 6: Cleaning audit and system logs...
  ✓ Deleted X operational audit log entries

========================================
BATCH DATA CLEANUP COMPLETED!
========================================
```

---

## Verification Checklist

After running migrations, verify:

- [ ] No SQL errors appeared during execution
- [ ] You can log in to the application
- [ ] No console errors related to missing columns
- [ ] Dashboard page loads without errors
- [ ] You can navigate to different pages

### Test These Views Work:
```sql
-- Should return results without errors
SELECT * FROM payments_with_details LIMIT 1;
SELECT * FROM payment_analytics LIMIT 1;
```

### Check Tables Were Created:
```sql
-- Should return true for all
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_reminders');
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_documents');
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_history');
```

### Check Columns Were Added:
```sql
-- Should return true for all
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'sale_date');
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'currency');
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'total_amount');
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_proof_url');
```

---

## Troubleshooting

### If You Get "Column Already Exists" Errors
This is SAFE - the migration uses `IF NOT EXISTS` checks. The migration will skip adding columns that already exist.

### If You Get "Table Already Exists" Errors
This is SAFE - the migration checks for table existence before creating. It will skip creating tables that already exist.

### If You Get "View Already Exists" Errors
This is SAFE - the migration uses `DROP VIEW IF EXISTS` before recreating views.

### If You Get Foreign Key Errors
Run the schema fix migration FIRST, then the cleanup migration SECOND. The order matters!

---

## Next Steps After Migration

1. **Test Your Application**
   - Log in
   - Navigate through all pages
   - Check for console errors

2. **Create Your First Real Data**
   - Create a batch
   - Add a customer
   - Process a shipment
   - Create a sale

3. **Monitor for Issues**
   - Watch browser console for errors
   - Check Supabase logs for database errors
   - Report any issues found

---

## Support Files

- **DATABASE_SCHEMA_ANALYSIS.md** - Complete documentation of database structure
- **20251027100000_comprehensive_database_schema_fix.sql** - Schema fix migration
- **20251027110000_clean_batch_data.sql** - Data cleanup migration

---

## Summary

✅ **Schema Fix Migration** - Fixes all column/table mismatches (REQUIRED)
✅ **Batch Cleanup Migration** - Removes all operational data (OPTIONAL)
✅ **Both migrations are syntax-error-free and ready to run**
✅ **Detailed logging shows exactly what changes**
✅ **Safe to run - uses IF EXISTS/IF NOT EXISTS checks**

**You're ready to go!** 🚀
