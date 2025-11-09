# 🚀 FIX LICENSE MODULE - MIGRATIONS REQUIRED

## Problem
- License list is EMPTY
- Mining companies dropdown is EMPTY
- Console shows 400 Bad Request error

## Root Cause
Missing database migrations. The view `licenses_with_computed_fields` doesn't exist.

---

## SOLUTION: Apply 2 Migrations

### Migration 19: Create Tables & View
**File:** `supabase/migrations/20251108000000_create_export_license_system.sql`

### Migration 20: Insert Sample Data
**File:** `supabase/migrations/20251108100000_seed_license_sample_data.sql`

---

## STEP 1: Diagnostic

Copy and run in Supabase SQL Editor:

```sql
SELECT
  'Tables' as check_item,
  COUNT(*)::text as result
FROM information_schema.tables
WHERE table_name IN ('licenses', 'license_requests')

UNION ALL

SELECT
  'View' as check_item,
  COUNT(*) as result
FROM pg_views
WHERE viewname = 'licenses_with_computed_fields'

UNION ALL

SELECT
  'Mining Companies',
  COUNT(*)
FROM mining_companies
WHERE status = 'active';
```

---

## STEP 2: Apply Migration 19

1. Open: `supabase/migrations/20251108000000_create_export_license_system.sql`
2. CTRL+A (select all)
3. CTRL+C (copy)
4. Go to Supabase SQL Editor
5. CTRL+V (paste)
6. Click "RUN"
7. Wait 10 seconds

**Creates:** tables, view, RLS policies

---

## STEP 3: Apply Migration 20

1. Open: `supabase/migrations/20251108100000_seed_license_sample_data.sql`
2. Copy ALL
3. Paste in SQL Editor
4. Click "RUN"
5. Should see: "INSERT 0 10"

**Inserts:** 10 sample licenses

---

## STEP 4: Fix User Role

```sql
UPDATE user_profiles
SET role = 'management'
WHERE id = auth.uid();
```

---

## STEP 5: Verify

```sql
SELECT
  license_number,
  applicant_company_name,
  status,
  remaining_percentage
FROM licenses_with_computed_fields
LIMIT 3;
```

Should return 3 rows.

---

## STEP 6: Reload

1. Go to `/licenses`
2. Press F5
3. Should see 10 licenses + populated dropdown

---

## ✅ Checklist

- [ ] Migration 19 applied
- [ ] Migration 20 applied
- [ ] User role = management
- [ ] View returns data
- [ ] Page shows licenses
- [ ] Dropdown populated

