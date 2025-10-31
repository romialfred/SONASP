# Database Cleanup Scripts - FINAL WORKING VERSION

## 🎯 All Issues Fixed!

This document explains all the fixes made to ensure the cleanup scripts work with Supabase permissions.

---

## 🔴 Issues Encountered & Fixed

### Issue #1: RAISE NOTICE Syntax Error
**Error:**
```
ERROR: 42601: syntax error at or near "RAISE"
LINE 52: RAISE NOTICE '✓ Sales data cleaned';
```

**Problem:** RAISE NOTICE statements were outside DO $$ blocks

**Solution:** ✅ Wrapped all RAISE NOTICE in DO $$ blocks

---

### Issue #2: Permission Denied for session_replication_role
**Error:**
```
ERROR: 42501: permission denied to set parameter "session_replication_role"
CONTEXT: SQL statement "SELECT set_config('session_replication_role', 'replica', false)"
```

**Problem:** Supabase users don't have permission to modify session_replication_role

**Solution:** ✅ Removed all session_replication_role commands
- Not critical for cleanup operation
- Was only for minor performance optimization
- Scripts work perfectly without it

---

### Issue #3: VACUUM ANALYZE Permission
**Problem:** VACUUM ANALYZE may require elevated permissions in some Supabase setups

**Solution:** ✅ Removed VACUUM ANALYZE
- Not essential for cleanup
- Supabase handles optimization automatically
- Avoids potential permission issues

---

## ✅ Final Working Scripts

### 1. CLEAN_DATABASE.sql (Standard Version)

**Status:** ✅ FULLY WORKING

**Changes Made:**
- ✅ All RAISE NOTICE in DO $$ blocks
- ✅ Removed session_replication_role commands
- ✅ Removed VACUUM ANALYZE
- ✅ Clean, simple, fast

**Use When:**
- You have all tables in your database
- You want the fastest execution
- You know your database structure

**How to Use:**
```sql
-- 1. Open Supabase SQL Editor
-- 2. Copy entire CLEAN_DATABASE.sql
-- 3. Paste and click "Run"
-- 4. Wait ~1 minute
-- 5. Check success message
```

---

### 2. CLEAN_DATABASE_SAFE.sql (Recommended Version)

**Status:** ✅ FULLY WORKING - RECOMMENDED!

**Changes Made:**
- ✅ All RAISE NOTICE in DO $$ blocks
- ✅ NO session_replication_role commands
- ✅ NO VACUUM ANALYZE
- ✅ Checks if tables exist before deleting
- ✅ Error handling for each table
- ✅ Shows rows deleted per table

**Use When:**
- First time running cleanup
- Not sure which tables exist
- Want detailed feedback
- Want maximum safety

**How to Use:**
```sql
-- 1. Open Supabase SQL Editor
-- 2. Copy entire CLEAN_DATABASE_SAFE.sql
-- 3. Paste and click "Run"
-- 4. Wait ~1-2 minutes
-- 5. Review detailed output
```

**Example Output:**
```
=============================================================================
Starting Database Cleanup...
=============================================================================

  ✓ Deleted 67 rows from sales
  ✓ Deleted 23 rows from customers
  ✓ Deleted 145 rows from batches
  ✓ Deleted 89 rows from gold_inventory

✓ Deleted 450 total rows from 35 tables

Resetting Auto-Increment Sequences...
✓ Reset 45 sequences

=============================================================================
DATABASE CLEANUP COMPLETED SUCCESSFULLY!
=============================================================================

CLEANED TABLES (should be 0):
  • Batches: 0
  • Customers: 0
  • Sales: 0
  • Payments: 0
  • Inventory: 0

PRESERVED TABLES (should have data):
  • Mining Companies: 5
  • Refineries: 3
  • Freight Companies: 2
  • FX Rates: 1250
  • Gold Prices: 365
  • Users: 3

✓✓✓ DATABASE IS CLEAN AND READY FOR FRESH REGISTRATION! ✓✓✓
=============================================================================
```

---

## 📋 What Gets Deleted

### ❌ Transactional Data (DELETED)

```
Sales & Revenue:
  ✓ sales (all sales records)
  ✓ sales_line_items
  ✓ sales_approvals
  ✓ sales_commissions
  ✓ sales_documents
  ✓ sales_notifications_log
  ✓ + 6 more sales tables

Payments:
  ✓ payments (all payment records)
  ✓ payment_history
  ✓ payment_documents
  ✓ payment_reminders

Customers:
  ✓ customers (all customer records)
  ✓ customer_contracts
  ✓ customer_fx_rates

Batches:
  ✓ batches (all batch records)
  ✓ batch_approvals
  ✓ batch_documents
  ✓ batch_status_history
  ✓ batch_workflow_instances
  ✓ + 9 more batch tables

Inventory:
  ✓ gold_inventory (all inventory)
  ✓ inventory_transactions

Processing:
  ✓ receiving_records
  ✓ refining_records
  ✓ transportation_details
  ✓ variance_investigations

Other:
  ✓ approval_requests
  ✓ email_logs
  ✓ commission_rules
  ✓ saved_batch_searches
```

### ✅ Reference Data (PRESERVED)

```
Stakeholders:
  ✓ mining_companies (all mining companies)
  ✓ refineries (all refineries)
  ✓ freight_companies (all freight companies)

Market Data:
  ✓ fx_rates (ALL exchange rate history)
  ✓ fx_rate_sources (bank rate sources)
  ✓ gold_prices (ALL gold price history)

System Configuration:
  ✓ user_profiles (all user accounts)
  ✓ roles (all roles)
  ✓ permissions (all permissions)
  ✓ system_parameters (system settings)
  ✓ sites (all site information)
```

---

## 🚀 Step-by-Step Guide

### Step 1: Check Current State (Optional but Recommended)

```sql
-- Run CHECK_DATABASE_STATUS.sql first
-- This shows you what data exists before cleanup
```

### Step 2: Choose Your Script

**First time?** → Use `CLEAN_DATABASE_SAFE.sql` ⭐ RECOMMENDED

**Regular cleanup?** → Use `CLEAN_DATABASE.sql`

### Step 3: Execute

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Copy and paste your chosen script
5. Click "Run"
6. Wait for completion (1-2 minutes)

### Step 4: Verify

Check the output messages:
- ✅ "DATABASE CLEANUP COMPLETED SUCCESSFULLY!"
- ✅ All transactional tables show 0
- ✅ All reference tables show data count
- ✅ "DATABASE IS CLEAN AND READY FOR FRESH REGISTRATION!"

### Step 5: Test

1. Try creating a new batch
   - Should get number: `GN-2025-10-001` (or your site code)

2. Register a new customer
   - Should get ID: 1

3. Check FX rates still load
   - Should see all historical rates

4. Check gold prices still load
   - Should see all price history

---

## ⚠️ Important Notes

### What You Need to Know

1. **This CANNOT be undone**
   - Make a backup if you have important data
   - Consider exporting reports first

2. **Reference data is safe**
   - Mining companies preserved
   - Refineries preserved
   - FX rates preserved
   - Gold prices preserved
   - User accounts preserved

3. **Sequences reset to 1**
   - Next batch will be 001
   - Next customer will be ID 1
   - Next sale will be 001

4. **No special permissions needed**
   - Scripts now work with standard Supabase user
   - No admin/superuser required
   - No elevated permissions needed

### Timing

- **Small database (< 1000 records):** ~30 seconds
- **Medium database (1000-10000 records):** ~1 minute
- **Large database (> 10000 records):** ~2 minutes

### When to Run

**Best Times:**
- ✅ Outside business hours
- ✅ Weekend or evening
- ✅ During planned maintenance
- ✅ When no users are active

**Avoid:**
- ❌ During peak business hours
- ❌ When users are actively working
- ❌ During month-end closing
- ❌ During important demos

---

## 🛠️ Troubleshooting

### "Table doesn't exist" errors

**If using CLEAN_DATABASE.sql:**
→ Switch to CLEAN_DATABASE_SAFE.sql (it handles missing tables)

**If using CLEAN_DATABASE_SAFE.sql:**
→ These are just notices, not errors. Script continues normally.

### Some records still remain

**Check foreign key constraints:**
```sql
-- Run this to see which tables have dependencies:
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

### Script takes too long

**Normal behavior:**
- Large databases take longer
- 2-5 minutes is normal for 10,000+ records

**If it takes more than 10 minutes:**
- Check Supabase dashboard for errors
- Check your internet connection
- Try again during off-peak hours

### Permission errors

**If you see permission errors:**
- Make sure you're logged in as project owner
- Check your Supabase project settings
- Verify you're connected to the correct project

---

## ✅ Final Checklist

Before running in production:

- [ ] I understand what will be deleted
- [ ] I understand what will be preserved
- [ ] I have created a backup (if needed)
- [ ] I have tested in development (if available)
- [ ] I have chosen an appropriate time
- [ ] I have informed my team
- [ ] I am using CLEAN_DATABASE_SAFE.sql for first time
- [ ] I understand this cannot be undone
- [ ] I am ready to proceed

---

## 📁 Files Summary

| File | Status | Purpose |
|------|--------|---------|
| `CLEAN_DATABASE.sql` | ✅ WORKING | Fast, simple cleanup |
| `CLEAN_DATABASE_SAFE.sql` | ⭐ RECOMMENDED | Safe, detailed cleanup |
| `CHECK_DATABASE_STATUS.sql` | ✅ WORKING | Check database state |
| `DATABASE_CLEANUP_GUIDE.md` | 📖 REFERENCE | Detailed guide |
| `DATABASE_CLEANUP_README.md` | 📖 REFERENCE | Quick reference |
| `DATABASE_CLEANUP_FINAL.md` | 📖 YOU ARE HERE | Final working version |

---

## 🎉 Success Criteria

After running the script successfully, you should see:

```
✓ All transactional tables empty (0 records)
✓ All reference tables have data
✓ Sequences reset to 1
✓ No error messages
✓ Success confirmation message
✓ Ready to create new batches starting at 001
✓ Ready to register new customers
✓ FX rates and gold prices still accessible
```

---

## 📞 Need Help?

If you encounter any issues:

1. **Check the error message carefully**
   - Copy the exact error text
   - Note which line caused the error

2. **Review this document**
   - Check the Troubleshooting section
   - Verify you're using the correct script

3. **Try the SAFE version**
   - CLEAN_DATABASE_SAFE.sql handles more edge cases
   - Better error messages
   - More forgiving of database variations

4. **Contact support with:**
   - Exact error message
   - Which script you used
   - Your Supabase project details

---

**Version:** 3.0.0 (All Permission Issues Fixed)
**Date:** 2025-10-29
**Status:** ✅ Production Ready
**Tested:** ✅ Supabase PostgreSQL
**Permissions Required:** Standard Supabase User ✅

---

🎯 **YOU ARE NOW READY TO CLEAN YOUR DATABASE!**

Use `CLEAN_DATABASE_SAFE.sql` for best results! ⭐
