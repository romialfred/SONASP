# Migration Execution Order - Gold Shipper Platform

## Important: Execute in This Exact Order

### ✅ Prerequisites
- Supabase project created and accessible
- Access to Supabase SQL Editor
- Backup of existing data (if any)

---

## 🔧 Core Schema Fixes (Execute First)

### 1. Fix Customers Table
**File:** `supabase/migrations/20251027160000_fix_customers_table_add_missing_columns.sql`

**What it does:**
- Adds `is_active` boolean column
- Adds `company` text column
- Updates existing customer records
- Creates performance indexes

**Why it's needed:**
- FX Analysis dropdown requires `is_active` column
- Customer listings use `company` field

**Fixes applied:**
- ✅ Fixed RAISE NOTICE syntax (wrapped in DO $$ block)

**Status:** ✅ FULLY FIXED - Ready to execute

---

### 2. Enhance Batches Table
**File:** `supabase/migrations/20251027170000_enhance_batches_table_comprehensive.sql`

**What it does:**
- Adds `metal_type` column (gold, silver, zinc, diamond, other)
- Adds `mine_to_airport_transport_id` foreign key
- Adds `airport_to_refinery_transport_id` foreign key
- Adds `destination_refinery_id` foreign key
- Adds `documents` JSONB column
- Adds `updated_by` user reference
- Creates `batch_details_enhanced` view with correct column mappings
- Creates performance indexes

**Why it's needed:**
- Batch creation form sends these fields
- Complete workflow tracking requires all transport stages
- Document attachments support
- Enhanced view for complete batch details with all relationships

**Fixes applied:**
- ✅ Fixed sites table column references (`location` → `address`, `type` → `site_type`)
- ✅ Fixed RAISE NOTICE syntax (wrapped in DO $$ block)

**Status:** ✅ FULLY FIXED - Ready to execute

---

## 📊 Test Data (Execute Second)

### 3. Add Customers and FX Transaction Data
**File:** `supabase/migrations/20251027180000_add_comprehensive_test_data_customers_fx.sql`

**What it does:**
- Inserts 6 international customers with complete profiles
- Adds 18 FX transactions spanning Aug-Oct 2024
- Creates realistic rate scenarios (good/bad/excellent/poor)
- Links transactions to ECB and Revolut rates

**Data added:**
- Auramet Trading LLC (USA) - 3 transactions
- Emirates Gold DMCC (UAE) - 4 transactions
- Swiss Gold Traders SA (Switzerland) - 3 transactions
- African Precious Metals (Côte d'Ivoire) - 3 transactions
- London Bullion Ltd (UK) - 3 transactions
- Hong Kong Metals Exchange (Hong Kong) - 2 transactions

**Why it's needed:**
- FX Analysis requires customer selection and transaction data
- Testing rate comparison and opportunity cost calculations

**Status:** ✅ Ready to execute

---

### 4. Add Complete Platform Test Data
**File:** `supabase/migrations/20251027190000_add_complete_platform_test_data.sql`

**What it does:**
- Adds 65+ days of gold prices (Aug-Oct 2024)
- Creates 4 operational sites (mines + airports)
- Inserts 7 batches at various workflow stages
- Adds 2 sales transactions (1 completed, 1 pending)
- Creates sample notifications
- Ensures all transport companies and refineries are active

**Data coverage:**
- Sites: Conakry Mine, Siguiri Mine, Conakry Airport, Abidjan Airport
- Batches: Created → Shipped → Airport → Refinery → Processing → Ready for Sale
- Sales: Completed with payment, Pending approval
- Gold prices: Daily London AM/PM rates

**Why it's needed:**
- Complete end-to-end testing without manual data entry
- Dashboard displays real metrics
- All modules have working data

**Fixes applied:**
- ✅ Fixed sites table column references (`location` → `address`, `type` → `site_type`)
- ✅ Fixed country codes ('Guinea' → 'GN', 'Côte d'Ivoire' → 'CI')
- ✅ Fixed RAISE NOTICE syntax (wrapped in DO $$ block)
- ✅ Fixed ON CONFLICT error on sites (changed to IF NOT EXISTS pattern)
- ✅ Fixed gold_prices_daily column names (`london_am_usd` → `london_am_rate`, etc.)
- ✅ Fixed batch status constraint violation ('shipped' → 'validated_for_transport')
- ✅ Fixed NULL customer_id violation (added existence checks before sales insertion)
- ✅ Fixed SQL quote escaping (`Côte d\'Ivoire` → `Côte d''Ivoire`)
- ✅ Fixed NULL rate_paid violation in Migration 3 (added COALESCE for all FX rates)

**Status:** ✅ FULLY FIXED - Ready to execute

---

## 📝 Execution Steps

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Execute Migration 1
```sql
-- Copy and paste entire content of:
-- 20251027160000_fix_customers_table_add_missing_columns.sql
```
- Click "Run" or press `Ctrl+Enter`
- Wait for success message: "Added is_active column..." and "Customers table schema updated successfully"

### Step 3: Execute Migration 2
```sql
-- Copy and paste entire content of:
-- 20251027170000_enhance_batches_table_comprehensive.sql
```
- Click "Run"
- Wait for success message: "Batches table enhanced successfully..."

### Step 4: Execute Migration 3
```sql
-- Copy and paste entire content of:
-- 20251027180000_add_comprehensive_test_data_customers_fx.sql
```
- Click "Run"
- Wait for success message: "Added 6 customers with 18 FX transactions..."

### Step 5: Execute Migration 4
```sql
-- Copy and paste entire content of:
-- 20251027190000_add_complete_platform_test_data.sql
```
- Click "Run"
- Wait for success messages showing:
  - "Added 65+ days of gold prices"
  - "Added 7 batches at various workflow stages"
  - "Added 2 sales transactions"
  - Complete summary report

---

## ✅ Verification Steps

After running all migrations, verify the data:

### Check Customers
```sql
SELECT id, name, company, email, country, is_active
FROM customers
WHERE is_active = true
ORDER BY name;
```
**Expected:** 6 rows

### Check Customer FX Rates
```sql
SELECT
  c.name as customer,
  COUNT(*) as transaction_count,
  MIN(cfr.transaction_date) as first_transaction,
  MAX(cfr.transaction_date) as last_transaction
FROM customer_fx_rates cfr
JOIN customers c ON cfr.customer_id = c.id
GROUP BY c.name
ORDER BY c.name;
```
**Expected:** 6 customers with transaction counts

### Check Batches
```sql
SELECT batch_number, status, metal_type, weight_grams,
       destination_refinery_id IS NOT NULL as has_refinery
FROM batches
ORDER BY created_at DESC
LIMIT 10;
```
**Expected:** 7+ batches with various statuses

### Check Gold Prices
```sql
SELECT COUNT(*) as price_days,
       MIN(price_date) as first_date,
       MAX(price_date) as last_date,
       AVG(london_am_usd) as avg_price
FROM gold_prices_daily;
```
**Expected:** 65+ days, avg ~$2500/oz

### Check Sales
```sql
SELECT sale_number, status, quantity_oz,
       c.name as customer_name
FROM sales s
JOIN customers c ON s.customer_id = c.id
ORDER BY created_at DESC;
```
**Expected:** 2 sales

---

## 🚀 Post-Migration Testing

### Test 1: FX Rate Analysis
1. Navigate to `/prices/fx-rates`
2. Click "FX Rate Analysis" tab
3. Select customer from dropdown (should show 6 customers)
4. Set dates: 2024-08-01 to 2024-10-31
5. Click "Run Analysis"
6. Verify transaction table appears with data

### Test 2: Batch Creation
1. Navigate to `/batches/new`
2. Observe field guide panel on right
3. Click on any field → Guide shows details
4. Fill form with any values
5. Submit → Should create successfully

### Test 3: Dashboard
1. Navigate to `/dashboard`
2. Observe metrics with real data
3. Check activity feed
4. Verify charts display properly

### Test 4: Customers List
1. Navigate to `/customers`
2. Verify 6 customers appear
3. Click on a customer
4. View profile and transaction history

---

## 🔄 Rollback (If Needed)

If you need to undo changes:

```sql
-- Rollback customers changes
ALTER TABLE customers DROP COLUMN IF EXISTS is_active;
ALTER TABLE customers DROP COLUMN IF EXISTS company;

-- Rollback batches changes
ALTER TABLE batches DROP COLUMN IF EXISTS metal_type;
ALTER TABLE batches DROP COLUMN IF EXISTS mine_to_airport_transport_id;
ALTER TABLE batches DROP COLUMN IF EXISTS airport_to_refinery_transport_id;
ALTER TABLE batches DROP COLUMN IF EXISTS destination_refinery_id;
ALTER TABLE batches DROP COLUMN IF EXISTS documents;
ALTER TABLE batches DROP COLUMN IF EXISTS updated_by;

-- Remove test data
DELETE FROM customer_fx_rates WHERE transaction_date >= '2024-08-01';
DELETE FROM batches WHERE batch_number LIKE 'GN-2024%';
DELETE FROM sales WHERE sale_number LIKE 'SL-2024%';
DELETE FROM gold_prices_daily WHERE price_date >= '2024-08-01';
```

---

## 📊 Migration Summary

| # | Migration File | Purpose | Status |
|---|----------------|---------|--------|
| 1 | `20251027160000_fix_customers_table_add_missing_columns.sql` | Add is_active, company columns | ✅ Fixed |
| 2 | `20251027170000_enhance_batches_table_comprehensive.sql` | Add transport, refinery, metal_type columns | ✅ Fixed |
| 3 | `20251027180000_add_comprehensive_test_data_customers_fx.sql` | 6 customers + 18 FX transactions | ✅ Ready |
| 4 | `20251027190000_add_complete_platform_test_data.sql` | Gold prices, batches, sales, sites | ✅ Fixed |

**Total Data Added:**
- 6 active customers
- 18 FX transactions
- 65+ gold price records
- 7 batches
- 2 sales
- 4 sites
- Sample notifications

---

## ✨ Success Criteria

After executing all migrations, you should be able to:

- ✅ Select customers in FX Analysis dropdown
- ✅ View FX transactions for all 6 customers
- ✅ Create new batches with complete workflow
- ✅ See populated dashboard with real data
- ✅ Browse 7 batches at different stages
- ✅ View customer profiles and histories
- ✅ See 65+ days of gold prices
- ✅ Test all platform features without manual data entry

**Platform Status: FULLY TESTABLE** 🎉
