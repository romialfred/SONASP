# Database Cleanup Guide - Gold Shipper

## Overview

This guide explains how to clean your Gold Shipper database to start fresh with new registrations while preserving important reference data.

## What Will Be Deleted

### ✅ Transactional Data (WILL BE DELETED)

1. **Batches**
   - All batch records
   - Batch approvals and status history
   - Batch documents and quality checks
   - Batch workflow instances
   - Batch alerts and analytics

2. **Inventory**
   - All gold inventory records
   - All inventory transactions

3. **Sales**
   - All sales records
   - Sales line items and allocations
   - Sales approvals and documents
   - Sales commissions and notifications
   - Pricing details and recommendations

4. **Payments**
   - All payment records
   - Payment history and documents
   - Payment reminders

5. **Customers**
   - All customer records
   - Customer contracts
   - Customer-specific FX rates

6. **Processing Records**
   - Receiving records
   - Refining records
   - Transportation details
   - Variance investigations

7. **Other Data**
   - Approval requests
   - Email logs
   - Commission rules
   - Saved searches

### ✅ Reference Data (WILL BE PRESERVED)

1. **Stakeholders**
   - Mining Companies
   - Refineries
   - Freight/Transport Companies

2. **Market Data**
   - FX Rates (all exchange rate history)
   - FX Rate Sources (bank configurations)
   - Gold Prices (all price history)

3. **System Configuration**
   - User accounts and profiles
   - Roles and permissions
   - System parameters
   - Site information

## How to Execute the Cleanup

### Method 1: Using Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to SQL Editor

2. **Open the Cleanup Script**
   - Click "New Query"
   - Copy the contents of `CLEAN_DATABASE.sql`
   - Paste into the SQL Editor

3. **Review Before Running**
   - Read through the script
   - Understand what will be deleted
   - Make a backup if needed (optional)

4. **Execute the Script**
   - Click the "Run" button
   - Wait for completion (may take 1-2 minutes)
   - Check the output messages

5. **Verify Results**
   - The script will show a summary
   - Verify that cleaned tables show 0 records
   - Verify that preserved tables still have data

### Method 2: Using Supabase CLI

If you're using Supabase CLI for migrations:

```bash
# Apply the migration
supabase db push

# Or reset and apply all migrations
supabase db reset
```

## Expected Output

After running the cleanup script, you should see output similar to:

```
✓ Sales data cleaned
✓ Payment data cleaned
✓ Customer data cleaned
✓ Batch data cleaned
✓ Inventory data cleaned
✓ Processing data cleaned
✓ Other transactional data cleaned
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
  • FX Rates: 1250
  • Gold Prices: 365

✓✓✓ DATABASE IS CLEAN AND READY FOR FRESH REGISTRATION! ✓✓✓
=============================================================================
```

## After Cleanup

### What You Can Do Immediately

1. **Create New Batches**
   - Batch numbers will start from scratch
   - First batch will be: `GN-2025-10-001` (or your site code)

2. **Register New Customers**
   - Customer IDs will start from 1
   - All customer data fresh

3. **Start New Sales**
   - Sales numbers will reset
   - Clean sales history

### What Remains Available

1. **Mining Companies** - All your suppliers are still there
2. **Refineries** - All refinery information preserved
3. **FX Rates** - Complete exchange rate history maintained
4. **Gold Prices** - All price history available for calculations
5. **User Accounts** - All users can still log in
6. **System Settings** - All configurations preserved

## Rollback Plan

### If You Need to Undo

Unfortunately, **this operation cannot be automatically rolled back**. However, you can:

1. **Restore from Backup** (if you created one before cleanup):
   ```sql
   -- Restore using your backup method
   ```

2. **Re-import Data** (if you have exports):
   - Use CSV imports for batches
   - Re-enter critical data manually

### Prevention

Before running cleanup in production:

1. **Create a Database Backup**
   ```bash
   # Using Supabase CLI
   supabase db dump -f backup_before_cleanup.sql
   ```

2. **Test on Development Environment First**
   - Run on a dev/staging database
   - Verify the results
   - Then run on production

## Troubleshooting

### Error: "relation does not exist"

**Cause:** A table mentioned in the script doesn't exist in your database.

**Solution:** This is normal and can be ignored. The script checks for table existence and only deletes if present.

### Error: "foreign key constraint violation"

**Cause:** The deletion order isn't respecting dependencies.

**Solution:** The script handles this by deleting in the correct order. If you still see this error:
1. Check if you have custom tables with foreign keys to these tables
2. Delete those custom table data first

### Script Takes Too Long

**Cause:** Large amount of data to delete.

**Solution:**
- Wait patiently (can take 5-10 minutes for large databases)
- Check Supabase dashboard for activity
- Consider deleting in smaller batches

## Safety Checklist

Before running the cleanup script:

- [ ] I have reviewed what will be deleted
- [ ] I have reviewed what will be preserved
- [ ] I understand this cannot be undone
- [ ] I have created a backup (if needed)
- [ ] I have tested on a dev environment (for production)
- [ ] I am ready to start with fresh data

## Support

If you encounter issues:

1. Check the error message carefully
2. Review the script output
3. Verify your database structure matches expectations
4. Contact your database administrator if needed

## Files Included

1. **`20251029000000_clean_transactional_data.sql`**
   - Migration file for Supabase CLI
   - Includes comprehensive documentation
   - Handles all edge cases

2. **`CLEAN_DATABASE.sql`**
   - Standalone script for SQL Editor
   - Simple and direct
   - Easy to copy-paste

3. **`DATABASE_CLEANUP_GUIDE.md`** (this file)
   - Complete instructions
   - Troubleshooting guide
   - Safety checklist

---

**Last Updated:** 2025-10-29
**Version:** 1.0.0
**Compatible With:** Gold Shipper v1.x
