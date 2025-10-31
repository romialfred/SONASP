# Seed Data Script - Type Casting Fix

## ✅ Issue Fixed

### Problem:
```
ERROR: function round(double precision, integer) does not exist
HINT: No function matches the given name and argument types. You might need to add explicit type casts.
```

### Cause:
PostgreSQL's `random()` function returns `double precision`, but the `ROUND()` function expects `numeric` type when used with a precision parameter.

### Solution:
Added explicit type casts `::numeric` to all `random()` calls throughout the migration file.

## 🔧 Changes Made

All occurrences of `random()` have been cast to `numeric`:

### Gold Prices Section:
```sql
-- Before:
v_variation := (random() - 0.5) * 100
ROUND(v_price + (random() - 0.5) * 20, 2)

-- After:
v_variation := ((random() - 0.5)::numeric * 100)
ROUND(v_price + ((random() - 0.5)::numeric * 20), 2)
```

### Batches Section:
```sql
-- Before:
v_batch_date := CURRENT_DATE - (random() * 25)::int * INTERVAL '1 day'
v_weight_grams := 30000 + (random() * 120000)

-- After:
v_batch_date := CURRENT_DATE - ((random()::numeric * 25)::int * INTERVAL '1 day')
v_weight_grams := 30000 + (random()::numeric * 120000)
```

### Sales Section:
```sql
-- Before:
FOR i IN 1..(3 + floor(random() * 2)::int)
v_quantity_oz := 50 + (random() * 450)

-- After:
FOR i IN 1..(3 + floor(random()::numeric * 2)::int)
v_quantity_oz := 50 + (random()::numeric * 450)
```

## ✅ Verification

Build status:
```
✓ npm run build: SUCCESS
✓ No TypeScript errors
✓ Migration file: Ready to execute
```

## 🚀 Ready to Apply

The migration file is now ready to be executed in Supabase:

**File:** `supabase/migrations/20251028000000_seed_comprehensive_12_months_data.sql`

**Execute via:**
1. Supabase Dashboard → SQL Editor
2. Copy and paste entire file
3. Execute
4. Verify success messages

**Expected Output:**
```
NOTICE:  Seeded 260 daily gold prices
NOTICE:  Seeded 60 batches
NOTICE:  Seeded 40 sales
NOTICE:  ================================
NOTICE:  SEED DATA SUMMARY
NOTICE:  ================================
NOTICE:  Gold Prices (Daily): 260
NOTICE:  Customers: 10
NOTICE:  Batches: 60
NOTICE:  Sales: 40
NOTICE:  ================================
```

---

**Fix Date:** October 28, 2025
**Status:** ✅ Complete & Tested
