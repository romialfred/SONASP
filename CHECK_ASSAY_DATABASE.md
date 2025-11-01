# 🔍 ASSAY CERTIFICATES DATABASE VERIFICATION

Run these SQL queries in Supabase SQL Editor to verify everything is set up correctly.

---

## ✅ STEP 1: Check Tables Exist

```sql
-- Check if all 3 tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) 
   FROM information_schema.columns 
   WHERE table_schema = 'public' 
     AND table_name = t.table_name) as column_count
FROM (
  VALUES 
    ('assay_certificates'),
    ('assay_certificate_data'),
    ('certificate_approvals')
) AS t(table_name)
WHERE EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name = t.table_name
);
```

**Expected Result:**
```
assay_certificates       → 30 columns (if FIX_ASSAY_SCHEMA.sql applied)
                         → 18 columns (if only base migration applied)
assay_certificate_data   → 35 columns
certificate_approvals    → 7 columns
```

---

## ✅ STEP 2: Check Storage Bucket

```sql
-- Check if assay-certificates bucket exists
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name = 'assay-certificates';
```

**Expected Result:**
```
name: assay-certificates
public: false
file_size_limit: 10485760 (10MB)
allowed_mime_types: ["application/pdf"]
```

---

## ✅ STEP 3: Check RLS Policies on Tables

```sql
-- Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%assay%'
ORDER BY tablename;
```

**Expected Result:**
All tables should have `rls_enabled = true`

```sql
-- List all policies on assay tables
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE '%assay%'
ORDER BY tablename, policyname;
```

**Expected Result:**
At least 7 policies across the 3 tables.

---

## ✅ STEP 4: Check Storage Policies

```sql
-- Check storage policies for assay-certificates bucket
SELECT 
  policyname,
  cmd,
  definition
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%'
ORDER BY policyname;
```

**Expected Result:**
4 policies (INSERT, SELECT, UPDATE, DELETE)

---

## ✅ STEP 5: Check Column Details

```sql
-- Check assay_certificates columns (should have 30 after fix)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assay_certificates'
ORDER BY ordinal_position;
```

**Critical Columns to Verify:**
- `id` (uuid)
- `batch_id` (uuid)
- `file_path` (text)
- `file_name` (text)
- `parsing_status` (text)
- `approval_status` (text)
- `sample_id` (text) ← Should exist after fix
- `gold_content_ppm` (numeric) ← Should exist after fix
- `silver_content_ppm` (numeric) ← Should exist after fix

---

## ✅ STEP 6: Check Functions Exist

```sql
-- Check helper functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%certificate%'
ORDER BY routine_name;
```

**Expected Result:**
- `get_batch_certificates` (function)
- `get_certificate_with_data` (function)

---

## ⚠️ STEP 7: Identify Missing Columns

```sql
-- Check which summary columns exist
SELECT 
  column_name,
  CASE 
    WHEN column_name IN (
      'sample_id',
      'sample_weight_grams',
      'gold_content_ppm',
      'gold_content_gpt',
      'gold_content_percent',
      'silver_content_ppm',
      'silver_content_gpt',
      'silver_content_percent',
      'platinum_content_ppm',
      'palladium_content_ppm',
      'fineness',
      'purity_percent'
    ) THEN '✅ Summary Column'
    ELSE '📋 Base Column'
  END as column_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assay_certificates'
ORDER BY 
  CASE WHEN column_type = '✅ Summary Column' THEN 1 ELSE 2 END,
  column_name;
```

**If you see ONLY base columns:**
→ You need to apply `FIX_ASSAY_SCHEMA.sql`

**If you see all 12 summary columns:**
→ Perfect! You're all set!

---

## 🎯 STEP 8: Test Upload Capability (After Fix Applied)

```sql
-- Verify user can insert (check permissions)
-- This will NOT actually insert, just check if you have permission
EXPLAIN (FORMAT JSON)
INSERT INTO assay_certificates (
  batch_id,
  file_path,
  file_name,
  file_size,
  mime_type,
  parsing_status,
  approval_status
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'test',
  'test.pdf',
  1024,
  'application/pdf',
  'pending',
  'pending'
);
```

**Expected Result:**
Should show execution plan (no permission error)

---

## 📊 STEP 9: Complete Status Report

```sql
-- Generate complete status report
SELECT 
  'Tables' as category,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ Complete'
    ELSE '❌ Missing Tables'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('assay_certificates', 'assay_certificate_data', 'certificate_approvals')

UNION ALL

SELECT 
  'Storage Bucket',
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ Complete'
    ELSE '❌ Missing Bucket'
  END
FROM storage.buckets
WHERE name = 'assay-certificates'

UNION ALL

SELECT 
  'Table Policies',
  COUNT(*),
  CASE 
    WHEN COUNT(*) >= 7 THEN '✅ Complete'
    ELSE '⚠️ Missing Policies'
  END
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE '%assay%'

UNION ALL

SELECT 
  'Storage Policies',
  COUNT(*),
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ Complete'
    ELSE '⚠️ Missing Policies'
  END
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%'

UNION ALL

SELECT 
  'Helper Functions',
  COUNT(*),
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ Complete'
    ELSE '⚠️ Missing Functions'
  END
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%certificate%';
```

---

## 🎉 SUCCESS CRITERIA

All checks should show:
- ✅ Tables: 3 tables with correct column counts
- ✅ Storage: 1 bucket with correct config
- ✅ Policies: 11+ total policies (7 table + 4 storage)
- ✅ Functions: 2 helper functions
- ✅ RLS: Enabled on all tables
- ✅ Columns: 30 columns in assay_certificates (after fix)

---

## 🆘 IF SOMETHING IS MISSING

### Missing Tables or Columns:
→ Apply `APPLY_ASSAY_MIGRATION_NOW.sql` (base)
→ Then apply `FIX_ASSAY_SCHEMA.sql` (fix)

### Missing Storage Bucket:
→ Already created in base migration
→ Check: `SELECT * FROM storage.buckets WHERE name = 'assay-certificates'`

### Missing Policies:
→ Run base migration again (safe with IF NOT EXISTS checks)

### Column Count is 18 instead of 30:
→ Apply `FIX_ASSAY_SCHEMA.sql` now!

