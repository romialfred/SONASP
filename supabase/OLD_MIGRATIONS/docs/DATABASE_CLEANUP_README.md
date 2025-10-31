# Database Cleanup Scripts - Quick Reference

## 📋 Available Scripts

### 1. `CHECK_DATABASE_STATUS.sql` - Check Current State
**Purpose:** See what data currently exists in your database

**Use this to:**
- Check how many records you have in each table
- See the latest activity dates
- Determine if cleanup is needed
- Verify cleanup was successful

**How to run:**
```sql
-- Copy and paste into Supabase SQL Editor, then click Run
```

**Output Example:**
```
TRANSACTIONAL DATA (Main Tables)
Batches:                    145
Customers:                  23
Sales:                      67
Payments:                   45
Gold Inventory:             89

REFERENCE DATA (Should Be Preserved)
Mining Companies:           5
Refineries:                 3
FX Rates:                   1250
Gold Prices:                365
```

---

### 2. `CLEAN_DATABASE.sql` - Clean Transactional Data (Standard Version)
**Purpose:** Delete all batches, sales, customers, inventory (keep stakeholders, FX rates, gold prices)

**Use this when:**
- Your database has all the expected tables
- You want faster execution
- You're confident about table structure

**How to run:**
```sql
-- Copy and paste into Supabase SQL Editor, then click Run
-- Wait 1-2 minutes for completion
```

**What it does:**
1. ✅ Deletes ALL batches and related data
2. ✅ Deletes ALL inventory records
3. ✅ Deletes ALL sales and payments
4. ✅ Deletes ALL customers
5. ✅ Resets auto-increment counters
6. ✅ Keeps stakeholders and reference data
7. ✅ Shows confirmation summary

**✅ FIXED:** All RAISE NOTICE statements are now properly wrapped in DO $$ blocks

---

### 3. `CLEAN_DATABASE_SAFE.sql` - Clean Transactional Data (Safe Version)
**Purpose:** Same as CLEAN_DATABASE.sql but checks if tables exist before deleting

**Use this when:**
- You're not sure which tables exist
- You have a customized database schema
- You want to avoid errors from missing tables
- You're testing the cleanup process

**How to run:**
```sql
-- Copy and paste into Supabase SQL Editor, then click Run
-- Wait 1-2 minutes for completion
```

**Advantages:**
- ✅ No errors if tables don't exist
- ✅ Shows exactly how many rows deleted from each table
- ✅ Counts deleted rows and tables
- ✅ Handles missing tables gracefully

**⭐ Recommended for first-time use!**

---

### 4. `20251029000000_clean_transactional_data.sql` - Migration Version
**Purpose:** Same as CLEAN_DATABASE.sql but as a Supabase migration

**Use this when:**
- Using Supabase CLI
- Managing database with migrations
- Deploying to multiple environments

**How to run:**
```bash
supabase db push
# Or
supabase db reset
```

---

## 🚀 Quick Start Guide

### Step 1: Check Current State
```sql
-- Run CHECK_DATABASE_STATUS.sql
-- Review the output
-- Note how many records exist
```

### Step 2: Decide If Cleanup Is Needed
- **If you have test data:** Clean it
- **If starting fresh:** Clean everything
- **If in production with real data:** Make a backup first!

### Step 3: (Optional) Create Backup
```bash
# Using Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql
```

### Step 4: Run Cleanup
```sql
-- Run CLEAN_DATABASE.sql
-- Wait for completion
-- Check the success messages
```

### Step 5: Verify Results
```sql
-- Run CHECK_DATABASE_STATUS.sql again
-- Verify transactional tables show 0
-- Verify reference tables still have data
```

---

## 📊 What Gets Deleted vs Preserved

### ❌ DELETED (Transactional Data)

| Category | Tables | Why Delete |
|----------|--------|------------|
| **Batches** | batches, batch_approvals, batch_documents, batch_status_history, etc. | Start fresh with new batch numbers |
| **Customers** | customers, customer_contracts, customer_fx_rates | Register new customers |
| **Sales** | sales, sales_line_items, sales_approvals, sales_commissions, etc. | New sales records |
| **Payments** | payments, payment_history, payment_documents, payment_reminders | New payment records |
| **Inventory** | gold_inventory, inventory_transactions | Fresh inventory tracking |
| **Processing** | receiving_records, refining_records, transportation_details | New processing records |

### ✅ PRESERVED (Reference Data)

| Category | Tables | Why Keep |
|----------|--------|----------|
| **Stakeholders** | mining_companies, refineries, freight_companies | Your business partners |
| **Market Data** | fx_rates, gold_prices | Historical data for calculations |
| **Configuration** | user_profiles, roles, permissions, system_parameters | System setup |
| **Locations** | sites | Your operational locations |

---

## ⚠️ Important Notes

### Before Running Cleanup

1. **Understand the Impact**
   - All batches will be deleted (cannot undo)
   - All customers will be deleted
   - All sales and payment history will be deleted
   - Batch numbers will start from 001 again

2. **Check Dependencies**
   - Export any reports you need
   - Save any data you might reference later
   - Inform team members about the cleanup

3. **Consider Timing**
   - Run during off-hours if in production
   - Ensure no active users during cleanup
   - Plan for 2-5 minutes of execution time

### After Running Cleanup

1. **Verify Success**
   - Run status check script
   - Confirm transactional tables are empty
   - Confirm reference data still exists

2. **Test Basic Operations**
   - Create a test batch
   - Verify batch number starts at 001
   - Test one complete workflow

3. **Monitor System**
   - Check for any errors
   - Verify users can still log in
   - Test all major features

---

## 🔍 Troubleshooting

### "Permission Denied" Error
**Solution:** Make sure you're connected as a superuser or database owner

### Script Takes Too Long
**Solution:** This is normal for large databases. Wait up to 5 minutes.

### "Table Does Not Exist" Error
**Solution:** This is fine - the script checks for table existence. Ignore these notices.

### Some Records Still Remain
**Solution:**
1. Check if you have custom tables with foreign keys
2. Run the status check to see which tables have data
3. Manually delete those tables' data first, then re-run cleanup

---

## 📞 Need Help?

### Common Questions

**Q: Will this delete my user accounts?**
A: No, user accounts are preserved.

**Q: Will FX rates be deleted?**
A: No, all FX rate history is preserved.

**Q: Will gold price history be deleted?**
A: No, all gold price data is preserved.

**Q: Can I undo this?**
A: Only if you have a backup. Otherwise, no.

**Q: How long does it take?**
A: Usually 1-2 minutes, up to 5 minutes for large databases.

**Q: Will this affect my mining companies?**
A: No, all stakeholder data is preserved.

---

## 📁 File Reference

```
project/
├── CHECK_DATABASE_STATUS.sql           # Check current database state
├── CLEAN_DATABASE.sql                  # Main cleanup script
├── DATABASE_CLEANUP_GUIDE.md          # Detailed instructions
├── DATABASE_CLEANUP_README.md         # This quick reference
└── supabase/migrations/
    └── 20251029000000_clean_transactional_data.sql  # Migration version
```

---

## ✅ Safety Checklist

Before running cleanup in production:

- [ ] I have reviewed what will be deleted
- [ ] I have reviewed what will be preserved
- [ ] I have created a database backup
- [ ] I have tested on a development environment
- [ ] I have informed my team
- [ ] I have chosen an appropriate time
- [ ] I understand this cannot be undone
- [ ] I am ready to proceed

---

## 📁 File Reference

```
project/
├── CHECK_DATABASE_STATUS.sql           # Check current database state
├── CLEAN_DATABASE.sql                  # Standard cleanup script (FIXED)
├── CLEAN_DATABASE_SAFE.sql            # Safe cleanup with table checks (NEW!)
├── DATABASE_CLEANUP_GUIDE.md          # Detailed instructions
├── DATABASE_CLEANUP_README.md         # This quick reference
└── supabase/migrations/
    └── 20251029000000_clean_transactional_data.sql  # Migration version
```

---

**Created:** 2025-10-29
**Version:** 2.0.0 (Fixed RAISE NOTICE syntax errors)
**For:** Gold Shipper Database Cleanup
**Status:** ✅ All Scripts Working Correctly
