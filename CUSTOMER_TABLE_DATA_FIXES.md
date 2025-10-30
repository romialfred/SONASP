# Customer Table Data Diagnostic and Fixes

## Problem: $NaN and Unknown Status Still Displaying

After previous fixes, the Customer Directory still shows:
- **TOTAL SPENT**: `$NaN`
- **STATUS**: `Unknown`

This indicates a **database data issue**, not just a code issue.

---

## Step 1: Run Diagnostic Queries

Copy and run these queries in **Supabase SQL Editor** to diagnose the problem:

### Query 1: Check Customers Table Structure
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

**What to look for:**
- Is `status` column present?
- What is its data type?
- Does it allow NULL?

### Query 2: Check Actual Customer Data
```sql
SELECT
  id,
  name,
  email,
  country,
  status,
  created_at
FROM customers
ORDER BY name;
```

**What to look for:**
- Are `status` values NULL?
- Are they valid ('active', 'inactive', 'pending')?
- Do all 3 customers exist (Auramet, Mansa Resources, StoneX)?

### Query 3: Check Status Distribution
```sql
SELECT
  status,
  COUNT(*) as count
FROM customers
GROUP BY status;
```

**Expected:**
- Each status should be one of: 'active', 'inactive', 'pending'
- No NULL values

**If you see NULL or other values → This is the problem!**

### Query 4: Check Sales Table Data
```sql
SELECT
  COUNT(*) as total_sales,
  COUNT(DISTINCT customer_id) as customers_with_sales,
  SUM(CASE WHEN customer_id IS NULL THEN 1 ELSE 0 END) as sales_without_customer,
  SUM(CASE WHEN final_proceeds IS NULL THEN 1 ELSE 0 END) as sales_without_proceeds
FROM sales;
```

**What to look for:**
- Are there any sales records?
- Do they have valid customer_id?
- Do they have final_proceeds values?

### Query 5: Check Customer-Sales Relationship
```sql
SELECT
  c.name as customer_name,
  c.status as customer_status,
  COUNT(s.id) as sale_count,
  SUM(s.final_proceeds) as total_proceeds,
  AVG(s.final_proceeds) as avg_proceeds
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
GROUP BY c.id, c.name, c.status
ORDER BY c.name;
```

**What to look for:**
- Do customers have sales?
- Are the totals calculating correctly?
- Are the final_proceeds values numeric?

---

## Step 2: SQL Quick Fix Script - RUN THIS

Run this all-in-one script to apply all fixes:

```sql
-- ========================================
-- CUSTOMER DATA FIX - ALL IN ONE
-- ========================================

-- 1. Fix NULL or invalid status values
UPDATE customers
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'inactive', 'pending');

-- 2. Ensure key customers exist
INSERT INTO customers (name, email, country, status)
VALUES
  ('Auramet International', 'trading@auramet.com', 'United States', 'active'),
  ('StoneX Group Inc.', 'metals@stonex.com', 'United States', 'active'),
  ('Mansa Resources SA', 'infos@mansaresources.com', 'Ivory Coast', 'active')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  status = EXCLUDED.status;

-- 3. Fix NULL final_proceeds in sales
UPDATE sales
SET final_proceeds = 0
WHERE final_proceeds IS NULL;

-- 4. Verification - Should show all valid data
SELECT
  c.name,
  c.status,
  COUNT(s.id) as sales_count,
  COALESCE(SUM(s.final_proceeds), 0)::numeric(10,2) as total_spent
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
GROUP BY c.id, c.name, c.status
ORDER BY c.name;

-- Expected: All statuses should be 'active', all numbers should be numeric
```

---

## Step 3: Clear Cache and Test

After running the SQL:

1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Hard refresh**: Ctrl+F5
3. **Check console**: Open F12 DevTools
4. **Navigate to**: `/customers`

### What You Should See in Console:

```javascript
Fetched customers: [
  {id: "...", name: "Auramet International", status: "active", ...}
]
Customer Auramet International: {
  rawStatus: "active",
  validStatus: "active",
  totalPurchases: 0,
  rawTotalSpent: 0,
  finalTotalSpent: 0,
  paymentRate: 0
}
```

### What You Should See in UI:

| Column | Before ❌ | After ✅ |
|--------|----------|----------|
| STATUS | Unknown | Active |
| TOTAL SPENT | $NaN | $0.00 |
| PAYMENT RATE | NaN% | 0.0% |

---

## Troubleshooting

### Still Showing Unknown?

**Check console for:**
```javascript
Customer X: { rawStatus: null, ... }
```

**Fix:**
```sql
-- Force update ALL customers
UPDATE customers SET status = 'active';
SELECT name, status FROM customers;
```

### Still Showing $NaN?

**Check console for:**
```javascript
⚠️ Customer X has 5 sales but totalSpent is 0
```

**Check sales data:**
```sql
SELECT id, customer_id, final_proceeds, pg_typeof(final_proceeds)
FROM sales
WHERE customer_id = (SELECT id FROM customers WHERE name = 'Customer X');
```

**If final_proceeds is text type:**
```sql
-- Convert to numeric (careful!)
ALTER TABLE sales
ALTER COLUMN final_proceeds TYPE numeric
USING CASE
  WHEN final_proceeds ~ '^[0-9.]+$' THEN final_proceeds::numeric
  ELSE 0
END;
```

---

## Summary

✅ **Files Modified:**
- CustomerListing.tsx - Added debug logs
- CUSTOMER_TABLE_DATA_FIXES.md - This file

✅ **SQL to Run:**
- Run the "SQL Quick Fix Script" above in Supabase SQL Editor

✅ **Expected Result:**
- All customers show valid status
- All amounts show as numbers (not NaN)
- Console logs show valid data

**After running SQL and clearing cache, Customer Directory should work!** ✅
